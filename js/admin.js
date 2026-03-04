import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  getDoc,
  setDoc,
  orderBy,
  query,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== CONFIG =====
// Change this password before deploying!
const ADMIN_PASSWORD = "12345";

// ===== CONSTANTS =====
const TEAM_COLORS = [
  "#e94560", "#4fc3f7", "#81c784", "#ffb74d",
  "#ce93d8", "#80cbc4", "#ff8a65", "#f9a825", "#90caf9", "#ef9a9a",
];
const TEAM_NAMES = [
  "Lag 1","Lag 2","Lag 3","Lag 4","Lag 5",
  "Lag 6","Lag 7","Lag 8","Lag 9","Lag 10",
];

// ===== STATE =====
let players = [];        // Array of { id, name, quizScore, liveScore }
let pendingChanges = {}; // { userId: deltaLiveScore }
let currentMode  = "leaderboard";
let currentTeams = [];
let selectedTeamCount = 2;

// ===== DOM REFS =====
const screenAuth = document.getElementById("screen-auth");
const screenAdmin = document.getElementById("screen-admin");
const passwordInput = document.getElementById("admin-password");
const btnLogin = document.getElementById("btn-login");
const authError = document.getElementById("auth-error");

const btnPush = document.getElementById("btn-push");
const btnRefresh = document.getElementById("btn-refresh");
const pendingBadge = document.getElementById("pending-badge");
const statusBar = document.getElementById("status-bar");
const searchInput = document.getElementById("search-input");
const playerTotalEl = document.getElementById("player-total");
const tableBody = document.getElementById("users-table-body");
const loadingOverlay = document.getElementById("loading-overlay");

const addPlayerForm  = document.getElementById("add-player-form");
const addPlayerInput = document.getElementById("add-player-name");
const btnAddPlayer   = document.getElementById("btn-add-player");
const addPlayerError = document.getElementById("add-player-error");

const teamSetupEl      = document.getElementById("team-setup");
const teamActiveEl     = document.getElementById("team-active");
const teamPreviewGrid  = document.getElementById("team-preview-grid");
const teamAwardCards   = document.getElementById("team-award-cards");
const btnStartTeam     = document.getElementById("btn-start-team");

// ===== SCREEN MANAGEMENT =====
function showScreen(name) {
  if (screenAuth) screenAuth.classList.toggle("active", name === "auth");
  if (screenAdmin) screenAdmin.classList.toggle("active", name === "admin");
}

// ===== AUTH =====
if (btnLogin) {
  btnLogin.addEventListener("click", tryLogin);
}
if (passwordInput) {
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
}

function tryLogin() {
  const pw = passwordInput ? passwordInput.value : "";
  if (pw === ADMIN_PASSWORD) {
    authError && (authError.textContent = "");
    localStorage.setItem("bgAuth", "1");
    showScreen("admin");
    loadPlayers();
  } else {
    if (authError) authError.textContent = "Feil passord. Prøv igjen.";
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.focus();
    }
  }
}

// ===== LOAD PLAYERS =====
async function loadPlayers() {
  setLoading(true);
  hideStatus();

  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(query(usersRef, orderBy("quizScore", "desc")));

    players = snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Unknown",
      quizScore: d.data().quizScore || 0,
      liveScore: d.data().liveScore || 0,
    }));

    pendingChanges = {};
    renderTable(players);
    updatePendingBadge();
    updateTeamModeUI();
  } catch (err) {
    console.error("Load error:", err);
    showStatus("Klarte ikke å laste spillere. Sjekk Firebase-konfigurasjonen.", "error");
  } finally {
    setLoading(false);
  }
}

// ===== RENDER TABLE =====
function renderTable(data) {
  if (playerTotalEl) playerTotalEl.textContent = `${data.length} spiller${data.length !== 1 ? "e" : ""}`;

  if (!tableBody) return;

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="table-empty">
            <span class="icon">👥</span>
            Ingen spillere registrert ennå. Legg til én ovenfor!
          </div>
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = data.map((player, idx) => {
    const delta = pendingChanges[player.id] || 0;
    const displayLive = player.liveScore + delta;
    const hasDelta = delta !== 0;
    const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "";

    return `
      <tr class="${hasDelta ? "has-changes" : ""}" data-id="${player.id}">
        <td class="td-rank">#${idx + 1}</td>
        <td class="td-name">${escapeHtml(player.name)}</td>
        <td class="td-quiz-score">${player.quizScore.toLocaleString()}</td>
        <td class="td-live-score">
          <span class="live-score-display">${displayLive.toLocaleString()}</span>
          ${hasDelta ? `<span class="change-indicator"> (${deltaLabel})</span>` : ""}
        </td>
        <td class="td-controls">
          <div class="score-controls">
            <button class="score-btn plus" data-id="${player.id}" data-delta="3">+3</button>
            <button class="score-btn plus" data-id="${player.id}" data-delta="1">+1</button>
            <button class="score-btn minus" data-id="${player.id}" data-delta="-1">−1</button>
            <div class="custom-input-wrap">
              <input type="number" class="custom-score-input" data-id="${player.id}" placeholder="0" />
              <button class="score-btn apply" data-id="${player.id}">Ok</button>
            </div>
          </div>
        </td>
        <td class="td-delete">
          <button class="btn-delete-player" data-id="${player.id}" data-name="${escapeHtml(player.name)}">✕</button>
        </td>
      </tr>`;
  }).join("");

  // Attach button events
  tableBody.querySelectorAll(".score-btn[data-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyDelta(btn.dataset.id, parseInt(btn.dataset.delta));
    });
  });

  tableBody.querySelectorAll(".score-btn.apply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = tableBody.querySelector(`.custom-score-input[data-id="${id}"]`);
      const val = input ? parseInt(input.value) : 0;
      if (!isNaN(val) && val !== 0) {
        applyDelta(id, val);
        if (input) input.value = "";
      }
    });
  });

  // Allow Enter key on custom inputs
  tableBody.querySelectorAll(".custom-score-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const id = input.dataset.id;
        const val = parseInt(input.value);
        if (!isNaN(val) && val !== 0) {
          applyDelta(id, val);
          input.value = "";
        }
      }
    });
  });

  // Delete player buttons
  tableBody.querySelectorAll(".btn-delete-player").forEach((btn) => {
    btn.addEventListener("click", () => deletePlayer(btn.dataset.id, btn.dataset.name));
  });
}

// ===== APPLY DELTA =====
function applyDelta(playerId, delta) {
  if (!pendingChanges[playerId]) pendingChanges[playerId] = 0;
  pendingChanges[playerId] += delta;

  // Prevent going below 0
  const player = players.find((p) => p.id === playerId);
  if (player) {
    const resultScore = player.liveScore + pendingChanges[playerId];
    if (resultScore < 0) {
      pendingChanges[playerId] = -player.liveScore;
    }
  }

  // Re-render only the affected row to preserve other inputs
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
  renderTable(filtered);
  updatePendingBadge();
}

// ===== PUSH TO FIRESTORE =====
if (btnPush) {
  btnPush.addEventListener("click", pushChanges);
}

async function pushChanges() {
  const changedIds = Object.keys(pendingChanges).filter((id) => pendingChanges[id] !== 0);

  if (changedIds.length === 0) {
    showStatus("Ingen endringer å pushe.", "error");
    return;
  }

  if (btnPush) btnPush.disabled = true;
  hideStatus();

  try {
    const batch = writeBatch(db);

    // Update each player's liveScore
    changedIds.forEach((id) => {
      const delta = pendingChanges[id];
      const player = players.find((p) => p.id === id);
      if (!player) return;

      const newScore = Math.max(0, player.liveScore + delta);
      batch.update(doc(db, "users", id), { liveScore: newScore });

      // Update local state
      player.liveScore = newScore;
    });

    // Increment leaderboard version
    const metaRef = doc(db, "meta", "leaderboard");
    batch.set(metaRef, { version: increment(1) }, { merge: true });

    await batch.commit();

    pendingChanges = {};
    updatePendingBadge();

    // Re-render with fresh data
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
    renderTable(filtered);

    showStatus(`${changedIds.length} oppdatering${changedIds.length !== 1 ? "er" : ""} lagt til resultattavlen!`, "success");
  } catch (err) {
    console.error("Push error:", err);
    showStatus("Klarte ikke å pushe endringer. Sjekk tilkoblingen din.", "error");
  } finally {
    if (btnPush) btnPush.disabled = false;
  }
}

// ===== REFRESH =====
if (btnRefresh) {
  btnRefresh.addEventListener("click", () => {
    if (Object.values(pendingChanges).some((d) => d !== 0)) {
      if (!confirm("Du har ulagrede endringer. Oppdatere likevel?")) return;
    }
    loadPlayers();
  });
}

// ===== SEARCH FILTER =====
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const search = searchInput.value.toLowerCase();
    const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
    renderTable(filtered);
  });
}

// ===== PENDING BADGE =====
function updatePendingBadge() {
  const count = Object.values(pendingChanges).filter((d) => d !== 0).length;
  if (pendingBadge) {
    if (count > 0) {
      pendingBadge.textContent = count;
      pendingBadge.classList.remove("hidden");
    } else {
      pendingBadge.classList.add("hidden");
    }
  }
}

// ===== STATUS BAR =====
function showStatus(msg, type) {
  if (!statusBar) return;
  statusBar.textContent = msg;
  statusBar.className = type;
  statusBar.style.display = "block";

  if (type === "success") {
    setTimeout(hideStatus, 4000);
  }
}

function hideStatus() {
  if (statusBar) statusBar.style.display = "none";
}

// ===== LOADING =====
function setLoading(loading) {
  if (loadingOverlay) loadingOverlay.style.display = loading ? "block" : "none";
  if (tableBody && loading) tableBody.innerHTML = "";
}

// ===== TEAM MODE =====

// Team count buttons
document.querySelectorAll(".team-count-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".team-count-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTeamCount = parseInt(btn.dataset.count);
    renderTeamPreview();
  });
});

if (btnStartTeam) btnStartTeam.addEventListener("click", startTeamMode);

// Listen to meta/game so UI stays in sync across devices
onSnapshot(doc(db, "meta", "game"), (snap) => {
  const data = snap.exists() ? snap.data() : { mode: "leaderboard", teams: [] };
  currentMode  = data.mode  || "leaderboard";
  currentTeams = data.teams || [];
  updateTeamModeUI();
});

function generateTeams(playersList, teamCount) {
  const sorted = [...playersList].sort((a, b) => b.liveScore - a.liveScore);
  const teams  = Array.from({ length: teamCount }, (_, i) => ({
    name: TEAM_NAMES[i],
    color: TEAM_COLORS[i],
    playerIds:   [],
    playerNames: [],
  }));

  let forward = true;
  let ti = 0;
  sorted.forEach((player) => {
    teams[ti].playerIds.push(player.id);
    teams[ti].playerNames.push(player.name);
    if (forward) {
      ti++;
      if (ti >= teamCount) { ti = teamCount - 1; forward = false; }
    } else {
      ti--;
      if (ti < 0) { ti = 0; forward = true; }
    }
  });
  return teams;
}

function renderTeamPreview() {
  if (!teamPreviewGrid) return;
  if (players.length === 0) {
    teamPreviewGrid.innerHTML = `<p class="team-preview-empty">Ingen spillere registrert ennå.</p>`;
    return;
  }
  const teams = generateTeams(players, selectedTeamCount);
  teamPreviewGrid.innerHTML = teams.map((team) => `
    <div class="team-preview-card" style="border-top-color: ${team.color}">
      <div class="team-preview-name" style="color: ${team.color}">${escapeHtml(team.name)}</div>
      <div class="team-preview-count">${team.playerNames.length} spillere</div>
      <div class="team-preview-list">
        ${team.playerNames.map((n) => `<span class="team-preview-player">${escapeHtml(n)}</span>`).join("")}
      </div>
    </div>
  `).join("");
}

async function startTeamMode() {
  const teams = generateTeams(players, selectedTeamCount);
  const teamsForFirestore = teams.map(({ name, color, playerIds }) => ({ name, color, playerIds }));
  try {
    await setDoc(doc(db, "meta", "game"), { mode: "teams", teams: teamsForFirestore });
    showStatus("Lagspill startet! TV-skjermen bytter nå til lagoversikt.", "success");
  } catch (err) {
    console.error("Start team error:", err);
    showStatus("Klarte ikke å starte lagspill.", "error");
  }
}

async function endTeamMode() {
  if (!confirm("Avslutte lagspillet? TV-en bytter tilbake til resultattavlen.")) return;
  try {
    await setDoc(doc(db, "meta", "game"), { mode: "leaderboard", teams: [] });
    showStatus("Lagspillet er avsluttet.", "success");
  } catch (err) {
    console.error("End team error:", err);
    showStatus("Klarte ikke å avslutte lagspill.", "error");
  }
}

async function awardAllAndEnd() {
  if (!teamAwardCards) return;
  const pointsPerTeam = [];
  teamAwardCards.querySelectorAll(".team-pts-input").forEach((input) => {
    pointsPerTeam[parseInt(input.dataset.team)] = parseInt(input.value) || 0;
  });

  try {
    const batch = writeBatch(db);
    pointsPerTeam.forEach((pts, teamIndex) => {
      if (!pts) return;
      const team = currentTeams[teamIndex];
      if (!team) return;
      team.playerIds.forEach((id) => {
        const player = players.find((p) => p.id === id);
        if (!player) return;
        const newScore = Math.max(0, player.liveScore + pts);
        batch.update(doc(db, "users", id), { liveScore: newScore });
        player.liveScore = newScore;
      });
    });
    batch.set(doc(db, "meta", "game"), { mode: "leaderboard", teams: [] });
    batch.set(doc(db, "meta", "leaderboard"), { version: increment(1) }, { merge: true });
    await batch.commit();

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    renderTable(players.filter((p) => p.name.toLowerCase().includes(search)));
    showStatus("Poeng gitt og lagspillet er avsluttet!", "success");
  } catch (err) {
    console.error("Award all and end error:", err);
    showStatus("Klarte ikke å gi poeng. Prøv igjen.", "error");
  }
}

function updateTeamModeUI() {
  if (!teamSetupEl || !teamActiveEl) return;
  if (currentMode === "teams") {
    teamSetupEl.classList.add("hidden");
    teamActiveEl.classList.remove("hidden");
    renderTeamAwardCards();
  } else {
    teamSetupEl.classList.remove("hidden");
    teamActiveEl.classList.add("hidden");
    renderTeamPreview();
  }
}

function renderTeamAwardCards() {
  if (!teamAwardCards) return;

  const cardsHtml = currentTeams.map((team, i) => {
    const memberNames = (team.playerIds || [])
      .map((id) => players.find((p) => p.id === id)?.name || "?")
      .join(", ");
    return `
      <div class="team-award-card" style="border-top-color: ${team.color}">
        <div class="team-award-name" style="color: ${team.color}">${escapeHtml(team.name)}</div>
        <div class="team-award-members">${escapeHtml(memberNames)}</div>
        <div class="team-pts-quick">
          <button class="score-btn plus team-pts-quick-btn" data-team="${i}" data-pts="1">+1</button>
          <button class="score-btn plus team-pts-quick-btn" data-team="${i}" data-pts="3">+3</button>
          <button class="score-btn plus team-pts-quick-btn" data-team="${i}" data-pts="5">+5</button>
          <button class="score-btn plus team-pts-quick-btn" data-team="${i}" data-pts="10">+10</button>
        </div>
        <div class="team-pts-row">
          <input type="number" class="custom-score-input team-pts-input" data-team="${i}" placeholder="0" min="0" />
          <span class="team-pts-label">poeng</span>
        </div>
      </div>`;
  }).join("");

  teamAwardCards.innerHTML = `
    <div class="team-award-grid">${cardsHtml}</div>
    <div class="team-award-actions">
      <button id="btn-award-and-end" class="ds-button">✓ Gi poeng &amp; Avslutt lagspill</button>
      <button id="btn-end-no-pts" class="ds-button" data-variant="secondary">Avslutt uten poeng</button>
    </div>`;

  teamAwardCards.querySelectorAll(".team-pts-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const teamIdx = btn.dataset.team;
      const input = teamAwardCards.querySelector(`.team-pts-input[data-team="${teamIdx}"]`);
      if (input) input.value = btn.dataset.pts;
      // Highlight active quick button within this card
      btn.closest(".team-pts-quick").querySelectorAll(".team-pts-quick-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("btn-award-and-end")?.addEventListener("click", awardAllAndEnd);
  document.getElementById("btn-end-no-pts")?.addEventListener("click", endTeamMode);
}

// ===== ADD PLAYER =====
if (btnAddPlayer) {
  btnAddPlayer.addEventListener("click", addPlayer);
}
if (addPlayerInput) {
  addPlayerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addPlayer();
  });
}

async function addPlayer() {
  const name = addPlayerInput ? addPlayerInput.value.trim() : "";
  if (!name) {
    setAddError("Vennligst skriv inn et navn.");
    return;
  }

  // Check for duplicate name
  const duplicate = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    setAddError(`"${name}" er allerede i listen.`);
    return;
  }

  if (btnAddPlayer) { btnAddPlayer.disabled = true; btnAddPlayer.textContent = "Legger til…"; }
  setAddError("");

  try {
    const docRef = await addDoc(collection(db, "users"), {
      name,
      quizScore: 0,
      liveScore: 0,
      quizCompleted: false,
      registeredAt: serverTimestamp(),
    });

    players.push({ id: docRef.id, name, quizScore: 0, liveScore: 0 });
    if (addPlayerInput) addPlayerInput.value = "";

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
    renderTable(filtered);
    if (playerTotalEl) playerTotalEl.textContent = `${players.length} spiller${players.length !== 1 ? "e" : ""}`;

    showStatus(`"${name}" ble lagt til.`, "success");
  } catch (err) {
    console.error("Add player error:", err);
    setAddError("Klarte ikke å legge til spiller. Sjekk tilkoblingen din.");
  } finally {
    if (btnAddPlayer) { btnAddPlayer.disabled = false; btnAddPlayer.textContent = "+ Legg til spiller"; }
  }
}

function setAddError(msg) {
  if (addPlayerError) addPlayerError.textContent = msg;
}

// ===== DELETE PLAYER =====
async function deletePlayer(id, name) {
  if (!confirm(`Fjerne "${name}" fra spillet? Dette kan ikke angres.`)) return;

  try {
    await deleteDoc(doc(db, "users", id));
    players = players.filter((p) => p.id !== id);
    delete pendingChanges[id];

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
    renderTable(filtered);
    if (playerTotalEl) playerTotalEl.textContent = `${players.length} spiller${players.length !== 1 ? "e" : ""}`;
    updatePendingBadge();
    showStatus(`"${name}" er fjernet.`, "success");
  } catch (err) {
    console.error("Delete player error:", err);
    showStatus("Klarte ikke å fjerne spiller. Prøv igjen.", "error");
  }
}

// ===== QR MODAL =====
(function () {
  const modal    = document.getElementById("qr-modal");
  const codeEl   = document.getElementById("qr-modal-code");
  const urlEl    = document.getElementById("qr-modal-url");
  const openBtn  = document.getElementById("btn-qr-modal");
  const closeBtn = document.getElementById("btn-qr-close");
  const backdrop = document.getElementById("qr-modal-backdrop");
  let generated  = false;

  function openModal() {
    if (!modal) return;
    if (!generated && typeof QRCode !== "undefined" && codeEl) {
      const playUrl = window.location.origin +
        window.location.pathname.replace(/admin\.html.*/, "") + "play.html";
      new QRCode(codeEl, {
        text: playUrl, width: 160, height: 160,
        colorDark: "#000000", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      if (urlEl) urlEl.textContent = playUrl;
      generated = true;
    }
    modal.classList.remove("hidden");
  }

  function closeModal() {
    if (modal) modal.classList.add("hidden");
  }

  if (openBtn)  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
})();

// ===== UTILS =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("bgAuth") === "1") {
    showScreen("admin");
    loadPlayers();
  } else {
    showScreen("auth");
  }
});
