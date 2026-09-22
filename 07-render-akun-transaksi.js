  // ============================================================
  // RENDER: RINGKASAN AKUN & DAFTAR/FILTER TRANSAKSI
  // ============================================================
  // Pengingat jatuh tempo di Ringkasan: bisa toggle horizon (7/30/90/365 hari) + yang sudah lewat.
  let dueReminderPeriodDays = 7;
  function setDueReminderPeriod(days) {
    dueReminderPeriodDays = days;
    const data = loadData();
    renderDueReminders(data, computeAllBalances(data));
  }
  function renderDueReminders(data, balances) {
    const card = $('due-reminder-card');
    if (!card) return;
    const allSoon = computeUpcomingDues(data, balances, 365);
    const items = computeUpcomingDues(data, balances, dueReminderPeriodDays);
    if (!allSoon.length && !items.length) { card.style.display = 'none'; card.innerHTML = ''; return; }
    card.style.display = 'block';
    const periodBtns = [7, 30, 90, 365].map(d => {
      const lbl = d === 7 ? '7H' : (d === 30 ? '30H' : (d === 90 ? '90H' : '1Th'));
      return `<button type="button" class="type-btn${d === dueReminderPeriodDays ? ' active' : ''}" style="padding:6px 0; font-size:11px;" onclick="setDueReminderPeriod(${d})">${lbl}</button>`;
    }).join('');
    const dueTotal = items.reduce((s, it) => s + it.amount, 0);
    const header = `<div class="section-title-row" style="margin-bottom:6px;"><div class="section-title">Jatuh tempo</div>${items.length ? `<span class="txn-amount keluar" style="font-size:14px;">${formatRp(dueTotal)}</span>` : ''}</div>
      <div class="type-toggle" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:10px;">${periodBtns}</div>`;
    if (!items.length) {
      card.innerHTML = header + '<div class="empty" style="padding:14px;">Tidak ada tagihan jatuh tempo dalam ' + (dueReminderPeriodDays === 365 ? '1 tahun' : dueReminderPeriodDays + ' hari') + ' ke depan.</div>';
      return;
    }
    card.innerHTML = header + items.map(it => {
      const late = it.days < 0;
      const when = late ? 'Lewat ' + (-it.days) + ' hari' : (it.days === 0 ? 'Hari ini' : (it.days === 1 ? 'Besok' : it.days + ' hari lagi'));
      const color = late ? 'var(--red)' : (it.days <= 3 ? 'var(--amber)' : 'var(--ink-soft)');
      return `
        <div class="txn-row clickable" onclick="openAccountDetail('${it.id}')">
          <div class="txn-left">
            <span class="dot keluar"></span>
            <div class="txn-text">
              <div class="txn-desc">${escapeHtml(it.name)} · ${escapeHtml(it.label)}</div>
              <div class="txn-meta" style="color:${color}; font-weight:600;">${when} · ${escapeHtml(fmtTgl(it.due))}</div>
            </div>
          </div>
          <div class="txn-right"><span class="txn-amount keluar">${formatRp(it.amount)}</span>${it.payKind ? `<button type="button" class="io-btn" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); payDueFromRingkasan('${it.id}')">Bayar</button>` : ''}</div>
        </div>`;
    }).join('') + (() => {
      const liquid = computeLiquidFunds(data, balances || computeAllBalances(data));
      const gap = liquid - dueTotal;
      const per = dueReminderPeriodDays === 365 ? '1 tahun' : dueReminderPeriodDays + ' hari';
      return `<div class="acc-sub" style="margin-top:10px; padding-top:10px; border-top:1px solid var(--line);">Uang tersedia (kas, bank, e-wallet) ${formatRp(liquid)} · jatuh tempo ${per} ${formatRp(dueTotal)}<br><strong style="color:${gap >= 0 ? 'var(--green)' : 'var(--red)'};">${gap >= 0 ? 'Cukup, sisa ' + formatRp(gap) : 'Kurang ' + formatRp(-gap)}</strong></div>`;
    })();
  }

  function renderAccountsSummary(data, balances) {
    if (!balances) balances = computeAllBalances(data);
    const asetEl = $('akun-total-aset');
    const utangEl = $('akun-total-utang');
    if (!asetEl || !utangEl) return;
    const { aset: totalAset, utang: totalUtang } = computeAssetDebt(data, balances);
    asetEl.textContent = formatRp(totalAset);
    utangEl.textContent = formatRp(totalUtang);
  }

  // Tab Akun: dikelompokkan per tipe (bisa dilipat), tiap akun berupa kartu. Tipe sederhana (kas, bank, e-wallet)
  // dua kolom; tipe dengan info banyak (kartu kredit, PayLater, pinjaman, titipan) satu kolom. Urut dari nilai terbesar.
  const ACC_GROUP_KEY = 'kp_acc_collapsed';
  let accCollapsed = {};
  try { accCollapsed = JSON.parse(localStorage.getItem(ACC_GROUP_KEY) || '{}') || {}; } catch (e) { accCollapsed = {}; }
  const ACC_WIDE_TYPES = { kartu_kredit: true, paylater: true, pinjaman: true, pinjaman_online: true, titipan: true };

  function toggleAccGroup(type) {
    accCollapsed[type] = !accCollapsed[type];
    try { localStorage.setItem(ACC_GROUP_KEY, JSON.stringify(accCollapsed)); } catch (e) {}
    const g = document.querySelector('.acc-group[data-type="' + type + '"]');
    if (g) {
      g.classList.toggle('collapsed', !!accCollapsed[type]);
      const head = g.querySelector('.acc-group-head');
      if (head) head.setAttribute('aria-expanded', accCollapsed[type] ? 'false' : 'true');
    }
  }

  function renderAccounts(data, balances) {
    if (!balances) balances = computeAllBalances(data);
    const container = $('accounts-scroll');
    if (!container) return;
    if (data.accounts.length === 0) {
      container.innerHTML = '<div class="empty">Belum ada akun. Tambahkan yang pertama dengan tombol + di bawah.</div>';
      return;
    }
    const txnStats = computeAccountTxnStats(data);

    // Hitung tampilan tiap akun
    const items = data.accounts.map(acc => {
      const bal = balances[acc.id];
      const isDebt = TYPE_DEBT[acc.type];
      const colorVar = TYPE_COLOR_VAR[acc.type] || '--teal';
      const txnCount = txnStats[acc.id] ? txnStats[acc.id].count : 0;
      let valueText, color, metaExtra = '', barHtml = '', sortVal = Math.abs(bal), groupVal = bal, canPay = false;

      if (isDebt) {
        const limit = acc.limit || 0;
        const used = acc.type === 'paylater' ? paylaterCreditUsed(data, acc, bal) : (bal < 0 ? Math.abs(bal) : 0);
        const overpaid = bal > 0 ? bal : 0;
        const sisa = limit - used;
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const remL = TYPE_LOAN[acc.type] ? computeLoanRemaining(data, acc, bal) : null;
        const usedL = remL ? remL.total : used;
        canPay = acc.type === 'kartu_kredit' && used > 0;
        sortVal = usedL; groupVal = usedL;
        valueText = overpaid > 0 ? 'Lebih bayar ' + formatRp(overpaid) : (TYPE_LOAN[acc.type] ? (usedL > 0 ? 'Sisa hutang ' + formatRp(usedL) : 'Lunas') : 'Terpakai ' + formatRp(used));
        color = usedL > 0 ? 'var(--red)' : 'var(--ink)';
        metaExtra = limit > 0 ? ' · Sisa limit ' + formatRp(sisa) : '';
        if (acc.interestPercent && acc.type !== 'paylater') metaExtra += ' · Bunga ' + acc.interestPercent + '%/bln jika belum lunas';
      metaExtra += feeAdminMetaText(acc);
        metaExtra += cardSchemeMetaText(acc);
        metaExtra += assetMetaText(acc);
        if (acc.type === 'paylater') metaExtra += paylaterMetaExtra(data, acc);
        if (acc.loanRatePercent) metaExtra += ' · Bunga ' + acc.loanRatePercent + (acc.loanRateUnit === 'bulan' ? '%/bln (' : '%/thn (') + (acc.loanInterestType === 'menurun' ? 'menurun' : 'tetap') + ')';
        const barColor = pct >= 90 ? '--red' : (pct >= 70 ? '--amber' : colorVar);
        if (TYPE_LOAN[acc.type]) {
          const lp = computeLoanProgress(acc, bal);
          if (lp) {
            metaExtra += ' · Terbayar ' + lp.pct + '%';
            barHtml = `<div class="acc-bar"><div class="acc-bar-fill" style="width:${lp.pct}%; background:var(--green);"></div></div>`;
          }
          const sch = computeLoanSchedule(data, acc, bal);
          if (sch) metaExtra += ' · Angsuran ' + sch.paid + '/' + sch.tenor + (sch.next ? ' · berikutnya ' + fmtTgl(sch.next.due) : '');
        } else if (limit > 0) barHtml = `<div class="acc-bar"><div class="acc-bar-fill" style="width:${pct}%; background:var(${barColor});"></div></div>`;
      } else if (acc.type === 'titipan') {
        if (bal > 0) { valueText = 'Berutang ' + formatRp(bal); color = 'var(--red)'; }
        else if (bal < 0) { valueText = 'Lebih ' + formatRp(Math.abs(bal)); color = 'var(--green)'; }
        else { valueText = 'Lunas'; color = 'var(--ink-soft)'; }
      } else {
        valueText = formatRp(bal);
        color = bal < 0 ? 'var(--red)' : 'var(--ink)';
        metaExtra += assetMetaText(acc);
      }
      return { acc, colorVar, valueText, color, metaExtra, barHtml, txnCount, sortVal, groupVal, canPay };
    });

    // Kelompokkan per tipe (urutan mengikuti TYPE_LABELS), tipe kosong dilewati.
    const html = Object.keys(TYPE_LABELS).map(type => {
      const group = items.filter(it => it.acc.type === type);
      if (!group.length) return '';
      group.sort((x, y) => y.sortVal - x.sortVal);
      const colorVar = TYPE_COLOR_VAR[type] || '--teal';
      const isDebtType = !!TYPE_DEBT[type];
      const total = group.reduce((sum, it) => sum + it.groupVal, 0);
      let totalText;
      if (isDebtType) totalText = total > 0 ? 'Utang ' + formatRp(total) : 'Lunas';
      else if (type === 'titipan') totalText = total > 0 ? 'Piutang ' + formatRp(total) : (total < 0 ? 'Utang ' + formatRp(-total) : 'Lunas');
      else totalText = formatRp(total);
      const totalColor = (isDebtType && total > 0) || (type === 'titipan' && total < 0) || (!isDebtType && type !== 'titipan' && total < 0) ? 'var(--red)' : 'var(--ink)';
      const collapsed = !!accCollapsed[type];
      const wide = !!ACC_WIDE_TYPES[type];
      const cards = group.map(it => {
        const metaBits = (it.metaExtra ? it.metaExtra.replace(/^ · /, '').split(' · ') : []);
        metaBits.push(it.txnCount + ' transaksi');
        return `
          <div class="acc-card acc-tile" style="--accent-color: var(${colorVar});" role="button" tabindex="0" onclick="openAccountDetail('${it.acc.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openAccountDetail('${it.acc.id}');}">
            <div class="acc-name">${escapeHtml(it.acc.name)}</div>
            <div class="acc-tile-value" style="color:${it.color}">${it.valueText}</div>
            <div class="acc-tile-meta">${metaBits.map(escapeHtml).join(' · ')}</div>
            ${it.barHtml}
            ${it.canPay ? `<button type="button" class="io-btn" style="width:100%; margin-top:10px; padding:8px 10px; font-size:13px;" onclick="event.stopPropagation(); payCardFromDetail('${it.acc.id}','tagihan')" onkeydown="event.stopPropagation()">Bayar tagihan</button>` : ''}
          </div>`;
      }).join('');
      return `
        <div class="acc-group${collapsed ? ' collapsed' : ''}" data-type="${type}">
          <button class="acc-group-head" onclick="toggleAccGroup('${type}')" aria-expanded="${collapsed ? 'false' : 'true'}">
            <span class="dot" style="background: var(${colorVar})"></span>
            <span class="acc-group-title">${TYPE_LABELS[type]}</span>
            <span class="acc-group-count">${group.length}</span>
            <span class="acc-group-total" style="color:${totalColor}">${totalText}</span>
            <svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="acc-grid${wide ? ' one' : ''}">${cards}</div>
        </div>`;
    }).join('');
    container.innerHTML = html;
  }

  function renderFilters(data) {
    const row = $('filter-row');
    row.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = 'chip' + (state.activeFilter === 'all' ? ' active' : '');
    allChip.textContent = 'Semua akun';
    allChip.onclick = () => { state.activeFilter = 'all'; refreshTxnList(); };
    row.appendChild(allChip);
    data.accounts.forEach(acc => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.activeFilter === acc.id ? ' active' : '');
      chip.textContent = acc.name;
      chip.onclick = () => { state.activeFilter = acc.id; refreshTxnList(); };
      row.appendChild(chip);
    });
  }

  function renderTypeFilters() {
    const row = $('type-filter-row');
    row.innerHTML = '';
    const options = [['all', 'Semua jenis'], ['masuk', 'Pemasukan'], ['keluar', 'Pengeluaran'], ['transfer', 'Transfer']];
    options.forEach(([val, label]) => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.activeTypeFilter === val ? ' active' : '');
      chip.textContent = label;
      chip.onclick = () => { state.activeTypeFilter = val; refreshTxnList(); };
      row.appendChild(chip);
    });
  }

  function onSortChange() {
    state.sortMode = $('sort-select').value;
    refreshTxnList();
  }

  let txnSearchDebounceTimer = null;
  function onTxnSearchInput() {
    const raw = $('txn-search-input').value;
    const clearBtn = $('txn-search-clear');
    if (clearBtn) clearBtn.classList.toggle('show', raw.length > 0);
    clearTimeout(txnSearchDebounceTimer);
    txnSearchDebounceTimer = setTimeout(() => {
      state.txnSearchQuery = raw.trim().toLowerCase();
      refreshTxnList();
    }, 220);
  }

  function clearTxnSearch() {
    const searchEl = $('txn-search-input');
    if (searchEl) searchEl.value = '';
    const clearBtn = $('txn-search-clear');
    if (clearBtn) clearBtn.classList.remove('show');
    clearTimeout(txnSearchDebounceTimer);
    state.txnSearchQuery = '';
    refreshTxnList();
  }

  function resetFilters() {
    state.activeFilter = 'all';
    state.activeTypeFilter = 'all';
    state.sortMode = 'date-desc';
    state.txnSearchQuery = '';
    state.txnMonth = 'cur';
    clearTimeout(txnSearchDebounceTimer);
    $('sort-select').value = 'date-desc';
    const searchEl = $('txn-search-input');
    if (searchEl) searchEl.value = '';
    const clearBtn = $('txn-search-clear');
    if (clearBtn) clearBtn.classList.remove('show');
    refreshTxnList();
  }

  // Refresh ringan khusus tab Transaksi: dipakai saat ganti filter/urutan/cari
  // saja (data tidak berubah), jadi tidak perlu render ulang seluruh tab lain
  // (akun, grafik, titipan, laporan) yang berat dan bikin lag terutama saat mengetik di kolom cari.
  function refreshTxnList() {
    let data = loadData();
    data = applyRecurringFees(data);
    state.txnRenderLimit = TXN_PAGE_SIZE; // filter/urutan/cari/bulan berubah -> mulai lagi dari halaman pertama
    renderTxnMonthRow(data);
    renderFilters(data);
    renderTypeFilters();
    renderTxnListSection(data);
  }

  // ---------- Pemilih bulan di tab Transaksi ----------
  // Default: hanya bulan berjalan. Pilihan bulan = bulan yang punya transaksi + bulan ini, plus "Semua waktu".
  // Sedang mencari (kolom cari terisi) => pencarian menyisir SEMUA bulan supaya transaksi lama tetap ketemu.
  function txnMonthKeys(data) {
    const cur = todayStr().slice(0, 7);
    const set = new Set([cur]);
    data.txns.forEach(t => { const k = monthKeyFromDate(t.date || ''); if (/^\d{4}-\d{2}$/.test(k)) set.add(k); });
    return Array.from(set).sort().reverse();
  }
  function resolveTxnMonth(keys) {
    const cur = todayStr().slice(0, 7);
    if (state.txnMonth === 'all') return 'all';
    const k = state.txnMonth === 'cur' ? cur : state.txnMonth;
    return keys.indexOf(k) >= 0 ? k : cur;
  }
  function txnMonthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
  function renderTxnMonthRow(data) {
    const sel = $('txn-month-select');
    if (!sel) return;
    const cur = todayStr().slice(0, 7);
    const keys = txnMonthKeys(data);
    const val = resolveTxnMonth(keys);
    sel.innerHTML = keys.map(k => `<option value="${k}">${txnMonthLabel(k)}${k === cur ? ' (bulan ini)' : ''}</option>`).join('') + '<option value="all">Semua waktu</option>';
    sel.value = val;
    const idx = keys.indexOf(val);
    const prev = $('txn-month-prev'), next = $('txn-month-next');
    if (prev) prev.disabled = idx < 0 || idx >= keys.length - 1; // makin ke bawah = makin lama
    if (next) next.disabled = idx <= 0;
  }
  function setTxnMonth(v) {
    state.txnMonth = v === todayStr().slice(0, 7) ? 'cur' : v;
    refreshTxnList();
  }
  function onTxnMonthChange() { setTxnMonth($('txn-month-select').value); }
  function shiftTxnMonth(step) { // step +1 = bulan lebih lama, -1 = lebih baru
    const keys = txnMonthKeys(loadData());
    const idx = keys.indexOf(resolveTxnMonth(keys));
    const ni = idx + step;
    if (idx < 0 || ni < 0 || ni >= keys.length) return;
    setTxnMonth(keys[ni]);
  }


