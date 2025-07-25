import { db, auth } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔑 Usage Settings
const USAGE_LIMIT = 10;

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const usageBar = document.getElementById("usageBar");
const usageText = document.getElementById("usageText");
const resetBtn = document.getElementById("resetUsageBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    usageText.textContent = "⚠ Please sign in to view usage.";
    resetBtn.style.display = "none";
    return;
  }

  const usageRef = doc(db, "usage", user.uid);
  const usageSnap = await getDoc(usageRef);
  const currentKey = getCurrentMonthKey();

  let currentCount = 0;
  let needsReset = false;

  if (usageSnap.exists()) {
    const data = usageSnap.data();
    if (data.reset === true) {
      needsReset = true;
    }
    currentCount = data[currentKey] || 0;
  }

  if (needsReset) {
    await updateDoc(usageRef, {
      [currentKey]: 0,
      reset: false
    });
    currentCount = 0;
  }

  // Update UI
  const percent = Math.min((currentCount / USAGE_LIMIT) * 100, 100);
  usageBar.style.width = `${percent}%`;
  usageText.textContent = `${currentCount} / ${USAGE_LIMIT} books used`;

  // Reset handler
  resetBtn.onclick = async () => {
    await setDoc(usageRef, {
      [currentKey]: 0
    }, { merge: true });

    usageBar.style.width = "0%";
    usageText.textContent = `0 / ${USAGE_LIMIT} books used`;
    alert("✅ Usage reset for this month!");
  };
});
