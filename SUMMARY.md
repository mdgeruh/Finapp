# Ringkasan: Keuangan Pribadi

Ringkasan analisis dan perubahan pada proyek **Keuangan Pribadi** (v1.1.007 menjadi **v1.1.012**), tanggal 21 Sep 2026.

## 1. Gambaran proyek

Aplikasi pencatatan keuangan pribadi berbasis web statis: HTML + CSS + JavaScript biasa, tanpa build tool, sekitar 8.300 baris.

- Data utama di `localStorage` (key `keuangan-app-data-v2`), jalan offline.
- Sinkron cloud **opsional** lewat Supabase (login email + kata sandi). Aktif hanya kalau `SUPABASE_ANON_KEY` di `00-config.js` terisi; key saat ini kosong, jadi app masih mode lokal.
- Fitur: kas/bank/e-wallet, aset dengan valuasi, kartu kredit, PayLater, pinjaman bank & online (pinjol), titipan/piutang, grafik, laporan utang (proyeksi kas, total biaya utang, simulasi pelunasan, saran), export/import JSON & CSV.

**Struktur modul** (dimuat berurutan oleh `index.html`, berbagi scope global):

| File | Isi |
|---|---|
| `00-config.js` | Konfigurasi Supabase |
| `01-data.js` | State, penyimpanan, kalkulasi saldo & pinjaman |
| `02-navigasi.js` | Navigasi, header, tab Profil, sapaan |
| `03`–`05` | Form transaksi, akun, form titipan |
| `06`–`08` | Util UI, render akun/transaksi, render titipan |
| `09`–`12` | Grafik, beranda, laporan, render utama |
| `13-import-export.js` | Import, export, reset, backup |
| `14-sync.js` | Login, sinkron cloud, nama pemilik |
| `15-startup.js` | Startup (dijalankan terakhir) |

## 2. Temuan analisis dan statusnya

| # | Temuan | Status |
|---|---|---|
| 1 | **Bug kritis:** `15-startup.js` memakai `OWNER_NAME` yang sudah tidak ada, sehingga startup berhenti dan app tidak pernah merender (semua angka Rp0) | **Diperbaiki** (v1.1.008) |
| 2 | `loadData()` menimpa data lokal yang rusak dengan data contoh, dan bisa ikut terkirim ke cloud | **Diperbaiki** (v1.1.008) |
| 3 | README dan CHANGELOG usang (masih "satu file HTML, 100% lokal") | **Diperbarui** (v1.1.008 dan seterusnya) |
| 4 | `escapeHtml` tidak meng-escape tanda kutip, sedangkan dipakai di dua atribut (`03-form-transaksi.js:165`, `14-sync.js`) | Belum |
| 5 | Cache DOM `$()` rawan elemen basi setelah `innerHTML` dibuat ulang (sumber bug simulasi di v1.1.007) | Belum |
| 6 | `supabase/setup.sql` tidak ada di unggahan, jadi Row Level Security belum bisa diverifikasi | Belum |
| 7 | Data keuangan tersimpan di Supabase sebagai JSON biasa (tidak dienkripsi di sisi klien) | Catatan risiko |
| 8 | Nama default "Made Ceplor" dan data contoh `defaultData()` tertulis langsung di kode | Belum |

## 3. Perubahan per versi

### v1.1.008: perbaikan kritis
- Sapaan di startup memakai `updateGreeting()`, jadi app tampil normal lagi.
- Data lokal rusak diamankan di key `keuangan-app-data-v2-corrupt`, muncul peringatan merah, dan data contoh hanya di memori.
- README ditulis ulang: struktur multi-file, sinkron cloud, tab Profil.

### v1.1.009: layar login baru
- Tanpa kotak modal: satu kolom bersih, logo "Rp", judul serif, tombol tampil/sembunyikan kata sandi, spinner saat proses.
- Layar lupa kata sandi dan kata sandi baru memakai gaya yang sama.
- Teks isian 16px (iOS tidak zoom), layar bisa digulir di HP pendek, istilah diseragamkan jadi "kata sandi".

### v1.1.010: login dari menu gear
- Opsi **Masuk untuk sinkron** tampil kalau belum login; setelah login berganti jadi **Keluar (email)**.
- Layar masuk dari gear punya tombol **Batal**.
- Alur sesi dipakai bersama dengan alur saat boot (`syncStartSession`).
- Pesan khusus kalau pustaka Supabase belum termuat (offline).

### v1.1.011: nama pemilik tersinkron
- Nama disimpan di metadata akun Supabase (`user_metadata.owner_name`), dengan salinan lokal di `kp_owner_name`.
- Akun yang sudah punya nama menang; kalau belum, nama perangkat dikirim sebagai isi awal.
- Menyimpan nama saat login ikut memperbarui akun, dengan pesan jelas kalau gagal.

### v1.1.012: tampilan tablet dan desktop
- Layar 1024px ke atas: sidebar kiri dengan tombol **Catat transaksi**, kolom isi maksimal 760px.
- Layar 1280px ke atas: Ringkasan tampil dua kolom (kartu operasional di kiri, grafik di kanan).
- Layar 768px ke atas: dialog dan sheet muncul di tengah layar.
- Ponsel dan Export PDF tidak berubah.

## 4. File yang berubah

| File | 008 | 009 | 010 | 011 | 012 |
|---|:-:|:-:|:-:|:-:|:-:|
| `01-data.js` | ✓ |  |  | ✓ (komentar) |  |
| `02-navigasi.js` |  |  |  | ✓ |  |
| `12-render-utama.js` (versi) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `14-sync.js` |  | ✓ | ✓ | ✓ |  |
| `15-startup.js` | ✓ |  |  |  |  |
| `index.html` |  |  | ✓ | ✓ | ✓ |
| `style.css` |  | ✓ |  |  | ✓ |
| `README.md`, `CHANGELOG.md` | ✓ | ✓ | ✓ | ✓ | ✓ |

## 5. Cara pengujian

Semua perubahan diuji di browser headless (Playwright, Chromium) dengan Supabase tiruan:

- Render semua tab dengan data contoh tanpa error JavaScript.
- Data rusak: data asli tetap utuh, backup dan peringatan muncul.
- Login: isian kosong, gagal, berhasil, tombol mata, lupa kata sandi, tema terang/gelap, layar pendek.
- Menu gear: tanpa cloud, mode lokal lalu login, login saat boot.
- Nama pemilik: akun sudah punya nama, migrasi dari lokal, simpan berhasil, simpan gagal, mode lokal.
- Tampilan: lebar 1440, 1280, 1024, 900, dan 390px (tanpa scroll horizontal), dialog di tengah, dan mode cetak tetap satu kolom.

**Belum teruji:** login dan sinkron ke Supabase sungguhan, karena key kosong.

## 6. Yang belum dikerjakan

1. Perbaiki `escapeHtml` di dalam atribut (escape tanda kutip) atau ganti dengan fungsi khusus atribut.
2. Kurangi risiko cache `$()` untuk elemen yang dibuat ulang lewat `innerHTML`.
3. Tinjau `supabase/setup.sql` dan pastikan RLS aktif sebelum mengisi `SUPABASE_ANON_KEY`.
4. Pertimbangkan mengganti nama default dan menghapus data contoh untuk pengguna baru.
5. Sinkron nama dari perangkat lain masih terlihat saat login atau app dibuka ulang, belum real-time.
6. Desktop tahap 2: tab Transaksi bergaya tabel, Laporan dua kolom, Titipan master-detail, Akun grid 3 kolom, dan pintasan keyboard.

## 7. Cara memakai file hasil

Timpa file di folder proyek dengan versi terbaru dari folder output. Urutan pemuatan skrip di `index.html` tidak boleh diubah. Sebelum memasang versi baru, **Export JSON** dulu sebagai cadangan.
