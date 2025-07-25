import { db, auth } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const booksPerPage = 30;
let currentPage = 1;
let lastVisibleDoc = null;
let isSearching = false;
let lastSearchQuery = "";
let filteredBooks = [];

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

// 🔍 Search
searchInput?.addEventListener("input", async () => {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) {
    isSearching = false;
    currentPage = 1;
    lastVisibleDoc = null;
    await loadBooks();
  } else {
    isSearching = true;
    lastSearchQuery = keyword;
    await searchBooks(keyword);
  }
});

// 📚 Load books with pagination
async function loadBooks() {
  if (limitReached("reads")) return;

  let q = query(collection(db, "books"), orderBy("title"), limit(booksPerPage));
  if (lastVisibleDoc) {
    q = query(collection(db, "books"), orderBy("title"), startAfter(lastVisibleDoc), limit(booksPerPage));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    bookContainer.innerHTML = "<p style='color:white; text-align:center; margin-top:40px;'>No more books.</p>";
    return;
  }

  lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
  renderBooks(snapshot.docs);
  updatePagination(snapshot.size);
}

// 🔍 Search books (client-side)
async function searchBooks(keyword) {
  if (limitReached("reads")) return;

  const snapshot = await getDocs(query(collection(db, "books")));
  const books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  filteredBooks = books.filter(book =>
    (book.title || "").toLowerCase().includes(keyword) ||
    (book.author || "").toLowerCase().includes(keyword)
  );

  renderFilteredPage(1);
}

function renderBooks(bookDocs) {
  bookContainer.innerHTML = "";
  bookDocs.forEach((doc) => {
    const book = doc.data();
    const imageUrl = book.imageL || book.imageM || book.imageS || "ph.png";
    const ratingText = Array.isArray(book.ratings)
      ? (book.ratings.reduce((a, b) => a + b, 0) / book.ratings.length).toFixed(1) + " / 5"
      : "N/A";

    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${book.title}" />
      <h3>${book.title}</h3>
      <p>${book.author}</p>
      <p>Rating: ${ratingText}</p>
    `;
    card.onclick = () => {
      window.location.href = `book.html?isbn=${doc.id}`;
    };
    bookContainer.appendChild(card);
  });

  pageInfo.textContent = `Page ${currentPage}`;
  prevBtn.disabled = currentPage === 1;
}

// 🔄 Filtered book pagination (client-side only)
function renderFilteredPage(page) {
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
    const ratingText = Array.isArray(book.ratings)
      ? (book.ratings.reduce((a, b) => a + b, 0) / book.ratings.length).toFixed(1) + " / 5"
      : "N/A";

    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${book.title}" />
      <h3>${book.title}</h3>
      <p>${book.author}</p>
      <p>Rating: ${ratingText}</p>
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

// ⏮️⏭️ Pagination buttons
prevBtn.addEventListener("click", async () => {
  if (currentPage > 1) {
    currentPage--;
    if (isSearching) {
      renderFilteredPage(currentPage);
    } else {
      lastVisibleDoc = null;
      await loadBooks();
    }
  }
});

nextBtn.addEventListener("click", async () => {
  currentPage++;
  if (isSearching) {
    renderFilteredPage(currentPage);
  } else {
    await loadBooks();
  }
});

// 📌 Load initial books
await loadBooks();
