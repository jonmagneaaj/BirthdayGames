import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== CONSTANTS =====
const QUESTIONS_PER_GAME = 10;
const SECONDS_PER_QUESTION = 30;
const SCORE_PER_CORRECT = 1000;
const SCORE_PENALTY_PER_SECOND = 10; // points lost per second elapsed

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

// ===== DOM REFS =====
const screens = {
  register: document.getElementById("screen-register"),
  quiz: document.getElementById("screen-quiz"),
  results: document.getElementById("screen-results"),
  done: document.getElementById("screen-done"),
};

const nameInput = document.getElementById("player-name-input");
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
const btnViewLeaderboard = document.getElementById("btn-view-leaderboard");

const doneScoreEl = document.getElementById("done-score");

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
    showError("No questions found! Ask the host to add questions first.");
    throw new Error("No questions in Firestore");
  }
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
  // Check if player already exists
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("name", "==", name));
  const existing = await getDocs(q);

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const data = existingDoc.data();

    if (data.quizCompleted) {
      // Already played — show done screen
      userId = existingDoc.id;
      playerName = name;
      doneScoreEl.textContent = (data.quizScore || 0).toLocaleString();
      showScreen("done");
      return;
    }

    // Registered but not completed — let them play again
    userId = existingDoc.id;
    playerName = name;
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

  // Update progress bar
  if (progressBar) progressBar.style.width = progress + "%";

  // Update counter
  if (questionCounter) questionCounter.textContent = `Question ${idx + 1} / ${QUESTIONS_PER_GAME}`;
  if (currentScoreDisplay) currentScoreDisplay.textContent = `Score: ${totalScore.toLocaleString()}`;

  // Set question text
  if (questionText) questionText.textContent = q.question;

  // Shuffle answer positions for this question
  const { answers: shuffledAnswers, correctIdx } = shuffleAnswers(q.answers, q.correct);
  currentCorrectIdx = correctIdx;

  // Render answer buttons
  if (answersGrid) {
    answersGrid.innerHTML = shuffledAnswers.map((ans, i) => `
      <button class="answer-btn" data-index="${i}">${escapeHtml(ans)}</button>
    `).join("");

    answersGrid.querySelectorAll(".answer-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.index)));
    });
  }

  // Start timer
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

    // Color shifts: green → yellow → red
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

  // Visual feedback
  const btns = answersGrid.querySelectorAll(".answer-btn");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentCorrectIdx) btn.classList.add("correct");
    else if (i === selectedIdx && !isCorrect) btn.classList.add("wrong");
  });

  // Points toast
  showPointsToast(pointsEarned, isCorrect);

  // Advance after delay
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

  pointsToast.textContent = isCorrect ? `+${points.toLocaleString()}` : "✗ No points";
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

  // Update Firestore
  if (userId) {
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

  showScreen("results");
}

// ===== VIEW LEADERBOARD =====
if (btnViewLeaderboard) {
  btnViewLeaderboard.addEventListener("click", () => {
    window.location.href = "index.html";
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
}

async function handleRegister() {
  const name = nameInput ? nameInput.value.trim() : "";

  if (!name) {
    showError("Please enter your name.");
    return;
  }
  if (name.length < 2) {
    showError("Name must be at least 2 characters.");
    return;
  }
  if (name.length > 30) {
    showError("Name too long (max 30 characters).");
    return;
  }

  setLoading(true);
  hideError();

  try {
    await registerPlayer(name);
  } catch (err) {
    console.error("Registration error:", err);
    showError("Something went wrong. Check your Firebase config and try again.");
    setLoading(false);
  }
}

function setLoading(loading) {
  if (btnRegister) {
    btnRegister.disabled = loading;
    btnRegister.textContent = loading ? "Loading…" : "Let's Play!";
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
  await loadQuestions();
});
