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
    category: "Barndom",
    icon: "👶",
    text: "Hva var [navn]s favoritt-TV-program som barn?",
    hint: "Tenk tegnefilmer, lørdagsmorgenprogrammer, eller den serien de så på repeat.",
  },
  {
    category: "Barndom",
    icon: "🏠",
    text: "I hvilken gate eller by vokste [navn] opp?",
    hint: "Bruk det ekte stedet som ett svar og finn på tre troverdige alternativer.",
  },
  {
    category: "Barndom",
    icon: "🐾",
    text: "Hva het [navn]s første kjæledyr?",
    hint: "Perfekt for de som kjenner [navn] godt — bruk det ekte navnet og tre distrahere alternativer.",
  },
  {
    category: "Barndom",
    icon: "🎒",
    text: "Hva var [navn]s minst favorittfag på skolen?",
    hint: "Maths? Gym? Kunst? Spør familien på forhånd hvis du er usikker.",
  },
  {
    category: "Mat og drikke",
    icon: "🍕",
    text: "Hva er [navn]s go-to takeaway-bestilling på en lat fredagskveld?",
    hint: "Pizza, kebab, kinesisk, sushi — velg det som passer best og legg til morsomme gale alternativer.",
  },
  {
    category: "Mat og drikke",
    icon: "☕",
    text: "Hvordan drikker [navn] morgenkaffen sin?",
    hint: "Flat white? Sort? Tre sukker? Eller er de en te-person?",
  },
  {
    category: "Mat og drikke",
    icon: "🍰",
    text: "Hvilken smak bursdagskake ville [navn] hemmelig foretrekke over alle andre?",
    hint: "Klassisk sjokolade, sitronkake, gulrotkake, eller noe vilt?",
  },
  {
    category: "Mat og drikke",
    icon: "🍺",
    text: "Hva er [navn]s signaturdrikk på baren?",
    hint: "Fatøl? Gin og tonic? Bare lime og soda?",
  },
  {
    category: "Reise",
    icon: "✈️",
    text: "Hvilket land er øverst på [navn]s reise-bucket-list?",
    hint: "Japan, Island, New Zealand, Peru? Spør dem — eller gjett!",
  },
  {
    category: "Reise",
    icon: "🗺️",
    text: "Hva var [navn]s mest minneverdige feriemål?",
    hint: "Tenk på turene de alltid nevner i samtalen.",
  },
  {
    category: "Reise",
    icon: "🧳",
    text: "Hva glemmer [navn] alltid å pakke når de reiser?",
    hint: "Lader, tannbørste, solkrem, reiseadapter?",
  },
  {
    category: "Popkultur",
    icon: "🎬",
    text: "Hvilken film kan [navn] sitere nesten ord for ord?",
    hint: "Tenk på filmer de har fått alle til å se minst to ganger.",
  },
  {
    category: "Popkultur",
    icon: "📺",
    text: "Hvilken TV-serie bingewatchet [navn] sist?",
    hint: "Velg aktuelle serier og noen klassikere som svaralternativer.",
  },
  {
    category: "Popkultur",
    icon: "🎵",
    text: "Hvilken sang setter [navn] alltid på først på en fest hjemme?",
    hint: "Hymnen deres — sangen alle forbinder med dem.",
  },
  {
    category: "Popkultur",
    icon: "🎤",
    text: "Hva er [navn]s go-to karaoke-sang?",
    hint: "Bonuspoeng hvis den er pinlig utenfor stemmeregisteret deres.",
  },
  {
    category: "Jobb og karriere",
    icon: "💼",
    text: "Hva var [navn]s aller første jobb?",
    hint: "Barnevakt? Fast food? Avislevering? Bruk den ekte og finn på andre.",
  },
  {
    category: "Jobb og karriere",
    icon: "🎓",
    text: "Hva studerte [navn] på universitetet?",
    hint: "Eller hvis de ikke gikk dit, hvilken jobb trodde de de ville ha som 10-åring?",
  },
  {
    category: "Jobb og karriere",
    icon: "🌟",
    text: "Hva er [navn]s hemmelige drømmejobb om penger ikke var et problem?",
    hint: "Astronaut, kokk, profesjonell hundeklemmer — jo mer personlig, jo bedre.",
  },
  {
    category: "Personlighet",
    icon: "⏰",
    text: "Hvor tidlig ankommer [navn] egentlig til ting?",
    hint: "Kronisk tidlig, akkurat i tide, moteriktig sen, eller kronisk sen?",
  },
  {
    category: "Personlighet",
    icon: "📱",
    text: "Hvilken app bruker [navn] mest tid på?",
    hint: "Instagram, TikTok, YouTube, eller et obskurt spill?",
  },
  {
    category: "Personlighet",
    icon: "🛌",
    text: "Når våkner [navn] naturlig i helgene?",
    hint: "Tidlig på trening? Luksusen av å sove lenge? Når noen sender melding?",
  },
  {
    category: "Personlighet",
    icon: "💸",
    text: "Hva ville [navn] spleise på om de fikk 5 000 kr akkurat nå?",
    hint: "Sko, gadgets, en weekendtur, eller rett i sparegrisen?",
  },
  {
    category: "Gøy og tilfeldig",
    icon: "🦸",
    text: "Hvilken superkraft ville [navn] velge?",
    hint: "Usynlighet, tidsreiser, flyving, eller tankeleser?",
  },
  {
    category: "Gøy og tilfeldig",
    icon: "🏝️",
    text: "Hva ville [navn] ta med til en øde øy?",
    hint: "Gjør dette til en flervalgsoppgave: hvilken kombinasjon er mest typisk for dem?",
  },
  {
    category: "Gøy og tilfeldig",
    icon: "🐉",
    text: "Hvilket Game of Thrones / fantasy-hus ville [navn] tilhøre?",
    hint: "Stark, Lannister, Targaryen eller Baratheon? Tilpass til fandomet de elsker.",
  },
  {
    category: "Gøy og tilfeldig",
    icon: "🧀",
    text: "Hvilken mat ville [navn] gjerne spise hver eneste dag i et år?",
    hint: "Jo mer spesifikt og personlig, jo morsommere blir gjetteleken.",
  },
  {
    category: "Venner og familie",
    icon: "👯",
    text: "Hvem har vært [navn]s venn lengst i dette rommet?",
    hint: "List opp noen navn som svar — holder det personlig og gir reaksjoner!",
  },
  {
    category: "Venner og familie",
    icon: "📞",
    text: "Hvem ringer [navn] først når noe spennende skjer?",
    hint: "Mamma, bestevenn, kjæreste? Bruk ekte navn for maksimalt kaos.",
  },
  {
    category: "Venner og familie",
    icon: "🎁",
    text: "Hva er den beste gaven [navn] noensinne har fått?",
    hint: "Spør dem på forhånd og bruk det ekte svaret — overrasker folk.",
  },
  {
    category: "Milepæler",
    icon: "🚗",
    text: "Hvor gammel var [navn] da de tok lappen?",
    hint: "Bruk den ekte alderen og tre nærliggende alternativer (f.eks. 17, 18, 19, 21).",
  },
  {
    category: "Milepæler",
    icon: "🏡",
    text: "Hvilken by eller sted bodde [navn] i da de var lykkeligst?",
    hint: "Et personlig spørsmål som alltid utløser en god historie!",
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
const answersFormEn = document.getElementById("answers-form-en");
const btnAddQuestion = document.getElementById("btn-add-question");
const formStatus = document.getElementById("form-status");
const questionInput = document.getElementById("question-input");
const questionInputEn = document.getElementById("question-input-en");

const questionsList = document.getElementById("questions-list");
const questionCountBadge = document.getElementById("question-count-badge");

// ===== AUTH =====
btnLogin && btnLogin.addEventListener("click", tryLogin);
authInput && authInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

function tryLogin() {
  if (authInput.value === ADMIN_PASSWORD) {
    authError.textContent = "";
    localStorage.setItem("bgAuth", "1");
    screenAuth.classList.remove("active");
    screenMain.classList.add("active");
    loadQuestions();
    showRandomInspiration();
  } else {
    authError.textContent = "Feil passord.";
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
      <input type="text" class="ds-input answer-input" placeholder="Answer ${labels[i]}…" data-index="${i}" />
      <div class="correct-radio-wrap${i === selectedCorrect ? " selected" : ""}" data-index="${i}" title="Mark as correct answer">
        <input type="radio" name="correct" value="${i}" ${i === selectedCorrect ? "checked" : ""} />
        <div class="radio-dot"></div>
      </div>
    </div>
  `).join("");

  if (answersFormEn) {
    answersFormEn.innerHTML = Array.from({ length: selectedAnswerCount }, (_, i) => `
      <div class="answer-row" data-index="${i}">
        <span class="answer-row-label">${labels[i]}</span>
        <input type="text" class="ds-input answer-input-en" placeholder="Answer ${labels[i]} (EN)…" data-index="${i}" />
      </div>
    `).join("");
  }

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
  const questionText   = questionInput   ? questionInput.value.trim()   : "";
  const questionTextEn = questionInputEn ? questionInputEn.value.trim() : "";
  if (!questionText) { showFormStatus("Vennligst skriv inn et spørsmål.", "error"); return; }

  const inputs   = answersForm   ? answersForm.querySelectorAll(".answer-input")    : [];
  const inputsEn = answersFormEn ? answersFormEn.querySelectorAll(".answer-input-en") : [];
  const answers   = Array.from(inputs).map((i) => i.value.trim());
  const answersEn = Array.from(inputsEn).map((i) => i.value.trim());

  // Validate: need at least 2 non-empty answers
  const filledCount = answers.filter(Boolean).length;
  if (filledCount < 2) { showFormStatus("Fyll inn minst 2 svar.", "error"); return; }

  // Validate correct answer is filled
  if (!answers[selectedCorrect]) { showFormStatus("Det markerte riktige svaret kan ikke være tomt.", "error"); return; }

  // Remove trailing empty answers and adjust correct index
  const filteredAnswers   = answers.slice(0, selectedAnswerCount).filter(Boolean);
  const filteredAnswersEn = answersEn.slice(0, selectedAnswerCount);

  // Re-compute correct index based on filled answers
  const correctText = answers[selectedCorrect];
  const correctIdx = filteredAnswers.indexOf(correctText);

  btnAddQuestion.disabled = true;
  btnAddQuestion.textContent = "Saving…";

  try {
    const docPayload = {
      question:  questionText,
      answers:   filteredAnswers,
      correct:   correctIdx,
      createdAt: serverTimestamp(),
    };
    if (questionTextEn) {
      docPayload.question_en = questionTextEn;
      docPayload.answers_en  = filteredAnswersEn;
    }
    await addDoc(collection(db, "questions"), docPayload);

    showFormStatus("Spørsmål lagt til!", "success");
    resetForm();
    await loadQuestions();
  } catch (err) {
    console.error("Add question error:", err);
    showFormStatus("Klarte ikke å lagre. Sjekk tilkoblingen din.", "error");
  } finally {
    btnAddQuestion.disabled = false;
    btnAddQuestion.textContent = "+ Legg til spørsmål";
  }
}

function resetForm() {
  if (questionInput)   questionInput.value   = "";
  if (questionInputEn) questionInputEn.value = "";
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
  questionsList.innerHTML = `<div class="list-loading">Laster…</div>`;

  try {
    const snapshot = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "asc")));
    questions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderQuestionsList();
  } catch (err) {
    console.error("Load questions error:", err);
    questionsList.innerHTML = `<div class="list-empty"><span class="icon">⚠️</span>Klarte ikke å laste spørsmål.</div>`;
  }
}

function renderQuestionsList() {
  if (questionCountBadge) questionCountBadge.textContent = `${questions.length} spørsmål`;

  if (questions.length === 0) {
    questionsList.innerHTML = `<div class="list-empty"><span class="icon">✏️</span>Ingen spørsmål ennå — legg til det første ovenfor!</div>`;
    return;
  }

  questionsList.innerHTML = questions.map((q, idx) => {
    const answersHtml = (q.answers || []).map((ans, i) =>
      `<div class="qa-item${i === q.correct ? " correct-ans" : ""}">${escapeHtml(ans)}</div>`
    ).join("");

    const hasEn = q.question_en || (q.answers_en && q.answers_en.length);
    const answersHtmlEn = hasEn ? (q.answers_en || []).map((ans, i) =>
      `<div class="qa-item qa-item-en${i === q.correct ? " correct-ans" : ""}">${escapeHtml(ans)}</div>`
    ).join("") : "";

    return `
      <div class="question-card" data-id="${q.id}">
        <div class="question-card-top">
          <span class="question-card-num">Q${idx + 1}</span>
          <div class="question-card-texts">
            <span class="question-card-text">${escapeHtml(q.question)}</span>
            ${hasEn ? `<span class="question-card-text-en">🇬🇧 ${escapeHtml(q.question_en || "")}</span>` : ""}
          </div>
          <button class="btn-delete-q" data-id="${q.id}">Delete</button>
        </div>
        <div class="question-answers">${answersHtml}</div>
        ${hasEn ? `<div class="question-answers question-answers-en">${answersHtmlEn}</div>` : ""}
      </div>`;
  }).join("");

  questionsList.querySelectorAll(".btn-delete-q").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuestion(btn.dataset.id));
  });
}

// ===== DELETE QUESTION =====
async function deleteQuestion(id) {
  if (!confirm("Slette dette spørsmålet?")) return;
  try {
    await deleteDoc(doc(db, "questions", id));
    questions = questions.filter((q) => q.id !== id);
    renderQuestionsList();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Klarte ikke å slette. Prøv igjen.");
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
  if (localStorage.getItem("bgAuth") === "1") {
    screenMain.classList.add("active");
    loadQuestions();
    showRandomInspiration();
  } else {
    screenAuth.classList.add("active");
  }
  selectedAnswerCount = 4;
  selectedCorrect = 0;
  renderAnswerInputs();
});
