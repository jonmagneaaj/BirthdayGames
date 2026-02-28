import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwFwBUDek5euOCkxWXk6R9dAwB-o9FaKo",
  authDomain: "bursdag32.firebaseapp.com",
  projectId: "bursdag32",
  storageBucket: "bursdag32.firebasestorage.app",
  messagingSenderId: "78245185731",
  appId: "1:78245185731:web:6671bd024a5b5a2125ba76",
  measurementId: "G-72MNQ8E661"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
