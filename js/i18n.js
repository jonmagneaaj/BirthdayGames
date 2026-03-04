// ===== TRANSLATIONS =====
export const TRANSLATIONS = {
  no: {
    // --- play.html / quiz.js ---
    pageTitle:          "Birthday Games — Spill!",
    heroHeading:        "Bli med på festen!",
    heroSubtitle:       "10 spørsmål · 15 sekunder per spørsmål · Svar raskt for makspoeng!",
    nameLabel:          "Navnet ditt",
    namePlaceholder:    "Trykk for å velge navn…",
    playBtn:            "La oss spille!",
    leaderboardLink:    "📊 Se resultattavlen",
    registerNote:       "Opptil 1 000 poeng per spørsmål — poengene teller ned fra 1 000 til 0",
    questionCounter:    "Spørsmål {idx} / {total}",
    scoreDisplay:       "Poeng: {score}",
    quizDone:           "Quiz fullført!",
    scoreLabel:         "poeng",
    correctAnswers:     "Riktige svar",
    avgTime:            "Gj.snitt svartid",
    playAgain:          "Spill igjen →",
    viewLeaderboard:    "Se resultattavlen →",
    celebrationTitle:   "Du leder nå!",
    celebrationSub:     "Gratulerer — du er på toppen!",
    noMatchHint:        "Ingen treff — skriv inn et nytt navn",
    searchPlaceholder:  "Skriv inn navnet ditt…",
    searchPlayBtn:      "La oss spille!",
    toastNoPoints:      "✗ Ingen poeng",
    toastPoints:        "+{points}",
    errNameRequired:    "Vennligst skriv inn navnet ditt.",
    errNameTooShort:    "Navnet må ha minst 2 tegn.",
    errNameTooLong:     "Navnet er for langt (maks 30 tegn).",
    errGeneric:         "Noe gikk galt. Sjekk tilkoblingen og prøv igjen.",
    errNoQuestions:     "Ingen spørsmål funnet! Be verten om å legge til spørsmål først.",
    loading:            "Laster…",
    highScoreNew:       "🎉 Ny rekord! Din forrige beste var {prev} poeng.",
    highScoreEqual:     "Lik din forrige rekord ({prev} poeng).",
    highScoreBelow:     "Din rekord er fortsatt {prev} poeng.",
    resultsNoteNew:     "Ny rekord lagret! Sjekk storskjermen for plasseringen din.",
    resultsNoteDefault: "Sjekk storskjermen for plasseringen din.",
    celebrationScore:   "{score} poeng",

    // --- leaderboard-mobil.html / leaderboard-mobil.js ---
    lbPageTitle:        "Birthday Games — Resultattavle",
    tabQuiz:            "🧠 Quizpoeng",
    tabLive:            "⚡ Livepoeng",
    backToPlay:         "Spill",
    teamsHeader:        "🏆 Lagoppsett",
    noPlayers:          "Ingen spillere ennå.",
    playerCount:        "{n} spiller",
    playerCountPlural:  "{n} spillere",
    connectionError:    "Tilkoblingsfeil.",
    tabTeams:           "🏆 Lagspill",
    updatedAt:          "Oppdatert {time}",
  },

  en: {
    // --- play.html / quiz.js ---
    pageTitle:          "Birthday Games — Play!",
    heroHeading:        "Join the party!",
    heroSubtitle:       "10 questions · 15 seconds per question · Answer fast for max points!",
    nameLabel:          "Your name",
    namePlaceholder:    "Tap to choose a name…",
    playBtn:            "Let's play!",
    leaderboardLink:    "📊 View leaderboard",
    registerNote:       "Up to 1,000 points per question — points count down from 1,000 to 0",
    questionCounter:    "Question {idx} / {total}",
    scoreDisplay:       "Score: {score}",
    quizDone:           "Quiz complete!",
    scoreLabel:         "points",
    correctAnswers:     "Correct answers",
    avgTime:            "Avg. response time",
    playAgain:          "Play again →",
    viewLeaderboard:    "View leaderboard →",
    celebrationTitle:   "You're in the lead!",
    celebrationSub:     "Congratulations — you're at the top!",
    noMatchHint:        "No match — type in a new name",
    searchPlaceholder:  "Type your name…",
    searchPlayBtn:      "Let's play!",
    toastNoPoints:      "✗ No points",
    toastPoints:        "+{points}",
    errNameRequired:    "Please enter your name.",
    errNameTooShort:    "Name must be at least 2 characters.",
    errNameTooLong:     "Name is too long (max 30 characters).",
    errGeneric:         "Something went wrong. Check your connection and try again.",
    errNoQuestions:     "No questions found! Ask the host to add questions first.",
    loading:            "Loading…",
    highScoreNew:       "🎉 New record! Your previous best was {prev} points.",
    highScoreEqual:     "Matched your previous record ({prev} points).",
    highScoreBelow:     "Your record is still {prev} points.",
    resultsNoteNew:     "New record saved! Check the big screen for your ranking.",
    resultsNoteDefault: "Check the big screen for your ranking.",
    celebrationScore:   "{score} points",

    // --- leaderboard-mobil.html / leaderboard-mobil.js ---
    lbPageTitle:        "Birthday Games — Leaderboard",
    tabQuiz:            "🧠 Quiz points",
    tabLive:            "⚡ Live points",
    backToPlay:         "Play",
    teamsHeader:        "🏆 Team setup",
    noPlayers:          "No players yet.",
    playerCount:        "{n} player",
    playerCountPlural:  "{n} players",
    connectionError:    "Connection error.",
    tabTeams:           "🏆 Team play",
    updatedAt:          "Updated {time}",
  },
};

// ===== CORE FUNCTIONS =====

export function getLang() {
  return localStorage.getItem("bgLang") || "no";
}

export function setLang(lang) {
  localStorage.setItem("bgLang", lang);
}

/**
 * Look up a translation key and interpolate {variable} placeholders.
 * Falls back to Norwegian, then raw key.
 */
export function t(key, vars = {}) {
  const lang  = getLang();
  const table = TRANSLATIONS[lang] || TRANSLATIONS.no;
  let str     = table[key] ?? TRANSLATIONS.no[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

/**
 * Apply translations to DOM elements with data-i18n / data-i18n-placeholder attributes.
 * Call once on DOMContentLoaded.
 */
export function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = getLang();
}

/**
 * Pluralization helper for player counts.
 */
export function tPlayerCount(n) {
  return n === 1 ? t("playerCount", { n }) : t("playerCountPlural", { n });
}
