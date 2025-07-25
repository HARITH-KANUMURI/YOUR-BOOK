// ✅ Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCilMAG_qisn0xDZoW2-RxjN3gXQg2WheM",
  authDomain: "your-book-login.firebaseapp.com",
  projectId: "your-book-login",
  storageBucket: "your-book-login.appspot.com",
  messagingSenderId: "171825227485",
  appId: "1:171825227485:web:4ba59eb12ac76dfbdddd34",
  measurementId: "G-ZVRPJBB3D4"
};

// ✅ Initialize and export everything you need
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ Optional: export Firestore helper functions globally (if needed)
window.firebaseImports = {
  collection,
  addDoc,
  serverTimestamp
};
