import { db, auth } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const isbn = urlParams.get("isbn");
const bookDetail = document.getElementById("bookDetail");
const recommendations = document.getElementById("recommendations");

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function getPreviousMonthKey() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function updateStarDisplay(value) {
  document.querySelectorAll(".star").forEach((star) => {
    const val = parseInt(star.getAttribute("data-value"));
    star.classList.toggle("active", val <= value);
  });
}
function showPreviousMonthRating(ratingsObj) {
  const ratingVal = document.getElementById("ratingVal");
  const lastMonth = getPreviousMonthKey();
  const monthRatings = ratingsObj?.[lastMonth];
  if (monthRatings && typeof monthRatings === "object") {
    const values = Object.values(monthRatings);
    if (values.length) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      ratingVal.textContent = `${avg.toFixed(1)} / 5`;
      return;
    }
  }
  ratingVal.textContent = "No ratings yet";
}

async function loadBook() {
  try {
    const bookRef = doc(db, "books", isbn);
    const bookSnap = await getDoc(bookRef);
    if (!bookSnap.exists()) {
      bookDetail.innerHTML = "<p>Book not found.</p>";
      return null;
    }

    const book = { id: bookSnap.id, ...bookSnap.data() };
    const img = book.imageL || book.imageM || book.imageS || "ph.png";
    const stockInfo = book.stock !== undefined ? `<p><strong>Stock:</strong> ${book.stock}</p>` : "";
    const locationInfo = book.location ? `<p><strong>Location:</strong> ${book.location}</p>` : "";
    const reserveHTML = book.stock > 0
      ? `<button class="reserve-btn" id="reserveBtn">📚 Reserve Book</button>`
      : `<p class="out-of-stock">Out of Stock</p>`;

    bookDetail.innerHTML = `
      <div class="book-card big">
        <img src="${img}" alt="${book.title}" />
        <div>
          <h3>${book.title}</h3>
          <p><strong>Author:</strong> ${book.author}</p>
          <p><strong>Publisher:</strong> ${book.publisher || "Unknown"}</p>
          <p><strong>Year:</strong> ${book.year || "N/A"}</p>
          <p><strong>ISBN:</strong> ${book.id}</p>
          ${locationInfo}
          ${stockInfo}
          <p><strong>Rating:</strong> <span id="ratingVal">Loading...</span></p>
          <div class="star-rating" id="starRating">
            ${[1, 2, 3, 4, 5].map(i => `<span class="star" data-value="${i}">&#9733;</span>`).join("")}
          </div>
          ${reserveHTML}
          <div id="authStatus" style="margin-top:10px; color:lightgray;"></div>
        </div>
      </div>
    `;

    showPreviousMonthRating(book.ratings || {});

    return book;
  } catch (err) {
    console.error("❌ Error loading book:", err);
    bookDetail.innerHTML = "<p>Error loading book.</p>";
    return null;
  }
}

async function setupAuthListeners(book) {
  onAuthStateChanged(auth, async (user) => {
    const authStatus = document.getElementById("authStatus");
    if (!user) {
      authStatus.textContent = "⚠ Not logged in.";
      return;
    }

    authStatus.textContent = `Logged in as: ${user.email || user.uid}`;

    // ⭐ Rating logic
    const stars = document.querySelectorAll(".star");
    const currentKey = getCurrentMonthKey();
    const userRating = book.ratings?.[currentKey]?.[user.uid];
    if (userRating) updateStarDisplay(userRating);

    stars.forEach((star) => {
      star.addEventListener("click", async () => {
        const value = parseInt(star.getAttribute("data-value"));
        const bookRef = doc(db, "books", book.id);
        const snap = await getDoc(bookRef);
        const existing = snap.data();
        const updatedRatings = {
          ...(existing.ratings || {}),
          [currentKey]: {
            ...(existing.ratings?.[currentKey] || {}),
            [user.uid]: value
          }
        };
        await updateDoc(bookRef, { ratings: updatedRatings });
        updateStarDisplay(value);
        alert("⭐ Rating saved!");
      });
    });

    // ✅ Reservation with panel
    const reserveBtn = document.getElementById("reserveBtn");
    if (reserveBtn && book.stock > 0) {
      reserveBtn.addEventListener("click", () => {
        const modal = document.getElementById("reservationModal");
        modal.style.display = "flex";

        document.getElementById("confirmReservation").onclick = async () => {
          const name = document.getElementById("regName").value.trim();
          const roll = document.getElementById("regRoll").value.trim();
          const dept = document.getElementById("regDept").value.trim();
          const branch = document.getElementById("regBranch").value.trim();
          const section = document.getElementById("regSection").value.trim();

          if (!name || !roll || !dept || !branch || !section) {
            alert("⚠ Please fill in all fields.");
            return;
          }

          try {
            const resRef = doc(db, "reservations", `${user.uid}_${book.id}`);
            const resSnap = await getDoc(resRef);
            if (resSnap.exists()) {
              alert("⛔ You already reserved this book.");
              modal.style.display = "none";
              return;
            }

            await setDoc(resRef, {
              userId: user.uid,
              bookId: book.id,
              timestamp: Date.now(),
              name,
              roll,
              department: dept,
              branch,
              section
            });

            await updateDoc(doc(db, "books", book.id), {
              stock: book.stock - 1
            });

            alert("✅ Book reserved!");
            modal.style.display = "none";
            window.location.reload();
          } catch (err) {
            console.error("Reservation failed:", err);
            alert("❌ Reservation failed: " + err.message);
          }
        };
      });
    }
  });
}

async function loadRecommendations(book) {
  const q = query(
    collection(db, "books"),
    where("author", "==", book.author),
    limit(6)
  );

  try {
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      if (docSnap.id === book.id) return;

      const b = docSnap.data();
      const recImg = b.imageL || b.imageM || b.imageS || "ph.png";
      const lastMonthKey = getPreviousMonthKey();
      const monthly = b.ratings?.[lastMonthKey];
      let ratingText = "N/A";

      if (monthly) {
        const vals = Object.values(monthly);
        if (vals.length) ratingText = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + " / 5";
      }

      const card = document.createElement("div");
      card.className = "book-card";
      card.innerHTML = `
        <img src="${recImg}" alt="${b.title}" />
        <h3>${b.title}</h3>
        <p>${b.author}</p>
        <p>Rating: ${ratingText}</p>
      `;
      card.onclick = () => {
        window.location.href = `book.html?isbn=${docSnap.id}`;
      };
      recommendations.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading recommendations:", err);
  }
}

// 🔄 Main
(async () => {
  const book = await loadBook();
  if (book) {
    await setupAuthListeners(book);
    await loadRecommendations(book);
  }
})();
