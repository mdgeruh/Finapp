  // ============================================================
  // NAVIGASI, HEADER SALDO & AKSI CEPAT
  // ============================================================
  function updateQuickPayButtons(data) {
    const row = $('quick-pay-row');
    if (!row) return;
    state.pendingTransferLabel = null;
    if (state.currentType !== 'transfer') { row.style.display = 'none'; row.innerHTML = ''; return; }

    if (!data) data = loadData();
    const toSel = $('to-account-select');
    const toAcc = data.accounts.find(a => a.id === toSel.value);
    if (!toAcc || !TYPE_DEBT[toAcc.type]) { row.style.display = 'none'; row.innerHTML = ''; return; }

    const bal = accountBalance(data, toAcc.id);
    const used = bal < 0 ? Math.abs(bal) : 0;
    if (used <= 0) { row.style.display = 'none'; row.innerHTML = ''; return; }

    let buttons = '';
    if (toAcc.type === 'kartu_kredit') {
      const ci = cardStatementInfo(data, toAcc, todayStr());
      if (ci && ci.remaining > 0) {
        const remaining = Math.min(used, ci.remaining);
        const minPay = Math.min(remaining, ci.minRemaining);
        if (minPay > 0) buttons += `<button type="button" class="io-btn" style="flex:1;" onclick="fillTransferAmount(${minPay}, 'Bayar KK - Minimal')">Minimal — ${formatRp(minPay)}</button>`;
        if (remaining < used) buttons += `<button type="button" class="io-btn" style="flex:1;" onclick="fillTransferAmount(${remaining}, 'Bayar KK - Tagihan cetak')">Tagihan cetak — ${formatRp(remaining)}</button>`;
      } else if (!ci) {
        const minPay = cardMinPayOf(toAcc, used);
        buttons += `<button type="button" class="io-btn" style="flex:1;" onclick="fillTransferAmount(${minPay}, 'Bayar KK - Minimal')">Minimal — ${formatRp(minPay)}</button>`;
      }
    }
    buttons += `<button type="button" class="io-btn" style="flex:1;" onclick="fillTransferAmount(${used}, 'Bayar ${TYPE_LABELS[toAcc.type] || toAcc.type} - Penuh')">Bayar penuh — ${formatRp(used)}</button>`;
    row.innerHTML = buttons;
    row.style.display = 'flex';
  }

  function fillTransferAmount(amount, label) {
    $('amount-input').value = amount;
    state.pendingTransferLabel = label || null;
    const catSel = $('category-select');
    if (catSel && [...catSel.options].some(o => o.value === 'Bayar tagihan/utang')) {
      catSel.value = 'Bayar tagihan/utang';
      onCategoryChange();
    }
  }

  const TAB_TITLES = {
    ringkasan: 'Keuangan pribadi',
    transaksi: 'Transaksi',
    titipan: 'Titipan & piutang',
    laporan: 'Laporan',
    akun: 'Akun',
    data: 'Data & export',
    profil: 'Profil'
  };

  // Optimasi: chart/list tiap tab lumayan berat buat digambar ulang (chart SVG + ukur teks dsb),
  // jadi daripada gambar ulang KE-6 tab tiap kali ada perubahan data (padahal cuma satu yang
  // kelihatan), tab yang lagi tidak aktif cukup ditandai "dirty" - baru benar-benar digambar
  // saat tab itu dibuka (lihat renderTabContent() & pemanggilannya di setTab()/render()).
  const TAB_NAMES = ['ringkasan', 'akun', 'transaksi', 'titipan', 'laporan', 'data', 'profil'];
  const dirtyTabs = new Set(TAB_NAMES);

  function currentTabName() {
    const panel = document.querySelector('.tab-panel.active');
    return (panel && panel.id.replace('tab-', '')) || 'ringkasan';
  }

  // Gambar ulang isi (chart/list) khusus satu tab. data & balances dioper dari pemanggil
  // supaya tidak dihitung ulang kalau sudah tersedia (lihat render()).
  function renderTabContent(name, data, balances) {
    dirtyTabs.delete(name);
    if (!data) data = loadData();
    if (!balances) balances = computeAllBalances(data);
    switch (name) {
      case 'ringkasan':
        renderDueReminders(data, balances);
        renderBackupReminder(data);
        renderAccountsSummary(data, balances);
        renderAccountValues(data, balances);
        renderRecentTxns(data);
        renderMonthInsights(data);
        renderCategoryChart(data);
        renderTrendChart(data);
        renderCashflowChart(data);
        renderNetWorthChart(data);
        applyRingkasanVisibility(data);
        break;
      case 'akun':
        renderAccounts(data, balances);
        break;
      case 'transaksi':
        renderTxnMonthRow(data);
        renderFilters(data);
        renderTypeFilters();
        renderTxnListSection(data);
        break;
      case 'titipan':
        renderTitipanList(data, balances);
        renderTitipanSummary(data, balances);
        renderTitipanFilters();
        break;
      case 'laporan':
        renderLaporan(data);
        break;
      case 'data':
        renderRingkasanConfig();
        break;
      case 'profil':
        renderProfilTab();
        break;
    }
  }

  // ---------- Tab Profil (icon user di header): nama pemilik untuk sapaan di Ringkasan ----------
  function renderProfilTab() {
    const el = $('profil-name-input');
    if (el) el.value = getOwnerName();

    const active = !!(typeof sync !== 'undefined' && sync.ready);
    const noneEl = $('profil-sync-none');
    const sectionEl = $('profil-sync-section');
    if (noneEl) noneEl.style.display = active ? 'none' : 'block';
    if (sectionEl) sectionEl.style.display = active ? 'block' : 'none';
    if (active) {
      const emailEl = $('profil-current-email');
      if (emailEl) emailEl.textContent = sync.email || '-';
      const emailInput = $('profil-email-input');
      if (emailInput) emailInput.value = '';
      const passInput = $('profil-pass-input');
      if (passInput) passInput.value = '';
    }
  }

  function updateGreeting() {
    const h = new Date().getHours();
    const sapa = h >= 4 && h < 11 ? 'Selamat pagi' : (h >= 11 && h < 15 ? 'Selamat siang' : (h >= 15 && h < 18 ? 'Selamat sore' : 'Selamat malam'));
    const g = $('greeting');
    if (g) g.innerHTML = escapeHtml(sapa) + ', <b>' + escapeHtml(getOwnerName()) + '</b>';
  }

  function saveOwnerNameFromInput() {
    const el = $('profil-name-input');
    const v = setOwnerName(el ? el.value : '');
    if (el) el.value = v;
    updateGreeting();
    showIoMsg('Nama tersimpan.', 'ok', 'profil-msg');
  }

  function setTab(name) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    const balanceBlock = $('balance-block');
    if (balanceBlock) balanceBlock.classList.toggle('tab-hidden', name !== 'ringkasan');
    const titleEl = $('page-title');
    if (titleEl) titleEl.textContent = TAB_TITLES[name] || TAB_TITLES.ringkasan;
    updateNavFab(name);

    // Tab ini belum digambar ulang sejak data terakhir berubah -> gambar sekarang,
    // pas dibuka (bukan tiap kali render() dipanggil dari tab lain).
    if (dirtyTabs.has(name)) renderTabContent(name);
  }

  const THEME_KEY = 'kp_theme';
  const THEME_LABELS = { system: 'Tampilan: Sistem', light: 'Tampilan: Terang', dark: 'Tampilan: Gelap' };

  function applyTheme(mode) {
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.setAttribute('data-theme', mode);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const btn = $('theme-toggle-btn');
    if (btn) btn.textContent = THEME_LABELS[mode] || THEME_LABELS.system;
  }

  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    let current = 'system';
    try { current = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
    const next = order[(order.indexOf(current) + 1) % order.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  (function initTheme() {
    let saved = 'system';
    try { saved = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
    applyTheme(saved);
  })();

  // Tombol + di navigasi mengikuti tab aktif: Akun -> tambah akun, Titipan -> catat titipan,
  // tab lain -> tambah transaksi.
  const NAV_FAB_LABELS = { akun: 'Tambah akun', titipan: 'Catat titipan' };
  function goToAdd() {
    const tab = currentTabName();
    if (tab === 'akun') openAccForm('add');
    else if (tab === 'titipan') openTitipanForm();
    else openAddTxnForm();
  }
  function goToAddTxn() { openAddTxnForm(); }
  function updateNavFab(name) {
    const fab = $('nav-fab');
    if (!fab) return;
    const label = NAV_FAB_LABELS[name] || 'Tambah transaksi';
    fab.setAttribute('aria-label', label);
    fab.setAttribute('title', label);
  }

  const EYE_OPEN_SVG = '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>';
  const EYE_CLOSED_SVG = '<path d="M3 3l18 18"/><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 3.02M6.6 6.6C4.1 8.2 2 12 2 12s3.5 7 10 7a9.2 9.2 0 0 0 4.02-.91"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>';

  function toggleBalanceVisibility() {
    state.balanceHidden = !state.balanceHidden;
    $('balance-eye-icon').innerHTML = state.balanceHidden ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
    const data = loadData();
    renderBalanceHeader(data);
    renderNetWorthChart(data);
  }

  function renderBalanceHeader(data, balances) {
    if (!balances) balances = computeAllBalances(data);
    const now = todayGmt8();
    const totalBalance = data.accounts.reduce((s, a) => s + balances[a.id], 0);
    const ad = computeAssetDebt(data, balances);

    $('balance-amount').textContent = state.balanceHidden ? '•••••••' : formatRp(totalBalance);
    $('total-in').textContent = state.balanceHidden ? '•••••••' : formatRp(ad.aset);
    $('total-out').textContent = state.balanceHidden ? '•••••••' : formatRp(ad.utang);
    $('balance-scope').textContent = 'Saldo semua akun (aset − utang) saat ini';
    // Bunga kontrak pinjaman flat yang belum jatuh tempo tidak ada di saldo akun (saldo = sisa pokok);
    // ditampilkan sebagai catatan supaya kekayaan bersih tidak terkesan lebih tinggi dari kenyataan.
    let sisaBungaTotal = 0;
    data.accounts.forEach(a => { if (TYPE_LOAN[a.type]) sisaBungaTotal += computeLoanRemaining(data, a, balances[a.id]).sisaBunga; });
    const noteEl = $('balance-note');
    if (noteEl) {
      noteEl.style.display = sisaBungaTotal > 0 ? 'block' : 'none';
      noteEl.textContent = sisaBungaTotal > 0 ? (state.balanceHidden ? 'Belum termasuk sisa bunga kontrak pinjaman' : 'Belum termasuk sisa bunga kontrak pinjaman ' + formatRp(sisaBungaTotal)) : '';
    }
  }


