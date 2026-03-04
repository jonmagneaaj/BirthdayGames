/**
 * Adds English translations (question_en, answers_en) to all Firestore questions.
 * Uses the Firestore REST API — no extra dependencies needed.
 */

const PROJECT_ID = "bursdag32";
const API_KEY    = "AIzaSyBwFwBUDek5euOCkxWXk6R9dAwB-o9FaKo";
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ===== TRANSLATION MAP =====
// Key: Norwegian question text (exact match)
// Value: { question_en, answers_en } — answers_en must be in same order as answers in Firestore

const TRANSLATIONS = {
  "Hva slags øl liker jeg best av disse typene?": {
    question_en: "Which type of beer do I like best?",
    answers_en: ["Pilsner", "Wheat beer", "IPA", "Stout"],
  },
  "Hva heter faren min ?": {
    question_en: "What is my father's name?",
    answers_en: ["Rune", "Lars", "Knut", "Fredrik"],
  },
  "Min første designer jobb var i et ..": {
    question_en: "My first design job was at a ..",
    answers_en: ["In-house agency", "Start-up agency", "Consultancy", "My own agency"],
  },
  "Jeg har aldri vært i..": {
    question_en: "I have never been to ..",
    answers_en: ["Belgium", "Spain", "France", "Germany"],
  },
  "Liker jeg karaoke?": {
    question_en: "Do I like karaoke?",
    answers_en: ["Yes", "No"],
  },
  "Hvilken barneskole gikk jeg på ?": {
    question_en: "Which primary school did I go to?",
    answers_en: [
      "Skien Primary School",
      "Stathelle Primary School",
      "Langesund Primary School",
      "Porsgrunn Primary School",
    ],
  },
  "Hvor mange unike øl har jeg \"tapped\"? (ish)": {
    question_en: "How many unique beers have I 'tapped'? (approx)",
    answers_en: ["700", "1000", "500", "200"],
  },
  "Fjorårets blåtur med gutta var i?": {
    question_en: "Last year's lads' trip was to?",
    answers_en: ["Riga", "Tallinn", "Milan", "London"],
  },
  "Min favoritt emoji er": {
    question_en: "My favourite emoji is",
    answers_en: ["🍻", "🙈", "🎉", "💀"],
  },
  "Hva studerte jeg på Vg1?": {
    question_en: "What did I study at upper secondary (Vg1)?",
    answers_en: ["Electrician", "Design and Crafts", "Media and Communication", "Computer Science"],
  },
  "Hva slags designer er jeg?": {
    question_en: "What kind of designer am I?",
    answers_en: ["Graphic Designer", "Fashion Designer", "UX Designer", "OG Designer"],
  },
  "Min første spillkonsoll var": {
    question_en: "My first gaming console was",
    answers_en: ["Nintendo 64", "PlayStation 1", "GameCube", "Wii"],
  },
  "Jeg jobber nå hos": {
    question_en: "I currently work at",
    answers_en: ["Berg-Hansen", "Baker-Hansen"],
  },
  "I fjor så løpte jeg halvmarathon i ..": {
    question_en: "Last year I ran a half marathon in ..",
    answers_en: ["Tallinn", "Oslo", "Copenhagen", "Riga"],
  },
  "Jeg har en bachelor i...": {
    question_en: "I have a bachelor's degree in ...",
    answers_en: ["Graphic Design", "Front-end Development", "Game Design"],
  },
  "Hvilken rolle fikk jeg i Snehvit ?": {
    question_en: "Which role did I get in Snow White?",
    answers_en: ["Sneezy", "Sleepy", "Bashful", "Grumpy"],
  },
  "Hva heter moren min ?": {
    question_en: "What is my mother's name?",
    answers_en: ["May-Britt", "Inger-ann", "Sofie", "Katja"],
  },
  "Favoritt sjokoladen min er": {
    question_en: "My favourite chocolate bar is",
    answers_en: ["Firkløver", "Walter's Almonds", "Troyka", "Stratos"],
  },
  "Jeg har tatt bacheloren min hos..": {
    question_en: "I did my bachelor's degree at ..",
    answers_en: ["NTNU", "OsloMet", "BI", "Høyskolen Kristiania"],
  },
  "Hvor mange helsøsken har jeg ?": {
    question_en: "How many full siblings do I have?",
    answers_en: ["2", "3", "1", "4"],
  },
  "Hvilken konsert i Langesund er jeg på nesten hvert år?": {
    question_en: "Which concert in Langesund do I attend almost every year?",
    answers_en: ["Postgirobygget", "DDE", "CC Cowboys", "Delillos"],
  },
  "Hvilken av disse sportene har jeg IKKE prøvd ?": {
    question_en: "Which of these sports have I NOT tried?",
    answers_en: ["Paintball", "Football", "Handball", "Gymnastics"],
  },
  "Min favoritt figur i Mario universet er..": {
    question_en: "My favourite character in the Mario universe is ..",
    answers_en: ["Luigi", "Mario", "Yoshi"],
  },
  "Jeg tok et års fagskole i..": {
    question_en: "I did a year of vocational school in ..",
    answers_en: ["Front-end Development", "Back-end Development", "Top-end Development"],
  },
  "Hva er handicapet mitt i golf?": {
    question_en: "What is my golf handicap?",
    answers_en: ["54", "32", "45", "16"],
  },
  "Hvilken dag har jeg bursdag?": {
    question_en: "What day is my birthday?",
    answers_en: ["8th of March", "7th of March", "6th of March", "9th of March"],
  },
  "De siste 3 årene så har jeg vært med på en tur til hvilken svensk by?": {
    question_en: "For the last 3 years, I've gone on a trip to which Swedish city?",
    answers_en: ["Gothenburg", "Malmö", "Stockholm", "Karlstad"],
  },
  "Jeg er fra..": {
    question_en: "I am from ..",
    answers_en: ["Telemark", "Østfold", "Vestfold", "Agder"],
  },
  "I mai så skal jeg på halvmarathon i": {
    question_en: "In May I am running a half marathon in",
    answers_en: ["Milan", "Edinburgh", "Stavanger", "Aalborg"],
  },
  "Hvilken øy kommer jeg fra?": {
    question_en: "Which island am I from?",
    answers_en: ["Sandøya", "Langøya", "Bjørkøya", "Oksøya"],
  },
  "Etter en sen kveld så drikker jeg ...": {
    question_en: "After a late night I drink ...",
    answers_en: ["Chocolate milk", "Coffee", "Pineapple juice", "Powerade"],
  },
  "Jeg trener på...": {
    question_en: "I work out at ...",
    answers_en: ["SATS", "EVO", "fresh"],
  },
};

// ===== HELPERS =====

function toFirestoreStringArray(arr) {
  return {
    arrayValue: {
      values: arr.map((s) => ({ stringValue: s })),
    },
  };
}

async function fetchAllDocuments() {
  const url = `${BASE_URL}/questions?key=${API_KEY}&pageSize=100`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.documents || [];
}

async function patchDocument(docName, questionEn, answersEn) {
  const url = `https://firestore.googleapis.com/v1/${docName}` +
    `?key=${API_KEY}` +
    `&updateMask.fieldPaths=question_en` +
    `&updateMask.fieldPaths=answers_en`;

  const body = {
    fields: {
      question_en: { stringValue: questionEn },
      answers_en:  toFirestoreStringArray(answersEn),
    },
  };

  const res = await fetch(url, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH failed for ${docName}: ${res.status} ${text}`);
  }
  return res.json();
}

// ===== MAIN =====

async function main() {
  console.log("Henter spørsmål fra Firestore…\n");
  const docs = await fetchAllDocuments();
  console.log(`Fant ${docs.length} spørsmål.\n`);

  let updated = 0;
  let skipped = 0;
  let missing = [];

  for (const doc of docs) {
    const fields  = doc.fields || {};
    const qNo     = fields.question?.stringValue || "";
    const already = "question_en" in fields;

    if (already) {
      console.log(`⏭  Allerede oversatt: ${qNo}`);
      skipped++;
      continue;
    }

    const translation = TRANSLATIONS[qNo];
    if (!translation) {
      console.warn(`❓ Ingen oversettelse funnet for: "${qNo}"`);
      missing.push(qNo);
      continue;
    }

    process.stdout.write(`✏️  ${qNo} → `);
    await patchDocument(doc.name, translation.question_en, translation.answers_en);
    console.log(`${translation.question_en} ✓`);
    updated++;
  }

  console.log(`\n✅ Ferdig! Oppdatert: ${updated}, allerede oversatt: ${skipped}, mangler: ${missing.length}`);
  if (missing.length > 0) {
    console.log("Mangler oversettelse for:");
    missing.forEach(q => console.log(`  - "${q}"`));
  }
}

main().catch(console.error);
