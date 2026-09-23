  // ============================================================
  // IMPORT / EXPORT / RESET DATA
  // ============================================================
  // Prefix nama file export/backup dengan identitas user: makin berguna sejak device bisa
  // dipakai gantian oleh beberapa akun (lihat syncGuardAccountSwitch di 14-sync.js) -- tanpa
  // prefix ini, file-file "keuangan-2026-09-23.json" dari akun berbeda jadi sulit dibedakan.
  // Prioritas: email akun cloud (kalau sedang login) > nama pemilik dari tab Profil > 'user'.
  function exportUserPrefix() {
    let raw = '';
    if (typeof sync !== 'undefined' && sync.ready && sync.email) raw = sync.email.split('@')[0];
    else if (typeof getOwnerName === 'function') raw = getOwnerName();
    const slug = raw.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // lepas aksen (é -> e, dst)
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'user';
  }

  // ---------- Pengingat cadangan ----------
  // Data hanya ada di localStorage browser ini. Kalau belum pernah ekspor (atau sudah >= 14 hari) dan
  // datanya sudah lumayan banyak, tampilkan pengingat di Ringkasan. "Nanti" menundanya 7 hari.
  const LAST_EXPORT_KEY = 'keuangan-last-export-v1';
  const BACKUP_SNOOZE_KEY = 'keuangan-backup-snooze-v1';
  function markExported() {
    try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()); localStorage.removeItem(BACKUP_SNOOZE_KEY); } catch (e) { /* tidak kritis */ }
    if (typeof renderBackupReminder === 'function') renderBackupReminder(loadData());
  }
  function renderBackupReminder(data) {
    const el = $('backup-reminder-card');
    if (!el) return;
    let last = null, snooze = 0;
    try { last = localStorage.getItem(LAST_EXPORT_KEY); snooze = Number(localStorage.getItem(BACKUP_SNOOZE_KEY)) || 0; } catch (e) { /* abaikan */ }
    const nowMs = Date.now();
    let days = last ? Math.floor((nowMs - new Date(last).getTime()) / 86400000) : null;
    if (days !== null && isNaN(days)) days = null;
    const need = data.txns.length >= 10 && (days === null || days >= 14) && nowMs >= snooze;
    if (!need) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="section-title" style="margin-bottom:6px;">Cadangkan data</div>
      <div class="acc-sub" style="margin-bottom:10px;">${days === null ? 'Kamu belum pernah mengekspor cadangan.' : 'Cadangan JSON terakhir ' + days + ' hari lalu.'} Data hanya tersimpan di browser ini, jadi ekspor berkala supaya aman kalau browser dibersihkan atau ganti perangkat.</div>
      <div class="acc-form-actions">
        <button type="button" class="submit-btn" onclick="exportJsonFromReminder()">Ekspor sekarang</button>
        <button type="button" class="io-btn" onclick="snoozeBackupReminder()">Nanti</button>
      </div>`;
  }
  async function exportJsonFromReminder() { await exportJson(); renderBackupReminder(loadData()); }
  function snoozeBackupReminder() {
    try { localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now() + 7 * 86400000)); } catch (e) { /* abaikan */ }
    renderBackupReminder(loadData());
  }

  async function exportJson() {
    const data = loadData();
    const payload = { exported_at: new Date().toISOString(), accounts: data.accounts, transaksi: data.txns };
    const json = JSON.stringify(payload, null, 2);
    const filename = 'keuangan-' + exportUserPrefix() + '-' + todayStr() + '.json';

    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data: json }); markExported(); showIoMsg('File JSON siap disimpan.', 'ok'); return; }
      catch (e) { /* fall through */ }
    }
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      markExported();
      showIoMsg('File JSON diunduh.', 'ok');
    } catch (e) { showIoMsg('Gagal membuat file export.', 'error'); }
  }

  function csvEscape(v) {
    const s = String(v === undefined || v === null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async function exportCsv() {
    const data = loadData();
    const accName = id => (data.accounts.find(a => a.id === id) || {}).name || '';
    const header = ['Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Jumlah', 'Akun', 'Akun Tujuan'];
    const rows = data.txns
      .slice()
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      .map(t => [
        t.date,
        t.type === 'masuk' ? 'Masuk' : t.type === 'keluar' ? 'Keluar' : 'Transfer',
        t.category || '',
        t.desc || '',
        t.amount,
        accName(t.accountId),
        t.type === 'transfer' ? accName(t.toAccountId) : ''
      ]);
    // BOM di depan supaya Excel baca sebagai UTF-8 (biar "Rp" dan karakter lain tidak berantakan).
    const csv = '\ufeff' + [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
    const filename = 'keuangan-' + exportUserPrefix() + '-' + todayStr() + '.csv';

    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data: csv }); showIoMsg('File CSV siap disimpan.', 'ok'); return; }
      catch (e) { /* fall through */ }
    }
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showIoMsg('File CSV diunduh.', 'ok');
    } catch (e) { showIoMsg('Gagal membuat file export.', 'error'); }
  }

  // ---------- Helper bersama: bangun objek akun & transaksi dari file import ----------
  // Dipakai oleh importJson() (gabung ke data yang ada) dan resetAndImport() (ganti semua data) —
  // sebelumnya kedua fungsi ini menyalin ~140 baris logic yang sama persis, jadi dipusatkan di sini
  // supaya field baru cukup ditambahkan sekali (tidak dobel, tidak bisa beda antara dua jalur import).
  function buildAccountFromImport(a, newId) {
    const acc = { id: newId, name: a.name, type: TYPE_LABELS[a.type] ? a.type : 'kas', initialBalance: typeof a.initialBalance === 'number' ? a.initialBalance : 0 };
    if (typeof a.limit === 'number') acc.limit = a.limit;
    if (typeof a.feeAmount === 'number') acc.feeAmount = a.feeAmount;
    if (typeof a.feeDay === 'number') acc.feeDay = a.feeDay;
    copyAssetFields(a, acc);
    if (acc.type === 'kartu_kredit') {
      if (typeof a.cardStatementDay === 'number' && a.cardStatementDay >= 1 && a.cardStatementDay <= 31) acc.cardStatementDay = Math.round(a.cardStatementDay);
      if (typeof a.cardMinValue === 'number' && a.cardMinValue > 0) { acc.cardMinValue = a.cardMinValue; acc.cardMinType = a.cardMinType === 'nominal' ? 'nominal' : 'percent'; }
    }
    if (typeof a.interestPercent === 'number') acc.interestPercent = a.interestPercent;
    if (a.feeType === 'percent') acc.feeType = 'percent';
    if (a.feePeriod === 'tahunan') acc.feePeriod = 'tahunan';
    if (typeof a.feeAnniversaryMonth === 'number' && a.feeAnniversaryMonth >= 1 && a.feeAnniversaryMonth <= 12) acc.feeAnniversaryMonth = Math.round(a.feeAnniversaryMonth);
    if (a.loanInterestType === 'tetap' || a.loanInterestType === 'menurun') acc.loanInterestType = a.loanInterestType;
    if (typeof a.loanRatePercent === 'number') acc.loanRatePercent = a.loanRatePercent;
    if (a.loanRateUnit === 'bulan' || a.loanRateUnit === 'tahun') acc.loanRateUnit = a.loanRateUnit;
    if (typeof a.loanAdminFee === 'number') acc.loanAdminFee = a.loanAdminFee;
    if (typeof a.loanAdminPercent === 'number') acc.loanAdminPercent = a.loanAdminPercent;
    if (a.loanAdminMode === 'cicil') acc.loanAdminMode = 'cicil';
    if (typeof a.loanInsurancePercent === 'number' && a.loanInsurancePercent > 0) acc.loanInsurancePercent = a.loanInsurancePercent;
    if (typeof a.loanStampFee === 'number') acc.loanStampFee = a.loanStampFee;
    if (typeof a.loanMandatorySavings === 'number') acc.loanMandatorySavings = a.loanMandatorySavings;
    if (typeof a.loanInstallment === 'number') acc.loanInstallment = a.loanInstallment;
    if (typeof a.loanTenorMonths === 'number') acc.loanTenorMonths = a.loanTenorMonths;
    if (typeof a.loanStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.loanStartDate)) acc.loanStartDate = a.loanStartDate;
    if (typeof a.loanDueDay === 'number' && a.loanDueDay >= 1 && a.loanDueDay <= 31) acc.loanDueDay = Math.round(a.loanDueDay);
    if (typeof a.originalPrincipal === 'number') acc.originalPrincipal = a.originalPrincipal;
    if (typeof a.lastFeeAppliedMonth === 'string' && /^\d{4}-\d{2}$/.test(a.lastFeeAppliedMonth)) acc.lastFeeAppliedMonth = a.lastFeeAppliedMonth;
    if (acc.type === 'paylater') { const pls = sanitizePlans(a.plans); if (pls.length) acc.plans = pls; }
    return acc;
  }

  function buildTxnFromImport(t, idMap, fallbackAccId) {
    const type = t.type === 'keluar' ? 'keluar' : (t.type === 'transfer' ? 'transfer' : 'masuk');
    const accountId = (t.accountId !== undefined && idMap[t.accountId]) || fallbackAccId;
    const toAccountId = t.toAccountId !== undefined ? ((idMap[t.toAccountId]) || fallbackAccId) : undefined;
    return {
      id: generateId('txn'),
      date: typeof t.date === 'string' ? t.date : todayStr(),
      type, desc: typeof t.desc === 'string' ? t.desc : 'Transfer',
      amount: Math.abs(t.amount), accountId,
      ...(type === 'transfer' ? { toAccountId } : {}),
      ...(type === 'transfer' && Array.isArray(t.planPaymentIds) && t.planPaymentIds.length ? { planPaymentIds: t.planPaymentIds.map(cleanPlanId).filter(Boolean) } : {}),
      ...(type === 'transfer' && t.planPaymentThrough && typeof t.planPaymentThrough === 'object' ? { planPaymentThrough: Object.fromEntries(Object.entries(t.planPaymentThrough).map(([pid, no]) => [cleanPlanId(pid), no]).filter(([pid]) => pid)) } : {}),
      ...(typeof t.category === 'string' && t.category ? { category: t.category } : {}),
      ...(type === 'keluar' && t.loanId !== undefined && idMap[t.loanId] ? { loanId: idMap[t.loanId] } : {}),
      ...(type === 'keluar' && cleanPlanId(t.planId) ? { planId: cleanPlanId(t.planId) } : {}),
      ...(type === 'keluar' && (t.method === 'nanti' || t.method === 'cicilan') ? { method: t.method } : {})
    };
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const data = loadData();

        const incomingAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
        const idMap = {};
        let newAccountsCount = 0;
        incomingAccounts.forEach(a => {
          if (!a || typeof a.name !== 'string') return;
          const exists = data.accounts.find(ex => ex.name === a.name && ex.type === a.type);
          if (exists) {
            idMap[a.id] = exists.id;
            // Lengkapi info jadwal yang masih kosong di akun pinjaman yang sudah ada (tanpa menimpa yang sudah diisi)
            if (TYPE_LOAN[exists.type]) {
              if (!exists.loanStartDate && typeof a.loanStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.loanStartDate)) exists.loanStartDate = a.loanStartDate;
              if (!exists.loanDueDay && typeof a.loanDueDay === 'number' && a.loanDueDay >= 1 && a.loanDueDay <= 31) exists.loanDueDay = Math.round(a.loanDueDay);
            }
            return;
          }
          const newId = generateId('acc');
          idMap[a.id] = newId;
          data.accounts.push(buildAccountFromImport(a, newId));
          newAccountsCount++;
        });

        const incomingTxns = Array.isArray(parsed) ? parsed : (parsed.transaksi || parsed.txns);
        if (!Array.isArray(incomingTxns)) throw new Error('format tidak dikenali');

        if (data.accounts.length === 0) {
          data.accounts.push({ id: generateId('acc'), name: 'Kas / Dompet', type: 'kas', initialBalance: 0 });
        }
        const fallbackAccId = data.accounts[0].id;
        const cleaned = incomingTxns
          .filter(t => t && typeof t.amount === 'number')
          .map(t => buildTxnFromImport(t, idMap, fallbackAccId));

        if (cleaned.length === 0 && newAccountsCount === 0) throw new Error('tidak ada transaksi atau akun baru yang valid');

        if (cleaned.length === 0) {
          // Cuma akun baru, tanpa transaksi (mis. import saldo pinjaman online yang sudah berjalan).
          const ok = await showConfirm(`File ini berisi ${newAccountsCount} akun baru, tanpa transaksi.\n\nTambahkan akun-akun itu?`);
          if (!ok) { event.target.value = ''; return; }
          saveData(data);
          render();
          showIoMsg(`${newAccountsCount} akun baru ditambahkan.`, 'ok');
          event.target.value = '';
          return;
        }

        const sig = (t) => [t.date, t.type, t.desc, t.amount, t.accountId, t.toAccountId || ''].join('|');
        // Hitung per tanda tangan: transaksi identik yang memang kembar (mis. dua kali beli kopi yang sama
        // di hari yang sama) tetap masuk, selama jumlahnya di file melebihi yang sudah ada di data.
        const existingCount = new Map();
        data.txns.forEach(x => { const k = sig(x); existingCount.set(k, (existingCount.get(k) || 0) + 1); });
        const seenIncoming = new Map();
        const deduped = [];
        let skipped = 0;
        cleaned.forEach(t => {
          const s = sig(t);
          const n = (seenIncoming.get(s) || 0) + 1;
          seenIncoming.set(s, n);
          if (n <= (existingCount.get(s) || 0)) { skipped++; return; }
          deduped.push(t);
        });

        if (deduped.length === 0) {
          showIoMsg('Semua transaksi di file itu sudah ada, tidak ada yang diimpor.', 'ok');
          event.target.value = '';
          return;
        }

        // Preview dulu sebelum benar-benar digabung & disimpan.
        const dates = deduped.map(t => t.date).sort();
        const rangeLabel = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`;
        const previewMsg = `File ini berisi:\n`
          + `${newAccountsCount > 0 ? `${newAccountsCount} akun baru\n` : ''}`
          + `${deduped.length} transaksi baru (rentang tanggal ${rangeLabel})`
          + `${skipped > 0 ? `\n${skipped} transaksi duplikat akan dilewati` : ''}`
          + `\n\nGabungkan ke data yang sekarang ada?`;
        const ok = await showConfirm(previewMsg);
        if (!ok) { event.target.value = ''; return; }

        data.txns = data.txns.concat(deduped);
        saveData(data);
        render();
        showIoMsg(`${deduped.length} transaksi diimpor` + (skipped > 0 ? `, ${skipped} duplikat dilewati.` : '.'), 'ok');
      } catch (e) {
        showIoMsg('Gagal membaca file: ' + e.message, 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => showIoMsg('Gagal membaca file.', 'error');
    reader.readAsText(file);
  }

  function buildDummyData() {
    const now = todayGmt8();
    function monthDate(monthsAgo, day) {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const day2 = Math.min(day, dim);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(day2).padStart(2, '0');
    }

    const accounts = [
      { id: 'dm-kas', name: 'Kas / Dompet', type: 'kas', initialBalance: 300000 },
      { id: 'dm-bank', name: 'BCA', type: 'bank', initialBalance: 2500000 },
      { id: 'dm-ewallet', name: 'Gopay', type: 'ewallet', initialBalance: 180000 },
      { id: 'dm-kk', name: 'Kartu Kredit BCA', type: 'kartu_kredit', initialBalance: 0, limit: 10000000, feeDay: 25, interestPercent: 2.25 },
      { id: 'dm-paylater', name: 'Shopee PayLater', type: 'paylater', initialBalance: 0, limit: 5000000, feeDay: 5 },
      { id: 'dm-budi', name: 'Budi', type: 'titipan', initialBalance: 0 },
      // Pinjaman bank untuk uji fitur angsuran: sisa pokok awal Rp12.000.000, bunga 12%/thn menurun (1%/bln dari sisa pokok)
      { id: 'dm-pinjaman', name: 'KUR BRI', type: 'pinjaman', initialBalance: -12000000,
        loanInterestType: 'menurun', loanRatePercent: 12, loanRateUnit: 'tahun',
        loanAdminFee: 120000, loanMandatorySavings: 50000, loanInstallment: 1200000 }
    ];

    const txns = [];
    let seq = 0;
    const push = (monthsAgo, day, obj) => {
      if (monthsAgo === 0 && day > now.getDate()) return; // belum terjadi
      seq += 1;
      txns.push({ id: 'dm-txn-' + seq, date: monthDate(monthsAgo, day), ...obj });
    };

    [2, 1, 0].forEach(m => {
      const k = 1 - m * 0.04; // sedikit variasi tiap bulan
      const r = (n) => Math.round(n * k / 1000) * 1000;

      // Pemasukan
      push(m, 1, { type: 'masuk', desc: 'Gaji bulanan', category: 'Gaji', amount: r(6000000), accountId: 'dm-bank' });
      push(m, 20, { type: 'masuk', desc: 'Cashback e-wallet', category: 'Cashback/bunga', amount: r(25000), accountId: 'dm-ewallet' });

      // Pengeluaran harian
      push(m, 2, { type: 'keluar', desc: 'Belanja bulanan', category: 'Belanja harian', amount: r(800000), accountId: 'dm-bank' });
      push(m, 4, { type: 'keluar', desc: 'Makan siang & kopi', category: 'Makan & minum', amount: r(150000), accountId: 'dm-kas' });
      push(m, 13, { type: 'keluar', desc: 'Makan malam keluarga', category: 'Makan & minum', amount: r(180000), accountId: 'dm-kas' });
      push(m, 6, { type: 'keluar', desc: 'Bensin & parkir', category: 'Transportasi', amount: r(200000), accountId: 'dm-kas' });
      push(m, 9, { type: 'keluar', desc: 'Streaming & nonton', category: 'Hiburan', amount: r(120000), accountId: 'dm-ewallet' });
      push(m, 11, { type: 'keluar', desc: 'Bayar listrik & internet', category: 'Tagihan & langganan', amount: r(450000), accountId: 'dm-bank' });
      push(m, 14, { type: 'keluar', desc: 'Obat & vitamin', category: 'Kesehatan', amount: r(80000), accountId: 'dm-kas' });

      // Pakai kartu kredit & paylater (otomatis nambah tagihan)
      push(m, 15, { type: 'keluar', desc: 'Belanja bulanan pakai kartu', category: 'Belanja harian', amount: r(1200000), accountId: 'dm-kk' });
      push(m, 8, { type: 'keluar', desc: 'Belanja online (Bayar nanti)', category: 'Belanja harian', amount: r(400000), accountId: 'dm-paylater', method: 'nanti' });

      // Bayar sebagian saja (biar bunganya kepakai)
      push(m, 25, { type: 'transfer', desc: 'Bayar KK - sebagian', category: 'Bayar tagihan/utang', amount: r(600000), accountId: 'dm-bank', toAccountId: 'dm-kk' });
      push(m, 5, { type: 'transfer', desc: 'Bayar PayLater - Minimal', category: 'Bayar tagihan/utang', amount: r(150000), accountId: 'dm-ewallet', toAccountId: 'dm-paylater' });
    });

    // Titipan & kategori custom (Lainnya), sekali saja biar variatif
    push(1, 7, { type: 'transfer', desc: 'Titipan: Beli pulsa - Budi', category: 'Titipan/piutang', amount: 50000, accountId: 'dm-bank', toAccountId: 'dm-budi' });
    push(0, 3, { type: 'transfer', desc: 'Terima titipan - Budi', category: 'Titipan/piutang', amount: 50000, accountId: 'dm-budi', toAccountId: 'dm-kas' });
    push(2, 17, { type: 'masuk', desc: 'Menang kuis online', category: 'Menang undian', amount: 100000, accountId: 'dm-kas' });
    push(1, 18, { type: 'keluar', desc: 'Servis AC rumah', category: 'Rumah tangga', amount: 300000, accountId: 'dm-bank' });

    // Cicilan PayLater (bunga flat + admin): beli HP Rp1.800.000, tenor 6 bln, bunga flat 2%/bln, admin Rp25.000
    //  -> bunga = 1.800.000 x 2% x 6 = 216.000, cicilan = (1.800.000 + 216.000) / 6 = 336.000/bln, total tagihan 2.041.000
    {
      const pl = computeFlatCicilan(1800000, 6, 2, 25000);
      const plDate = monthDate(1, 8);
      const paylater = accounts.find(a => a.id === 'dm-paylater');
      paylater.plans = [{ id: 'dm-plan-1', desc: 'Beli HP', date: plDate, pokok: pl.pokok, tenor: pl.tenor, ratePercent: pl.ratePercent, bunga: pl.bunga, admin: pl.admin, monthly: pl.monthly, total: pl.total }];
      const base = { type: 'keluar', accountId: 'dm-paylater', planId: 'dm-plan-1', method: 'cicilan' };
      push(1, 8, { ...base, desc: 'Beli HP', category: 'Belanja harian', amount: pl.pokok });
      push(1, 8, { ...base, desc: 'Bunga cicilan: Beli HP', category: 'Bunga & biaya bank', amount: pl.bunga });
      push(1, 8, { ...base, desc: 'Admin cicilan: Beli HP', category: 'Bunga & biaya bank', amount: pl.admin });
    }

    // Riwayat pinjaman (uji logika: bunga dulu baru pokok):
    //  - 2 bulan lalu : angsuran penuh (bunga + pokok)
    //  - 1 bulan lalu : bayar bunga saja (pokok tidak berkurang) + bayar pokok ekstra Rp500.000 di tanggal lain
    //  - bulan ini    : belum ada pembayaran, jadi bunga bulan ini masih terutang -> pas untuk uji "nominal bebas"
    let sisaPinjaman = 12000000;
    const angsuran = 1200000;
    const bunga2 = Math.round(sisaPinjaman * 0.01);
    push(2, 10, { type: 'keluar', desc: 'Bunga pinjaman KUR BRI', category: 'Bunga & biaya bank', amount: bunga2, accountId: 'dm-bank', loanId: 'dm-pinjaman' });
    push(2, 10, { type: 'transfer', desc: 'Angsuran pokok KUR BRI', amount: angsuran - bunga2, accountId: 'dm-bank', toAccountId: 'dm-pinjaman' });
    sisaPinjaman -= (angsuran - bunga2);
    const bunga1 = Math.round(sisaPinjaman * 0.01);
    push(1, 10, { type: 'keluar', desc: 'Bunga pinjaman KUR BRI', category: 'Bunga & biaya bank', amount: bunga1, accountId: 'dm-bank', loanId: 'dm-pinjaman' });
    push(1, 20, { type: 'transfer', desc: 'Bayar pokok KUR BRI', amount: 500000, accountId: 'dm-bank', toAccountId: 'dm-pinjaman' });

    return { accounts, txns };
  }

  async function resetAllData() {
    const current = loadData();
    const isAlreadyEmpty = current.accounts.length === 0 && current.txns.length === 0;
    if (isAlreadyEmpty) { showIoMsg('Data sudah kosong.', 'ok'); return; }

    const ok = await showConfirm('Ini akan MENGHAPUS SEMUA akun & transaksi yang ada sekarang, sampai bersih.\n\nData lama akan dibackup otomatis dulu sebelum dihapus.\n\nLanjutkan?');
    if (!ok) return;

    await autoBackupBeforeReset(current);

    saveData({ accounts: [], txns: [] });
    state.activeFilter = 'all';
    state.activeTypeFilter = 'all';
    state.categoryChartType = 'keluar';
    state.sortMode = 'date-desc';
    const sortSel = $('sort-select');
    if (sortSel) sortSel.value = 'date-desc';
    render();
    showIoMsg('Semua data sudah direset. Backup data lama sudah diunduh.', 'ok');
  }

  async function loadDummyData() {
    const current = loadData();
    const hasRealData = current.txns.length > 0 && !current.txns.every(t => String(t.id).startsWith('dm-txn-'));
    const warn = hasRealData
      ? 'Ini akan MENGHAPUS data yang ada sekarang dan menggantinya dengan data contoh (dummy).\n\nData lama akan dibackup otomatis dulu sebelum dihapus.\n\nLanjutkan?'
      : 'Isi dengan data contoh (dummy) untuk 3 bulan terakhir?';
    const ok = await showConfirm(warn);
    if (!ok) return;

    if (hasRealData) await autoBackupBeforeReset(current);

    const dummy = buildDummyData();
    saveData(dummy);
    state.activeFilter = 'all';
    state.activeTypeFilter = 'all';
    state.categoryChartType = 'keluar';
    state.sortMode = 'date-desc';
    const sortSel = $('sort-select');
    if (sortSel) sortSel.value = 'date-desc';
    render();
    showIoMsg('Data contoh dimuat: ' + dummy.accounts.length + ' akun, ' + dummy.txns.length + ' transaksi.', 'ok');
  }

  async function autoBackupBeforeReset(data) {
    const payload = { exported_at: new Date().toISOString(), accounts: data.accounts, transaksi: data.txns };
    const json = JSON.stringify(payload, null, 2);
    const filename = 'keuangan-backup-sebelum-reset-' + exportUserPrefix() + '-' + todayStr() + '-' + Date.now() + '.json';
    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data: json }); return true; } catch (e) { /* fall through */ }
    }
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) { return false; }
  }

  function resetAndImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incomingAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
        const incomingTxns = Array.isArray(parsed) ? parsed : (parsed.transaksi || parsed.txns);
        if (!Array.isArray(incomingTxns)) throw new Error('format tidak dikenali');

        // Selalu generate id baru sendiri untuk akun & transaksi hasil import — JANGAN percaya
        // id dari file, karena id ini nanti disisipkan ke atribut onclick saat render.
        // Id dari file cuma dipetakan (idMap) untuk menyambungkan accountId/toAccountId.
        const idMap = {};
        const cleanAccounts = incomingAccounts
          .filter(a => a && typeof a.name === 'string')
          .map(a => {
            const newId = generateId('acc');
            if (a.id !== undefined) idMap[a.id] = newId;
            return buildAccountFromImport(a, newId);
          });
        if (cleanAccounts.length === 0) throw new Error('tidak ada akun valid di file');

        const fallbackAccId = cleanAccounts[0].id;
        const cleanTxns = incomingTxns
          .filter(t => t && typeof t.amount === 'number')
          .map(t => buildTxnFromImport(t, idMap, fallbackAccId));

        const ok = await showConfirm(`Ini akan MENGHAPUS semua data yang ada sekarang dan menggantinya dengan isi file ini:\n${cleanAccounts.length} akun (${cleanAccounts.map(a => a.name).join(', ')})\n${cleanTxns.length} transaksi (${(() => { const ds = cleanTxns.map(t => t.date).sort(); return ds[0] === ds[ds.length - 1] ? ds[0] : `${ds[0]} – ${ds[ds.length - 1]}`; })()})\n\nData lama akan dibackup otomatis dulu sebelum dihapus.\n\nLanjutkan?`);
        if (!ok) { event.target.value = ''; return; }

        const backupOk = await autoBackupBeforeReset(loadData());

        saveData({ accounts: cleanAccounts, txns: cleanTxns });
        state.activeFilter = 'all';
        state.activeTypeFilter = 'all';
        state.sortMode = 'date-desc';
        const sortSel = $('sort-select');
        if (sortSel) sortSel.value = 'date-desc';
        render();
        showIoMsg(`Data direset: ${cleanAccounts.length} akun, ${cleanTxns.length} transaksi dimuat.` + (backupOk ? ' Backup data lama sudah diunduh.' : ' (Backup gagal diunduh, tapi reset tetap dilanjutkan.)'), 'ok');
      } catch (e) {
        showIoMsg('Gagal reset & import: ' + e.message, 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => showIoMsg('Gagal membaca file.', 'error');
    reader.readAsText(file);
  }

