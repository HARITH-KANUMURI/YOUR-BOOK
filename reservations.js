import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const reservationList = document.getElementById("reservationList");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    reservationList.innerHTML = `<p style="color:white;text-align:center;">Please sign in to view your reservations.</p>`;
    return;
  }

  try {
    const q = query(collection(db, "reservations"), where("userId", "==", user.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      reservationList.innerHTML = `<p style="color:white;text-align:center;">You haven’t reserved any books yet.</p>`;
      return;
    }

    for (const docSnap of snapshot.docs) {
      const res = docSnap.data();
      const bookRef = doc(db, "books", res.bookId);
      const bookSnap = await getDoc(bookRef);
      if (!bookSnap.exists()) continue;

      const book = bookSnap.data();
      const img = book.imageL || book.imageM || book.imageS || "ph.png";

      const card = document.createElement("div");
      card.className = "book-card";
      card.innerHTML = `
        <img src="${img}" alt="${book.title}" />
        <h3>${book.title}</h3>
        <p>${book.author}</p>
        <p><strong>Reserved:</strong> ${new Date(res.timestamp).toLocaleString()}</p>
        <button class="cancel-btn">❌ Cancel Reservation</button>
      `;

      const cancelBtn = card.querySelector(".cancel-btn");
      cancelBtn.addEventListener("click", async () => {
        const confirmCancel = confirm(`Cancel reservation for "${book.title}"?`);
        if (!confirmCancel) return;

        try {
          // Remove reservation document
          await deleteDoc(doc(db, "reservations", `${user.uid}_${book.id}`));

          // Increase book stock
          const bookRef = doc(db, "books", book.id);
          await updateDoc(bookRef, {
            stock: (book.stock || 0) + 1
          });

          alert("❌ Reservation cancelled.");
          card.remove();
        } catch (err) {
          console.error("Cancel failed:", err);
          alert("⚠ Failed to cancel reservation.");
        }
      });

      reservationList.appendChild(card);
    }

  } catch (err) {
    console.error("Failed to fetch reservations:", err);
    reservationList.innerHTML = `<p style="color:white;text-align:center;">Failed to load your reservations.</p>`;
  }
});
