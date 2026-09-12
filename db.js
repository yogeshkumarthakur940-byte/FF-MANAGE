// ============================================================
// FF HUB — shared Firebase init + helper functions
// Imported by every page as a module.
// ============================================================

import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbase = getFirestore(app);
export const storage = getStorage(app);

export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
  ref, uploadBytes, getDownloadURL
};

// ---------- role helpers ----------

// An "admins" collection holds one doc per admin UID (doc id === uid).
// A "players" collection holds one doc per player; a linked player doc
// has a `uid` field once that player has a login.
export async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(dbase, "admins", uid));
  return snap.exists();
}

// Creates a brand-new Auth login (email/password) for a player WITHOUT
// signing the currently-logged-in admin out. Works by spinning up a
// throwaway secondary Firebase app instance just for the signup call.
export async function createPlayerLogin(email, password) {
  const secondary = initializeApp(firebaseConfig, "secondary-" + Date.now());
  try {
    const secAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}

export async function getPlayerByUid(uid) {
  const q = query(collection(dbase, "players"), where("uid", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ---------- generic fetch helpers ----------

export async function fetchAll(col, orderField, dir = "asc") {
  const colRef = collection(dbase, col);
  const q = orderField ? query(colRef, orderBy(orderField, dir)) : colRef;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchWhere(col, field, op, value, orderField) {
  const colRef = collection(dbase, col);
  const q = orderField
    ? query(colRef, where(field, op, value), orderBy(orderField, "asc"))
    : query(colRef, where(field, op, value));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function uploadFile(path, file) {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// ---------- formatting ----------

export function fmtDate(iso) {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso) {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(n) {
  if (n === undefined || n === null || n === "") return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function statusBadge(status) {
  const map = {
    upcoming: "badge-upcoming",
    live: "badge-live",
    completed: "badge-completed",
    paid: "badge-paid",
    pending: "badge-pending"
  };
  const cls = map[status] || "badge-upcoming";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return `<span class="badge ${cls}">${label}</span>`;
}

export function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
