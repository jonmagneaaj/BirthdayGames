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
const QUESTION_DURATION_MS = 30_000; // 30 seconds in ms
const TICK_MS             = 100;     // scoring granularity: 1 point per 100ms
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
    showError("Ingen spørsmål funnet! Be verten om å legge til spørsmål først.");
    throw new Error("No questions in Firestore");
  }
}

// ===== LOAD EXISTING PLAYERS =====
async function loadExistingPlayers() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "users"), orderBy("name"), limit(100))
    );
    allPlayers = snapshot.docs.map((d) => ({ id: d.id, name: d.data().name }));
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
    nameSearchList.innerHTML = `<div class="search-empty">Ingen treff — skriv inn et nytt navn</div>`;
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
    answers:    shuffled.map(t => t.a),
    correctIdx: shuffled.findIndex(t => t.isCorrect),
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
  if (questionCounter)     questionCounter.textContent = `Spørsmål ${idx + 1} / ${QUESTIONS_PER_GAME}`;
  if (currentScoreDisplay) currentScoreDisplay.textContent = `Poeng: ${totalScore.toLocaleString()}`;
  if (questionText)        questionText.textContent = q.question;

  const { answers: shuffledAnswers, correctIdx } = shuffleAnswers(q.answers, q.correct);
  currentCorrectIdx = correctIdx;

  if (answersGrid) {
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
    // -1 point per 100ms: 1000→700 over 30s, finer than any setInterval approach
    pointsEarned = Math.max(0, SCORE_PER_CORRECT - ticks);
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
  pointsToast.textContent = isCorrect ? `+${points.toLocaleString()}` : "✗ Ingen poeng";
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
      highScoreMsg.textContent = `🎉 Ny rekord! Din forrige beste var ${previousBestScore.toLocaleString()} poeng.`;
      highScoreMsg.className   = "high-score-msg high-score-new";
    } else if (totalScore === previousBestScore) {
      highScoreMsg.textContent = `Lik din forrige rekord (${previousBestScore.toLocaleString()} poeng).`;
      highScoreMsg.className   = "high-score-msg";
    } else {
      highScoreMsg.textContent = `Din rekord er fortsatt ${previousBestScore.toLocaleString()} poeng.`;
      highScoreMsg.className   = "high-score-msg";
    }
  }

  if (isNewHighScore) previousBestScore = totalScore;

  if (resultsNote) {
    resultsNote.textContent = isNewHighScore
      ? "Ny rekord lagret! Sjekk storskjermen for plasseringen din."
      : "Sjekk storskjermen for plasseringen din.";
  }

  showScreen("results");
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
    showError("Vennligst skriv inn navnet ditt.");
    return;
  }
  if (name.length < 2) {
    showError("Navnet må ha minst 2 tegn.");
    return;
  }
  if (name.length > 30) {
    showError("Navnet er for langt (maks 30 tegn).");
    return;
  }

  setLoading(true);
  hideError();

  try {
    await registerPlayer(name);
  } catch (err) {
    console.error("Registration error:", err);
    showError("Noe gikk galt. Sjekk tilkoblingen og prøv igjen.");
    setLoading(false);
  }
}

function setLoading(loading) {
  if (btnRegister) {
    btnRegister.disabled  = loading;
    btnRegister.textContent = loading ? "Laster…" : "La oss spille!";
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
  showScreen("register");
  await Promise.all([loadQuestions(), loadExistingPlayers()]);
});
