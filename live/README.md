# soalbumilangit

Soal online gratis: halaman soal di **GitHub Pages**, jawaban siswa tertampung di **Google Sheets** (seperti Google Form), guru mengatur kapan nilai dan kunci jawaban boleh dilihat.

```
Siswa  →  index.html (GitHub Pages)  →  Apps Script  →  Google Sheet (Soal, Pengaturan, Jawaban)
Guru   →  admin.html (PIN)           →  Apps Script  →  buka/tutup, tampil nilai, tampil kunci, unduh CSV
```

Kunci jawaban tidak pernah dikirim ke browser siswa selama "tampilkan_kunci" bernilai TIDAK. Penilaian dilakukan di server.

## Pasang (sekali saja, ±10 menit)

### 1. Siapkan Google Sheet
1. Buka [drive.google.com](https://drive.google.com), klik **New > File upload**, pilih `TEMPLATE_SOAL.xlsx`.
2. Klik dua kali file itu, pilih **Open with Google Sheets**, lalu **File > Save as Google Sheets**.
3. Buka tab **Pengaturan**, ganti `pin_admin`, isi `judul` dan `petunjuk`.

### 2. Pasang backend
1. Di Google Sheet: **Extensions > Apps Script**.
2. Hapus isi default, tempel seluruh isi `Code.gs`, klik **Save**.
3. Klik **Deploy > New deployment**, ikon roda gigi pilih **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Klik **Deploy**, setujui izin (klik *Advanced > Go to … (unsafe)* jika muncul peringatan, itu skrip kamu sendiri).
5. Salin **Web app URL** (berakhiran `/exec`).

### 3. Pasang halaman web
1. Buka `config.js`, ganti `PASTE_URL_WEB_APP_DI_SINI` dengan URL tadi.
2. Di repo GitHub: **Add file > Upload files**, unggah `index.html`, `admin.html`, `config.js` (jangan unggah `Code.gs` dan xlsx kalau tidak mau, tidak masalah juga), lalu **Commit**.
3. **Settings > Pages > Source: Deploy from a branch > main / (root) > Save**.
4. Tunggu 1-2 menit. Alamatnya:
   - Siswa: `https://yusriliqbal27.github.io/soalbumilangit/`
   - Guru: `https://yusriliqbal27.github.io/soalbumilangit/admin.html`

## Membuat soal baru
Satu baris di tab **Soal** = satu soal.

| Kolom | Isi |
|---|---|
| Soal | Teks soal |
| A–E | Pilihan jawaban (boleh hanya A–C atau A–D) |
| Kunci | Satu huruf, misal `B` |
| Bobot | Angka (kosong = 1) |
| Gambar | Link `https://…` (opsional) |
| Pembahasan | Tampil saat kunci dibuka (opsional) |

- **Soal esai**: kosongkan A–E dan Kunci. Jawaban tersimpan, tidak dinilai otomatis.
- **Dari Excel**: isi di Excel dengan kolom yang sama, lalu salin-tempel barisnya ke tab Soal. Atau unggah ulang file xlsx sebagai Sheet baru dan pasang ulang langkah 2.
- Soal langsung berubah di web tanpa upload ulang ke GitHub.

## Alur satu ujian
1. Isi soal, pastikan `status = BUKA` di admin.
2. Bagikan link siswa. Semua mengerjakan, jawaban masuk ke tab **Jawaban**.
3. Selesai: **Tutup** ujian di admin.
4. Kalau mau, tekan **Tampil** untuk nilai, lalu **Tampil** untuk kunci. Siswa cek lewat tab *Cek Hasil* dengan NIS-nya.
5. Unduh CSV. Untuk ujian baru, hapus baris 2 ke bawah di tab Jawaban dan ganti isi tab Soal.

Salah kunci? Perbaiki di Sheet, lalu klik **Hitung ulang nilai** di admin.

## Catatan
- Satu NIS hanya bisa mengumpulkan sekali (mencegah dobel kirim).
- Kalau kamu mengubah kode `Code.gs`, deploy ulang lewat **Deploy > Manage deployments > Edit > New version**, URL tetap sama.
- Siswa bisa cek hasil dengan NIS saja, jadi pakai NIS yang tidak mudah ditebak jika nilai bersifat rahasia.
