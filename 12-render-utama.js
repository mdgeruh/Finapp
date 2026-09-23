  // ============================================================
  // RENDER UTAMA (dipanggil ulang tiap ada perubahan data)
  // ============================================================
  // Versi app: samakan dengan nomor di nama file (keuangan_pribadi-v1_1_NNN.html) tiap ada revisi.
  const APP_NAME = 'Keuangan Pribadi';
  const APP_VERSION = 'v1.1.031';
  const APP_BUILD = '23 Sep 2026';
  (function () { const f = document.getElementById('app-footer'); if (f) f.textContent = APP_NAME + ' · ' + APP_VERSION + ' · ' + APP_BUILD; })();

  function render() {
    let data = loadData();
    data = applyRecurringFees(data);
    const balances = computeAllBalances(data); // 1x pass, dibagikan ke render di bawah
    populateAccountSelects(data);
    populateTitipanSelects(data);
    updateQuickPayButtons(data);
    renderBalanceHeader(data, balances);

    // Data berubah -> semua tab jadi tidak up-to-date, tapi cuma tab yang lagi aktif yang
    // benar-benar digambar sekarang. Tab lain baru digambar pas dibuka lewat setTab().
    TAB_NAMES.forEach(t => dirtyTabs.add(t));
    renderTabContent(currentTabName(), data, balances);

    // Detail akun yang lagi terbuka (saldo, sisa hutang, riwayat) ikut disegarkan, supaya hapus/edit
    // transaksi dari riwayat akun langsung terlihat tanpa harus tutup-buka lagi.
    const accDetailEl = $('acc-detail');
    if (detailAccountId && accDetailEl && accDetailEl.classList.contains('open')) openAccountDetail(detailAccountId);

    // Sama untuk detail titipan (saldo, status, riwayat, tombol Lunasi) — dulu tidak ikut
    // disegarkan sehingga hapus/edit transaksi dari riwayat titipan terlihat stale.
    const titipanDetailEl = $('titipan-detail');
    if (state.detailTitipanId && titipanDetailEl && titipanDetailEl.classList.contains('open')) openTitipanDetail(state.detailTitipanId);
  }

  // Bagian daftar transaksi di tab Transaksi: filter, urutkan, cari, lalu render.
  // Dipisah dari render() supaya bisa dipanggil sendiri (lihat refreshTxnList)
  // tanpa perlu menghitung ulang akun/grafik/laporan yang tidak berubah.
  function renderTxnListSection(data) {
    const accById = {};
    data.accounts.forEach(a => accById[a.id] = a);

    let txns = data.txns.slice();
    if (state.activeFilter !== 'all') {
      txns = txns.filter(t => t.accountId === state.activeFilter || t.toAccountId === state.activeFilter);
    }
    if (state.activeTypeFilter !== 'all') {
      txns = txns.filter(t => t.type === state.activeTypeFilter);
    }
    if (state.txnSearchQuery) {
      txns = txns.filter(t => {
        const accName1 = accById[t.accountId] ? accById[t.accountId].name.toLowerCase() : '';
        const accName2 = t.toAccountId && accById[t.toAccountId] ? accById[t.toAccountId].name.toLowerCase() : '';
        const desc = (t.desc || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        return desc.includes(state.txnSearchQuery) || cat.includes(state.txnSearchQuery) || accName1.includes(state.txnSearchQuery) || accName2.includes(state.txnSearchQuery);
      });
    }

    // Filter bulan (diabaikan saat mencari, supaya pencarian menyisir semua bulan).
    const monthKeys = txnMonthKeys(data);
    const monthSel = resolveTxnMonth(monthKeys);
    const monthActive = !state.txnSearchQuery && monthSel !== 'all';
    if (monthActive) txns = txns.filter(t => monthKeyFromDate(t.date || '') === monthSel);
    const periodLabel = state.txnSearchQuery ? 'Pencarian di semua bulan' : (monthSel === 'all' ? 'Semua waktu' : txnMonthLabel(monthSel));

    const isFiltered = state.activeFilter !== 'all' || state.activeTypeFilter !== 'all' || !!state.txnSearchQuery;

    const summaryEl = $('txn-summary');
    if (summaryEl) {
      if (txns.length === 0) {
        summaryEl.textContent = '';
      } else {
        const sumIn = txns.filter(t => t.type === 'masuk').reduce((s, t) => s + t.amount, 0);
        const sumOut = txns.filter(t => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);
        const countLabel = periodLabel + ' · ' + txns.length + ' transaksi';
        summaryEl.innerHTML = `${countLabel} · Masuk <strong style="color:var(--green)">${formatRp(sumIn)}</strong> · Keluar <strong style="color:var(--red)">${formatRp(sumOut)}</strong>`;
      }
    }

    const listEl = $('list-section');
    listEl.innerHTML = '';

    if (txns.length === 0) {
      if (monthActive && !isFiltered) {
        listEl.innerHTML = '<div class="empty">Belum ada transaksi di ' + escapeHtml(periodLabel) + '.<br><button type="button" class="empty-reset-link" onclick="setTxnMonth(\'all\')">Lihat semua waktu</button></div>';
      } else if (isFiltered) {
        listEl.innerHTML = '<div class="empty">Tidak ada transaksi yang cocok' + (monthActive ? ' di ' + escapeHtml(periodLabel) : '') + '.<br><button type="button" class="empty-reset-link" onclick="resetFilters()">Hapus semua filter</button></div>';
      } else {
        listEl.innerHTML = '<div class="empty">Belum ada transaksi di sini. Tambahkan yang pertama di atas.</div>';
      }
      return;
    }

    function buildRow(t, showDate) {
      const row = document.createElement('div');
      row.className = 'txn-row clickable';
      row.onclick = () => openTxnDetail(t.id);
      const accName = accById[t.accountId] ? accById[t.accountId].name : '?';
      let metaText, descText, sign;
      if (t.type === 'transfer') {
        const toName = accById[t.toAccountId] ? accById[t.toAccountId].name : '?';
        descText = (t.desc && t.desc !== 'Transfer') ? t.desc : 'Transfer';
        metaText = accName + ' → ' + toName;
        sign = '⇄';
      } else {
        descText = t.desc;
        metaText = accName;
        sign = t.type === 'masuk' ? '+' : '−';
      }
      if (t.category) metaText += ' · ' + t.category;
      if (t.planId) metaText += ' · Cicilan'; else if (t.method === 'nanti') metaText += ' · Bayar nanti';
      if (showDate) metaText += ' · ' + formatDayLabel(t.date);
      row.innerHTML = `
        <div class="txn-left">
          <span class="dot ${t.type}"></span>
          <div class="txn-text">
            <div class="txn-desc">${escapeHtml(descText)}</div>
            <div class="txn-meta">${escapeHtml(metaText)}</div>
          </div>
        </div>
        <div class="txn-right">
          <span class="txn-amount ${t.type}">${sign} ${formatRp(t.amount)}</span>
          <button class="del-btn" onclick="event.stopPropagation(); deleteTxn('${t.id}')" aria-label="Hapus">×</button>
        </div>
      `;
      return row;
    }

    // Virtualisasi ringan: jangan gambar SEMUA baris yang lolos filter ke DOM sekaligus kalau
    // jumlahnya jauh di atas txnRenderLimit -- limit direset ke TXN_PAGE_SIZE tiap ganti
    // filter/urutan/cari/bulan (lihat refreshTxnList), dan bisa ditambah lewat tombol "Muat lebih banyak".
    const limit = state.txnRenderLimit || TXN_PAGE_SIZE;
    const totalCount = txns.length;

    if (state.sortMode === 'amount-desc' || state.sortMode === 'amount-asc') {
      txns.sort((a, b) => state.sortMode === 'amount-desc' ? b.amount - a.amount : a.amount - b.amount);
      txns.slice(0, limit).forEach(t => listEl.appendChild(buildRow(t, true)));
      appendLoadMoreIfNeeded(listEl, totalCount - limit, data);
    } else if (state.sortMode === 'alpha-asc' || state.sortMode === 'alpha-desc') {
      const label = (t) => t.type === 'transfer' ? ((t.desc && t.desc !== 'Transfer') ? t.desc : 'Transfer') : (t.desc || '');
      txns.sort((a, b) => label(a).localeCompare(label(b), 'id', { sensitivity: 'base' }) * (state.sortMode === 'alpha-asc' ? 1 : -1));
      txns.slice(0, limit).forEach(t => listEl.appendChild(buildRow(t, true)));
      appendLoadMoreIfNeeded(listEl, totalCount - limit, data);
    } else {
      const byDate = {};
      txns.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
      const dates = Object.keys(byDate).sort((a, b) => state.sortMode === 'date-asc' ? a.localeCompare(b) : b.localeCompare(a));

      // Potong di batas HARI (bukan di tengah hari) supaya kelompok tanggal tetap utuh.
      // Dihitung dari dayTxnsAll.length (bukan cuma yang tampil) supaya hari yang sedang
      // dilipat tidak bikin batas jadi maju terlalu jauh.
      let shown = 0, cutoff = dates.length;
      for (let i = 0; i < dates.length; i++) {
        shown += byDate[dates[i]].length;
        if (shown >= limit) { cutoff = i + 1; break; }
      }
      const visibleDates = dates.slice(0, cutoff);

      visibleDates.forEach(date => {
        const dayTxnsAll = byDate[date];
        const dayIn = dayTxnsAll.filter(t => t.type === 'masuk').reduce((s, t) => s + t.amount, 0);
        const dayOut = dayTxnsAll.filter(t => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);
        const isCollapsed = !!state.collapsedDays[date];

        const heading = document.createElement('div');
        heading.className = 'day-heading clickable-heading';
        heading.onclick = () => {
          state.collapsedDays[date] = !state.collapsedDays[date];
          renderTxnListSection(data);
        };

        const leftWrap = document.createElement('span');
        leftWrap.className = 'day-heading-left';
        const chevron = document.createElement('span');
        chevron.className = 'day-chevron' + (isCollapsed ? ' collapsed' : '');
        chevron.textContent = '⌄';
        leftWrap.appendChild(chevron);
        const labelSpan = document.createElement('span');
        labelSpan.textContent = formatDayLabel(date);
        leftWrap.appendChild(labelSpan);
        heading.appendChild(leftWrap);

        if (dayIn > 0 || dayOut > 0) {
          const subSpan = document.createElement('span');
          subSpan.className = 'day-sub';
          const parts = [];
          if (dayIn > 0) parts.push(`<span class="in">+${formatRp(dayIn)}</span>`);
          if (dayOut > 0) parts.push(`<span class="out">−${formatRp(dayOut)}</span>`);
          subSpan.innerHTML = parts.join('<span class="sep">·</span>');
          heading.appendChild(subSpan);
        }
        listEl.appendChild(heading);

        if (!isCollapsed) {
          let dayTxns = dayTxnsAll.slice();
          dayTxns = state.sortMode === 'date-asc' ? dayTxns : dayTxns.reverse();
          dayTxns.forEach(t => listEl.appendChild(buildRow(t, false)));
        }
      });

      appendLoadMoreIfNeeded(listEl, dates.length - cutoff, data);
    }
  }

  // Tombol "Muat lebih banyak" di bawah daftar transaksi.
  function appendLoadMoreIfNeeded(listEl, hidden, data) {
    if (hidden <= 0) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'empty-reset-link txn-load-more';
    btn.style.cssText = 'display:block; width:100%; margin-top:10px; padding:10px; text-align:center;';
    btn.textContent = 'Muat lebih banyak';
    btn.onclick = () => { state.txnRenderLimit = (state.txnRenderLimit || TXN_PAGE_SIZE) + TXN_PAGE_SIZE; renderTxnListSection(data); };
    listEl.appendChild(btn);
  }


  let downloadsCap = null;
  (async () => {
    try { downloadsCap = await claude.use('downloads'); } catch (e) { downloadsCap = null; }
  })();


