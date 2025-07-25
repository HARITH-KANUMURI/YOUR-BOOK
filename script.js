import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const booksPerPage = 30;
let books = [], filteredBooks = [], currentPage = 1;

const bookContainer = document.getElementById("bookContainer");
const pageInfo = document.getElementById("pageInfo");
const searchInput = document.getElementById("searchInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// 🔄 Global usage reset
const resetDocRef = doc(db, "usage", "global_reset");
const resetSnap = await getDoc(resetDocRef);
const resetTime = resetSnap.exists() ? resetSnap.data().timestamp : null;

if (resetTime && localStorage.getItem("lastReset") !== resetTime) {
  localStorage.removeItem("used_reads");
  localStorage.removeItem("used_writes");
  localStorage.setItem("lastReset", resetTime);
}

function limitReached(type) {
  const limits = { reads: 45000, writes: 15000 };
  const key = "used_" + type;
  let count = parseInt(localStorage.getItem(key) || "0");

  if (count >= limits[type]) {
    document.getElementById("resetUsageContainer").style.display = "block";
    alert("❌ You have reached your " + type.toUpperCase() + " limit for this month.");
    return true;
  }

  localStorage.setItem(key, count + 1);
  return false;
}

// 🔄 Reset Usage button
window.resetUsage = function () {
  localStorage.removeItem("used_reads");
  localStorage.removeItem("used_writes");
  alert("✅ Usage reset locally.");
  location.reload();
};

// 📚 Load books
async function loadBooks() {
  if (limitReached("reads")) return;

  const snapshot = await getDocs(collection(db, "books"));
  books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  filteredBooks = books;
  renderPage(1);
}
loadBooks();

function renderPage(page) {
  bookContainer.innerHTML = "";
  currentPage = page;

  const start = (page - 1) * booksPerPage;
  const end = start + booksPerPage;
  const pageBooks = filteredBooks.slice(start, end);

  if (pageBooks.length === 0) {
    bookContainer.innerHTML = `<p style="text-align:center;color:white;margin-top:40px;">No books found.</p>`;
    pageInfo.textContent = "";
    return;
  }

  pageBooks.forEach((book) => {
    const imageUrl = book.imageL || book.imageM || book.imageS || "ph.png";
    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${book.title}" />
      <h3>${book.title}</h3>
      <p>${book.author}</p>
      <p>Rating: ${(book.ratings?.length || "N/A")}</p>
    `;
    card.onclick = () => {
      window.location.href = `book.html?isbn=${book.id}`;
    };
    bookContainer.appendChild(card);
  });

  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) renderPage(currentPage - 1);
});
nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  if (currentPage < totalPages) renderPage(currentPage + 1);
});

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.toLowerCase();
    filteredBooks = books.filter((book) => {
      return (
        (book.title || "").toLowerCase().includes(keyword) ||
        (book.author || "").toLowerCase().includes(keyword)
      );
    });
    renderPage(1);
  });
}

// 🔐 Admin Reset Button Logic
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  const token = await user.getIdTokenResult();
  if (token.claims.admin) {
    document.getElementById("adminResetContainer").style.display = "block";
  }
});

document.getElementById("adminResetBtn")?.addEventListener("click", async () => {
  if (!confirm("⚠ Reset all users' usage?")) return;
  try {
    await setDoc(doc(db, "usage", "global_reset"), {
      timestamp: new Date().toISOString()
    });
    alert("✅ All usage limits will reset on next visit.");
  } catch (e) {
    alert("❌ Failed to reset usage.");
    console.error(e);
  }
});
