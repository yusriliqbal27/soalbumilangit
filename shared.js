import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, query, where, getDocs, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup,
  GoogleAuthProvider, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js?v=4";

// Sesi login guru & siswa dipisah (nama app berbeda) supaya tidak saling menimpa di browser yang sama
const isAdmin = location.pathname.endsWith("admin.html");
export const app = initializeApp(firebaseConfig, isAdmin ? "guru" : "siswa");
export const db = getFirestore(app);
export const auth = getAuth(app);
export {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where,
  getDocs, writeBatch, serverTimestamp, onAuthStateChanged, signInAnonymously,
  signInWithPopup, GoogleAuthProvider, signOut,
};

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Pengganti confirm()/alert() bawaan browser (diblokir di sebagian in-app browser)
export function ask(msg, { ok = "Ya, lanjut", cancel = "Batal" } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="box"><p></p><div class="acts"></div></div>`;
    wrap.querySelector("p").textContent = msg;
    const acts = wrap.querySelector(".acts");
    const done = (v) => { wrap.remove(); resolve(v); };
    const b1 = document.createElement("button"); b1.textContent = ok; b1.onclick = () => done(true);
    acts.appendChild(b1);
    if (cancel) {
      const b2 = document.createElement("button"); b2.textContent = cancel; b2.className = "sec"; b2.onclick = () => done(false);
      acts.appendChild(b2);
    }
    document.body.appendChild(wrap);
    b1.focus();
  });
}
export const notify = (msg) => ask(msg, { ok: "OK", cancel: "" });

// Normalisasi kolom Gambar: link https, link Google Drive, atau nama file di folder gambar/ pada repo
export function safeImg(v) {
  v = String(v ?? "").trim();
  if (!v) return "";
  const drive = v.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;
  if (/^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (/^[\w\-./ ]+$/.test(v) && !v.includes("..") && !v.startsWith("/")) return v.includes("/") ? v : "gambar/" + v;
  return null; // tidak valid
}
