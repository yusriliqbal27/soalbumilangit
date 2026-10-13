# Soal Bumi Langit

Ujian online serentak. Hosting di GitHub Pages, penyimpanan jawaban di Firebase (gratis).

- Siswa: `index.html` — masuk dengan kode ujian + nama, tunggu guru menekan **Mulai**, semua mengerjakan bersamaan.
- Guru: `admin.html` — buat ujian dari Excel, mulai/akhiri, lalu pilih siswa boleh lihat nilai / kunci atau tidak.
- Jawaban tidak ditampilkan ke siapa pun sampai guru menekan **Rilis**.

## Setup (sekali saja, ±10 menit)

1. https://console.firebase.google.com → **Add project** (Analytics boleh dimatikan).
2. **Build → Firestore Database → Create database** (mode production, lokasi `asia-southeast2` atau terdekat).
3. **Build → Authentication → Get started**, aktifkan **Anonymous** dan **Google**.
   Tab **Settings → Authorized domains** → tambah `yusriliqbal27.github.io`.
4. **Project settings → Your apps → Web (`</>`)** → salin `firebaseConfig` ke [firebase-config.js](firebase-config.js).
5. Buka [firestore.rules](firestore.rules), ganti `GANTI_EMAIL_GURU@gmail.com` dengan email Google guru, lalu tempel seluruhnya di **Firestore → Rules → Publish**.
6. GitHub repo → **Settings → Pages** → Source: `main` / root. Tunggu 1–2 menit.
7. Guru buka `https://yusriliqbal27.github.io/soalbumilangit/admin.html`, login Google.

## Membuat soal baru

1. Di panel guru klik **Unduh template Excel** (atau pakai [template-soal.xlsx](template-soal.xlsx)).
2. Isi kolom: `No, Soal, A–E, Kunci, Bobot, Pembahasan, Gambar` (A–E minimal 2 diisi; Bobot, Pembahasan, Gambar boleh kosong).
3. Unggah file → tampil "N soal terbaca ✓" (atau daftar baris yang salah) → **Simpan ujian**.
4. Bagikan **kode ujian** ke siswa. Saat semua siap, klik **Mulai ujian untuk semua**.

## Catatan keamanan

Kunci jawaban disimpan di koleksi `keys` yang hanya bisa dibaca guru; siswa tidak pernah menerimanya sebelum Rilis.
Setiap siswa hanya bisa mengirim sekali (per perangkat/browser). Kunci API Firebase di `firebase-config.js` memang publik; yang melindungi data adalah aturan Firestore.

## Soal bergambar

Isi kolom **Gambar** pada baris soal itu dengan salah satu:

1. **Nama file** gambar yang kamu taruh di folder `gambar/` repo ini, mis. `lapisan-bumi.png` (paling aman, tidak bergantung situs lain). Upload gambarnya lewat GitHub → Add file → Upload files, ke folder `gambar`.
2. **Link `https://...`** langsung ke gambar (harus berakhiran .png/.jpg atau link gambar langsung).
3. **Link berbagi Google Drive** (`https://drive.google.com/file/d/.../view`), dengan akses "Siapa saja yang memiliki link". Diubah otomatis menjadi link gambar.

Contoh: [soal-gambar-contoh.xlsx](soal-gambar-contoh.xlsx) dan [gambar/lapisan-bumi.png](gambar/lapisan-bumi.png).
Gambar tampil di atas pilihan jawaban, dan juga di halaman hasil saat kunci dirilis.
