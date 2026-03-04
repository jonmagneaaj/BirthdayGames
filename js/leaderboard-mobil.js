import { t, getLang, setLang, applyTranslations, tPlayerCount } from "./i18n.js";
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
const tabTeams     = document.getElementById("tab-teams");
const quizPanel    = document.getElementById("mob-quiz-panel");
const livePanel    = document.getElementById("mob-live-panel");
const teamsPanel   = document.getElementById("mob-teams-panel");
const quizListEl   = document.getElementById("mob-quiz-list");
const quizCountEl  = document.getElementById("mob-quiz-count");
const liveListEl   = document.getElementById("mob-live-list");
const liveCountEl  = document.getElementById("mob-live-count");
const teamGridEl   = document.getElementById("mob-team-grid");
const updatedEl    = document.getElementById("mob-updated");

// ===== TAB SWITCHING =====
const allTabs   = [tabQuiz, tabLive, tabTeams];
const allPanels = [quizPanel, livePanel, teamsPanel];

function switchTab(activeTab, activePanel) {
  allTabs.forEach(t   => t.classList.remove("active"));
  allPanels.forEach(p => p.classList.remove("active"));
  activeTab.classList.add("active");
  activePanel.classList.add("active");
}

tabQuiz.addEventListener("click",  () => switchTab(tabQuiz,  quizPanel));
tabLive.addEventListener("click",  () => switchTab(tabLive,  livePanel));
tabTeams.addEventListener("click", () => switchTab(tabTeams, teamsPanel));

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
        <p>${t("noPlayers")}</p>
      </div>`;
    if (countEl) countEl.textContent = "";
    return;
  }

  if (countEl) countEl.textContent = tPlayerCount(players.length);

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
  // Highlight teams tab as "live"
  tabTeams.classList.add("tab-live");

  // Auto-switch to teams tab if user is not already on it
  if (!teamsPanel.classList.contains("active")) {
    switchTab(tabTeams, teamsPanel);
  }

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
  tabTeams.classList.remove("tab-live");
  // If user is currently on teams panel, switch back to live
  if (teamsPanel.classList.contains("active")) {
    switchTab(tabLive, livePanel);
  }
}

// ===== TIMESTAMP =====
function updateTimestamp() {
  if (!updatedEl) return;
  const now = new Date();
  const locale  = getLang() === "en" ? "en-GB" : "nb-NO";
  const timeStr = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  updatedEl.textContent = t("updatedAt", { time: timeStr });
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
      if (quizListEl) quizListEl.innerHTML = `<div class="mob-empty"><p>${t("connectionError")}</p></div>`;
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
      if (liveListEl) liveListEl.innerHTML = `<div class="mob-empty"><p>${t("connectionError")}</p></div>`;
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

// ===== LANG TOGGLE =====
function initLangToggle() {
  const btn = document.getElementById("btn-lang-toggle");
  if (!btn) return;
  btn.textContent = getLang() === "no" ? "🇬🇧 EN" : "🇳🇴 NO";
  btn.addEventListener("click", () => {
    setLang(getLang() === "no" ? "en" : "no");
    location.reload();
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
  applyTranslations();
  document.title = t("lbPageTitle");
  initLangToggle();
  startListening();
});
