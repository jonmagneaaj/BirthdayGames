import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
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

// ===== STATE =====
let players = [];        // Array of { id, name, quizScore, liveScore }
let pendingChanges = {}; // { userId: deltaLiveScore }

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

const addPlayerForm = document.getElementById("add-player-form");
const addPlayerInput = document.getElementById("add-player-name");
const btnAddPlayer = document.getElementById("btn-add-player");
const addPlayerError = document.getElementById("add-player-error");

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
    showScreen("admin");
    loadPlayers();
  } else {
    if (authError) authError.textContent = "Incorrect password. Try again.";
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
  } catch (err) {
    console.error("Load error:", err);
    showStatus("Failed to load players. Check your Firebase config.", "error");
  } finally {
    setLoading(false);
  }
}

// ===== RENDER TABLE =====
function renderTable(data) {
  if (playerTotalEl) playerTotalEl.textContent = `${data.length} player${data.length !== 1 ? "s" : ""}`;

  if (!tableBody) return;

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="table-empty">
            <span class="icon">👥</span>
            No players registered yet. Add one above!
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
            <button class="score-btn plus" data-id="${player.id}" data-delta="50">+50</button>
            <button class="score-btn plus" data-id="${player.id}" data-delta="10">+10</button>
            <button class="score-btn minus" data-id="${player.id}" data-delta="-10">−10</button>
            <div class="custom-input-wrap">
              <input type="number" class="custom-score-input" data-id="${player.id}" placeholder="0" />
              <button class="score-btn apply" data-id="${player.id}">Apply</button>
            </div>
          </div>
        </td>
        <td class="td-delete">
          <button class="btn-delete-player" data-id="${player.id}" data-name="${escapeHtml(player.name)}">Remove</button>
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
    showStatus("No changes to push.", "error");
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

    showStatus(`Successfully pushed ${changedIds.length} update${changedIds.length !== 1 ? "s" : ""} to leaderboard!`, "success");
  } catch (err) {
    console.error("Push error:", err);
    showStatus("Failed to push changes. Check your connection.", "error");
  } finally {
    if (btnPush) btnPush.disabled = false;
  }
}

// ===== REFRESH =====
if (btnRefresh) {
  btnRefresh.addEventListener("click", () => {
    if (Object.values(pendingChanges).some((d) => d !== 0)) {
      if (!confirm("You have unsaved changes. Refresh anyway?")) return;
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
    setAddError("Please enter a name.");
    return;
  }

  // Check for duplicate name
  const duplicate = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    setAddError(`"${name}" is already in the list.`);
    return;
  }

  if (btnAddPlayer) { btnAddPlayer.disabled = true; btnAddPlayer.textContent = "Adding…"; }
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
    if (playerTotalEl) playerTotalEl.textContent = `${players.length} player${players.length !== 1 ? "s" : ""}`;

    showStatus(`"${name}" added successfully.`, "success");
  } catch (err) {
    console.error("Add player error:", err);
    setAddError("Failed to add player. Check your connection.");
  } finally {
    if (btnAddPlayer) { btnAddPlayer.disabled = false; btnAddPlayer.textContent = "+ Add Player"; }
  }
}

function setAddError(msg) {
  if (addPlayerError) addPlayerError.textContent = msg;
}

// ===== DELETE PLAYER =====
async function deletePlayer(id, name) {
  if (!confirm(`Remove "${name}" from the game? This cannot be undone.`)) return;

  try {
    await deleteDoc(doc(db, "users", id));
    players = players.filter((p) => p.id !== id);
    delete pendingChanges[id];

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = players.filter((p) => p.name.toLowerCase().includes(search));
    renderTable(filtered);
    if (playerTotalEl) playerTotalEl.textContent = `${players.length} player${players.length !== 1 ? "s" : ""}`;
    updatePendingBadge();
    showStatus(`"${name}" removed.`, "success");
  } catch (err) {
    console.error("Delete player error:", err);
    showStatus("Failed to remove player. Try again.", "error");
  }
}

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
  showScreen("auth");
});
