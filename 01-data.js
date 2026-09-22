  /*
   * STRUKTUR FILE INI (cari komentar "====" untuk lompat ke tiap bagian):
   *  1. Konfigurasi & state terpusat (state{}, konstanta, cache DOM $())
   *  2. Lapisan data (load/save, kalkulasi saldo)
   *  3. Navigasi, header & aksi cepat
   *  4. Form transaksi
   *  5. Akun (rekening/kas/kartu)
   *  6. Titipan / piutang
   *  7. Util UI (modal, toast, format tanggal)
   *  8. Render: ringkasan akun & daftar transaksi
   *  9. Render: titipan/piutang
   *  10. Grafik (SVG): tren, net worth, cashflow, kategori
   *  11. Render: beranda
   *  12. Tab laporan
   *  13. Render utama (entry point)
   *  14. Import / export / reset data
   */
  const STORAGE_KEY = 'keuangan-app-data-v2';
  const OLD_STORAGE_KEY = 'keuangan-harian-txns';
  // Virtualisasi ringan daftar transaksi: daripada bangun SEMUA baris transaksi yang lolos filter
  // (bisa ribuan kalau jurnal sudah lama jalan), render() hanya menggambar TXN_PAGE_SIZE transaksi
  // dulu lalu ada tombol "Muat lebih banyak" (lihat loadMoreTxns() di 12-render-utama.js).
  const TXN_PAGE_SIZE = 80;

  let idCounter = 0;

  // ============================================================
  // LAPISAN DATA: penyimpanan (load/save), generate ID, kalkulasi saldo
  // ============================================================
  function generateId(prefix) {
    idCounter += 1;
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + idCounter.toString(36);
  }
  const TYPE_LABELS = { kas: 'Kas / Dompet', bank: 'Bank', ewallet: 'E-wallet', aset: 'Aset', kartu_kredit: 'Kartu Kredit', paylater: 'PayLater', pinjaman: 'Pinjaman Bank', pinjaman_online: 'Pinjaman Online', titipan: 'Titipan / Piutang' };
  const TYPE_DEBT = { kartu_kredit: true, paylater: true, pinjaman: true, pinjaman_online: true };
  const TYPE_LOAN = { pinjaman: true, pinjaman_online: true };
  const TYPE_COLOR_VAR = { kas: '--teal', bank: '--blue', ewallet: '--purple', aset: '--amber', kartu_kredit: '--rust', paylater: '--amber', pinjaman: '--blue', pinjaman_online: '--purple', titipan: '--green' };
  const CATEGORIES = {
    masuk: ['Gaji', 'Bonus/THR', 'Hasil usaha', 'Hadiah', 'Cashback/bunga', 'Jual barang', 'Lainnya'],
    keluar: ['Makan & minum', 'Transportasi', 'Belanja harian', 'Tagihan & langganan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Upacara/Ibadah', 'Cicilan/utang', 'Bunga & biaya bank', 'Biaya admin & materai pinjaman', 'Lainnya'],
    transfer: ['Top up saldo', 'Tarik tunai', 'Bayar tagihan/utang', 'Pindah dana antar akun', 'Beli/jual aset', 'Titipan/piutang', 'Lainnya']
  };
  const CATEGORY_CUSTOM = 'Lainnya';

  // Cache elemen DOM: hindari query berulang ke elemen yang sama (sebelumnya
  // beberapa id di-getElementById() ulang sampai 4-5x di fungsi berbeda).
  const _domCache = new Map();
  function $(id) {
    if (!_domCache.has(id)) _domCache.set(id, document.getElementById(id));
    return _domCache.get(id);
  }

  const PIE_COLOR_VARS = ['--teal', '--rust', '--blue', '--purple', '--amber', '--green', '--red', '--ink-soft'];

  // Semua referensi "hari ini"/"sekarang" pakai GMT+8 tetap (bukan timezone lokal perangkat),
  // supaya konsisten di HP/laptop manapun. Pakai nowGmt8() lalu getUTC*() untuk baca komponen tanggalnya.
  // Sengaja pakai `function` (bukan `const`) supaya di-hoist penuh dan aman dipanggil dari mana saja,
  // termasuk saat inisialisasi objek `state` di bawah ini.
  function nowGmt8() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
  }
  function todayStr() {
    return nowGmt8().toISOString().slice(0,10);
  }
  // Tanggal "hari ini" GMT+8, dibungkus jadi objek Date lokal jam 00:00 -
  // supaya bisa dipakai bareng .getDate()/.setDate()/.getMonth() dst seperti kode lain di file ini.
  function todayGmt8() {
    const [y, m, d] = todayStr().split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Semua state UI terpusat di satu objek (sebelumnya ~20 variabel let terpisah).
  // Memudahkan debug (console.log(state)), reset, dan nanti sinkronisasi ke backend.
  let state = {
    currentType: 'masuk',
    pendingTransferLabel: null,
    activeFilter: 'all',
    activeTypeFilter: 'all',
    sortMode: 'date-desc',
    titipanMode: 'belanja',
    activeTitipanFilter: 'all',
    titipanSortMode: 'balance',
    titipanSearchQuery: '',
    categoryChartType: 'keluar',
    editingTxnId: null,
    detailTxnId: null,
    detailTitipanId: null,
    txnSearchQuery: '',
    txnMonth: 'cur', // 'cur' = bulan berjalan (otomatis ikut ganti bulan), 'YYYY-MM', atau 'all'
    balanceHidden: false,
    collapsedDays: {},
    txnRenderLimit: TXN_PAGE_SIZE, // di-reset ke TXN_PAGE_SIZE tiap ganti filter/urutan/cari/bulan (lihat refreshTxnList)
    // Laporan tab state
    laporanPeriod: 'harian',
    laporanProjDays: 30,
    laporanSimExtra: null,
    laporanRefDate: todayGmt8(),
    laporanCustomStart: null,
    laporanCustomEnd: null,
    laporanAccFilter: 'all',
    laporanCatMasukFilter: 'all',
    laporanCatKeluarFilter: 'all'
  };

  // Header: sapaan sesuai jam + nama pemilik, tanggal singkat dengan hari.
  // Nama pemilik diedit lewat tab Profil (gear -> Profil) dan disimpan di localStorage
  // (seperti tema), bukan bagian dari data.accounts/txns -> tidak ikut ekspor JSON. Saat login, nama juga disimpan di metadata akun Supabase (lihat syncSaveOwnerName di 14-sync.js), dan localStorage jadi salinan lokalnya.
  const OWNER_NAME_KEY = 'kp_owner_name';
  const OWNER_NAME_DEFAULT = 'Made Ceplor';
  function getOwnerName() {
    try { return localStorage.getItem(OWNER_NAME_KEY) || OWNER_NAME_DEFAULT; } catch (e) { return OWNER_NAME_DEFAULT; }
  }
  function setOwnerName(name) {
    const v = (name || '').trim() || OWNER_NAME_DEFAULT;
    try { localStorage.setItem(OWNER_NAME_KEY, v); } catch (e) { /* tidak kritis */ }
    return v;
  }

  function defaultData() {
    const accId = 'kas-default';
    return {
      accounts: [{ id: accId, name: 'Kas / Dompet', type: 'kas', initialBalance: 0 }],
      txns: [
        { id: 1, date: todayStr(), type: 'masuk', desc: 'Bawa kas', amount: 100000, accountId: accId, category: 'Lainnya' },
        { id: 2, date: todayStr(), type: 'masuk', desc: 'Benerin laptop', amount: 300000, accountId: accId, category: 'Hasil usaha' },
        { id: 3, date: todayStr(), type: 'keluar', desc: 'Belanja telor', amount: 20000, accountId: accId, category: 'Belanja harian' },
        { id: 4, date: todayStr(), type: 'keluar', desc: 'Belanja bahan banten', amount: 25000, accountId: accId, category: 'Upacara/Ibadah' },
        { id: 5, date: todayStr(), type: 'keluar', desc: 'Makan di luar', amount: 35000, accountId: accId, category: 'Makan & minum' },
        { id: 6, date: todayStr(), type: 'keluar', desc: 'Take away makanan', amount: 30000, accountId: accId, category: 'Makan & minum' },
        { id: 7, date: todayStr(), type: 'keluar', desc: 'Bensin', amount: 30000, accountId: accId, category: 'Transportasi' }
      ]
    };
  }

  const CORRUPT_BACKUP_KEY = 'keuangan-app-data-v2-corrupt';
  // Data di localStorage ada tapi tidak bisa dibaca (JSON rusak / bentuk salah): jangan ditimpa data contoh.
  // Salinan mentahnya disimpan di key terpisah dan pengguna diberi peringatan. Data contoh yang dikembalikan
  // hanya ada di memori (tidak disimpan) sampai pengguna sendiri mengubah sesuatu, supaya tidak terkirim ke cloud.
  function handleCorruptData(raw, reason) {
    try {
      if (localStorage.getItem(CORRUPT_BACKUP_KEY) !== raw) localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    } catch (e) { console.error('backup data rusak gagal', e); }
    console.error('data lokal tidak bisa dibaca:', reason);
    showCorruptWarning();
    return defaultData();
  }
  function showCorruptWarning() {
    if (typeof document === 'undefined' || !document.body || document.getElementById('corrupt-data-toast')) return;
    const el = document.createElement('div');
    el.id = 'corrupt-data-toast';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:88px;z-index:9999;background:#A13B2E;color:#fff;padding:12px 14px;border-radius:12px;font:600 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);';
    el.textContent = 'Data di perangkat ini tidak bisa dibaca. Salinannya diamankan (key keuangan-app-data-v2-corrupt). Yang tampil sekarang hanya data contoh: jangan ubah apa pun sebelum memulihkan dari backup JSON.';
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }

  function loadData() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.accounts) && Array.isArray(parsed.txns)) return parsed;
        return handleCorruptData(raw, 'bentuk data tidak valid');
      }
    } catch (e) {
      if (raw) return handleCorruptData(raw, e);
      console.error('load failed', e);
    }

    // migrate from old flat-txn format if present
    try {
      const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldRaw) {
        const oldTxns = JSON.parse(oldRaw);
        const accId = 'kas-default';
        const migrated = {
          accounts: [{ id: accId, name: 'Kas / Dompet', type: 'kas', initialBalance: 0 }],
          txns: oldTxns.map(t => ({ ...t, accountId: accId }))
        };
        saveData(migrated);
        return migrated;
      }
    } catch (e) { console.error('migration failed', e); }

    const seed = defaultData();
    saveData(seed);
    return seed;
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); if (typeof syncAfterSave === 'function') syncAfterSave(); return true; }
    catch (e) {
      console.error('save failed', e);
      showSaveError();
      return false;
    }
  }
  // Peringatan terlihat kalau penyimpanan gagal (kuota penuh / mode privat / penyimpanan diblokir),
  // supaya kamu tidak mengira data sudah tersimpan. Segera ekspor JSON sebagai cadangan.
  function showSaveError() {
    if (typeof document === 'undefined' || !document.body || document.getElementById('save-error-toast')) return;
    const el = document.createElement('div');
    el.id = 'save-error-toast';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:88px;z-index:9999;background:#A13B2E;color:#fff;padding:12px 14px;border-radius:12px;font:600 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);';
    el.textContent = 'Data GAGAL disimpan di browser ini (penyimpanan penuh atau diblokir). Ekspor JSON sekarang sebagai cadangan.';
    el.onclick = () => el.remove();
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 12000);
  }

  function formatRp(n) {
    const sign = n < 0 ? '−' : '';
    return sign + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  }

  // ---------- ASET ----------
  // Nilai aset = penilaian TERBARU (acc.valuations, tanggal <= hari ini) + transaksi sesudah tanggal penilaian itu
  // (beli tambahan = transfer masuk, jual = transfer keluar). Tanpa penilaian: saldo awal + semua transaksi.
  // Jadi memperbarui nilai tidak dihitung sebagai pemasukan/pengeluaran; hanya mengubah kekayaan bersih.
  function assetBalance(acc, txns, asOf) {
    const limit = asOf || todayStr();
    const vals = (acc.valuations || []).filter(v => v && typeof v.date === 'string' && v.date <= limit && typeof v.value === 'number')
      .sort((a, b) => a.date.localeCompare(b.date));
    const cp = vals.length ? vals[vals.length - 1] : null;
    let bal = cp ? cp.value : (acc.initialBalance || 0);
    txns.forEach(t => {
      if (cp && t.date <= cp.date) return;
      if (asOf && t.date > asOf) return;
      if (t.type === 'masuk' && t.accountId === acc.id) bal += t.amount;
      else if (t.type === 'keluar' && t.accountId === acc.id) bal -= t.amount;
      else if (t.type === 'transfer') {
        if (t.accountId === acc.id) bal -= t.amount;
        if (t.toAccountId === acc.id) bal += t.amount;
      }
    });
    return bal;
  }
  function hasValuations(acc) { return acc.type === 'aset' && Array.isArray(acc.valuations) && acc.valuations.length > 0; }

  // Kelompokkan transaksi per akun SEKALI SAJA (satu pass atas semua transaksi), lalu tiap akun
  // aset tinggal pakai daftar transaksinya sendiri di assetBalance() -- bukan scan ulang SELURUH
  // data.txns dari nol untuk tiap akun aset seperti sebelumnya (O(akun aset x transaksi) -> O(transaksi)).
  // Satu transaksi bisa masuk ke 2 akun sekaligus kalau transfer (accountId & toAccountId beda).
  function groupTxnsByAccount(txns) {
    const idx = {};
    txns.forEach(t => {
      if (t.accountId) (idx[t.accountId] || (idx[t.accountId] = [])).push(t);
      if (t.type === 'transfer' && t.toAccountId && t.toAccountId !== t.accountId) {
        (idx[t.toAccountId] || (idx[t.toAccountId] = [])).push(t);
      }
    });
    return idx;
  }
  function assetMetaText(acc) {
    if (acc.type !== 'aset') return '';
    let t = '';
    if (acc.assetKind) t += ' · ' + acc.assetKind;
    if (acc.assetQty > 0) t += ' · ' + (Math.round(acc.assetQty * 1000) / 1000).toLocaleString('id-ID') + (acc.assetUnit ? ' ' + acc.assetUnit : '');
    return t;
  }

  function accountBalance(data, accId) {
    const acc = data.accounts.find(a => a.id === accId);
    if (!acc) return 0;
    if (hasValuations(acc)) return assetBalance(acc, data.txns);
    let bal = acc.initialBalance || 0;
    data.txns.forEach(t => {
      if (t.type === 'masuk' && t.accountId === accId) bal += t.amount;
      else if (t.type === 'keluar' && t.accountId === accId) bal -= t.amount;
      else if (t.type === 'transfer') {
        if (t.accountId === accId) bal -= t.amount;
        if (t.toAccountId === accId) bal += t.amount;
      }
    });
    return bal;
  }

  // Hitung saldo SEMUA akun dalam satu kali pass atas txns (bukan sekali per akun
  // seperti accountBalance()). render() memanggil ini sekali lalu membagikan hasilnya
  // ke renderBalanceHeader/renderAccountsSummary/renderAccounts/renderTitipanSummary/
  // renderAccountValues, yang sebelumnya masing-masing loop accountBalance() sendiri.
  function computeAllBalances(data) {
    const balances = {};
    data.accounts.forEach(a => { balances[a.id] = a.initialBalance || 0; });
    data.txns.forEach(t => {
      if (t.type === 'masuk') { if (t.accountId in balances) balances[t.accountId] += t.amount; }
      else if (t.type === 'keluar') { if (t.accountId in balances) balances[t.accountId] -= t.amount; }
      else if (t.type === 'transfer') {
        if (t.accountId in balances) balances[t.accountId] -= t.amount;
        if (t.toAccountId in balances) balances[t.toAccountId] += t.amount;
      }
    });
    const assetAccs = data.accounts.filter(hasValuations);
    if (assetAccs.length) {
      // Index dibangun cuma kalau memang ada akun aset -- akun biasa tidak kena biaya tambahan ini.
      const txnIndex = groupTxnsByAccount(data.txns);
      assetAccs.forEach(a => { balances[a.id] = assetBalance(a, txnIndex[a.id] || []); });
    }
    return balances;
  }

  // Hitung jumlah transaksi & tanggal transaksi terakhir untuk SEMUA akun dalam
  // satu kali pass atas txns (bukan sekali per akun via data.txns.filter() di
  // dalam .map()). Dipakai oleh renderAccounts() & renderTitipanList() yang
  // sebelumnya masing-masing filter data.txns per akun (O(akun x transaksi)).
  function computeAccountTxnStats(data) {
    const stats = {};
    data.accounts.forEach(a => { stats[a.id] = { count: 0, lastDate: null }; });
    const touch = (accId, date) => {
      const s = stats[accId];
      if (!s) return;
      s.count++;
      if (!s.lastDate || date > s.lastDate) s.lastDate = date;
    };
    data.txns.forEach(t => {
      touch(t.accountId, t.date);
      if (t.type === 'transfer' && t.toAccountId) touch(t.toAccountId, t.date);
      if (t.loanId) touch(t.loanId, t.date);
    });
    return stats;
  }

  // Perkiraan bunga bulan ini untuk akun pinjaman, berdasarkan jenis bunganya:
  // - tetap: dihitung dari pokok AWAL (originalPrincipal kalau diisi — misal pinjaman yang sudah
  //   berjalan saat dimasukkan ke app — atau initialBalance kalau tidak), sama tiap bulan sepanjang tenor.
  // - menurun: dihitung dari SISA pokok saat ini (accountBalance), jadi makin lama makin kecil.
  // loanRatePercent disimpan sesuai loanRateUnit ('tahun' = perlu dibagi 12 dulu, 'bulan' = dipakai langsung).
  // Biaya bulanan pinjol yang ikut di dalam tiap angsuran (selain pokok & bunga):
  // - asuransi/proteksi: persen per bulan dari pokok awal (loanInsurancePercent), opsional
  // - admin yang dicicil (loanAdminMode === 'cicil'): persen admin dari pokok awal, dibagi tenor
  // Diperlakukan sama seperti bunga (kategori 'Bunga & biaya bank'), jadi ikut sisa hutang, jadwal, dan rincian bayar.
  function loanMonthlyFees(acc) {
    if (acc.type !== 'pinjaman_online') return 0;
    const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    const tenor = acc.loanTenorMonths || 0;
    let f = 0;
    if ((acc.loanInsurancePercent || 0) > 0) f += pokokAwal * acc.loanInsurancePercent / 100;
    if (acc.loanAdminMode === 'cicil' && (acc.loanAdminPercent || 0) > 0 && tenor > 0) f += pokokAwal * acc.loanAdminPercent / 100 / tenor;
    return f;
  }
  // `bal` opsional: kalau pemanggil sudah punya saldo akun ini (dari computeAllBalances()
  // atau parameter yang diteruskan), kirim ke sini supaya tidak scan ulang SELURUH data.txns
  // lewat accountBalance() -- terutama sia-sia untuk pinjaman bunga TETAP, yang sebenarnya
  // tidak butuh sisaPokok sama sekali (base-nya pokokAwal, bukan sisaPokok).
  function computeLoanMonthlyInterest(data, acc, bal) {
    const rate = acc.loanRatePercent || 0;
    const fees = loanMonthlyFees(acc);
    if (rate <= 0 && fees <= 0) return 0;
    const rateMonthly = acc.loanRateUnit === 'bulan' ? (rate / 100) : (rate / 100 / 12);
    const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    // sisaPokok cuma dipakai untuk bunga menurun -- jangan hitung (apalagi scan penuh
    // via accountBalance) kalau jenisnya bukan itu.
    const sisaPokok = acc.loanInterestType === 'menurun'
      ? Math.max(0, -(bal === undefined ? accountBalance(data, acc.id) : bal))
      : 0;
    const base = acc.loanInterestType === 'menurun' ? sisaPokok : pokokAwal;
    return Math.round((rate > 0 ? base * rateMonthly : 0) + fees);
  }

  // Bunga EFEKTIF per bulan (%) dari pinjaman, untuk perbandingan yang adil antar jenis pinjaman.
  // - menurun: bunga sudah dihitung dari sisa pokok, jadi sama dengan suku bunga bulanannya.
  // - flat bertenor: dicari lewat IRR dari arus kas nyata: dana bersih yang diterima (pokok - admin/materai
  //   di depan) dibanding angsuran tetap (pokok per bulan + bunga & biaya bulanan) selama tenor.
  //   Bunga flat 1%/bln dari pokok awal setara ±1,8%/bln efektif untuk tenor 12 bulan.
  // Mengembalikan null kalau datanya belum cukup (mis. pinjaman flat tanpa tenor).
  function loanEffectiveMonthlyRate(data, acc) {
    if (!TYPE_LOAN[acc.type]) return null;
    const P = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    if (P <= 0) return null;
    if (acc.loanInterestType === 'menurun') {
      const r = acc.loanRatePercent || 0;
      return r > 0 ? (acc.loanRateUnit === 'bulan' ? r : r / 12) : null;
    }
    const tenor = acc.loanTenorMonths || 0;
    const monthly = computeLoanMonthlyInterest(data, acc);
    if (tenor <= 0 || monthly <= 0) return null;
    const upfront = (acc.loanAdminMode === 'cicil' ? 0 : (acc.loanAdminFee || 0)) + (acc.loanStampFee || 0);
    const net = P - upfront;
    if (net <= 0) return null;
    const pay = Math.floor(P / tenor) + monthly;
    if (pay * tenor <= net) return 0;
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      const pv = pay * (1 - Math.pow(1 + m, -tenor)) / m;
      if (pv > net) lo = m; else hi = m;
    }
    return lo * 100;
  }

  // Total sisa hutang pinjaman bunga TETAP (flat) yang bertenor = sisa pokok + sisa bunga kontrak yang belum dibayar
  // (sama seperti "Total Sisa Pinjaman" di aplikasi bank). Saldo akun tetap = sisa pokok (pembukuan tidak berubah).
  // Hanya berlaku kalau pinjaman dimulai dari nol di app (pokok awal = saldo awal); pinjaman yang sudah berjalan
  // saat dimasukkan tidak diketahui bunga terbayarnya, jadi memakai sisa pokok saja.
  function computeLoanRemaining(data, acc, bal) {
    const sisaPokok = Math.max(0, -(bal === undefined ? accountBalance(data, acc.id) : bal));
    const res = { sisaPokok, sisaBunga: 0, total: sisaPokok, flat: false };
    if (!TYPE_LOAN[acc.type]) return res;
    if (acc.loanInterestType === 'menurun') {
      // Bunga menurun: "sisa bunga" hanya bisa diketahui kalau jadwal anuitasnya bisa dibuat
      // (tenor + tanggal pencairan + suku bunga, atau angsuran manual). res.flat tetap false —
      // jangan dipakai splitLoanPayment untuk memecah bunga multi-angsuran seperti pinjaman flat,
      // karena porsi bunga tiap angsuran menurun tidak sama besar.
      const sch = computeLoanSchedule(data, acc, bal);
      if (sch) {
        res.sisaBunga = sch.rows.slice(sch.paid).reduce((sum, r) => sum + r.bunga, 0);
        res.total = sisaPokok + res.sisaBunga;
      }
      return res;
    }
    const tenor = acc.loanTenorMonths || 0;
    const monthly = computeLoanMonthlyInterest(data, acc, sisaPokok);
    if (tenor <= 0 || monthly <= 0) return res;
    const init = Math.abs(acc.initialBalance || 0);
    const orig = Math.abs(acc.originalPrincipal || 0);
    if (orig && init && orig !== init) return res;
    const paid = data.txns
      .filter(t => t.loanId === acc.id && t.type === 'keluar' && t.category === 'Bunga & biaya bank')
      .reduce((sum, t) => sum + t.amount, 0);
    res.sisaBunga = sisaPokok > 0 ? Math.max(0, monthly * tenor - paid) : 0;
    res.total = sisaPokok + res.sisaBunga;
    res.flat = true;
    return res;
  }

  // Jadwal angsuran pinjaman bunga flat bertenor. Butuh tenor + tanggal pencairan (loanStartDate).
  // Jatuh tempo ke-1 = sebulan setelah pencairan, tanggal = loanDueDay (kalau kosong: tanggal pencairan).
  // Angsuran yang sudah dibayar = pokok terbayar / pokok per angsuran (tiap angsuran memuat 1 bunga + 1 pokok).
  // Angsuran anuitas (PMT) bunga menurun: sama tiap bulan, porsi bunga (dari sisa pokok) makin kecil dan
  // porsi pokok makin besar tiap periode. Kalau bunga 0%, angsuran = pokok/tenor.
  function loanAnnuityPMT(principal, monthlyRatePct, tenor) {
    if (!(principal > 0) || !(tenor > 0)) return 0;
    const r = (monthlyRatePct || 0) / 100;
    if (!(r > 0)) return Math.round(principal / tenor);
    return Math.round(principal * r / (1 - Math.pow(1 + r, -tenor)));
  }
  function fmtTgl(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Kalau tanggal pencairan belum diisi, tebak dari transaksi "Pencairan ..." yang menyebut nama akun pinjaman
  // (mis. hasil impor JSON lama). Yang diisi manual di Edit akun selalu didahulukan.
  function inferLoanStartDate(data, acc) {
    const name = (acc.name || '').toLowerCase();
    const dates = data.txns
      .filter(t => t.type === 'masuk' && /pencairan|cair/i.test(t.desc || '') && ((t.desc || '').toLowerCase().includes(name) || t.loanId === acc.id))
      .map(t => t.date).sort();
    return dates[0] || '';
  }
  function computeLoanSchedule(data, acc, bal) {
    if (!TYPE_LOAN[acc.type]) return null;
    const tenor = acc.loanTenorMonths || 0;
    const startDate = acc.loanStartDate || inferLoanStartDate(data, acc);
    if (tenor <= 0 || !startDate) return null;
    const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    if (pokokAwal <= 0) return null;
    const sisaPokok = Math.max(0, -(bal === undefined ? accountBalance(data, acc.id) : bal));
    const parts = startDate.split('-').map(Number);
    const y = parts[0], m = parts[1], startDay = parts[2];
    const day = acc.loanDueDay || startDay;
    const today = todayStr();
    const dueDateOf = (i) => {
      const d = new Date(y, m - 1 + i, 1);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getFullYear() + '-' + padMonth(d.getMonth() + 1) + '-' + padMonth(Math.min(day, dim));
    };

    if (acc.loanInterestType === 'menurun') {
      // Bunga menurun (anuitas): bunga tiap bulan = sisa pokok x suku bunga bulanan, jadi turun tiap
      // bulan sementara angsuran tetap. Butuh suku bunga (untuk menghitung/memverifikasi anuitas);
      // tanpa itu jadwalnya tidak bisa disusun meski tenor & tanggal pencairan sudah diisi.
      const rateMonthly = acc.loanRateUnit === 'bulan' ? (acc.loanRatePercent || 0) : (acc.loanRatePercent || 0) / 12;
      if (!(rateMonthly > 0)) return null;
      const installment = acc.loanInstallment > 0 ? acc.loanInstallment : loanAnnuityPMT(pokokAwal, rateMonthly, tenor);
      if (!(installment > 0)) return null;
      const rows = [];
      let sisa = pokokAwal;
      for (let i = 1; i <= tenor && sisa > 0; i++) {
        const bunga = Math.round(sisa * rateMonthly / 100);
        let pokok = installment - bunga;
        if (pokok < 0) pokok = 0;
        if (pokok > sisa || i === tenor) pokok = sisa;
        sisa = Math.max(0, Math.round((sisa - pokok) * 100) / 100);
        rows.push({ no: i, due: dueDateOf(i), pokok, bunga, total: pokok + bunga, sisa, status: null });
      }
      if (!rows.length) return null;
      // "Sudah dibayar" ditaksir dari pokok yang sudah berkurang (asumsi angsuran dibayar berurutan
      // sesuai jadwal) — sama seperti pendekatan pinjaman flat di bawah, bukan dari histori transaksi persis.
      const paidPrincipal = pokokAwal - sisaPokok;
      let cum = 0, paid = 0;
      rows.forEach(r => { cum += r.pokok; if (cum <= paidPrincipal + 1) paid = r.no; });
      if (sisaPokok <= 0) paid = rows.length;
      rows.forEach(r => { r.status = r.no <= paid ? 'lunas' : (r.due < today ? 'telat' : 'belum'); });
      return { rows, paid, tenor: rows.length, next: paid < rows.length ? rows[paid] : null };
    }

    const bunga = computeLoanMonthlyInterest(data, acc, sisaPokok);
    const pokokPer = Math.floor(pokokAwal / tenor);
    const paid = sisaPokok <= 0 ? tenor : (pokokPer > 0 ? Math.min(tenor, Math.floor((pokokAwal - sisaPokok + 1) / pokokPer)) : 0);
    const rows = [];
    let sisa = pokokAwal;
    for (let i = 1; i <= tenor; i++) {
      const due = dueDateOf(i);
      const pokok = i === tenor ? sisa : pokokPer;
      sisa -= pokok;
      const status = i <= paid ? 'lunas' : (due < today ? 'telat' : 'belum');
      rows.push({ no: i, due, pokok, bunga, total: pokok + bunga, sisa: Math.max(0, sisa), status });
    }
    return { rows, paid, tenor, next: paid < tenor ? rows[paid] : null };
  }

  // ---------- ARUS UTANG (dipisah dari pemasukan/pengeluaran di Ringkasan) ----------
  // Bayar tagihan/cicilan dan pencairan pinjaman bukan pendapatan/belanja sungguhan: pencairan hanya
  // menambah kas sekaligus utang, dan bayar utang hanya memindahkan kas ke pelunasan.
  const DEBT_FLOW_CATEGORIES = ['Cicilan/utang', 'Bayar tagihan/utang'];
  function isDebtFlowTxn(t) {
    if (DEBT_FLOW_CATEGORIES.indexOf(t.category) >= 0) return true;
    if (t.type === 'masuk' && (t.loanId || /pencairan\s+pinjaman/i.test(t.desc || ''))) return true;
    return false;
  }
  // Total bayar utang & pencairan di satu bulan. Bayar utang = pengeluaran berkategori utang
  // + transfer ke akun bertipe utang (kartu, PayLater, pinjaman).
  function debtFlowsOf(data, txnList) {
    const debtIds = new Set(data.accounts.filter(a => TYPE_DEBT[a.type]).map(a => a.id));
    let paid = 0, disbursed = 0;
    txnList.forEach(t => {
      if (t.type === 'keluar' && isDebtFlowTxn(t)) paid += t.amount;
      else if (t.type === 'transfer' && debtIds.has(t.toAccountId) && !debtIds.has(t.accountId)) paid += t.amount;
      else if (t.type === 'masuk' && isDebtFlowTxn(t)) disbursed += t.amount;
    });
    return { paid, disbursed };
  }
  function monthDebtFlows(data, monthKey) {
    return debtFlowsOf(data, data.txns.filter(t => monthKeyFromDate(t.date || '') === monthKey));
  }
  function computeAssetDebt(data, balances) {
    let aset = 0, utang = 0;
    data.accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (TYPE_DEBT[acc.type]) {
        utang += bal < 0 ? Math.abs(bal) : 0;
        if (bal > 0) aset += bal; // lebih bayar dianggap saldo/aset
      } else if (acc.type === 'titipan') {
        if (bal > 0) aset += bal; // orang berutang ke kita = piutang
        else if (bal < 0) utang += Math.abs(bal); // kita terima lebih = utang balik ke mereka
      } else {
        if (bal >= 0) aset += bal; else utang += Math.abs(bal);
      }
    });
    return { aset, utang };
  }
  // Uang yang benar-benar siap dipakai bayar tagihan: kas + bank + e-wallet (saldo positif saja).
  function computeLiquidFunds(data, balances) {
    let sum = 0;
    data.accounts.forEach(acc => {
      if (acc.type === 'kas' || acc.type === 'bank' || acc.type === 'ewallet') sum += Math.max(0, balances[acc.id] || 0);
    });
    return sum;
  }

  // ---------- SKEMA KARTU KREDIT ----------
  // Tagihan cetak = saldo hutang pada tanggal cetak terakhir (cardStatementDay). Belanja setelah tanggal itu
  // masuk tagihan berikutnya. Pembayaran sejak tanggal cetak mengurangi sisa tagihan cetak & minimum.
  // Bunga (applyRecurringFees) tetap dari SELURUH sisa hutang saat jatuh tempo, sesuai pengaturan.
  function cardMinPayOf(acc, base) {
    if (!(base > 0)) return 0;
    const hasCfg = acc.cardMinValue > 0;
    const type = hasCfg && acc.cardMinType === 'nominal' ? 'nominal' : 'percent';
    const val = hasCfg ? acc.cardMinValue : 5; // default lama: 5%
    const raw = type === 'nominal' ? val : Math.round(base * val / 100);
    return Math.min(base, Math.max(1, raw));
  }
  function cardMinLabel(acc) {
    if (!(acc.cardMinValue > 0)) return 'min 5%';
    return 'min ' + (acc.cardMinType === 'nominal' ? formatRp(acc.cardMinValue) : acc.cardMinValue + '%');
  }
  function cardSchemeMetaText(acc) {
    if (acc.type !== 'kartu_kredit') return '';
    let t = '';
    if (acc.cardStatementDay) t += ' · Cetak tgl ' + acc.cardStatementDay;
    if (acc.cardStatementDay || acc.cardMinValue > 0) t += ' · ' + cardMinLabel(acc);
    return t;
  }
  function cardStatementInfo(data, acc, todayS) {
    const stDay = acc.cardStatementDay, dueDay = acc.feeDay;
    if (acc.type !== 'kartu_kredit' || !(stDay > 0) || !(dueDay > 0)) return null;
    const t = new Date(todayS + 'T00:00:00');
    const mk = (y, m, d) => {
      const b = new Date(y, m, 1), yy = b.getFullYear(), mm = b.getMonth();
      return yy + '-' + padMonth(mm + 1) + '-' + padMonth(Math.min(d, new Date(yy, mm + 1, 0).getDate()));
    };
    let S = mk(t.getFullYear(), t.getMonth(), stDay);
    if (S > todayS) S = mk(t.getFullYear(), t.getMonth() - 1, stDay);
    const sy = Number(S.slice(0, 4)), sm = Number(S.slice(5, 7)) - 1;
    const D = dueDay > stDay ? mk(sy, sm, dueDay) : mk(sy, sm + 1, dueDay);
    const nextStatement = mk(sy, sm + 1, stDay);
    const balS = accountBalanceAsOf(data, acc.id, S);
    const statement = balS < 0 ? Math.abs(balS) : 0;
    let paid = 0;
    data.txns.forEach(x => {
      if (x.date <= S || x.date > todayS) return;
      if (x.type === 'transfer' && x.toAccountId === acc.id) paid += x.amount;
      else if (x.type === 'masuk' && x.accountId === acc.id) paid += x.amount;
    });
    const remaining = Math.max(0, Math.round((statement - paid) * 100) / 100);
    const minTotal = cardMinPayOf(acc, statement);
    const minRemaining = Math.min(remaining, Math.max(0, minTotal - paid));
    return { statementDate: S, dueDate: D, nextStatement, statement, paid, remaining, minTotal, minRemaining };
  }

  // Tagihan yang jatuh tempo dalam N hari (atau sudah lewat): angsuran pinjaman + kartu kredit/PayLater yang masih ada tagihan.
  function computeUpcomingDues(data, balances, withinDays) {
    const today = todayStr();
    const t0 = new Date(today + 'T00:00:00');
    const daysTo = (ds) => Math.round((new Date(ds + 'T00:00:00') - t0) / 86400000);
    const out = [];
    data.accounts.forEach(acc => {
      const bal = balances ? balances[acc.id] : accountBalance(data, acc.id);
      if (TYPE_LOAN[acc.type]) {
        const sc = computeLoanSchedule(data, acc, bal);
        if (sc && sc.next) out.push({ id: acc.id, name: acc.name, label: 'Angsuran ' + sc.next.no + '/' + sc.tenor, amount: sc.next.total, due: sc.next.due, days: daysTo(sc.next.due), payKind: true });
      } else if (acc.type === 'kartu_kredit' && acc.feeDay && bal < 0) {
        const ci = cardStatementInfo(data, acc, today);
        if (ci) {
          if (ci.remaining > 0) {
            out.push({ id: acc.id, name: acc.name, label: 'Tagihan cetak ' + fmtTgl(ci.statementDate) + (ci.minRemaining > 0 ? ' · min ' + formatRp(ci.minRemaining) : ' · minimum terpenuhi'), amount: ci.remaining, due: ci.dueDate, days: daysTo(ci.dueDate), payKind: true });
          }
          return;
        }
        const now = new Date(t0);
        const mk = (yy, mm) => { const dim = new Date(yy, mm + 1, 0).getDate(); return yy + '-' + padMonth(mm + 1) + '-' + padMonth(Math.min(acc.feeDay, dim)); };
        let ds = mk(now.getFullYear(), now.getMonth());
        if (ds < today) ds = mk(now.getFullYear(), now.getMonth() + 1);
        out.push({ id: acc.id, name: acc.name, label: 'Tagihan kartu', amount: Math.abs(bal), due: ds, days: daysTo(ds), payKind: true });
      } else if (acc.type === 'paylater' && acc.feeDay && bal < 0) {
        const now = new Date(t0);
        const mk = (yy, mm) => { const dim = new Date(yy, mm + 1, 0).getDate(); return yy + '-' + padMonth(mm + 1) + '-' + padMonth(Math.min(acc.feeDay, dim)); };
        let ds = mk(now.getFullYear(), now.getMonth());
        if (ds < today) ds = mk(now.getFullYear(), now.getMonth() + 1);
        // Nominal due bukan seluruh sisa hutang (itu keliru untuk cicilan bertenor panjang):
        // hitung cicilan yang jatuh tempo periode ini dari plan yang masih aktif, lalu tambahkan
        // sisa hutang yang tidak tercakup jadwal manapun (mis. "bayar nanti", atau cicilan yang
        // sudah telat dari jadwalnya) — bagian itu diperlakukan seperti kartu kredit, due sekarang.
        const plans = Array.isArray(acc.plans) ? acc.plans : [];
        let cicilanDue = 0, remainingPlanned = 0;
        plans.forEach(pl => {
          const sc = paylaterPlanSchedule(data, acc, pl);
          if (sc && sc.k < sc.tenor) {
            const remaining = Math.max(0, pl.total - sc.k * pl.monthly);
            remainingPlanned += remaining;
            cicilanDue += Math.min(pl.monthly, remaining);
          }
        });
        const extra = Math.max(0, Math.abs(bal) - remainingPlanned);
        out.push({ id: acc.id, name: acc.name, label: 'Tagihan PayLater', amount: cicilanDue + extra, due: ds, days: daysTo(ds), payKind: true });
      }
    });
    return out.filter(x => x.days <= withinDays).sort((a, b) => a.days - b.days);
  }

  // ---------- PAYLATER: cicilan bertenor (bunga flat + admin) ----------
  // Bayar Nanti = 0% (transaksi biasa, ditandai method 'nanti'). Cicilan = pokok + bunga flat (pokok x %/bln x tenor)
  // + admin sekali bayar. Semuanya dicatat sebagai pengeluaran di akun PayLater (menambah sisa hutang) dan
  // rencananya disimpan di akun (acc.plans), terhubung ke transaksi lewat planId.
  function computeFlatCicilan(pokok, tenor, ratePercent, admin) {
    const bunga = Math.round(pokok * (ratePercent / 100) * tenor);
    const monthly = tenor > 0 ? Math.round((pokok + bunga) / tenor) : 0;
    return { pokok, tenor, ratePercent, bunga, admin, monthly, total: pokok + bunga + admin };
  }

  function padMonth(n) { return String(n).padStart(2, '0'); }

  // Jadwal cicilan berdasarkan tanggal jatuh tempo baku akun (jatuh tempo pertama = bulan setelah transaksi).
  function paylaterPeriodDue(acc, plan, i) {
    const day = acc.feeDay || 0;
    if (!day || !plan || !plan.date) return null;
    const [y, m] = plan.date.split('-').map(Number);
    const d = new Date(y, m - 1 + i, 1);
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getFullYear() + '-' + padMonth(d.getMonth() + 1) + '-' + padMonth(Math.min(day, dim));
  }

  // Jadwal cicilan: periode dianggap lunas kalau (a) tanggal jatuh temponya sudah lewat (asumsi bayar
  // tepat waktu — perkiraan lama), ATAU (b) sudah ada transaksi transfer pembayaran yang benar-benar
  // ditandai untuk cicilan ini (planPaymentIds berisi id plan ini) — supaya bayar LEBIH AWAL (sebelum
  // tanggal jatuh tempo, lewat tombol "Bayar bulan ini") langsung tercermin, bukan menunggu tanggalnya lewat.
  function paylaterPlanSchedule(data, acc, plan) {
    if (!acc.feeDay || !plan || !plan.date) return null;
    const tenor = plan.tenor || 0;
    const today = todayStr();
    let calK = 0;
    for (let i = 1; i <= tenor; i++) if (paylaterPeriodDue(acc, plan, i) <= today) calK++;
    let paidK = 0;
    (data.txns || []).forEach(t => {
      if (t.type === 'transfer' && t.toAccountId === acc.id && t.planPaymentThrough && t.planPaymentThrough[plan.id] != null) {
        paidK = Math.max(paidK, t.planPaymentThrough[plan.id]);
      }
    });
    const k = Math.min(tenor, Math.max(calK, paidK));
    return { k, tenor, next: k < tenor ? paylaterPeriodDue(acc, plan, k + 1) : null, last: paylaterPeriodDue(acc, plan, tenor) };
  }

  // Kelompokkan semua cicilan aktif (dari semua plan) yang BELUM lunas, per bulan jatuh tempo —
  // supaya kelihatan berapa total tagihan PayLater tiap bulan ke depan, bukan cuma bulan terdekat.
  // Kalau akun sudah lunas total (saldo hutang 0/lebih), tidak ada tagihan yang perlu ditampilkan lagi.
  function paylaterMonthlyBreakdown(data, acc, bal) {
    if ((bal || 0) >= 0) return [];
    const plans = Array.isArray(acc.plans) ? acc.plans : [];
    const groups = {};
    plans.forEach(pl => {
      const sc = paylaterPlanSchedule(data, acc, pl);
      if (!sc) return;
      for (let i = sc.k + 1; i <= pl.tenor; i++) {
        const due = paylaterPeriodDue(acc, pl, i);
        const key = due.slice(0, 7);
        if (!groups[key]) groups[key] = { due, total: 0, items: [] };
        groups[key].total += pl.monthly;
        groups[key].items.push({ planId: pl.id, desc: pl.desc, no: i, tenor: pl.tenor, amount: pl.monthly });
      }
    });
    return Object.keys(groups).sort().map(k => groups[k]);
  }

  function fmtBulanTahun(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function paylaterMetaExtra(data, acc) {
    let extra = '';
    if (acc.feeDay) extra += ' · Jatuh tempo tgl ' + acc.feeDay;
    const plans = Array.isArray(acc.plans) ? acc.plans : [];
    const active = plans.filter(pl => { const sc = paylaterPlanSchedule(data, acc, pl); return !sc || sc.k < sc.tenor; }).length;
    if (active > 0) extra += ' · ' + active + ' cicilan aktif';
    const fee = paylaterFeeSummary(data, acc);
    if (fee.feeRemaining > 0.5) extra += ' · Sisa bunga cicilan ' + formatRp(fee.feeRemaining);
    return extra;
  }

  // Terpakai limit PayLater = sisa POKOK transaksi saja (prorata sesuai periode yang belum lunas),
  // BUKAN pokok+bunga. Limit PayLater biasanya hanya terpotong sebesar pokok transaksi, sama seperti
  // logika di aplikasi pencatat PayLater terpisah (limit tidak berkurang oleh bunga cicilan).
  // "Bayar nanti" (tanpa plan/bunga 0%) dan tunggakan di luar jadwal cicilan dihitung penuh sebagai pokok.
  function paylaterCreditUsed(data, acc, bal) {
    const plans = Array.isArray(acc.plans) ? acc.plans : [];
    let remainingPokok = 0, remainingPlanTotal = 0;
    plans.forEach(pl => {
      const tenor = pl.tenor || 0;
      if (!tenor) return;
      const sc = paylaterPlanSchedule(data, acc, pl);
      const k = sc ? Math.min(sc.k, tenor) : 0;
      if (k >= tenor) return; // cicilan ini sudah lunas
      const sisaPeriode = tenor - k;
      remainingPokok += (pl.pokok || 0) * (sisaPeriode / tenor);
      remainingPlanTotal += Math.max(0, (pl.total || 0) - k * (pl.monthly || 0));
    });
    // Sisa yang tidak tercakup jadwal cicilan manapun (bayar nanti, atau telat dari jadwal) dianggap pokok penuh.
    const extra = Math.max(0, Math.abs(bal || 0) - remainingPlanTotal);
    return Math.round(remainingPokok + extra);
  }

  // Ringkasan bunga cicilan PayLater: sisa bunga yang belum jatuh tempo, total bunga seumur cicilan,
  // bunga yang sudah terbayar sejauh ini, dan rata-rata persentase bunga terhadap pokok.
  function paylaterFeeSummary(data, acc) {
    const plans = Array.isArray(acc.plans) ? acc.plans : [];
    let feeAllTime = 0, feeRemaining = 0, pctSum = 0, pctCount = 0;
    plans.forEach(pl => {
      const tenor = pl.tenor || 0;
      if (!tenor || pl.bunga == null) return;
      feeAllTime += pl.bunga;
      const sc = paylaterPlanSchedule(data, acc, pl);
      const k = sc ? Math.min(sc.k, tenor) : 0;
      const sisaPeriode = Math.max(0, tenor - k);
      feeRemaining += pl.bunga * (sisaPeriode / tenor);
      if (pl.pokok) { pctSum += (pl.bunga / pl.pokok) * 100; pctCount++; }
    });
    const feePaidSoFar = Math.max(0, feeAllTime - feeRemaining);
    const feeAvgPct = pctCount ? (pctSum / pctCount) : 0;
    return { feeAllTime, feeRemaining, feePaidSoFar, feeAvgPct };
  }

  // Bersihkan data cicilan dari file import (jangan percaya tipe/isi dari luar).
  function sanitizePlans(arr) {
    if (!Array.isArray(arr)) return [];
    const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? v : 0;
    return arr.filter(pl => pl && typeof pl.id === 'string' && typeof pl.date === 'string' && num(pl.tenor) >= 1)
      .map(pl => ({
        id: String(pl.id).replace(/[^\w-]/g, '').slice(0, 60),
        desc: typeof pl.desc === 'string' ? pl.desc.slice(0, 200) : 'Cicilan',
        date: pl.date.slice(0, 10),
        pokok: num(pl.pokok), tenor: Math.round(num(pl.tenor)), ratePercent: num(pl.ratePercent),
        bunga: num(pl.bunga), admin: num(pl.admin), monthly: num(pl.monthly), total: num(pl.total)
      }));
  }
  function cleanPlanId(v) { return typeof v === 'string' ? v.replace(/[^\w-]/g, '').slice(0, 60) : ''; }

  // Progres pelunasan pinjaman: pokok awal = originalPrincipal kalau diisi (buat pinjaman yang sudah
  // berjalan saat dimasukkan ke app — sisa sekarang beda dari pokok pertama cair), else |saldo awal akun|.
  // Terbayar = pokok awal - sisa hutang sekarang.
  function computeLoanProgress(acc, bal) {
    const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    const sisa = Math.max(0, -bal);
    if (pokokAwal <= 0) return null;
    const terbayar = Math.min(pokokAwal, Math.max(0, pokokAwal - sisa));
    const pct = sisa <= 0 ? 100 : Math.min(99, Math.floor((terbayar / pokokAwal) * 100));
    return { pokokAwal, sisa, terbayar, pct };
  }

  function accountBalanceAsOf(data, accId, dateStr) {
    const acc = data.accounts.find(a => a.id === accId);
    if (!acc) return 0;
    if (hasValuations(acc)) return assetBalance(acc, data.txns, dateStr);
    let bal = acc.initialBalance || 0;
    data.txns.forEach(t => {
      if (t.date > dateStr) return;
      if (t.type === 'masuk' && t.accountId === accId) bal += t.amount;
      else if (t.type === 'keluar' && t.accountId === accId) bal -= t.amount;
      else if (t.type === 'transfer') {
        if (t.accountId === accId) bal -= t.amount;
        if (t.toAccountId === accId) bal += t.amount;
      }
    });
    return bal;
  }

  function applyRecurringFees(data) {
    let changed = false;
    const now = todayGmt8();
    data.accounts.forEach(acc => {
      if (!TYPE_DEBT[acc.type]) return;
      if (acc.type === 'paylater') return; // PayLater: bunga/admin hanya lewat transaksi cicilan
      const feeVal = acc.feeAmount || 0;
      const feeDay = acc.feeDay || 0;
      const interestPct = acc.interestPercent || 0;
      const feeType = acc.feeType === 'percent' ? 'percent' : 'nominal';
      const feePeriod = acc.feePeriod === 'tahunan' ? 'tahunan' : 'bulanan';
      if (feeDay <= 0 || (feeVal <= 0 && interestPct <= 0)) return;
      // Iuran tahunan: patokan bulan tagihnya sama tiap tahun. Dipatok sekali di bulan pertama kali
      // biaya ini aktif (tidak berubah lagi kecuali periode diganti lewat Edit akun).
      if (feePeriod === 'tahunan' && feeVal > 0 && !acc.feeAnniversaryMonth) {
        acc.feeAnniversaryMonth = now.getMonth() + 1;
        changed = true;
      }

      let cursor;
      if (acc.lastFeeAppliedMonth) {
        const [y, m] = acc.lastFeeAppliedMonth.split('-').map(Number);
        cursor = new Date(y, m - 1, 1);
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      while (cursor.getFullYear() < now.getFullYear() || (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())) {
        const isCurrentMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const dueDay = Math.min(feeDay, daysInMonth);
        if (isCurrentMonth && now.getDate() < dueDay) break;

        const monthKey = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
        const dueDateStr = monthKey + '-' + String(dueDay).padStart(2, '0');

        // Bunga: dihitung dari sisa tagihan yang masih belum lunas tepat di tanggal jatuh tempo.
        // Kalau bulan itu dibayar penuh (sisa jadi 0/lunas atau malah lebih bayar), tidak kena bunga.
        let sisaBelumLunas = 0;
        if (interestPct > 0 || (feeType === 'percent' && feePeriod === 'bulanan')) {
          const balAtDue = accountBalanceAsOf(data, acc.id, dueDateStr);
          sisaBelumLunas = balAtDue < 0 ? Math.abs(balAtDue) : 0;
        }
        if (interestPct > 0 && sisaBelumLunas > 0) {
          const bunga = Math.round(sisaBelumLunas * interestPct / 100);
          if (bunga > 0) {
            data.txns.push({
              id: generateId('txn'), date: dueDateStr, type: 'keluar',
              desc: `Bunga ${interestPct}% dari sisa belum lunas (${formatRp(sisaBelumLunas)})`,
              amount: bunga, accountId: acc.id, category: 'Bunga & biaya bank'
            });
            changed = true;
          }
        }

        if (feeVal > 0) {
          // Bulanan: dikenakan tiap bulan di tanggal jatuh tempo. Tahunan: cuma di bulan "ulang tahun" biaya ini.
          const isChargeMonth = feePeriod === 'bulanan' || (cursor.getMonth() + 1) === (acc.feeAnniversaryMonth || (now.getMonth() + 1));
          if (isChargeMonth) {
            let feeCharged = feeVal;
            let feeDesc = feePeriod === 'tahunan' ? 'Iuran tahunan kartu' : 'Biaya admin bulanan';
            if (feeType === 'percent') {
              // Persen + bulanan: dari sisa belum lunas (sama basisnya dengan bunga, tapi baris terpisah).
              // Persen + tahunan: dari limit kartu (lazim untuk iuran tahunan berbasis limit).
              const base = feePeriod === 'tahunan' ? (acc.limit || 0) : sisaBelumLunas;
              feeCharged = Math.round(base * feeVal / 100);
              feeDesc += ` (${feeVal}% dari ${feePeriod === 'tahunan' ? 'limit' : 'sisa belum lunas'})`;
            }
            if (feeCharged > 0) {
              data.txns.push({
                id: generateId('txn'), date: dueDateStr, type: 'keluar',
                desc: feeDesc, amount: feeCharged, accountId: acc.id, category: 'Tagihan & langganan'
              });
              changed = true;
            }
          }
        }

        acc.lastFeeAppliedMonth = monthKey;
        cursor.setMonth(cursor.getMonth() + 1);
      }
    });
    if (changed) saveData(data);
    return data;
  }


