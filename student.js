import {
  db, auth, doc, getDoc, setDoc, onSnapshot, serverTimestamp,
  signInAnonymously, onAuthStateChanged, $, esc, fmtTime, ask, safeImg,
} from "./shared.js?v=4";

const app = $("#app");
const SESSION_KEY = "sbl_session";
let uid, sess, exam, paper, answers = [], tick, unsubExam, unsubRes, submitted = false;

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

onAuthStateChanged(auth, (u) => { if (u) { uid = u.uid; start(); } });
signInAnonymously(auth).catch((e) => { app.innerHTML = `<div class="card bad">Gagal masuk: ${esc(e.message)}</div>`; });

function start() {
  sess = load(SESSION_KEY);
  sess ? enter() : joinView();
}

function joinView(err = "") {
  app.innerHTML = `<h1>Soal Bumi Langit</h1><div class="card">
    <label>Kode ujian</label><input id="code" autocapitalize="characters" placeholder="mis. AB12CD">
    <label>Nama lengkap</label><input id="name">
    <label>Kelas</label><input id="kelas" placeholder="mis. XI IPA 2">
    <button id="go">Masuk</button><p class="bad">${esc(err)}</p></div>`;
  $("#go").onclick = async () => {
    const code = $("#code").value.trim().toUpperCase(), name = $("#name").value.trim(), kelas = $("#kelas").value.trim();
    if (!code || !name) return joinView("Kode ujian dan nama wajib diisi.");
    const snap = await getDoc(doc(db, "exams", code));
    if (!snap.exists()) return joinView("Kode ujian tidak ditemukan.");
    sess = { code, name, kelas };
    save(SESSION_KEY, sess);
    enter();
  };
}

async function enter() {
  const sid = `${sess.code}_${uid}`;
  const sub = await getDoc(doc(db, "submissions", sid));
  if (sub.exists()) { submitted = true; return watchResult(sid); }
  unsubExam = onSnapshot(doc(db, "exams", sess.code), async (s) => {
    if (submitted) return;
    if (!s.exists()) { localStorage.removeItem(SESSION_KEY); return joinView("Ujian sudah dihapus."); }
    exam = s.data();
    if (exam.status === "draft") return waitingView();
    const ended = Date.now() >= exam.endsAt;
    if (exam.status === "closed" || ended) {
      if (paper && !ended) return;
      if (paper) return submit(true); // waktu habis: kirim apa adanya
      return endedView();
    }
    if (!paper) {
      const p = await getDoc(doc(db, "exams", sess.code, "paper", "questions"));
      paper = p.data().items;
      answers = load("ans_" + sess.code) || [];
      examView();
    }
    runTimer();
  });
}

function waitingView() {
  $("#timer").classList.add("hidden");
  app.innerHTML = `<h1>${esc(exam.title)}</h1><div class="card"><h2>Halo, ${esc(sess.name)}</h2>
    <p>Ujian belum dimulai. Biarkan halaman ini terbuka — soal akan muncul otomatis saat guru memulai.</p>
    <button class="sec" id="out">Bukan saya / ganti nama</button></div>`;
  $("#out").onclick = () => { localStorage.removeItem(SESSION_KEY); unsubExam?.(); joinView(); };
}

function endedView() {
  app.innerHTML = `<h1>${esc(exam.title)}</h1><div class="card"><p class="bad">Waktu ujian sudah habis dan jawabanmu tidak terkirim.</p></div>`;
}

function examView() {
  $("#tTitle").textContent = exam.title;
  $("#timer").classList.remove("hidden");
  app.innerHTML = `<div class="card">${paper.map((q, i) => `
    <div class="q"><b>${i + 1}.</b> ${esc(q.text).replace(/\n/g, "<br>")}
    ${safeImg(q.image) ? `<img class="qimg" src="${esc(safeImg(q.image))}" alt="Gambar soal ${i + 1}" loading="lazy">` : ""}
    ${q.options.map((o) => `<label class="opt ${answers[i] === o.k ? "sel" : ""}" data-i="${i}">
      <input type="radio" name="q${i}" value="${o.k}" ${answers[i] === o.k ? "checked" : ""}>
      <span><b>${o.k}.</b> ${esc(o.t)}</span></label>`).join("")}</div>`).join("")}
    <button id="send">Kirim jawaban</button></div>`;
  app.querySelectorAll("input[type=radio]").forEach((r) => r.onchange = () => {
    const i = +r.name.slice(1);
    answers[i] = r.value;
    save("ans_" + sess.code, answers);
    app.querySelectorAll(`.opt[data-i="${i}"]`).forEach((l) => l.classList.toggle("sel", l.contains(r) && r.checked));
  });
  $("#send").onclick = async () => {
    const blank = paper.filter((_, i) => !answers[i]).length;
    if (await ask(blank ? `Masih ${blank} soal belum dijawab. Tetap kirim?` : "Kirim jawaban sekarang? Tidak bisa diubah.", { ok: "Kirim", cancel: "Kembali" })) submit();
  };
}

function runTimer() {
  clearInterval(tick);
  const upd = () => {
    const left = exam.endsAt - Date.now();
    $("#tClock").textContent = fmtTime(left);
    if (left <= 0) { clearInterval(tick); submit(true); }
  };
  upd();
  tick = setInterval(upd, 500);
}

async function submit(auto = false) {
  if (submitted) return;
  submitted = true;
  clearInterval(tick); unsubExam?.();
  const sid = `${sess.code}_${uid}`;
  const arr = paper ? paper.map((_, i) => answers[i] || "") : [];
  try {
    await setDoc(doc(db, "submissions", sid), {
      examId: sess.code, uid, name: sess.name, kelas: sess.kelas, answers: arr, submittedAt: serverTimestamp(),
    });
  } catch (e) {
    submitted = false;
    app.insertAdjacentHTML("afterbegin", `<div class="card bad">Gagal mengirim (${esc(e.code || e.message)}). Coba lagi.</div>`);
    return;
  }
  watchResult(sid);
}

function watchResult(sid) {
  clearInterval(tick);
  $("#timer").classList.add("hidden");
  app.innerHTML = `<h1>Jawaban terkirim ✓</h1><div class="card"><p>Terima kasih, ${esc(sess.name)}. Jawabanmu sudah diterima.</p>
    <p class="mute">Tunggu sampai guru menampilkan hasil. Halaman ini akan berubah otomatis.</p></div>`;
  unsubRes = onSnapshot(doc(db, "results", sid), (s) => { if (s.exists()) resultView(s.data()); });
}

async function resultView(r) {
  if (!paper) {
    try { paper = (await getDoc(doc(db, "exams", sess.code, "paper", "questions"))).data().items; } catch {}
  }
  let html = `<h1>Hasil</h1><div class="card">`;
  if (r.showScore) html += `<div class="big">${r.score}</div><p style="text-align:center" class="mute">${r.correct} benar dari ${r.total} soal</p>`;
  if (!r.showScore && !r.showKey) html += `<p>Guru memilih tidak menampilkan hasil.</p>`;
  html += `</div>`;
  if (r.showKey && r.detail && paper) {
    html += `<div class="card">` + paper.map((q, i) => {
      const d = r.detail[i];
      return `<div class="q"><b>${i + 1}.</b> ${esc(q.text).replace(/\n/g, "<br>")}
        ${safeImg(q.image) ? `<img class="qimg" src="${esc(safeImg(q.image))}" alt="">` : ""}
        ${q.options.map((o) => `<div class="opt ${o.k === d.key ? "right" : o.k === d.mine ? "wrong" : ""}"><span><b>${o.k}.</b> ${esc(o.t)}</span></div>`).join("")}
        <p class="${d.ok ? "ok" : "bad"}">${d.ok ? "Benar" : `Salah — jawabanmu: ${d.mine || "kosong"}, kunci: ${d.key}`}</p>
        ${d.expl ? `<p class="mute">${esc(d.expl)}</p>` : ""}</div>`;
    }).join("") + `</div>`;
  }
  app.innerHTML = html;
}
