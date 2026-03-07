import { t, getLang, setLang, applyTranslations } from "./i18n.js";
import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== CONSTANTS =====
const QUESTIONS_PER_GAME  = 10;
const QUESTION_DURATION_MS = 15_000; // 15 seconds
const TICK_MS             = 100;     // 100ms granularity
const SCORE_PER_CORRECT   = 1000;

// ===== STATE =====
let allQuestions       = [];
let gameQuestions      = [];
let currentQuestionIdx = 0;
let totalScore         = 0;
let timerInterval      = null;
let questionStartTime  = 0;  // performance.now() snapshot — avoids setInterval throttle
let answerLocked       = false;
let currentCorrectIdx = 0;
let userId            = null;
let playerName        = "";
let questionResults   = [];
let previousBestScore = 0;
let allPlayers        = [];

// ===== DOM REFS =====
const screens = {
  password: document.getElementById("screen-password"),
  register: document.getElementById("screen-register"),
  quiz:     document.getElementById("screen-quiz"),
  results:  document.getElementById("screen-results"),
};

const nameInput        = document.getElementById("player-name-input");
const btnRegister      = document.getElementById("btn-register");
const errorMsg         = document.getElementById("register-error");

const progressBar      = document.getElementById("progress-bar");
const questionCounter  = document.getElementById("question-counter");
const currentScoreDisplay = document.getElementById("current-score-display");
const questionText     = document.getElementById("question-text");
const answersGrid      = document.getElementById("answers-grid");
const timerText        = document.getElementById("timer-text");
const timerRing        = document.getElementById("timer-ring");
const pointsToast      = document.getElementById("points-toast");

const finalScoreEl     = document.getElementById("final-score");
const correctCountEl   = document.getElementById("correct-count");
const avgTimeEl        = document.getElementById("avg-time");
const highScoreMsg     = document.getElementById("high-score-msg");
const resultsNote      = document.getElementById("results-note");
const btnViewLeaderboard = document.getElementById("btn-view-leaderboard");
const btnPlayAgain     = document.getElementById("btn-play-again");

// Password refs
const pwInput     = document.getElementById("pw-input");
const btnPwSubmit = document.getElementById("btn-pw-submit");
const pwError     = document.getElementById("pw-error");
const GAME_PASSWORD = "Jon";

// Overlay refs
const nameSearchOverlay = document.getElementById("name-search-overlay");
const nameSearchInput   = document.getElementById("name-search-input");
const nameSearchList    = document.getElementById("name-search-list");
const btnSearchBack     = document.getElementById("btn-search-back");
const btnSearchPlay     = document.getElementById("btn-search-play");

// ===== SCREEN MANAGEMENT =====
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("active", key === name);
  });
}

// ===== LOAD QUESTIONS =====
async function loadQuestions() {
  const snapshot = await getDocs(collection(db, "questions"));
  allQuestions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (allQuestions.length === 0) {
    showError(t("errNoQuestions"));
    throw new Error("No questions in Firestore");
  }
}

// ===== LOAD EXISTING PLAYERS =====
async function loadExistingPlayers() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "users"), orderBy("name"), limit(100))
    );
    allPlayers = snapshot.docs.map((d) => ({ id: d.id, name: d.data().name, quizScore: d.data().quizScore || 0 }));
  } catch (err) {
    console.warn("Could not load players for autocomplete:", err);
    allPlayers = [];
  }

  const lastName = localStorage.getItem("bgLastName");
  if (lastName && nameInput) {
    nameInput.value = lastName;
  }
}

// ===== NAME SEARCH OVERLAY =====
function openSearchOverlay() {
  if (!nameSearchOverlay) return;
  nameSearchOverlay.classList.remove("hidden");
  if (nameSearchInput) {
    nameSearchInput.value = nameInput ? nameInput.value : "";
    renderOverlaySuggestions(nameSearchInput.value);
    setTimeout(() => nameSearchInput.focus(), 60);
  }
}

function closeSearchOverlay() {
  if (!nameSearchOverlay) return;
  nameSearchOverlay.classList.add("hidden");
}

function renderOverlaySuggestions(filter) {
  if (!nameSearchList) return;

  const trimmed = filter.trim().toLowerCase();
  let matches;

  if (trimmed === "") {
    matches = allPlayers.slice(0, 12);
  } else {
    matches = allPlayers.filter((p) =>
      p.name.toLowerCase().startsWith(trimmed)
    );
    // Exact match — no need to show list
    if (matches.length === 1 && matches[0].name.toLowerCase() === trimmed) {
      nameSearchList.innerHTML = "";
      return;
    }
  }

  if (matches.length === 0) {
    nameSearchList.innerHTML = `<div class="search-empty">${t("noMatchHint")}</div>`;
    return;
  }

  nameSearchList.innerHTML = matches
    .map((p) => `<div class="search-suggestion" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>`)
    .join("");

  nameSearchList.querySelectorAll(".search-suggestion").forEach((el) => {
    el.addEventListener("click", () => {
      if (nameSearchInput) nameSearchInput.value = el.dataset.name;
      confirmOverlay();
    });
  });
}

function confirmOverlay() {
  const name = nameSearchInput ? nameSearchInput.value.trim() : "";
  if (nameInput) nameInput.value = name;
  closeSearchOverlay();
  handleRegister();
}

// Overlay events
if (nameInput) {
  nameInput.addEventListener("click", openSearchOverlay);
  nameInput.addEventListener("focus", (e) => { e.target.blur(); openSearchOverlay(); });
}
if (btnRegister) {
  btnRegister.addEventListener("click", () => {
    const name = nameInput ? nameInput.value.trim() : "";
    if (name.length >= 2) {
      handleRegister();
    } else {
      openSearchOverlay();
    }
  });
}
if (btnSearchBack)  btnSearchBack.addEventListener("click", closeSearchOverlay);
if (btnSearchPlay)  btnSearchPlay.addEventListener("click", confirmOverlay);
if (nameSearchInput) {
  nameSearchInput.addEventListener("input",   () => renderOverlaySuggestions(nameSearchInput.value));
  nameSearchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") confirmOverlay(); });
}

// ===== PASSWORD =====
function handlePasswordSubmit() {
  const val = pwInput ? pwInput.value : "";
  if (val.toLowerCase() === GAME_PASSWORD.toLowerCase()) {
    localStorage.setItem("bgPasswordOk", "1");
    showScreen("register");
  } else {
    if (pwError) {
      pwError.textContent = t("pwWrong");
      pwError.classList.remove("hidden");
    }
    if (pwInput) {
      pwInput.value = "";
      pwInput.focus();
    }
  }
}

if (btnPwSubmit) {
  btnPwSubmit.addEventListener("click", handlePasswordSubmit);
}
if (pwInput) {
  pwInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handlePasswordSubmit(); });
}

// ===== SHUFFLE =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleAnswers(answers, correctIdx) {
  const tagged  = answers.map((a, i) => ({ a, isCorrect: i === correctIdx }));
  const shuffled = shuffle(tagged);
  return {
    answers:    shuffled.map(item => item.a),
    correctIdx: shuffled.findIndex(item => item.isCorrect),
  };
}

// ===== REGISTRATION =====
async function registerPlayer(name) {
  const usersRef = collection(db, "users");
  const existing = await getDocs(query(usersRef, where("name", "==", name)));

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const data = existingDoc.data();
    userId = existingDoc.id;
    playerName = name;
    previousBestScore = data.quizScore || 0;
    localStorage.setItem("bgLastName", name);
    startQuiz();
    return;
  }

  const docRef = await addDoc(usersRef, {
    name,
    quizScore: 0,
    liveScore: 0,
    quizCompleted: false,
    registeredAt: serverTimestamp(),
  });

  userId = docRef.id;
  playerName = name;
  previousBestScore = 0;
  localStorage.setItem("bgLastName", name);
  startQuiz();
}

// ===== START QUIZ =====
function startQuiz() {
  gameQuestions     = shuffle(allQuestions).slice(0, QUESTIONS_PER_GAME);
  currentQuestionIdx = 0;
  totalScore        = 0;
  questionResults   = [];
  showScreen("quiz");
  loadQuestion(0);
}

// ===== LOAD QUESTION =====
function loadQuestion(idx) {
  clearInterval(timerInterval);
  answerLocked     = false;
  questionStartTime = 0;

  const q        = gameQuestions[idx];
  const progress = (idx / QUESTIONS_PER_GAME) * 100;

  if (progressBar)         progressBar.style.width = progress + "%";
  if (questionCounter)     questionCounter.textContent = t("questionCounter", { idx: idx + 1, total: QUESTIONS_PER_GAME });
  if (currentScoreDisplay) currentScoreDisplay.textContent = t("scoreDisplay", { score: totalScore.toLocaleString() });

  const lang     = getLang();
  const qText    = (lang === "en" && q.question_en) ? q.question_en : q.question;
  const qAnswers = (lang === "en" && q.answers_en?.length) ? q.answers_en : q.answers;
  if (questionText) questionText.textContent = qText;

  const { answers: shuffledAnswers, correctIdx } = shuffleAnswers(qAnswers, q.correct);
  currentCorrectIdx = correctIdx;

  if (answersGrid) {
    answersGrid.dataset.count = shuffledAnswers.length;
    answersGrid.innerHTML = shuffledAnswers.map((ans, i) => `
      <button class="answer-btn" data-index="${i}">${escapeHtml(ans)}</button>
    `).join("");

    answersGrid.querySelectorAll(".answer-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.index)));
    });
  }

  startTimer();
}

// ===== TIMER =====
const CIRCUMFERENCE    = 188.5; // 2 * PI * 30 (radius)
const TOTAL_TICKS      = QUESTION_DURATION_MS / TICK_MS; // 300

// Returns ticks elapsed based on real wall-clock time, immune to setInterval throttling.
function getTicksElapsed() {
  if (!questionStartTime) return 0;
  return Math.min(TOTAL_TICKS, Math.floor((performance.now() - questionStartTime) / TICK_MS));
}

function startTimer() {
  questionStartTime = performance.now();
  updateTimerDisplay(TOTAL_TICKS);

  timerInterval = setInterval(() => {
    const ticks     = getTicksElapsed();
    const remaining = TOTAL_TICKS - ticks;
    updateTimerDisplay(remaining);

    if (ticks >= TOTAL_TICKS) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 50); // 50ms refresh: smooth ring animation, real timing from performance.now()
}

function updateTimerDisplay(remainingTicks) {
  if (timerText) timerText.textContent = Math.ceil(remainingTicks / 10);

  if (timerRing) {
    const fraction = remainingTicks / TOTAL_TICKS;
    const offset   = CIRCUMFERENCE * (1 - fraction);
    timerRing.style.strokeDashoffset = offset;

    if (fraction > 0.5)       timerRing.style.stroke = "#4caf50";
    else if (fraction > 0.25) timerRing.style.stroke = "#ff9800";
    else                      timerRing.style.stroke = "#f44336";
  }
}

// ===== HANDLE ANSWER =====
function handleAnswer(selectedIdx) {
  if (answerLocked) return;
  answerLocked = true;
  clearInterval(timerInterval);

  const isCorrect = selectedIdx === currentCorrectIdx;

  const ticks = getTicksElapsed(); // real elapsed ticks at moment of answer

  let pointsEarned = 0;
  if (isCorrect) {
    // Linear: 1000 pts at 0s → 0 pts at 15s
    pointsEarned = Math.round(SCORE_PER_CORRECT * (TOTAL_TICKS - ticks) / TOTAL_TICKS);
    totalScore += pointsEarned;
  }

  questionResults.push({ isCorrect, secondsElapsed: ticks / 10 });

  const btns = answersGrid.querySelectorAll(".answer-btn");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentCorrectIdx)          btn.classList.add("correct");
    else if (i === selectedIdx && !isCorrect) btn.classList.add("wrong");
  });

  showPointsToast(pointsEarned, isCorrect);
  setTimeout(() => nextQuestion(), 1400);
}

function handleTimeout() {
  if (answerLocked) return;
  answerLocked = true;

  questionResults.push({ isCorrect: false, secondsElapsed: QUESTION_DURATION_MS / 1000 });

  const btns = answersGrid ? answersGrid.querySelectorAll(".answer-btn") : [];
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentCorrectIdx) btn.classList.add("correct");
  });

  showPointsToast(0, false);
  setTimeout(() => nextQuestion(), 1400);
}

function showPointsToast(points, isCorrect) {
  if (!pointsToast) return;
  pointsToast.textContent = isCorrect ? t("toastPoints", { points: points.toLocaleString() }) : t("toastNoPoints");
  pointsToast.classList.toggle("wrong-toast", !isCorrect);
  pointsToast.classList.add("show");
  setTimeout(() => pointsToast.classList.remove("show"), 1000);
}

// ===== NEXT QUESTION =====
function nextQuestion() {
  currentQuestionIdx++;
  if (currentQuestionIdx >= QUESTIONS_PER_GAME) {
    finishQuiz();
  } else {
    loadQuestion(currentQuestionIdx);
  }
}

// ===== FINISH QUIZ =====
async function finishQuiz() {
  clearInterval(timerInterval);

  const isNewHighScore = totalScore > previousBestScore;

  if (userId && isNewHighScore) {
    try {
      await updateDoc(doc(db, "users", userId), {
        quizScore:     totalScore,
        quizCompleted: true,
      });
    } catch (err) {
      console.error("Failed to save score:", err);
    }
  }

  const correctCount = questionResults.filter((r) => r.isCorrect).length;
  const avgTime = questionResults.length > 0
    ? Math.round(questionResults.reduce((s, r) => s + r.secondsElapsed, 0) / questionResults.length)
    : 0;

  if (finalScoreEl)   finalScoreEl.textContent   = totalScore.toLocaleString();
  if (correctCountEl) correctCountEl.textContent = `${correctCount} / ${QUESTIONS_PER_GAME}`;
  if (avgTimeEl)      avgTimeEl.textContent      = `${avgTime}s`;
  if (progressBar)    progressBar.style.width    = "100%";

  if (highScoreMsg) {
    if (previousBestScore === 0) {
      highScoreMsg.textContent = "";
      highScoreMsg.className   = "high-score-msg";
    } else if (isNewHighScore) {
      highScoreMsg.textContent = t("highScoreNew", { prev: previousBestScore.toLocaleString() });
      highScoreMsg.className   = "high-score-msg high-score-new";
    } else if (totalScore === previousBestScore) {
      highScoreMsg.textContent = t("highScoreEqual", { prev: previousBestScore.toLocaleString() });
      highScoreMsg.className   = "high-score-msg";
    } else {
      highScoreMsg.textContent = t("highScoreBelow", { prev: previousBestScore.toLocaleString() });
      highScoreMsg.className   = "high-score-msg";
    }
  }

  if (isNewHighScore) previousBestScore = totalScore;

  if (resultsNote) {
    resultsNote.textContent = isNewHighScore
      ? t("resultsNoteNew")
      : t("resultsNoteDefault");
  }

  // Check for #1 place (compare against all other players' best scores)
  const otherBest = allPlayers
    .filter(p => p.id !== userId)
    .reduce((max, p) => Math.max(max, p.quizScore || 0), 0);
  const isNumber1 = isNewHighScore && totalScore > otherBest;

  showScreen("results");

  if (isNumber1) {
    setTimeout(() => triggerNumber1Celebration(), 600);
  } else if (isNewHighScore) {
    setTimeout(() => triggerHighScorePulse(), 300);
  }
}

// ===== VIEW LEADERBOARD =====
if (btnViewLeaderboard) {
  btnViewLeaderboard.addEventListener("click", () => {
    window.location.href = "leaderboard-mobil.html";
  });
}

// ===== PLAY AGAIN =====
if (btnPlayAgain) {
  btnPlayAgain.addEventListener("click", () => startQuiz());
}

// ===== REGISTER VALIDATION =====
async function handleRegister() {
  const name = nameInput ? nameInput.value.trim() : "";

  if (!name) {
    showError(t("errNameRequired"));
    return;
  }
  if (name.length < 2) {
    showError(t("errNameTooShort"));
    return;
  }
  if (name.length > 30) {
    showError(t("errNameTooLong"));
    return;
  }

  setLoading(true);
  hideError();

  try {
    await registerPlayer(name);
  } catch (err) {
    console.error("Registration error:", err);
    showError(t("errGeneric"));
    setLoading(false);
  }
}

function setLoading(loading) {
  if (btnRegister) {
    btnRegister.disabled  = loading;
    btnRegister.textContent = loading ? t("loading") : t("playBtn");
  }
}

function showError(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
  }
}

function hideError() {
  if (errorMsg) errorMsg.classList.add("hidden");
}

// ===== CELEBRATION =====
function triggerNumber1Celebration() {
  const overlay = document.getElementById("celebration-overlay");
  if (!overlay) return;

  const container = document.getElementById("confetti-container");
  if (container) {
    container.innerHTML = "";
    const colors = ["#ffd700", "#ff6b6b", "#4fc3f7", "#81c784", "#ffb74d", "#ce93d8", "#f06292"];
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left          = Math.random() * 100 + "vw";
      piece.style.background    = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width         = (7 + Math.random() * 9) + "px";
      piece.style.height        = (7 + Math.random() * 9) + "px";
      piece.style.borderRadius  = Math.random() > 0.4 ? "50%" : "3px";
      piece.style.animationDuration = (1.8 + Math.random() * 2.2) + "s";
      piece.style.animationDelay   = (Math.random() * 1.8) + "s";
      container.appendChild(piece);
    }
  }

  const scoreEl = document.getElementById("celebration-score");
  if (scoreEl) scoreEl.textContent = t("celebrationScore", { score: totalScore.toLocaleString() });

  overlay.classList.remove("hidden");
  overlay.addEventListener("click", () => overlay.classList.add("hidden"), { once: true });
  setTimeout(() => overlay.classList.add("hidden"), 5000);
}

function triggerHighScorePulse() {
  if (finalScoreEl) {
    finalScoreEl.classList.add("glow-new-high");
    setTimeout(() => finalScoreEl.classList.remove("glow-new-high"), 4000);
  }
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
document.addEventListener("DOMContentLoaded", async () => {
  applyTranslations();
  document.title = t("pageTitle");
  initLangToggle();

  if (localStorage.getItem("bgPasswordOk") === "1") {
    showScreen("register");
  } else {
    showScreen("password");
  }

  await Promise.all([loadQuestions(), loadExistingPlayers()]);
});
