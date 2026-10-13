import {
  db, auth, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where,
  getDocs, writeBatch, serverTimestamp, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signOut, $, esc, ask, notify, safeImg,
} from "./shared.js?v=4";

const app = $("#app");
let unsubs = [];
const opt = { score: true, key: false };
const clearSubs = () => { unsubs.forEach((u) => u()); unsubs = []; };

onAuthStateChanged(auth, (u) => (u && !u.isAnonymous ? listView() : loginView()));

function loginView(msg = "") {
  clearSubs();
  app.innerHTML = `<h1>Panel Guru</h1><div class="card"><button id="gl">Masuk dengan Google</button>
    <p class="bad">${esc(msg)}</p></div>`;
  $("#gl").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => loginView(e.message));
}

const header = (extra = "") => `<div class="row" style="align-items:center"><h1>Panel Guru</h1>
  <div style="text-align:right">${extra}<button class="sec" id="lo">Keluar</button></div></div>`;
const bindLogout = () => ($("#lo").onclick = () => signOut(auth));

// ---------- Excel ----------
const TEMPLATE_HEAD = ["No", "Soal", "A", "B", "C", "D", "E", "Kunci", "Bobot", "Pembahasan", "Gambar"];
function downloadTemplate() {
  const rows = [TEMPLATE_HEAD,
    [1, "Lapisan bumi yang paling tebal adalah …", "Kerak", "Mantel", "Inti luar", "Inti dalam", "", "B", 1, "Mantel ±2.900 km, lapisan paling tebal.", ""],
    [2, "Gempa tektonik disebabkan oleh …", "Letusan gunung api", "Runtuhnya gua", "Pergerakan lempeng", "Ledakan nuklir", "Meteor", "C", 2, "Pergerakan lempeng melepas energi.", ""]];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 60 }, ...Array(5).fill({ wch: 22 }), { wch: 8 }, { wch: 8 }, { wch: 40 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Soal");
  XLSX.writeFile(wb, "template-soal.xlsx");
}

async function parseExcel(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const items = [], keys = [], errors = [];
  rows.forEach((raw, idx) => {
    const r = {};
    Object.keys(raw).forEach((k) => (r[k.trim().toLowerCase()] = raw[k]));
    const text = String(r.soal ?? "").trim();
    if (!text) return;
    const options = ["a", "b", "c", "d", "e"].map((k) => ({ k: k.toUpperCase(), t: String(r[k] ?? "").trim() })).filter((o) => o.t);
    const key = String(r.kunci ?? "").trim().toUpperCase();
    const line = idx + 2;
    if (options.length < 2) errors.push(`Baris ${line}: pilihan jawaban kurang dari 2`);
    if (!options.some((o) => o.k === key)) errors.push(`Baris ${line}: kunci "${key}" tidak cocok dengan pilihan`);
    const weight = Number(r.bobot) > 0 ? Number(r.bobot) : 1;
    const image = safeImg(r.gambar);
    if (image === null) errors.push(`Baris ${line}: isi kolom Gambar tidak valid (pakai link https:// atau nama file di folder gambar/)`);
    items.push({ text, options, image: image || "" });
    keys.push({ key, weight, expl: String(r.pembahasan ?? "").trim() });
  });
  if (!items.length) errors.push("Tidak ada soal terbaca. Pastikan kolom sesuai template.");
  return { items, keys, errors };
}

// ---------- daftar ujian ----------
function listView() {
  clearSubs();
  app.innerHTML = header() + `
  <div class="card"><h2>Buat ujian baru</h2>
    <p class="mute">1. Unduh template → 2. isi soal di Excel → 3. unggah di bawah.</p>
    <button class="sec" id="tpl">Unduh template Excel</button>
    <div class="row"><div><label>Judul ujian</label><input id="title"></div>
    <div><label>Durasi (menit)</label><input id="dur" type="number" value="60" min="1"></div></div>
    <label>File soal (.xlsx)</label><input id="file" type="file" accept=".xlsx,.xls,.csv">
    <div id="prev" class="mute"></div><button id="mk" disabled>Simpan ujian</button></div>
  <div class="card"><h2>Ujian saya</h2><div id="list" class="mute">Memuat…</div></div>`;
  bindLogout();
  $("#tpl").onclick = downloadTemplate;
  let parsed = null;
  $("#file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    parsed = await parseExcel(f);
    $("#prev").innerHTML = parsed.errors.length
      ? `<span class="bad">${parsed.errors.map(esc).join("<br>")}</span>`
      : `<span class="ok">${parsed.items.length} soal terbaca ✓</span>`;
    $("#mk").disabled = parsed.errors.length > 0;
  };
  $("#mk").onclick = async () => {
    const title = $("#title").value.trim();
    if (!title) return notify("Isi judul ujian.");
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    $("#mk").disabled = true;
    const b = writeBatch(db);
    b.set(doc(db, "exams", code), { title, durationMin: +$("#dur").value || 60, status: "draft", endsAt: 0, count: parsed.items.length, createdAt: serverTimestamp() });
    b.set(doc(db, "exams", code, "paper", "questions"), { items: parsed.items });
    b.set(doc(db, "keys", code), { items: parsed.keys });
    await b.commit();
    examView(code);
  };
  unsubs.push(onSnapshot(collection(db, "exams"), (s) => {
    const rows = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    $("#list").innerHTML = rows.length ? `<table>${rows.map((e) => `<tr><td><b>${esc(e.title)}</b><br><span class="mute">Kode ${e.id} · ${e.count} soal · ${e.status}</span></td>
      <td><button data-id="${e.id}">Kelola</button></td></tr>`).join("")}</table>` : "Belum ada ujian.";
    app.querySelectorAll("#list button").forEach((b) => (b.onclick = () => examView(b.dataset.id)));
  }));
}

// ---------- kelola satu ujian ----------
function examView(code) {
  clearSubs();
  let exam, subs = [];
  const render = () => {
    if (!exam) return;
    const st = { draft: "Belum dimulai", open: Date.now() < exam.endsAt ? "Berlangsung" : "Waktu habis", closed: "Ditutup" }[exam.status];
    app.innerHTML = header(`<button class="sec" id="back">← Daftar</button>`) + `
    <div class="card"><h2>${esc(exam.title)}</h2>
      <p>Kode ujian untuk siswa: <b style="font-size:1.6rem;letter-spacing:3px">${code}</b></p>
      <p class="mute">Alamat siswa: ${esc(location.href.replace(/admin\.html.*$/, ""))}</p>
      <p>Status: <b>${st}</b> · ${exam.count} soal · ${exam.durationMin} menit · terkumpul: <b>${subs.length}</b></p>
      <button id="st" ${exam.status !== "draft" ? "disabled" : ""}>▶ Mulai ujian untuk semua</button>
      <button id="en" class="sec" ${exam.status !== "open" ? "disabled" : ""}>Akhiri sekarang (paksa kumpul)</button>
      <button id="cl" class="sec" ${exam.status === "closed" ? "disabled" : ""}>Tutup pengumpulan</button></div>
    <div class="card"><h2>Tampilkan hasil ke siswa</h2>
      <label><input type="checkbox" id="oScore" ${opt.score ? "checked" : ""}> Siswa boleh lihat nilai</label>
      <label><input type="checkbox" id="oKey" ${opt.key ? "checked" : ""}> Siswa boleh lihat kunci &amp; pembahasan</label>
      <button id="rel" ${subs.length ? "" : "disabled"}>Hitung &amp; rilis hasil</button>
      <button id="xl" class="sec" ${subs.length ? "" : "disabled"}>Unduh rekap Excel</button>
      <p class="mute">Nilai baru terlihat siswa setelah kamu klik Rilis. Bisa diulang untuk mengubah pilihan.</p></div>
    <div class="card"><h2>Jawaban masuk (${subs.length})</h2>
      <table><tr><th>Nama</th><th>Kelas</th><th>Terjawab</th></tr>
      ${subs.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.kelas)}</td><td>${s.answers.filter(Boolean).length}/${exam.count}</td></tr>`).join("")}</table></div>
    <div class="card"><button class="red" id="del">Hapus ujian ini</button></div>`;
    bindLogout();
    $("#back").onclick = listView;
    $("#st").onclick = () => updateDoc(doc(db, "exams", code), { status: "open", endsAt: Date.now() + exam.durationMin * 60000 });
    $("#en").onclick = async () => (await ask("Semua siswa akan langsung dipaksa mengumpulkan. Lanjut?")) && updateDoc(doc(db, "exams", code), { endsAt: Date.now() });
    $("#cl").onclick = async () => (await ask("Setelah ditutup siswa tidak bisa mengirim lagi. Lanjut?")) && updateDoc(doc(db, "exams", code), { status: "closed" });
    $("#oScore").onchange = (e) => (opt.score = e.target.checked);
    $("#oKey").onchange = (e) => (opt.key = e.target.checked);
    $("#rel").onclick = release;
    $("#xl").onclick = exportXlsx;
    $("#del").onclick = remove;
  };

  const score = (answers, keys) => {
    let got = 0, total = 0, correct = 0;
    const detail = keys.map((k, i) => {
      const ok = answers[i] === k.key;
      total += k.weight; if (ok) { got += k.weight; correct++; }
      return { mine: answers[i] || "", key: k.key, ok, expl: k.expl };
    });
    return { score: Math.round((got / total) * 1000) / 10, correct, detail };
  };
  const getKeys = async () => (await getDoc(doc(db, "keys", code))).data().items;

  async function release() {
    const showScore = $("#oScore").checked, showKey = $("#oKey").checked;
    const keys = await getKeys();
    for (let i = 0; i < subs.length; i += 400) {
      const b = writeBatch(db);
      subs.slice(i, i + 400).forEach((s) => {
        const r = score(s.answers, keys);
        b.set(doc(db, "results", `${code}_${s.uid}`), {
          examId: code, uid: s.uid, name: s.name, showScore, showKey,
          score: r.score, correct: r.correct, total: keys.length, detail: showKey ? r.detail : null,
        });
      });
      await b.commit();
    }
    notify(`Hasil dirilis untuk ${subs.length} siswa.`);
  }

  async function exportXlsx() {
    const keys = await getKeys();
    const rows = subs.map((s) => {
      const r = score(s.answers, keys);
      const o = { Nama: s.name, Kelas: s.kelas, Nilai: r.score, Benar: r.correct };
      s.answers.forEach((a, i) => (o[`S${i + 1}`] = a));
      return o;
    });
    rows.sort((a, b) => a.Nama.localeCompare(b.Nama));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Rekap");
    XLSX.writeFile(wb, `rekap-${code}.xlsx`);
  }

  async function remove() {
    if (!(await ask("Hapus ujian beserta semua jawaban dan hasil? Tidak bisa dibatalkan."))) return;
    const b = writeBatch(db);
    for (const c of ["submissions", "results"]) {
      (await getDocs(query(collection(db, c), where("examId", "==", code)))).forEach((d) => b.delete(d.ref));
    }
    b.delete(doc(db, "exams", code, "paper", "questions"));
    b.delete(doc(db, "keys", code));
    b.delete(doc(db, "exams", code));
    await b.commit();
    listView();
  }

  unsubs.push(onSnapshot(doc(db, "exams", code), (s) => { exam = s.data(); render(); }));
  unsubs.push(onSnapshot(query(collection(db, "submissions"), where("examId", "==", code)), (s) => {
    subs = s.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name));
    render();
  }));
}
