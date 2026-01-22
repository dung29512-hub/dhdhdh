// Firebase v9 modular (ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** ✅ Firebase config của bạn (giữ nguyên) */
const firebaseConfig = {
  apiKey: "AIzaSyDYzP8PvuR1C-YsxKFc1uKFTEd9PAuMD9w",
  authDomain: "lekhanhdung-72f11.firebaseapp.com",
  projectId: "lekhanhdung-72f11",
  storageBucket: "lekhanhdung-72f11.firebasestorage.app",
  messagingSenderId: "1057896493080",
  appId: "1:1057896493080:web:ffe0da00f85a8a6597d36d",
  measurementId: "G-MB71DTL809"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========== UI refs ==========
const $ = (id) => document.getElementById(id);

const authCard = $("authCard");
const appCard = $("appCard");
const authMsg = $("authMsg");
const userInfo = $("userInfo");
const btnLogout = $("btnLogout");

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");

const subject = $("subject");
const score = $("score");
const semester = $("semester");
const note = $("note");
const btnAdd = $("btnAdd");
const btnUpdate = $("btnUpdate");
const btnCancelEdit = $("btnCancelEdit");
const tbody = $("tbody");
const search = $("search");

// ========== State ==========
let currentUser = null;
let unsubscribeScores = null;
let editingId = null;
let allRows = []; // for client-side search

// ========== Helpers ==========
function showAuth(msg = "") {
  authCard.classList.remove("d-none");
  appCard.classList.add("d-none");
  btnLogout.classList.add("d-none");
  userInfo.textContent = "";
  authMsg.textContent = msg;
}

function showApp() {
  authCard.classList.add("d-none");
  appCard.classList.remove("d-none");
  btnLogout.classList.remove("d-none");
  authMsg.textContent = "";
}

function setEditing(isEditing) {
  if (isEditing) {
    btnAdd.classList.add("d-none");
    btnUpdate.classList.remove("d-none");
    btnCancelEdit.classList.remove("d-none");
  } else {
    btnAdd.classList.remove("d-none");
    btnUpdate.classList.add("d-none");
    btnCancelEdit.classList.add("d-none");
    editingId = null;
  }
}

function clearForm() {
  subject.value = "";
  score.value = "";
  semester.value = "";
  note.value = "";
}

function validateForm() {
  const s = subject.value.trim();
  const sem = semester.value.trim();
  const sc = Number(score.value);

  if (!s) return "Bạn chưa nhập tên môn.";
  if (!Number.isFinite(sc)) return "Điểm phải là số.";
  if (sc < 0 || sc > 10) return "Điểm phải trong khoảng 0 → 10.";
  if (!sem) return "Bạn chưa nhập học kỳ.";
  return null;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRows(rows) {
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.subject)}</td>
      <td><span class="badge bg-primary">${r.score}</span></td>
      <td>${escapeHtml(r.semester)}</td>
      <td>${escapeHtml(r.note || "")}</td>
      <td class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-warning" data-edit="${r.id}">Sửa</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${r.id}">Xoá</button>
      </td>
    </tr>
  `).join("");

  // Bind buttons (simple delegation also ok; here quick bind)
  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => removeRow(btn.getAttribute("data-del")));
  });
}

function applySearch() {
  const key = search.value.trim().toLowerCase();
  if (!key) return renderRows(allRows);
  const filtered = allRows.filter(r =>
    r.subject.toLowerCase().includes(key) ||
    r.semester.toLowerCase().includes(key)
  );
  renderRows(filtered);
}

// ========== Auth ==========
btnSignup.addEventListener("click", async () => {
  authMsg.textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authMsg.textContent = e.message;
  }
});

btnLogin.addEventListener("click", async () => {
  authMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authMsg.textContent = e.message;
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (!user) {
    if (unsubscribeScores) unsubscribeScores();
    unsubscribeScores = null;
    allRows = [];
    renderRows([]);
    setEditing(false);
    clearForm();
    showAuth("");
    return;
  }

  userInfo.textContent = `Đăng nhập: ${user.email}`;
  showApp();
  listenScores(user.uid);
});

// ========== Firestore CRUD ==========
function listenScores(uid) {
  if (unsubscribeScores) unsubscribeScores();

  const colRef = collection(db, "users", uid, "scores");
  const q = query(colRef, orderBy("createdAt", "desc"));

  unsubscribeScores = onSnapshot(q, (snap) => {
    allRows = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      score: d.data().score ?? ""
    }));
    applySearch();
  });
}

btnAdd.addEventListener("click", async () => {
  const err = validateForm();
  if (err) return alert(err);

  try {
    const uid = currentUser.uid;
    await addDoc(collection(db, "users", uid, "scores"), {
      subject: subject.value.trim(),
      score: Number(score.value),
      semester: semester.value.trim(),
      note: note.value.trim(),
      createdAt: serverTimestamp()
    });
    clearForm();
  } catch (e) {
    alert("Lỗi thêm dữ liệu: " + e.message);
  }
});

function startEdit(id) {
  const r = allRows.find(x => x.id === id);
  if (!r) return;

  editingId = id;
  subject.value = r.subject ?? "";
  score.value = r.score ?? "";
  semester.value = r.semester ?? "";
  note.value = r.note ?? "";
  setEditing(true);
}

btnCancelEdit.addEventListener("click", () => {
  clearForm();
  setEditing(false);
});

btnUpdate.addEventListener("click", async () => {
  if (!editingId) return;

  const err = validateForm();
  if (err) return alert(err);

  try {
    const uid = currentUser.uid;
    await updateDoc(doc(db, "users", uid, "scores", editingId), {
      subject: subject.value.trim(),
      score: Number(score.value),
      semester: semester.value.trim(),
      note: note.value.trim()
    });
    clearForm();
    setEditing(false);
  } catch (e) {
    alert("Lỗi cập nhật: " + e.message);
  }
});

async function removeRow(id) {
  if (!confirm("Xoá dòng điểm này?")) return;

  try {
    const uid = currentUser.uid;
    await deleteDoc(doc(db, "users", uid, "scores", id));
    if (editingId === id) {
      clearForm();
      setEditing(false);
    }
  } catch (e) {
    alert("Lỗi xoá: " + e.message);
  }
}

search.addEventListener("input", applySearch);
