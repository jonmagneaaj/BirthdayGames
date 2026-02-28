import { db } from "../firebase-config.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== STATE =====
const prevQuizRanks = new Map();   // userId -> rank (previous snapshot)
const prevLiveRanks = new Map();   // userId -> rank (previous snapshot)

// ===== DOM REFS =====
const quizListEl = document.getElementById("quiz-list");
const liveListEl = document.getElementById("live-list");
const quizCountEl = document.getElementById("quiz-count");
const liveCountEl = document.getElementById("live-count");
const lastUpdatedEl = document.getElementById("last-updated-time");

// ===== QR CODE =====
function renderQR() {
  const qrContainer = document.getElementById("qr-code");
  if (!qrContainer) return;

  // Build the play.html URL based on current host
  const playUrl = window.location.origin + window.location.pathname.replace("index.html", "") + "play.html";

  // Use QRCode.js (loaded via CDN in HTML)
  if (typeof QRCode !== "undefined") {
    new QRCode(qrContainer, {
      text: playUrl,
      width: 108,
      height: 108,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    document.getElementById("qr-label").textContent = "Scan to play!";
  } else {
    qrContainer.innerHTML = '<p style="font-size:0.7rem;color:#888;padding:8px;text-align:center">QR unavailable</p>';
  }
}

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
      <div class="board-empty">
        <div class="empty-icon">👀</div>
        <p>No players yet.<br>Waiting for the party to start!</p>
      </div>`;
    if (countEl) countEl.textContent = "0 players";
    return;
  }

  if (countEl) countEl.textContent = `${players.length} player${players.length !== 1 ? "s" : ""}`;

  const html = players.map((player, idx) => {
    const rank = idx + 1;
    const chevron = getChevron(player.id, rank, prevMap);
    const medal = medalFor(rank);
    const score = (player[scoreField] || 0).toLocaleString();
    const isTop3 = rank <= 3;

    return `
      <div class="board-entry${isTop3 ? " top-3" : ""}" data-id="${player.id}">
        <div class="entry-rank ${rankClass(rank)}">
          ${medal ? `<span class="entry-medal">${medal}</span>` : `#${rank}`}
        </div>
        <div class="entry-name">${escapeHtml(player.name)}</div>
        <div class="entry-score">${score}</div>
        <div class="entry-chevron ${chevron.cls}">${chevron.symbol}</div>
      </div>`;
  }).join("");

  listEl.innerHTML = html;
}

// ===== UPDATE RANK MAPS =====
function saveRanks(players, prevMap) {
  players.forEach((player, idx) => {
    prevMap.set(player.id, idx + 1);
  });
}

// ===== FIRESTORE LISTENER =====
function startListening() {
  const usersRef = collection(db, "users");

  onSnapshot(
    query(usersRef, orderBy("quizScore", "desc"), limit(50)),
    (snapshot) => {
      const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Render quiz board
      renderBoard(quizListEl, players, "quizScore", prevQuizRanks, quizCountEl);
      saveRanks(players, prevQuizRanks);

      updateTimestamp();
    },
    (err) => {
      console.error("Quiz leaderboard error:", err);
      if (quizListEl) quizListEl.innerHTML = `<div class="board-empty"><p>Connection error. Retrying…</p></div>`;
    }
  );

  onSnapshot(
    query(usersRef, orderBy("liveScore", "desc"), limit(50)),
    (snapshot) => {
      const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Render live board
      renderBoard(liveListEl, players, "liveScore", prevLiveRanks, liveCountEl);
      saveRanks(players, prevLiveRanks);

      updateTimestamp();
    },
    (err) => {
      console.error("Live leaderboard error:", err);
      if (liveListEl) liveListEl.innerHTML = `<div class="board-empty"><p>Connection error. Retrying…</p></div>`;
    }
  );
}

// ===== TIMESTAMP =====
function updateTimestamp() {
  if (!lastUpdatedEl) return;
  const now = new Date();
  lastUpdatedEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  renderQR();
  startListening();
});
