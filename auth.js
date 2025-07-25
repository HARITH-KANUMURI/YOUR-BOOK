import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const signInBtn = document.getElementById("signInBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const userDropdown = document.getElementById("userDropdown");

onAuthStateChanged(auth, (user) => {
  if (user) {
    signInBtn.style.display = "none";
    userEmail.textContent = user.email || user.displayName;
    userDropdown.classList.remove("hidden");
  } else {
    signInBtn.style.display = "inline-block";
    userDropdown.classList.add("hidden");
  }
});

signInBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Google Sign-in failed");
    console.error(err);
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});
