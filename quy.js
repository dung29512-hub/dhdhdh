import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
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

/** Firebase config của bạn */
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

const $ = (id) => document.getElementById(id);

const authCard = $("authCard");
const appCard = $("appCard");
const authMsg = $("authMsg");
const userInfo = $("userInfo");
const btnLogout = $("btnLogout");

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");

const type = $("type");
const amount = $("amount");
const date = $("date");
const desc = $("desc");
const btnAdd = $("btnAdd");
const btnUpdate = $("btnUpdate");
const btnCancelEdit = $("btnCancelEdit");
const tbody = $("tbody");
const search = $("search");

const sumThu = $("sumThu");
const sumChi = $("sumChi");
const balance = $("balance");

let currentUser = null;
let unsubscribeFunds = null;
let editingId = null;
let allRows = [];

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
  type.value = "thu";
  amount.value = "";
  desc.value = "";
  // mặc định ngày hôm nay
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  date.value = `${yyyy}-${mm}-${dd}`;
}

function validateForm() {
  const a = Number(amount.value);
  if (!Number.isFinite(a) || a < 0) return "Số tiền không hợp lệ.";
  if (!date.value) return "Bạn chưa chọn ngày.";
  if (!desc.value.trim()) return "Bạn chưa nhập nội dung.";
  return null;
}

function formatMoney(v) {
  return (v || 0).toLocaleString("vi-VN") + " đ";
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRows(rows) {
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <span class="badge ${r.type === "thu" ? "bg-success" : "bg-danger"}">
          ${r.type.toUpperCase()}
        </span>
      </td>
      <td>${formatMoney(r.amount)}</td>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.desc)}</td>
      <td class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-warning" data-edit="${r.id}">Sửa</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${r.id}">Xoá</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => removeRow(btn.getAttribute("data-del")));
  });
}

function updateSummary() {
  let thu = 0, chi = 0;
  for (const r of allRows) {
    if (r.type === "thu") thu += Number(r.amount || 0);
    else chi += Number(r.amount || 0);
  }
  sumThu.textContent = formatMoney(thu);
  sumChi.textContent = formatMoney(chi);
  balance.textContent = formatMoney(thu - chi);
}

function applySearch() {
  const key = search.value.trim().toLowerCase();
  const filtered = !key
    ? allRows
    : allRows.filter(r => (r.desc || "").toLowerCase().includes(key));
  renderRows(filtered);
}

// ------- Auth -------
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
    if (unsubscribeFunds) unsubscribeFunds();
    unsubscribeFunds = null;
    allRows = [];
    renderRows([]);
    setEditing(false);
    showAuth("");
    return;
  }

  userInfo.textContent = `Đăng nhập: ${user.email}`;
  showApp();
  clearForm();
  listenFunds(user.uid);
});

// ------- Firestore -------
function listenFunds(uid) {
  if (unsubscribeFunds) unsubscribeFunds();

  const colRef = collection(db, "users", uid, "funds");
  const q = query(colRef, orderBy("date", "desc"), orderBy("createdAt", "desc"));

  unsubscribeFunds = onSnapshot(q, (snap) => {
    allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateSummary();
    applySearch();
  });
}

btnAdd.addEventListener("click", async () => {
  const err = validateForm();
  if (err) return alert(err);

  try {
    const uid = currentUser.uid;
    await addDoc(collection(db, "users", uid, "funds"), {
      type: type.value,
      amount: Number(amount.value),
      date: date.value,           // lưu dạng YYYY-MM-DD để sort dễ
      desc: desc.value.trim(),
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
  type.value = r.type || "thu";
  amount.value = r.amount ?? "";
  date.value = r.date || "";
  desc.value = r.desc || "";
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
    await updateDoc(doc(db, "users", uid, "funds", editingId), {
      type: type.value,
      amount: Number(amount.value),
      date: date.value,
      desc: desc.value.trim()
    });
    clearForm();
    setEditing(false);
  } catch (e) {
    alert("Lỗi cập nhật: " + e.message);
  }
});

async function removeRow(id) {
  if (!confirm("Xoá giao dịch này?")) return;

  try {
    const uid = currentUser.uid;
    await deleteDoc(doc(db, "users", uid, "funds", id));
    if (editingId === id) {
      clearForm();
      setEditing(false);
    }
  } catch (e) {
    alert("Lỗi xoá: " + e.message);
  }
}

search.addEventListener("input", applySearch);

// set default date on first load
clearForm();
