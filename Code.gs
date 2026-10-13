/**
 * BACKEND SOAL ONLINE (Google Apps Script)
 * Dipasang di Google Sheet: Extensions > Apps Script > tempel file ini.
 * Sheet wajib punya 3 tab: Soal, Pengaturan, Jawaban (sudah ada di TEMPLATE_SOAL.xlsx).
 * Kunci jawaban TIDAK PERNAH dikirim ke siswa kecuali guru menyalakan "tampilkan_kunci".
 */

const TAB_SOAL = 'Soal';
const TAB_SET = 'Pengaturan';
const TAB_JAWAB = 'Jawaban';

/* ---------- Setup (jalankan sekali kalau tab belum ada) ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(TAB_SOAL)) {
    const s = ss.insertSheet(TAB_SOAL);
    s.appendRow(['No', 'Soal', 'A', 'B', 'C', 'D', 'E', 'Kunci', 'Bobot', 'Gambar (URL, opsional)', 'Pembahasan (opsional)']);
    s.appendRow([1, 'Ibu kota Indonesia adalah...', 'Bandung', 'Jakarta', 'Surabaya', 'Medan', '', 'B', 1, '', 'Jakarta adalah ibu kota.']);
  }
  if (!ss.getSheetByName(TAB_SET)) {
    const s = ss.insertSheet(TAB_SET);
    s.appendRow(['Kunci', 'Nilai', 'Keterangan']);
    [
      ['judul', 'Ujian Contoh', 'Judul yang tampil di halaman siswa'],
      ['petunjuk', 'Kerjakan sendiri dengan jujur.', 'Petunjuk singkat untuk siswa'],
      ['status', 'BUKA', 'BUKA = siswa bisa mengerjakan, TUTUP = ditutup'],
      ['tampilkan_nilai', 'TIDAK', 'YA = siswa bisa cek nilainya'],
      ['tampilkan_kunci', 'TIDAK', 'YA = siswa bisa lihat jawaban benar & pembahasan'],
      ['acak_soal', 'YA', 'YA = urutan soal & pilihan diacak per siswa'],
      ['durasi_menit', '0', '0 = tanpa batas waktu'],
      ['pin_admin', '123456', 'GANTI PIN INI! Dipakai untuk masuk admin.html']
    ].forEach(r => s.appendRow(r));
  }
  if (!ss.getSheetByName(TAB_JAWAB)) {
    const s = ss.insertSheet(TAB_JAWAB);
    s.appendRow(['Waktu', 'Nama', 'NIS/Kelas', 'Skor', 'Benar', 'Total PG', 'Jawaban (JSON)', 'Durasi (detik)']);
    s.getRange('C:C').setNumberFormat('@'); // NIS sebagai teks (angka 0 di depan aman)
  }
}

/* ---------- Helper ---------- */
function sh_(name) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Tab "' + name + '" tidak ditemukan. Jalankan fungsi setup() atau pakai TEMPLATE_SOAL.xlsx.');
  return s;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function settings_() {
  const rows = sh_(TAB_SET).getDataRange().getValues();
  const s = {};
  rows.slice(1).forEach(r => { if (r[0] !== '') s[String(r[0]).trim()] = String(r[1]).trim(); });
  return s;
}
function setSetting_(key, val) {
  const sh = sh_(TAB_SET);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(val); return; }
  }
  sh.appendRow([key, val, '']);
}
function yes_(v) { return String(v).trim().toUpperCase() === 'YA'; }

function questions_() {
  const rows = sh_(TAB_SOAL).getDataRange().getValues();
  rows.shift();
  const out = [];
  rows.forEach(r => {
    if (String(r[1]).trim() === '') return;
    const opsi = {};
    ['A', 'B', 'C', 'D', 'E'].forEach((k, i) => {
      const v = r[2 + i];
      if (String(v).trim() !== '') opsi[k] = String(v);
    });
    const kunci = String(r[7] || '').trim().toUpperCase();
    out.push({
      id: out.length + 1,                       // ID dibuat dari urutan baris, bukan kolom No
      soal: String(r[1]),
      opsi: opsi,
      kunci: Object.keys(opsi).length ? kunci : '',   // tanpa pilihan = soal esai (tidak dinilai otomatis)
      bobot: Number(r[8]) > 0 ? Number(r[8]) : 1,
      gambar: String(r[9] || '').trim(),
      bahas: String(r[10] || '').trim()
    });
  });
  return out;
}

function score_(qs, jaw) {
  let got = 0, total = 0, benar = 0, nPG = 0;
  qs.forEach(q => {
    if (!q.kunci) return;
    nPG++; total += q.bobot;
    if (String(jaw[q.id] || '').toUpperCase() === q.kunci) { got += q.bobot; benar++; }
  });
  return { skor: total ? Math.round(got / total * 10000) / 100 : 0, benar: benar, totalPG: nPG };
}

/* ---------- Endpoint GET (siswa) ---------- */
function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.action === 'soal') return json_(publicData_());
    if (p.action === 'hasil') return json_(hasil_(String(p.id || '').trim()));
    return json_({ ok: true, msg: 'API soal aktif' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function publicData_() {
  const st = settings_();
  const buka = st.status && st.status.toUpperCase() === 'BUKA';
  const data = {
    ok: true,
    judul: st.judul || 'Ujian',
    petunjuk: st.petunjuk || '',
    buka: !!buka,
    acak: yes_(st.acak_soal),
    durasi: Number(st.durasi_menit) || 0,
    soal: []
  };
  if (buka) {
    // kunci & pembahasan dibuang sebelum dikirim
    data.soal = questions_().map(q => ({ id: q.id, soal: q.soal, opsi: q.opsi, bobot: q.bobot, gambar: q.gambar, esai: !q.kunci }));
  }
  return data;
}

function findRow_(id) {
  const sh = sh_(TAB_JAWAB);
  if (sh.getLastRow() < 2) return null;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][2]).trim() === id) return vals[i];
  return null;
}

function hasil_(id) {
  if (!id) return { ok: false, error: 'Isi NIS / Kelas dulu.' };
  const row = findRow_(id);
  if (!row) return { ok: false, error: 'Data tidak ditemukan. Cek lagi NIS-nya atau kamu belum mengumpulkan.' };
  const st = settings_();
  const res = { ok: true, nama: row[1], tersimpan: true, nilaiTampil: yes_(st.tampilkan_nilai), kunciTampil: yes_(st.tampilkan_kunci) };
  if (res.nilaiTampil) { res.skor = row[3]; res.benar = row[4]; res.totalPG = row[5]; }
  if (res.kunciTampil) {
    let jaw = {};
    try { jaw = JSON.parse(row[6] || '{}'); } catch (x) {}
    res.review = questions_().map(q => ({
      id: q.id, soal: q.soal, opsi: q.opsi, kunci: q.kunci, bahas: q.bahas, jawabanmu: jaw[q.id] || '', esai: !q.kunci
    }));
  }
  return res;
}

/* ---------- Endpoint POST (kirim jawaban & admin) ---------- */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'submit') return json_(submit_(d));
    if (d.action === 'admin') return json_(admin_(d));
    return json_({ ok: false, error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function submit_(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const st = settings_();
    if (String(st.status).toUpperCase() !== 'BUKA') return { ok: false, error: 'Ujian sedang ditutup oleh guru.' };
    const id = String(d.id || '').trim(), nama = String(d.nama || '').trim();
    if (!id || !nama) return { ok: false, error: 'Nama dan NIS/Kelas wajib diisi.' };
    if (findRow_(id)) return { ok: false, error: 'NIS/Kelas ini sudah pernah mengumpulkan jawaban.' };
    const jaw = d.jawaban && typeof d.jawaban === 'object' ? d.jawaban : {};
    const r = score_(questions_(), jaw);
    sh_(TAB_JAWAB).appendRow([new Date(), nama, id, r.skor, r.benar, r.totalPG, JSON.stringify(jaw), Number(d.durasi) || '']);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function admin_(d) {
  const st = settings_();
  if (!st.pin_admin || String(d.pin) !== st.pin_admin) return { ok: false, error: 'PIN salah.' };
  if (d.cmd === 'set') {
    const allowed = ['status', 'tampilkan_nilai', 'tampilkan_kunci', 'acak_soal'];
    if (allowed.indexOf(d.key) < 0) return { ok: false, error: 'Pengaturan tidak boleh diubah dari sini.' };
    setSetting_(d.key, String(d.value));
  }
  if (d.cmd === 'recalc') {
    const sh = sh_(TAB_JAWAB), qs = questions_();
    if (sh.getLastRow() > 1) {
      const rng = sh.getRange(2, 1, sh.getLastRow() - 1, 8), vals = rng.getValues();
      vals.forEach(row => {
        let jaw = {};
        try { jaw = JSON.parse(row[6] || '{}'); } catch (x) {}
        const r = score_(qs, jaw);
        row[3] = r.skor; row[4] = r.benar; row[5] = r.totalPG;
      });
      rng.setValues(vals);
    }
  }
  // selalu kembalikan kondisi terbaru
  const now = settings_(), sh = sh_(TAB_JAWAB);
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues() : [];
  return {
    ok: true,
    pengaturan: {
      judul: now.judul, status: now.status, tampilkan_nilai: now.tampilkan_nilai,
      tampilkan_kunci: now.tampilkan_kunci, acak_soal: now.acak_soal, durasi_menit: now.durasi_menit
    },
    jumlahSoal: questions_().length,
    hasil: rows.map(r => ({ waktu: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), nama: r[1], id: r[2], skor: r[3], benar: r[4], total: r[5], durasi: r[7] }))
  };
}
