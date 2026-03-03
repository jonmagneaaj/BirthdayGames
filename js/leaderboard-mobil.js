import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== STATE =====
const prevQuizRanks = new Map();
const prevLiveRanks = new Map();
let allLivePlayers = [];

// ===== DOM REFS =====
const tabQuiz      = document.getElementById("tab-quiz");
const tabLive      = document.getElementById("tab-live");
const quizPanel    = document.getElementById("mob-quiz-panel");
const livePanel    = document.getElementById("mob-live-panel");
const quizListEl   = document.getElementById("mob-quiz-list");
const quizCountEl  = document.getElementById("mob-quiz-count");
const liveListEl   = document.getElementById("mob-live-list");
const liveCountEl  = document.getElementById("mob-live-count");
const liveInnerEl  = document.getElementById("mob-live-inner");
const teamsInnerEl = document.getElementById("mob-teams-inner");
const teamGridEl   = document.getElementById("mob-team-grid");
const updatedEl    = document.getElementById("mob-updated");

// ===== TAB SWITCHING =====
tabQuiz.addEventListener("click", () => {
  tabQuiz.classList.add("active");
  tabLive.classList.remove("active");
  quizPanel.classList.add("active");
  livePanel.classList.remove("active");
});

tabLive.addEventListener("click", () => {
  tabLive.classList.add("active");
  tabQuiz.classList.remove("active");
  livePanel.classList.add("active");
  quizPanel.classList.remove("active");
});

// ===== CHEVRON LOGIC =====
function getChevron(userId, currentRank, prevMap) {
  if (!prevMap.has(userId)) return { symbol: "—", cls: "chevron-neutral" };
  const prev = prevMap.get(userId);
  if (currentRank < prev) return { symbol: "↑", cls: "chevron-up" };
  if (currentRank > prev) return { symbol: "↓", cls: "chevron-down" };
  return { symbol: "—", cls: "chevron-neutral" };
}

// ===== MEDAL EMOJI =====
function medalFor(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

// ===== RANK CLASS =====
function rankClass(rank) {
  if (rank <= 3) return `rank-${rank}`;
  return "";
}

// ===== RENDER BOARD =====
function renderBoard(listEl, players, scoreField, prevMap, countEl) {
  if (!listEl) return;

  if (players.length === 0) {
    listEl.innerHTML = `
      <div class="mob-empty">
        <div class="empty-icon">👀</div>
        <p>Ingen spillere ennå.</p>
      </div>`;
    if (countEl) countEl.textContent = "";
    return;
  }

  if (countEl) countEl.textContent = `${players.length} spiller${players.length !== 1 ? "e" : ""}`;

  listEl.innerHTML = players.map((player, idx) => {
    const rank = idx + 1;
    const chevron = getChevron(player.id, rank, prevMap);
    const medal = medalFor(rank);
    const score = (player[scoreField] || 0).toLocaleString();
    const isTop3 = rank <= 3;

    return `
      <div class="mob-entry${isTop3 ? " top-3" : ""}">
        <div class="mob-rank ${rankClass(rank)}">
          ${medal ? `<span>${medal}</span>` : `#${rank}`}
        </div>
        <div class="mob-name">${escapeHtml(player.name)}</div>
        <div class="mob-score">${score}</div>
        <div class="mob-chevron ${chevron.cls}">${chevron.symbol}</div>
      </div>`;
  }).join("");
}

// ===== SAVE RANKS =====
function saveRanks(players, prevMap) {
  players.forEach((player, idx) => {
    prevMap.set(player.id, idx + 1);
  });
}

// ===== TEAM VIEW =====
function showTeamMode(teams) {
  liveInnerEl.classList.add("hidden");
  teamsInnerEl.classList.remove("hidden");
  tabLive.textContent = "🏆 Lagspill";

  if (!teamGridEl || !teams || teams.length === 0) return;

  teamGridEl.innerHTML = teams.map((team) => {
    const playerNames = (team.playerIds || []).map((id) => {
      const p = allLivePlayers.find((pl) => pl.id === id);
      return p ? escapeHtml(p.name) : "?";
    });

    return `
      <div class="mob-team-card" style="--team-color: ${team.color}">
        <div class="mob-team-name">${escapeHtml(team.name)}</div>
        <div class="mob-team-players">
          ${playerNames.map((n) => `<div class="mob-team-player">${n}</div>`).join("")}
        </div>
      </div>`;
  }).join("");
}

function showLiveMode() {
  teamsInnerEl.classList.add("hidden");
  liveInnerEl.classList.remove("hidden");
  tabLive.textContent = "⚡ Livepoeng";
}

// ===== TIMESTAMP =====
function updateTimestamp() {
  if (!updatedEl) return;
  const now = new Date();
  updatedEl.textContent = "Oppdatert " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ===== FIRESTORE LISTENERS =====
function startListening() {
  const usersRef = collection(db, "users");

  onSnapshot(
    query(usersRef, orderBy("quizScore", "desc"), limit(50)),
    (snapshot) => {
      const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBoard(quizListEl, players, "quizScore", prevQuizRanks, quizCountEl);
      saveRanks(players, prevQuizRanks);
      updateTimestamp();
    },
    (err) => {
      console.error("Quiz leaderboard error:", err);
      if (quizListEl) quizListEl.innerHTML = `<div class="mob-empty"><p>Tilkoblingsfeil.</p></div>`;
    }
  );

  onSnapshot(
    query(usersRef, orderBy("liveScore", "desc"), limit(50)),
    (snapshot) => {
      const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      allLivePlayers = players;
      renderBoard(liveListEl, players, "liveScore", prevLiveRanks, liveCountEl);
      saveRanks(players, prevLiveRanks);
      updateTimestamp();
    },
    (err) => {
      console.error("Live leaderboard error:", err);
      if (liveListEl) liveListEl.innerHTML = `<div class="mob-empty"><p>Tilkoblingsfeil.</p></div>`;
    }
  );

  onSnapshot(doc(db, "meta", "game"), (snap) => {
    if (!snap.exists()) { showLiveMode(); return; }
    const { mode, teams } = snap.data();
    if (mode === "teams") {
      showTeamMode(teams || []);
    } else {
      showLiveMode();
    }
  });
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
  startListening();
});
