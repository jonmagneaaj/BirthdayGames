import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== CONFIG =====
const ADMIN_PASSWORD = "12345";

// ===== INSPIRATION DATA =====
const INSPIRATIONS = [
  {
    category: "Childhood",
    icon: "👶",
    text: "What was [name]'s favourite TV show as a kid?",
    hint: "Think cartoons, Saturday morning shows, or that one series they watched on repeat.",
  },
  {
    category: "Childhood",
    icon: "🏠",
    text: "What street or town did [name] grow up in?",
    hint: "Use the real name as one answer and make up 3 plausible-sounding alternatives.",
  },
  {
    category: "Childhood",
    icon: "🐾",
    text: "What was the name of [name]'s first pet?",
    hint: "Great for true friends — use the real name and three red herrings.",
  },
  {
    category: "Childhood",
    icon: "🎒",
    text: "What was [name]'s least favourite subject at school?",
    hint: "Maths? PE? Art? Ask their family beforehand if you're not sure.",
  },
  {
    category: "Food & Drink",
    icon: "🍕",
    text: "What is [name]'s go-to takeaway order on a lazy Friday night?",
    hint: "Pizza, kebab, Chinese, sushi — pick what fits best and add fun wrong options.",
  },
  {
    category: "Food & Drink",
    icon: "☕",
    text: "How does [name] take their morning coffee?",
    hint: "Flat white? Black? Three sugars? Or are they a tea person?",
  },
  {
    category: "Food & Drink",
    icon: "🍰",
    text: "What flavour birthday cake would [name] secretly prefer over all others?",
    hint: "Classic chocolate, lemon drizzle, carrot cake, or something wild?",
  },
  {
    category: "Food & Drink",
    icon: "🍺",
    text: "What is [name]'s signature drink at the pub?",
    hint: "Pint of lager? Gin and tonic? Strictly lime and soda?",
  },
  {
    category: "Travel",
    icon: "✈️",
    text: "Which country is top of [name]'s travel bucket list?",
    hint: "Japan, Iceland, New Zealand, Peru? Ask them — or use your best guess!",
  },
  {
    category: "Travel",
    icon: "🗺️",
    text: "What was [name]'s most memorable holiday destination?",
    hint: "Think about the trips they always bring up in conversation.",
  },
  {
    category: "Travel",
    icon: "🧳",
    text: "What does [name] always forget to pack when travelling?",
    hint: "Charger, toothbrush, sunscreen, travel adapter?",
  },
  {
    category: "Pop Culture",
    icon: "🎬",
    text: "What film can [name] quote almost word for word?",
    hint: "Think about movies they've made everyone watch at least twice.",
  },
  {
    category: "Pop Culture",
    icon: "📺",
    text: "Which TV series did [name] binge-watch most recently?",
    hint: "Pick current shows and a couple of classics as answer options.",
  },
  {
    category: "Pop Culture",
    icon: "🎵",
    text: "What song does [name] always put on first at a house party?",
    hint: "Their anthem — the song everyone associates with them.",
  },
  {
    category: "Pop Culture",
    icon: "🎤",
    text: "What is [name]'s go-to karaoke song?",
    hint: "Bonus points if it's embarrassingly out of their range.",
  },
  {
    category: "Work & Career",
    icon: "💼",
    text: "What was [name]'s very first job?",
    hint: "Babysitting? Fast food? Delivering newspapers? Use the real one and invent others.",
  },
  {
    category: "Work & Career",
    icon: "🎓",
    text: "What did [name] study at university?",
    hint: "Or if they didn't go, what career did they think they'd have at age 10?",
  },
  {
    category: "Work & Career",
    icon: "🌟",
    text: "What is [name]'s secret dream job if money were no object?",
    hint: "Astronaut, chef, professional dog cuddler — the more personal the better.",
  },
  {
    category: "Personality",
    icon: "⏰",
    text: "How early does [name] actually arrive to things?",
    hint: "Chronically early, right on time, fashionably late, or chronically late?",
  },
  {
    category: "Personality",
    icon: "📱",
    text: "What app does [name] spend the most time on?",
    hint: "Instagram, TikTok, YouTube, or some obscure game?",
  },
  {
    category: "Personality",
    icon: "🛌",
    text: "What time does [name] naturally wake up on a weekend?",
    hint: "7am gym warrior? 11am luxury? Whenever someone texts them?",
  },
  {
    category: "Personality",
    icon: "💸",
    text: "What would [name] splurge on if given €500 right now?",
    hint: "Shoes, gadgets, a weekend trip, or straight to savings?",
  },
  {
    category: "Fun & Random",
    icon: "🦸",
    text: "Which superhero power would [name] choose?",
    hint: "Invisibility, time travel, flying, or reading minds?",
  },
  {
    category: "Fun & Random",
    icon: "🏝️",
    text: "What three things would [name] bring to a desert island?",
    hint: "Turn this into a multiple choice: which combination is most like them?",
  },
  {
    category: "Fun & Random",
    icon: "🐉",
    text: "Which Game of Thrones / fantasy house would [name] belong to?",
    hint: "Stark, Lannister, Targaryen, or Baratheon? Adapt to any fandom they love.",
  },
  {
    category: "Fun & Random",
    icon: "🧀",
    text: "What food would [name] happily eat every single day for a year?",
    hint: "The more specific and personal, the funnier the guessing will be.",
  },
  {
    category: "Friends & Family",
    icon: "👯",
    text: "Who has been [name]'s friend the longest in this room?",
    hint: "List a few names as answers — keeps it personal and gets a reaction!",
  },
  {
    category: "Friends & Family",
    icon: "📞",
    text: "Who does [name] call first when something exciting happens?",
    hint: "Mum, best friend, partner? Use real names for maximum chaos.",
  },
  {
    category: "Friends & Family",
    icon: "🎁",
    text: "What is the best gift [name] has ever received?",
    hint: "Ask them in advance and use the real answer — catches people off guard.",
  },
  {
    category: "Milestones",
    icon: "🚗",
    text: "How old was [name] when they passed their driving test?",
    hint: "Use the real age and three close alternatives (e.g. 17, 18, 19, 21).",
  },
  {
    category: "Milestones",
    icon: "🏡",
    text: "Which city or town did [name] live in when they were happiest?",
    hint: "A personal question that usually sparks a great story!",
  },
];

// ===== STATE =====
let selectedAnswerCount = 4;
let selectedCorrect = 0;
let questions = [];

// ===== DOM =====
const screenAuth = document.getElementById("screen-auth");
const screenMain = document.getElementById("screen-main");
const authInput = document.getElementById("auth-password");
const btnLogin = document.getElementById("btn-auth-login");
const authError = document.getElementById("auth-error");

const inspirationText = document.getElementById("inspiration-text");
const inspirationHint = document.getElementById("inspiration-hint");
const inspirationCategory = document.getElementById("inspiration-category");
const inspirationIcon = document.getElementById("inspiration-icon");
const btnRefresh = document.getElementById("btn-refresh-inspiration");

const answersForm = document.getElementById("answers-form");
const btnAddQuestion = document.getElementById("btn-add-question");
const formStatus = document.getElementById("form-status");
const questionInput = document.getElementById("question-input");

const questionsList = document.getElementById("questions-list");
const questionCountBadge = document.getElementById("question-count-badge");

// ===== AUTH =====
btnLogin && btnLogin.addEventListener("click", tryLogin);
authInput && authInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

function tryLogin() {
  if (authInput.value === ADMIN_PASSWORD) {
    authError.textContent = "";
    screenAuth.classList.remove("active");
    screenMain.classList.add("active");
    loadQuestions();
    showRandomInspiration();
  } else {
    authError.textContent = "Wrong password.";
    authInput.value = "";
    authInput.focus();
  }
}

// ===== INSPIRATION =====
let lastInspirationIdx = -1;

function showRandomInspiration() {
  let idx;
  do { idx = Math.floor(Math.random() * INSPIRATIONS.length); }
  while (idx === lastInspirationIdx && INSPIRATIONS.length > 1);
  lastInspirationIdx = idx;

  const item = INSPIRATIONS[idx];
  if (inspirationText) inspirationText.textContent = item.text;
  if (inspirationHint) inspirationHint.textContent = item.hint;
  if (inspirationCategory) inspirationCategory.textContent = item.category;
  if (inspirationIcon) inspirationIcon.textContent = item.icon;
}

btnRefresh && btnRefresh.addEventListener("click", () => {
  btnRefresh.classList.add("spinning");
  setTimeout(() => btnRefresh.classList.remove("spinning"), 400);
  showRandomInspiration();
});

// ===== ANSWER COUNT SELECTOR =====
document.querySelectorAll(".count-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAnswerCount = parseInt(btn.dataset.count);
    if (selectedCorrect >= selectedAnswerCount) selectedCorrect = 0;
    renderAnswerInputs();
  });
});

function renderAnswerInputs() {
  if (!answersForm) return;
  const labels = ["A", "B", "C", "D"];
  answersForm.innerHTML = Array.from({ length: selectedAnswerCount }, (_, i) => `
    <div class="answer-row" data-index="${i}">
      <span class="answer-row-label">${labels[i]}</span>
      <input type="text" class="answer-input" placeholder="Answer ${labels[i]}…" data-index="${i}" />
      <div class="correct-radio-wrap${i === selectedCorrect ? " selected" : ""}" data-index="${i}" title="Mark as correct answer">
        <input type="radio" name="correct" value="${i}" ${i === selectedCorrect ? "checked" : ""} />
        <div class="radio-dot"></div>
      </div>
    </div>
  `).join("");

  // Highlight correct input border
  updateCorrectHighlight();

  // Radio click
  answersForm.querySelectorAll(".correct-radio-wrap").forEach((wrap) => {
    wrap.addEventListener("click", () => {
      selectedCorrect = parseInt(wrap.dataset.index);
      answersForm.querySelectorAll(".correct-radio-wrap").forEach((w) => w.classList.remove("selected"));
      wrap.classList.add("selected");
      updateCorrectHighlight();
    });
  });
}

function updateCorrectHighlight() {
  if (!answersForm) return;
  answersForm.querySelectorAll(".answer-input").forEach((inp, i) => {
    inp.classList.toggle("correct-answer", i === selectedCorrect);
  });
}

// ===== ADD QUESTION =====
btnAddQuestion && btnAddQuestion.addEventListener("click", submitQuestion);

async function submitQuestion() {
  const questionText = questionInput ? questionInput.value.trim() : "";
  if (!questionText) { showFormStatus("Please enter a question.", "error"); return; }

  const inputs = answersForm ? answersForm.querySelectorAll(".answer-input") : [];
  const answers = Array.from(inputs).map((i) => i.value.trim());

  // Validate: need at least 2 non-empty answers
  const filledCount = answers.filter(Boolean).length;
  if (filledCount < 2) { showFormStatus("Please fill in at least 2 answers.", "error"); return; }

  // Validate correct answer is filled
  if (!answers[selectedCorrect]) { showFormStatus("The marked correct answer can't be empty.", "error"); return; }

  // Remove trailing empty answers and adjust correct index
  const filteredAnswers = answers.slice(0, selectedAnswerCount).filter(Boolean);

  // Re-compute correct index based on filled answers
  const correctText = answers[selectedCorrect];
  const correctIdx = filteredAnswers.indexOf(correctText);

  btnAddQuestion.disabled = true;
  btnAddQuestion.textContent = "Saving…";

  try {
    await addDoc(collection(db, "questions"), {
      question: questionText,
      answers: filteredAnswers,
      correct: correctIdx,
      createdAt: serverTimestamp(),
    });

    showFormStatus("Question added!", "success");
    resetForm();
    await loadQuestions();
  } catch (err) {
    console.error("Add question error:", err);
    showFormStatus("Failed to save. Check your connection.", "error");
  } finally {
    btnAddQuestion.disabled = false;
    btnAddQuestion.textContent = "+ Add Question";
  }
}

function resetForm() {
  if (questionInput) questionInput.value = "";
  selectedCorrect = 0;
  renderAnswerInputs();
}

function showFormStatus(msg, type) {
  if (!formStatus) return;
  formStatus.textContent = msg;
  formStatus.className = `form-status ${type}`;
  if (type === "success") setTimeout(() => { formStatus.className = "form-status"; }, 3500);
}

// ===== LOAD QUESTIONS =====
async function loadQuestions() {
  if (!questionsList) return;
  questionsList.innerHTML = `<div class="list-loading">Loading…</div>`;

  try {
    const snapshot = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "asc")));
    questions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderQuestionsList();
  } catch (err) {
    console.error("Load questions error:", err);
    questionsList.innerHTML = `<div class="list-empty"><span class="icon">⚠️</span>Failed to load questions.</div>`;
  }
}

function renderQuestionsList() {
  if (questionCountBadge) questionCountBadge.textContent = `${questions.length} question${questions.length !== 1 ? "s" : ""}`;

  if (questions.length === 0) {
    questionsList.innerHTML = `<div class="list-empty"><span class="icon">✏️</span>No questions yet — add your first one above!</div>`;
    return;
  }

  questionsList.innerHTML = questions.map((q, idx) => {
    const answersHtml = (q.answers || []).map((ans, i) =>
      `<div class="qa-item${i === q.correct ? " correct-ans" : ""}">${escapeHtml(ans)}</div>`
    ).join("");

    return `
      <div class="question-card" data-id="${q.id}">
        <div class="question-card-top">
          <span class="question-card-num">Q${idx + 1}</span>
          <span class="question-card-text">${escapeHtml(q.question)}</span>
          <button class="btn-delete-q" data-id="${q.id}">Delete</button>
        </div>
        <div class="question-answers">${answersHtml}</div>
      </div>`;
  }).join("");

  questionsList.querySelectorAll(".btn-delete-q").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuestion(btn.dataset.id));
  });
}

// ===== DELETE QUESTION =====
async function deleteQuestion(id) {
  if (!confirm("Delete this question?")) return;
  try {
    await deleteDoc(doc(db, "questions", id));
    questions = questions.filter((q) => q.id !== id);
    renderQuestionsList();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete. Try again.");
  }
}

// ===== UTILS =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  screenAuth.classList.add("active");
  selectedAnswerCount = 4;
  selectedCorrect = 0;
  renderAnswerInputs();
});
