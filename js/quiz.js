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
const QUESTIONS_PER_GAME = 10;
const SECONDS_PER_QUESTION = 30;
const SCORE_PER_CORRECT = 1000;
const SCORE_PENALTY_PER_SECOND = 1; // points lost per second elapsed

// ===== STATE =====
let allQuestions = [];
let gameQuestions = [];
let currentQuestionIdx = 0;
let totalScore = 0;
let timerInterval = null;
let secondsElapsed = 0;
let answerLocked = false;
let currentCorrectIdx = 0;
let userId = null;
let playerName = "";
let questionResults = [];
let previousBestScore = 0;
let allPlayers = []; // for name autocomplete

// ===== DOM REFS =====
const screens = {
  register: document.getElementById("screen-register"),
  quiz: document.getElementById("screen-quiz"),
  results: document.getElementById("screen-results"),
};

const nameInput = document.getElementById("player-name-input");
const nameSuggestions = document.getElementById("name-suggestions");
const btnRegister = document.getElementById("btn-register");
const errorMsg = document.getElementById("register-error");

const progressBar = document.getElementById("progress-bar");
const questionCounter = document.getElementById("question-counter");
const currentScoreDisplay = document.getElementById("current-score-display");
const questionText = document.getElementById("question-text");
const answersGrid = document.getElementById("answers-grid");
const timerText = document.getElementById("timer-text");
const timerRing = document.getElementById("timer-ring");
const pointsToast = document.getElementById("points-toast");

const finalScoreEl = document.getElementById("final-score");
const correctCountEl = document.getElementById("correct-count");
const avgTimeEl = document.getElementById("avg-time");
const highScoreMsg = document.getElementById("high-score-msg");
const btnViewLeaderboard = document.getElementById("btn-view-leaderboard");
const btnPlayAgain = document.getElementById("btn-play-again");

// ===== SCREEN MANAGEMENT =====
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    if (key === name) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

// ===== LOAD QUESTIONS FROM FIRESTORE =====
async function loadQuestions() {
  const snapshot = await getDocs(collection(db, "questions"));
  allQuestions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (allQuestions.length === 0) {
    showError("Ingen spørsmål funnet! Be verten om å legge til spørsmål først.");
    throw new Error("No questions in Firestore");
  }
}

// ===== LOAD EXISTING PLAYERS (for autocomplete) =====
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

  // Pre-fill last used name
  const lastName = localStorage.getItem("bgLastName");
  if (lastName && nameInput) {
    nameInput.value = lastName;
  }

  renderSuggestions(nameInput ? nameInput.value : "");
}

// ===== NAME SUGGESTIONS =====
function renderSuggestions(filter) {
  if (!nameSuggestions) return;

  const trimmed = filter.trim().toLowerCase();
  let matches;

  if (trimmed === "") {
    // Show all players (up to 8)
    matches = allPlayers.slice(0, 8);
  } else {
    matches = allPlayers.filter((p) =>
      p.name.toLowerCase().startsWith(trimmed)
    );
    // Hide list if there's an exact match
    if (matches.length === 1 && matches[0].name.toLowerCase() === trimmed) {
      nameSuggestions.innerHTML = "";
      return;
    }
  }

  if (matches.length === 0) {
    nameSuggestions.innerHTML = "";
    return;
  }

  nameSuggestions.innerHTML = matches
    .map(
      (p) =>
        `<div class="name-suggestion" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>`
    )
    .join("");

  nameSuggestions.querySelectorAll(".name-suggestion").forEach((el) => {
    el.addEventListener("click", () => {
      if (nameInput) nameInput.value = el.dataset.name;
      nameSuggestions.innerHTML = "";
      if (btnRegister) btnRegister.focus();
    });
  });
}

// ===== FISHER-YATES SHUFFLE =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== SHUFFLE ANSWERS (tracks where correct answer lands) =====
function shuffleAnswers(answers, correctIdx) {
  const tagged = answers.map((a, i) => ({ a, isCorrect: i === correctIdx }));
  const shuffled = shuffle(tagged);
  return {
    answers: shuffled.map(t => t.a),
    correctIdx: shuffled.findIndex(t => t.isCorrect),
  };
}

// ===== REGISTRATION =====
async function registerPlayer(name) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("name", "==", name));
  const existing = await getDocs(q);

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

  // New player — create document
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
  gameQuestions = shuffle(allQuestions).slice(0, QUESTIONS_PER_GAME);
  currentQuestionIdx = 0;
  totalScore = 0;
  questionResults = [];
  showScreen("quiz");
  loadQuestion(0);
}

// ===== LOAD QUESTION =====
function loadQuestion(idx) {
  clearInterval(timerInterval);
  answerLocked = false;
  secondsElapsed = 0;

  const q = gameQuestions[idx];
  const progress = (idx / QUESTIONS_PER_GAME) * 100;

  if (progressBar) progressBar.style.width = progress + "%";
  if (questionCounter) questionCounter.textContent = `Spørsmål ${idx + 1} / ${QUESTIONS_PER_GAME}`;
  if (currentScoreDisplay) currentScoreDisplay.textContent = `Poeng: ${totalScore.toLocaleString()}`;
  if (questionText) questionText.textContent = q.question;

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
const CIRCUMFERENCE = 188.5; // 2 * PI * 30 (radius)

function startTimer() {
  secondsElapsed = 0;
  updateTimerDisplay(SECONDS_PER_QUESTION);

  timerInterval = setInterval(() => {
    secondsElapsed++;
    const remaining = SECONDS_PER_QUESTION - secondsElapsed;

    updateTimerDisplay(remaining);

    if (remaining <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 1000);
}

function updateTimerDisplay(remaining) {
  if (timerText) timerText.textContent = remaining;

  if (timerRing) {
    const fraction = remaining / SECONDS_PER_QUESTION;
    const offset = CIRCUMFERENCE * (1 - fraction);
    timerRing.style.strokeDashoffset = offset;

    if (fraction > 0.5) {
      timerRing.style.stroke = "#4caf50";
    } else if (fraction > 0.25) {
      timerRing.style.stroke = "#ff9800";
    } else {
      timerRing.style.stroke = "#f44336";
    }
  }
}

// ===== HANDLE ANSWER =====
function handleAnswer(selectedIdx) {
  if (answerLocked) return;
  answerLocked = true;
  clearInterval(timerInterval);

  const isCorrect = selectedIdx === currentCorrectIdx;

  let pointsEarned = 0;
  if (isCorrect) {
    pointsEarned = Math.max(0, SCORE_PER_CORRECT - secondsElapsed * SCORE_PENALTY_PER_SECOND);
    totalScore += pointsEarned;
  }

  questionResults.push({ isCorrect, secondsElapsed });

  const btns = answersGrid.querySelectorAll(".answer-btn");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentCorrectIdx) btn.classList.add("correct");
    else if (i === selectedIdx && !isCorrect) btn.classList.add("wrong");
  });

  showPointsToast(pointsEarned, isCorrect);
  setTimeout(() => nextQuestion(), 1400);
}

function handleTimeout() {
  if (answerLocked) return;
  answerLocked = true;

  questionResults.push({ isCorrect: false, secondsElapsed: SECONDS_PER_QUESTION });

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
  pointsToast.classList.remove("wrong-toast");
  if (!isCorrect) pointsToast.classList.add("wrong-toast");

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

  // Only update Firestore if it's a new high score
  if (userId && isNewHighScore) {
    try {
      await updateDoc(doc(db, "users", userId), {
        quizScore: totalScore,
        quizCompleted: true,
      });
    } catch (err) {
      console.error("Failed to save score:", err);
    }
  }

  // Show results
  const correctCount = questionResults.filter((r) => r.isCorrect).length;
  const avgTime = questionResults.length > 0
    ? Math.round(questionResults.reduce((s, r) => s + r.secondsElapsed, 0) / questionResults.length)
    : 0;

  if (finalScoreEl) finalScoreEl.textContent = totalScore.toLocaleString();
  if (correctCountEl) correctCountEl.textContent = `${correctCount} / ${QUESTIONS_PER_GAME}`;
  if (avgTimeEl) avgTimeEl.textContent = `${avgTime}s`;
  if (progressBar) progressBar.style.width = "100%";

  // High score feedback
  if (highScoreMsg) {
    if (previousBestScore === 0) {
      highScoreMsg.textContent = "";
      highScoreMsg.className = "high-score-msg";
    } else if (isNewHighScore) {
      highScoreMsg.textContent = `🎉 Ny rekord! Din forrige beste var ${previousBestScore.toLocaleString()} poeng.`;
      highScoreMsg.className = "high-score-msg high-score-new";
    } else if (totalScore === previousBestScore) {
      highScoreMsg.textContent = `Lik din forrige rekord (${previousBestScore.toLocaleString()} poeng).`;
      highScoreMsg.className = "high-score-msg";
    } else {
      highScoreMsg.textContent = `Din rekord er fortsatt ${previousBestScore.toLocaleString()} poeng.`;
      highScoreMsg.className = "high-score-msg";
    }
  }

  // Update previousBestScore for potential replays
  if (isNewHighScore) previousBestScore = totalScore;

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
  btnPlayAgain.addEventListener("click", () => {
    startQuiz();
  });
}

// ===== REGISTER FLOW =====
if (btnRegister) {
  btnRegister.addEventListener("click", handleRegister);
}

if (nameInput) {
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleRegister();
  });
  nameInput.addEventListener("input", () => {
    renderSuggestions(nameInput.value);
  });
  nameInput.addEventListener("focus", () => {
    renderSuggestions(nameInput.value);
  });
  // Hide suggestions when clicking elsewhere
  document.addEventListener("click", (e) => {
    if (!nameInput.contains(e.target) && nameSuggestions && !nameSuggestions.contains(e.target)) {
      if (nameSuggestions) nameSuggestions.innerHTML = "";
    }
  });
}

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

  if (nameSuggestions) nameSuggestions.innerHTML = "";
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
    btnRegister.disabled = loading;
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
