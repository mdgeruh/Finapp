# Changelog

Riwayat perubahan **Keuangan Pribadi**. Format: yang terbaru di atas. Nomor versi mengikuti `APP_VERSION` dan footer app (sebelumnya juga nama file `keuangan_pribadi-v1_1_NNN.html`).

## v1.1.031 — 23 Sep 2026

**Diubah**
- **Icon gear diganti icon user, langsung buka tab Profil (`index.html`, `02-navigasi.js`):** tombol di pojok kanan atas sebelumnya membuka dropdown menu (Profil / Tampilan / Sinkron) lewat `toggleSettingsMenu()`. Sekarang icon-nya jadi siluet orang dan klik langsung `setTab('profil')` — satu langkah, bukan dua. Dropdown `.settings-menu` beserta CSS-nya, `toggleSettingsMenu()`, `goToSettingsTab()`, dan listener klik-di-luar untuk menutup menu semuanya dihapus karena sudah tidak dipakai
- **Toggle Tampilan (gelap/terang) dan tombol Masuk/Keluar sinkron dipindah ke tab Profil** (`index.html`) — sebelumnya ada di dropdown menu gear yang sekarang dihapus, jadi semua pengaturan "tentang saya & tampilan" sekarang ngumpul di satu tab. Elemen (`theme-toggle-btn`, `sync-menu-login-btn`, `sync-logout-btn`) tetap id yang sama, cuma pindah lokasi di halaman, jadi kode `02-navigasi.js`/`14-sync.js` yang menunjuknya tidak perlu berubah

**Diperbaiki**
- **Duplikasi kode parsing akun & transaksi import dipangkas** (`13-import-export.js`): `importJson()` (gabung ke data yang ada) dan `resetAndImport()` (ganti semua data) sebelumnya masing-masing punya ~70 baris logic yang identik untuk menyalin field akun (limit, biaya admin, bunga pinjaman, cicilan PayLater, dst.) dan ~15 baris untuk membentuk objek transaksi. Sekarang dipusatkan jadi dua fungsi bersama, `buildAccountFromImport(a, newId)` dan `buildTxnFromImport(t, idMap, fallbackAccId)`, dipakai oleh keduanya — total baris berkurang ±150, dan field baru ke depannya cukup ditambah sekali, tidak berisiko lupa di salah satu jalur import

## v1.1.030 — 23 Sep 2026

**Ditambah**
- **Nama file export/backup sekarang berprefix identitas user** (`13-import-export.js`, fungsi baru `exportUserPrefix()`): dipakai di ekspor JSON, ekspor CSV, dan backup otomatis sebelum reset/timpa data (`autoBackupBeforeReset`). Prioritas sumber prefix: bagian sebelum `@` dari email akun cloud kalau sedang login, kalau tidak pakai nama pemilik dari tab Profil, terakhir `'user'` kalau keduanya kosong. Nama disaring jadi slug huruf kecil + angka (aksen dilepas, karakter lain jadi `-`), misal `keuangan-budi-2026-09-23.json`. Berguna terutama sejak device bisa dipakai gantian beberapa akun (lihat perbaikan `syncGuardAccountSwitch` di v1.1.029) — file-file backup dari akun berbeda jadi mudah dibedakan tanpa perlu buka isinya dulu

## v1.1.029 — 23 Sep 2026

**Diperbaiki**
- **Data bisa "kebawa" antar akun cloud di device yang sama (bug penting):** localStorage (`STORAGE_KEY`) cuma satu untuk seluruh device, tidak dibedakan per akun. Kalau device ini pernah sinkron dengan akun cloud A lalu ada yang Keluar dan Masuk/Daftar dengan akun B (ganti user, pinjam HP, dst) tanpa localStorage sempat dibersihkan, `syncReconcile()` di `14-sync.js` mengira sisa data akun A itu "data di perangkat ini" milik akun B: ditawarkan sebagai pilihan yang bisa keliru dipilih, atau — kalau cloud akun B masih kosong — otomatis ikut terkirim jadi isi awal akun B. Sekarang ditambahkan `syncGuardAccountSwitch()`, dipanggil di awal `syncStartSession()` sebelum `syncReconcile()` menyentuh localStorage sama sekali: kalau `uid` di metadata sinkron device (`kp_sync_meta`) beda dari `uid` akun yang baru login, data lokal lama itu dibackup dulu ke file JSON (`autoBackupBeforeReset`), lalu `STORAGE_KEY` & `kp_seed_demo` dihapus dan metanya direset ke `{uid: akun-baru, version: 0}` sebelum lanjut — jadi device diperlakukan seolah baru pertama kali dipakai akun tersebut (tarik bersih dari cloud, atau mulai kosong kalau cloud-nya juga kosong). Alur migrasi normal "coba mode lokal dulu → baru Daftar" tidak berubah, karena di situ `meta.uid` memang masih kosong (belum pernah sync sama sekali)

## v1.1.028 — 23 Sep 2026

**Diperbaiki**
- **Akun cloud baru tidak lagi ikut kebawa data contoh:** sebelumnya `loadData()` (`01-data.js`) selalu mengisi 7 transaksi contoh bawaan (`defaultData()`) begitu localStorage perangkat kosong. Kalau user sempat coba "Pakai mode lokal dulu" (jadi data contoh itu sudah tersimpan lokal) lalu belakangan Daftar/Masuk Google, data contoh itu ikut terkirim jadi "isi awal" akun cloud yang baru dibuat -- padahal seharusnya kosong. Sekarang:
  - Kalau `loadData()` pertama kali mengisi data padahal saat itu sedang aktif sesi cloud (`sync.ready`), yang diisi adalah data benar-benar kosong (`emptyData()`, cuma 1 akun Kas saldo 0, tanpa transaksi), bukan data contoh
  - Data contoh yang tersimpan lokal ditandai (`SEED_DEMO_KEY`, dihapus otomatis oleh `saveData()` begitu ada perubahan sungguhan dari user). Kalau saat sinkron pertama ke akun cloud baru (`syncReconcile` di `14-sync.js`) ternyata data lokalnya masih persis data contoh yang belum tersentuh itu, datanya diganti kosong dulu sebelum dikirim
  - Data lokal **asli** yang sudah pernah diedit user (bukan data contoh) tetap terkirim apa adanya saat pertama kali disinkronkan ke akun cloud baru -- perilaku migrasi ini tidak berubah

## v1.1.027 — 23 Sep 2026

**Diubah**
- **`signUp()` di form Daftar sekarang mengirim `emailRedirectTo: location.href`** (`14-sync.js`), sama seperti pola yang sudah dipakai di "Lupa kata sandi" — memastikan link konfirmasi di email pendaftaran mengarah balik ke domain app yang sedang dipakai user, bukan cuma andalkan "Site URL" tunggal di dashboard Supabase. Domain ini tetap harus didaftarkan di Supabase → Authentication → URL Configuration → Redirect URLs, kalau tidak Supabase menolak redirect-nya

## v1.1.026 — 23 Sep 2026

**Ditambah**
- **Masuk/daftar dengan Google (OAuth)** (`14-sync.js`): tombol "Masuk dengan Google" / "Daftar dengan Google" di layar Masuk & Daftar, lewat `supabase.auth.signInWithOAuth({ provider: 'google' })`. Satu tombol ini otomatis berfungsi untuk keduanya — Google akan membuatkan akun baru kalau emailnya belum pernah dipakai, atau langsung login kalau sudah ada. Browser dialihkan penuh ke halaman Google lalu kembali ke app; Supabase-js membaca sesinya dari URL secara otomatis saat halaman dimuat ulang, jadi tidak ada logika baru di `syncBootInner()`. Tombol pakai gaya `.auth-oauth-btn` baru (border tipis, ikon "G" 4 warna) dipisahkan dari form email/password lewat divider "atau pakai email" (`.auth-divider`, CSS baru di `style.css`)
- **Setup sekali di luar app (wajib sebelum tombol Google berfungsi):** aktifkan provider Google di dashboard Supabase (Authentication → Providers → Google, isi Client ID & Secret dari Google Cloud Console), lalu tambahkan URL tempat app ini di-hosting ke daftar Redirect URLs (Authentication → URL Configuration). Tanpa ini tombol akan menampilkan pesan error dari Supabase saat diklik

## v1.1.025 — 23 Sep 2026

**Ditambah**
- **Pendaftaran akun baru langsung dari layar masuk** (`14-sync.js`): tautan "Belum punya akun? Daftar" di bawah layar Masuk membuka form Daftar (email, kata sandi, ulangi kata sandi) yang memanggil `supabase.auth.signUp()`. Kalau proyek Supabase mewajibkan konfirmasi email (bawaan default Supabase), user diberi tahu untuk cek email lalu diarahkan balik ke layar Masuk; kalau konfirmasi email dimatikan di pengaturan proyeknya, sesi langsung aktif setelah daftar (perilaku sama seperti login sukses). Validasi dasar (kata sandi minimal 6 karakter, kata sandi & ulangannya harus sama) dilakukan di sisi app sebelum memanggil Supabase. Tidak ada tabel/skema baru — akun tetap dikelola sepenuhnya oleh Supabase Auth, baris `app_data` untuk user baru baru dibuat saat data pertama kali tersinkron (lihat `syncReconcile`)

## v1.1.024 — 23 Sep 2026

**Diubah**
- **Sisa dropdown bawaan browser diganti jadi custom** (`enhanceSelect`, lanjutan v1.1.021): form akun/edit akun — jenis akun, jenis nilai & periode biaya admin, jenis aset, jenis pembayaran minimum kartu kredit, status pinjaman, jenis bunga, satuan suku bunga, cara bayar biaya admin, akun pencairan pinjaman; form "Catat pembayaran" pinjaman — jenis pembayaran & sumber dana; form Titipan — pilih orang & pilih dana; dan metode pembayaran PayLater di form transaksi. Semuanya sekarang tampil senada tema app di semua browser/HP, `<select>` asli tetap ada di balik layar jadi logic lama tidak berubah
- Panel dropdown custom sekarang ikut menyembunyikan opsi yang di-nonaktifkan lewat kode (mis. opsi "Bayar bunga saja" yang disembunyikan untuk Pinjaman Online), sebelumnya cuma disembunyikan di `<select>` asli tapi masih muncul di panel custom
- **Filter bulan & urutkan di tab Transaksi ikut diganti juga**: tampilan tetap ringkas seperti sebelumnya (ukuran/padding disesuaikan lewat CSS khusus per lokasi), cuma widget-nya sekarang custom

## v1.1.023 — 23 Sep 2026

**Ditambah**
- **Tab "Akun" dan "Data" dipindah ke nav bawah** (sebelumnya cuma bisa dibuka lewat menu pengaturan ⚙️): nav bawah sekarang berisi 6 tab — Ringkasan, Akun, Transaksi, Titipan, Laporan, Data — plus tombol + melayang terpisah. Ikon kartu (Akun) dan ikon database (Data) baru ditambahkan senada gaya ikon nav lain. Entri "Akun" & "Data & Export" di menu pengaturan dihapus (redundan), "Profil" tetap di sana. Ukuran font/ikon nav dikecilkan sedikit dan label dibungkus `<span>` supaya bisa ellipsis (…) kalau kepanjangan di layar sempit, supaya 6 tab tetap muat rapi

## v1.1.022 — 23 Sep 2026

**Diubah**
- **Tombol + (catat transaksi) di nav bawah diganti jadi FAB (floating action button) yang melayang lepas** di pojok kanan bawah layar, bukan lagi menyatu di tengah baris nav — juga berlaku di tampilan desktop (sebelumnya di desktop tombol ini jadi tombol lebar biasa di atas menu sidebar). Empat tombol nav lainnya otomatis membagi rata ruang yang ditinggalkan

## v1.1.021 — 23 Sep 2026

**Diubah**
- **Dropdown akun & kategori di form transaksi diganti jadi custom (bukan `<select>` bawaan browser):** field kategori, akun, dan akun tujuan (transfer) sekarang tampil sebagai tombol + panel pilihan sendiri (`06-util-ui.js`, fungsi `enhanceSelect`), supaya tampilannya konsisten di semua browser/HP dan bisa didesain senada tema app (termasuk grouping akun tetap dipertahankan). `<select>` aslinya tetap ada di balik layar (disembunyikan) sebagai sumber data, jadi semua logic form transaksi yang sudah ada tidak diubah/berisiko rusak. Dropdown lain (form akun, sort, bulan, dll) masih pakai `<select>` bawaan browser

## v1.1.020 — 22 Sep 2026

**Diubah** (color scheme & tipografi — "Modern mint")
- **Palet warna diganti total,** menjauh dari kombinasi krem+serif+terracotta lama: dasar sekarang abu-hijau sejuk nyaris putih (`--paper: #F3F6F4`), kartu putih bersih dengan border tipis (`--card: #FFFFFF`, sebelumnya `#FDFBF5` hampir menyatu dengan `--paper`), warna utama jadi mint cerah (`--teal: #14B88A`, sebelumnya hijau tua muram `#1F4B43`), dan aksen jadi koral hangat (`--rust: #FF6B4A`, sebelumnya rust `#A9532B`). Mode gelap ikut disegarkan senada (dasar `#0F1613`, mint `#3DDC97`). Warna semantik lain (hijau/merah/biru/ungu/kuning) ikut dicerahkan tipis biar senada
- **Font judul diganti dari Fraunces (serif) ke Space Grotesk (sans modern)** — dipakai di `h1`, saldo besar di Ringkasan, jumlah di detail transaksi, dan layar login (logo + judul). Body text tetap Inter
- Warna shadow/overlay modal disesuaikan dari coklat hangat ke gelap kehijauan biar senada palet baru
- Ikon PWA (`icon-*.png`, ditambahkan di v1.1.019) dan `manifest.json` (`theme_color`, `background_color`) ikut diperbarui ke palet baru
- Tidak ada perubahan struktur/logika — murni visual

## v1.1.019 — 22 Sep 2026

**Ditambah**
- **Bisa di-install sebagai app (PWA):** menambahkan `manifest.json` + ikon (`icon-192.png`, `icon-512.png`, dan versi maskable-nya — motif dompet + koin, warna teal/krem/rust sesuai skema app) serta tag terkait di `index.html`. Di HP (Android/iOS) dan desktop, ini memunculkan opsi "Install" / "Add to Home Screen" yang membuka app di jendela sendiri (tanpa address bar), bukan sekadar shortcut tab browser. **Catatan:** prompt install resmi Chrome butuh app di-host lewat HTTP/HTTPS (mis. `python3 -m http.server`, atau GitHub Pages) — dibuka langsung dari `file://` tetap bisa dipakai seperti biasa, tapi tanpa prompt install otomatis

## v1.1.018 — 22 Sep 2026

**Dioptimalkan** (performa, tidak ada perubahan tampilan/perilaku)
- **Hitung bunga pinjaman bunga TETAP dipercepat:** `computeLoanMonthlyInterest()` sebelumnya selalu scan ulang SELURUH `data.txns` lewat `accountBalance()` untuk menghitung `sisaPokok`, padahal nilai itu cuma dipakai untuk pinjaman bunga **menurun** — pinjaman **tetap/flat** memakai pokok awal, bukan sisa pokok, jadi scan itu sia-sia untuk jenis ini. Sekarang scan itu hanya dijalankan kalau jenis bunganya memang menurun, dan fungsi ini juga menerima `bal` opsional (dari `computeAllBalances()`) supaya pemanggil yang sudah punya saldo tidak perlu scan ulang sama sekali. Dampak terasa di tab Akun & Laporan kalau jumlah akun pinjaman dan transaksi sudah banyak — hasil perhitungan sama persis, cuma lebih cepat

## v1.1.017 — 22 Sep 2026

**Dioptimalkan** (performa, tidak ada perubahan tampilan/perilaku)
- **Daftar transaksi divirtualisasi:** tab Transaksi kini menggambar 80 transaksi per halaman (bukan semuanya sekaligus), dengan tombol "Muat lebih banyak" untuk menampilkan 80 berikutnya. Potongan halaman selalu di batas hari (kelompok tanggal tidak pernah terpotong di tengah), dan halaman otomatis kembali ke awal tiap ganti filter/urutan/cari/bulan. Berdampak terutama kalau jurnal transaksi sudah sangat panjang (ratusan–ribuan baris) — sebelumnya semua baris dibangun ulang di DOM tiap render
- **Hitung saldo akun aset dipercepat:** `computeAllBalances()` sebelumnya scan ulang SELURUH transaksi dari nol untuk tiap akun aset (properti/emas/forex dll — `O(akun aset × transaksi)`). Sekarang transaksi dikelompokkan per akun sekali di awal, jadi totalnya `O(transaksi)` saja. Hasil perhitungan sama persis, cuma lebih cepat kalau akun asetnya banyak

## v1.1.016 — 21 Sep 2026

**Ditambah** (pinjaman bunga menurun & pinjaman bank)
- **Anuitas (PMT) untuk bunga menurun:** kalau pokok, tenor, dan suku bunga diisi tapi angsuran dikosongkan, angsuran per bulan dihitung otomatis dengan rumus anuitas (tetap tiap bulan, porsi bunga mengecil dan porsi pokok membesar seiring waktu) — sebelumnya harus dihitung manual
- **Jadwal angsuran untuk pinjaman menurun:** kalau tenor dan tanggal pencairan diisi, muncul jadwal angsuran, progres terbayar, dan masuk pengingat Jatuh tempo di Ringkasan — sebelumnya hanya pinjaman bunga tetap yang punya ini
- **Kolom Tenor, tanggal pencairan, dan tanggal jatuh tempo kini muncul untuk pinjaman bank juga** (sebelumnya hanya pinjaman online). Pinjaman bank bunga tetap yang mengisi tenor juga ikut mendapat jadwal angsuran dan pengingat jatuh tempo
- **Laporan → Total biaya utang** kini menghitung sisa bunga pinjaman menurun dari jadwal anuitas kalau datanya lengkap (sebelumnya selalu tampil "-" untuk pinjaman menurun)
- **Simulasi pelunasan:** pinjaman menurun yang tenor/tanggal pencairan/suku bunganya lengkap tidak lagi butuh angsuran manual — angsuran anuitas otomatis dipakai, sehingga lebih sedikit pinjaman yang perlu masuk daftar "Belum disertakan" (lihat v1.1.015)

**Catatan**
- Perhitungan menurun mengasumsikan angsuran dibayar tepat sesuai jadwal (bulan demi bulan), sama seperti asumsi yang sudah dipakai jadwal pinjaman bunga tetap. Kalau pembayaran nyata berbeda dari jadwal, progres "terbayar" bisa sedikit meleset dari histori transaksi sebenarnya

## v1.1.015 — 21 Sep 2026

**Diperbaiki** (logika pinjaman)
- **Bayar beberapa angsuran sekaligus (pinjaman flat bertenor):** bunga kini dihitung per angsuran, bukan satu bulan saja. Contoh Rp3,36 juta (3 angsuran) sebelumnya tercatat bunga Rp120 ribu + pokok Rp3,24 juta; sekarang bunga Rp360 ribu + pokok Rp3,0 juta. Sisa pokok dan sisa bunga di tab Akun kembali sama dengan Laporan. Berlaku di mode "Angsuran"; mode "Nominal bebas" dan "Bunga saja" tidak berubah
- **Simulasi pelunasan:** pinjaman yang angsuran per bulannya belum diisi tidak lagi dianggap lunas dalam 1 bulan. Pinjaman itu dikeluarkan dari simulasi dan muncul catatan "Belum disertakan"

**Diubah**
- **Baris biaya di Laporan** kini akurat: pinjaman flat menampilkan "Bunga flat ≈ x%/bln dari pokok awal" dan, kalau tenor diketahui, bunga efektifnya (IRR, sudah memperhitungkan admin/materai di depan). Contoh: flat 12%/thn tenor 12 bulan ≈ 1,79%/bln efektif. Pinjaman menurun menampilkan "Bunga menurun ≈ x%/bln dari sisa pokok" (sebelumnya membagi bunga saat ini dengan pokok awal sehingga terlihat lebih kecil)

## v1.1.014 — 21 Sep 2026

**Diubah** (tampilan desktop)
- **Transaksi, Titipan, dan Laporan kini dua panel mulai layar 1024px** (sebelumnya 1280px), jadi laptop berlayar 1024–1279px tidak lagi terlihat seperti tampilan ponsel. Panel kiri 264px (filter/ringkasan), isi di kanan. Mulai 1280px panel kiri melebar (320px atau 300px) dan bagian dalam Laporan dua kolom
- **Akun:** kartu yang sendirian di grupnya kini memenuhi lebar grup, tidak lagi setengah lebar
- Di bawah 1024px tidak ada perubahan

## v1.1.013 — 21 Sep 2026

**Diubah** (tampilan desktop, semua tab)
- **Layar 1280px ke atas:**
  - **Akun:** grup akun mengalir dalam dua kolom
  - **Transaksi:** panel filter (bulan, cari, urutan, jenis, akun) menempel di kiri, daftar di kanan
  - **Titipan:** ringkasan di kiri, daftar orang di kanan
  - **Laporan:** pengaturan periode dan filter menempel di kiri; hasil di kanan dengan kartu utang dua kolom dan kategori pemasukan/pengeluaran berdampingan
  - **Data & Profil:** bagian pengaturan jadi kartu dua kolom
- **Layar 1024px ke atas:** bagian pengaturan Data & Profil tampil sebagai kartu; tab lain tetap satu kolom selebar maksimal 760px
- Ponsel, tablet, dan Export PDF tidak berubah. Struktur HTML diberi pembungkus (`txn-filters`, `titipan-side`, `laporan-controls`, dan lainnya) yang tidak berefek di layar kecil

## v1.1.012 — 21 Sep 2026

**Ditambah** (tampilan tablet & desktop)
- **Layar 1024px ke atas:** navigasi pindah ke sidebar kiri (tombol **Catat transaksi** di atas, lalu Ringkasan, Transaksi, Titipan, Laporan). Isi tidak lagi tertutup bilah bawah. Kolom isi maksimal 760px, kecuali Ringkasan
- **Layar 1280px ke atas:** tab Ringkasan tampil dua kolom (kartu operasional di kiri, grafik di kanan), sehingga halaman jauh lebih pendek
- **Layar 768px ke atas:** dialog konfirmasi dan sheet detail muncul di tengah layar (sebelumnya naik dari bawah); kolom isi 720px
- Efek hover pada menu navigasi
- Ponsel (di bawah 768px) dan Export PDF tidak berubah

## v1.1.011 — 21 Sep 2026

**Ditambah** (sinkron cloud)
- **Nama pemilik ikut tersinkron** lewat metadata akun Supabase (`user_metadata.owner_name`). Saat login, nama dari akun dipakai untuk sapaan; kalau akun belum punya nama dan perangkat ini pernah mengisinya, nama itu dikirim sebagai isi awal
- Menyimpan nama di tab Profil saat sudah login ikut memperbarui akun. Kalau gagal terkirim, muncul pesan bahwa nama baru tersimpan di perangkat ini saja
- Teks di tab Profil menyesuaikan status login

**Catatan**
- Nama tetap disalin di localStorage (`kp_owner_name`) supaya sapaan benar saat offline dan mode lokal. Nama tidak ikut Export JSON. Perubahan dari perangkat lain terlihat saat login atau app dibuka ulang

## v1.1.010 — 21 Sep 2026

**Ditambah** (sinkron cloud)
- Menu gear punya opsi **Masuk untuk sinkron** yang tampil kalau belum login (misalnya tadi memilih "Pakai mode lokal dulu"). Setelah login, opsi itu berganti jadi **Keluar (email)**. Tidak tampil kalau sinkron cloud tidak dikonfigurasi
- Layar masuk dari menu gear punya tombol **Batal**. Perubahan yang dibuat selama mode lokal tetap dikirim ke cloud, atau muncul dialog pilihan kalau cloud sudah punya data berbeda
- Kalau pustaka sinkron belum termuat (offline), muncul pesan untuk periksa koneksi lalu muat ulang

**Diubah**
- Alur login setelah app terbuka dipakai bersama dengan alur saat boot (`syncStartSession`), jadi perilakunya sama
- Teks di tab Profil disesuaikan: masuk lewat menu gear kapan saja

## v1.1.009 — 21 Sep 2026

**Diubah** (sinkron cloud)
- **Layar masuk didesain ulang**: tanpa kotak modal, satu kolom bersih dengan logo "Rp", judul serif, label di atas kolom, tombol tampil/sembunyikan kata sandi, tombol utama dengan indikator loading, dan pesan galat/sukses di bawah kolom. Mengikuti tema terang/gelap
- Layar **lupa kata sandi** dan **kata sandi baru** memakai tampilan yang sama. Email yang sudah diketik ikut terbawa saat pindah antar layar
- Ukuran teks kolom isian 16px supaya iOS tidak memperbesar layar saat mengetik. Layar bisa digulir di HP berlayar pendek
- Istilah diseragamkan jadi "kata sandi" (sebelumnya campur dengan "password")

## v1.1.008 — 21 Sep 2026

**Diperbaiki**
- **App tidak tampil sama sekali (semua angka Rp0)**: `15-startup.js` masih memakai konstanta `OWNER_NAME` yang sudah diganti `getOwnerName()`, sehingga startup berhenti dengan error dan `render()` tidak pernah jalan. Sapaan kini lewat `updateGreeting()`
- **Data lokal rusak tidak lagi ditimpa data contoh**: kalau JSON di localStorage tidak bisa dibaca (atau bentuknya salah), salinan mentahnya diamankan di key `keuangan-app-data-v2-corrupt`, muncul peringatan merah, dan data contoh hanya dipakai di memori (tidak disimpan/dikirim ke cloud) sampai pengguna mengubah sesuatu

**Diubah**
- README diperbarui: struktur multi-file, sinkron cloud (Supabase), tab Profil, key localStorage baru

## v1.1.007 — 21 Sep 2026

**Diubah** (tab Laporan)
- **Rincian utang**, **Proyeksi kas**, **Total biaya utang**, dan **Simulasi pelunasan** dipadatkan dengan pola yang sama seperti Saran: satu baris per akun/tagihan (titik status, nama, nilai, petunjuk satu baris), ketuk untuk detail. Halaman Laporan sekitar 19% lebih pendek di HP (data uji: 5.224 px jadi 4.236 px)
- Rincian utang: titik status merah/kuning/hijau per akun (lewat jatuh tempo atau limit ≥70% merah; limit ≥30% atau jatuh tempo ≤7 hari kuning)
- Proyeksi kas: empat angka ringkasan jadi grid 2×2, urutan bayar tampil 5 dulu lalu "Tampilkan N lagi", catatan dikecilkan. Ganti 30/60 hari kini hanya menggambar ulang kartu ini, jadi baris lain yang sedang dibuka dan posisi gulir tidak berubah
- Total biaya utang: satu baris per akun dengan total biaya kontrak di kanan, rincian di dalam baris
- Simulasi pelunasan: label skenario dipersingkat, penjelasan dan catatan pindah ke "Catatan simulasi" (tertutup)
- **Export PDF**: semua baris lipat (termasuk Saran) dibuka otomatis saat cetak lalu dikembalikan. Sebelumnya isi baris yang tertutup tidak ikut tercetak

**Diperbaiki**
- Simulasi pelunasan: setelah Laporan digambar ulang (ganti periode, filter akun, dll.), mengetik dana ekstra tidak memperbarui hasil dan nilainya tidak tersimpan. Penyebabnya elemen lama tersangkut di cache DOM (`$()`); kini selalu memakai elemen yang terbaru

**Kinerja**
- Jadwal dan sisa pinjaman, daftar jatuh tempo, dan rata-rata pemasukan dihitung sekali per render Laporan (dulu berulang di tiap kartu): jadwal 20×→9×, sisa pinjaman 15×→3×, jatuh tempo 2×→1×
- Total biaya utang menjumlah bunga & biaya dalam satu kali lewat transaksi, bukan sekali per akun
- Input dana ekstra di Simulasi menunggu jeda ketik 120 ms sebelum menghitung ulang
- Uji dengan 6.000 transaksi: render Laporan rata-rata 14,1 ms jadi 9,9 ms (sekitar 30% lebih cepat). Angka di semua kartu sudah dibandingkan dengan v1.1.006 pada beberapa set data dan hasilnya sama

## v1.1.006 — 21 Sep 2026

**Diubah**
- Kartu **Saran** di tab Laporan dipadatkan: satu baris judul per saran dengan titik warna (merah/kuning/abu/hijau), ketuk untuk detail, maksimal 3 tampil awal, sisanya di tombol "Tampilkan N lagi"
- Ringkasan jumlah "segera / waspada" ditampilkan di judul kartu
- Saran serupa digabung (limit kartu + PayLater jadi satu; pinjol berbiaya tinggi jadi satu). Catatan bunga flat pindah ke dalam detail pinjol
- Saran "tagihan terdekat" dihapus karena sudah ada di Proyeksi kas
- Disclaimer dikecilkan jadi satu baris

## v1.1.005 — 21 Sep 2026

**Diubah**
- Header dirapikan: judul "Keuangan harian" jadi **"Keuangan pribadi"** (judul tab browser ikut), sapaan sesuai jam + nama pemilik (`OWNER_NAME`), tanggal singkat dengan hari ("Sen, 21 Sep 2026")
- Ikon pengaturan ⚙ diganti ikon SVG yang gayanya sama dengan ikon mata di kartu saldo, supaya tampil konsisten di semua perangkat
- Perataan eyebrow (sapaan, tanggal, ikon) dan jarak ke judul dirapikan

## v1.1.004 — 21 Sep 2026

**Ditambah**
- **Footer versi** di bawah semua tab: nama app, nomor versi, tanggal build (konstanta `APP_NAME`, `APP_VERSION`, `APP_BUILD`). Tidak ikut tercetak saat Export PDF

## v1.1.003 — 21 Sep 2026

**Ditambah** (tab Laporan)
- **Proyeksi kas 30/60 hari**: saldo kas + bank + e-wallet setelah tagihan & angsuran terjadwal, urut per tanggal, dengan peringatan tanggal saldo diperkirakan minus. Angsuran pinjaman diambil dari jadwal semua bulan, cicilan PayLater bulan berikutnya ikut dihitung
- **Total biaya utang**: bunga, admin, asuransi, materai per akun (sudah dibayar vs sisa, persen dari pokok), plus total gabungan
- **Simulasi pelunasan**: input dana ekstra per bulan, membandingkan 3 skenario (tanpa ekstra, ekstra bunga tertinggi dulu, ekstra saldo terkecil dulu) dengan cicilan yang lunas digulung ke utang lain. Hasil terbarui langsung saat mengetik

## v1.1.002 — 21 Sep 2026

**Ditambah** (tab Laporan)
- **Rincian utang** per jenis: kartu kredit (pemakaian vs limit, tagihan cetak, minimum, jatuh tempo, estimasi bunga), PayLater (limit terpakai, cicilan aktif, sisa bunga cicilan, tagihan periode ini), pinjol & pinjaman bank (sisa pokok + bunga & biaya, angsuran ke-n, angsuran berikutnya, biaya efektif per bulan)
- Kartu **Saran** otomatis: tagihan lewat jatuh tempo, pemakaian limit, beban cicilan vs rata-rata pemasukan 90 hari, dana likuid vs tagihan 30 hari, pinjol berbiaya tinggi, prioritas dana ekstra, arus kas & beban bunga

## v1.1.001 — 21 Sep 2026

**Ditambah** (akun Pinjaman Online)
- Field **Asuransi / proteksi pinjaman** (% per bulan dari pokok awal), opsional, boleh kosong
- Pilihan **Cara bayar biaya admin**: dipotong dari pencairan (default, perilaku lama) atau dicicil bersama angsuran (pencairan Rp0 biaya)
- Angsuran otomatis kini = pokok/tenor + bunga flat + asuransi + (admin/tenor kalau dicicil), dengan rincian di bawah field angsuran
- Meta akun menampilkan "Admin ... dicicil" dan "Asuransi ...%/bln (Rp.../bln)"
- Field baru ikut Export/Import JSON dan Reset-dari-file (`loanAdminMode`, `loanInsurancePercent`)

**Diubah**
- Asuransi dan admin yang dicicil diperlakukan sebagai bagian "bunga & biaya" tiap angsuran, jadi otomatis ikut sisa hutang, jadwal angsuran (baris jadi "bunga & biaya"), dan rincian "Catat pembayaran"
- Kalau admin dicicil, pencairan tidak lagi memotong biaya admin

**Catatan**
- Akun pinjol lama tidak terpengaruh (admin tetap dipotong saat cair, tanpa asuransi)

## v1.1.000 — basis revisi

Titik awal penomoran file. Berisi seluruh fitur dari riwayat sebelum penomoran di bawah.

---

## Riwayat sebelum penomoran file

**v1.2**
- Tambah field **Tanggal** di form "Catat pembayaran" (pinjaman/pinjaman online) dan form "Catat titipan" — sebelumnya keduanya selalu memakai tanggal hari ini tanpa bisa diubah, jadi tidak bisa dipakai untuk mencatat bulan-bulan yang sudah lewat. Sekarang tanggalnya bebas dipilih (maksimal hari ini), dengan validasi supaya tidak bisa diisi tanggal masa depan
- Pesan konfirmasi kedua form otomatis menampilkan tanggal kalau tanggal yang dipilih bukan hari ini, supaya tidak salah catat
- Lihat bagian "Mencatat Bulan yang Sudah Lewat" di [README.md](README.md) untuk panduan lengkapnya

**v1.1**
- Tambah jenis aset **"Forex / trading (akun cent)"** dan **"Kripto / crypto futures"** di dropdown, lengkap dengan hint cara pakai (Jumlah = equity USD/USDT, Harga per satuan = kurs)
- Tambah tombol **"Lunasi sekarang"** di detail Titipan — mengisi mode & nominal otomatis untuk pelunasan penuh
- **Perbaikan bug**: sheet detail Titipan sekarang ikut disegarkan otomatis saat ada transaksi yang dihapus/diedit dari riwayatnya (sebelumnya cuma detail Akun biasa yang disegarkan)
- Tambah normalisasi `assetKind`/`assetUnit` (mis. `"usd"` → `"USD"`, `"forex"` → `"Forex"`) yang berlaku konsisten di input manual **dan** saat Import JSON / Reset-dari-file

**v1.0**
- Rilis awal: pencatatan kas/bank/e-wallet, aset dengan valuasi, kartu kredit, PayLater, pinjaman bank/online, titipan/piutang, grafik, laporan, export/import JSON & CSV
