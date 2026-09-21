  // ============================================================
  // RENDER: DAFTAR & DETAIL TITIPAN/PIUTANG
  // ============================================================
  function renderTitipanFilters() {
    const row = $('titipan-filter-row');
    if (!row) return;
    row.innerHTML = '';
    const options = [['all', 'Semua'], ['berutang', 'Berutang ke saya'], ['lebih', 'Titipan lebih saya'], ['lunas', 'Lunas']];
    options.forEach(([val, label]) => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.activeTitipanFilter === val ? ' active' : '');
      chip.textContent = label;
      chip.onclick = () => { state.activeTitipanFilter = val; refreshTitipanList(); };
      row.appendChild(chip);
    });
    const toggleBtn = $('titipan-sort-toggle');
    if (toggleBtn) toggleBtn.textContent = 'Urutkan: ' + (state.titipanSortMode === 'balance' ? 'Nominal' : 'Nama');
  }

  function toggleTitipanSort() {
    state.titipanSortMode = state.titipanSortMode === 'balance' ? 'alpha' : 'balance';
    refreshTitipanList();
  }

  let titipanSearchDebounceTimer = null;
  function onTitipanSearchInput() {
    const raw = $('titipan-search-input').value;
    const clearBtn = $('titipan-search-clear');
    if (clearBtn) clearBtn.classList.toggle('show', raw.length > 0);
    clearTimeout(titipanSearchDebounceTimer);
    titipanSearchDebounceTimer = setTimeout(() => {
      state.titipanSearchQuery = raw.trim().toLowerCase();
      refreshTitipanList();
    }, 220);
  }

  function clearTitipanSearch() {
    const searchEl = $('titipan-search-input');
    if (searchEl) searchEl.value = '';
    const clearBtn = $('titipan-search-clear');
    if (clearBtn) clearBtn.classList.remove('show');
    clearTimeout(titipanSearchDebounceTimer);
    state.titipanSearchQuery = '';
    refreshTitipanList();
  }

  function resetTitipanFilter() {
    state.activeTitipanFilter = 'all';
    refreshTitipanList();
  }

  // Refresh ringan khusus daftar orang di tab Titipan: dipakai saat ganti
  // filter/urutan saja, tanpa render ulang seluruh tab lain.
  function refreshTitipanList() {
    let data = loadData();
    data = applyRecurringFees(data);
    renderTitipanFilters();
    renderTitipanList(data, computeAllBalances(data));
  }

  function renderTitipanList(data, balances) {
    const container = $('titipan-list');
    if (!container) return;
    if (!balances) balances = computeAllBalances(data);
    const txnStats = computeAccountTxnStats(data);
    let people = data.accounts.filter(a => a.type === 'titipan');
    const withBal = people.map(acc => {
      const s = txnStats[acc.id] || { count: 0, lastDate: null };
      return { acc, bal: balances[acc.id], txnCount: s.count, lastDate: s.lastDate };
    });
    let filtered = withBal;
    if (state.titipanSearchQuery) {
      filtered = filtered.filter(x => x.acc.name.toLowerCase().includes(state.titipanSearchQuery));
    }
    if (state.activeTitipanFilter === 'berutang') filtered = filtered.filter(x => x.bal > 0);
    else if (state.activeTitipanFilter === 'lebih') filtered = filtered.filter(x => x.bal < 0);
    else if (state.activeTitipanFilter === 'lunas') filtered = filtered.filter(x => x.bal === 0);

    if (state.titipanSortMode === 'alpha') {
      filtered.sort((a, b) => a.acc.name.localeCompare(b.acc.name, 'id', { sensitivity: 'base' }));
    } else {
      filtered.sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal));
    }

    if (filtered.length === 0) {
      if (people.length === 0) {
        container.innerHTML = '<div class="empty">Belum ada orang yang dititipi/menitip.</div>';
      } else if (state.titipanSearchQuery) {
        container.innerHTML = '<div class="empty">Tidak ada nama yang cocok dengan pencarian.<br><button type="button" class="empty-reset-link" onclick="clearTitipanSearch()">Hapus pencarian</button></div>';
      } else {
        container.innerHTML = '<div class="empty">Tidak ada orang yang cocok dengan filter ini.<br><button type="button" class="empty-reset-link" onclick="resetTitipanFilter()">Tampilkan semua</button></div>';
      }
      return;
    }
    container.innerHTML = filtered.map(({ acc, bal, txnCount, lastDate }) => {
      let statusText, color;
      if (bal > 0) { statusText = 'Berutang ' + formatRp(bal); color = 'var(--red)'; }
      else if (bal < 0) { statusText = 'Saldo lebih ' + formatRp(Math.abs(bal)); color = 'var(--green)'; }
      else { statusText = 'Lunas'; color = 'var(--ink-soft)'; }
      const metaText = txnCount > 0
        ? txnCount + ' transaksi · terakhir ' + dayShortLabel(lastDate)
        : 'Belum ada transaksi';
      return `
        <div class="txn-row clickable" onclick="openTitipanDetail('${acc.id}')">
          <div class="txn-left">
            <span class="dot" style="background: var(--green)"></span>
            <div class="txn-text">
              <div class="txn-desc">${escapeHtml(acc.name)}</div>
              <div class="txn-meta">${metaText}</div>
            </div>
          </div>
          <div class="txn-right">
            <span class="txn-amount" style="color:${color}">${statusText}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function openTitipanDetail(id) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id && a.type === 'titipan');
    if (!acc) return;
    state.detailTitipanId = id;
    $('titipan-detail-name-edit-row').style.display = 'none';

    const bal = accountBalance(data, id);
    let statusText, statusColor;
    if (bal > 0) { statusText = 'Berutang ke saya'; statusColor = 'var(--red)'; }
    else if (bal < 0) { statusText = 'Titipan lebih saya'; statusColor = 'var(--green)'; }
    else { statusText = 'Lunas'; statusColor = 'var(--ink-soft)'; }

    $('titipan-detail-name').textContent = acc.name;
    const statusEl = $('titipan-detail-status');
    statusEl.textContent = statusText;
    statusEl.style.color = statusColor;
    const amtEl = $('titipan-detail-amount');
    amtEl.textContent = formatRp(Math.abs(bal));
    amtEl.style.color = statusColor;

    const lunasiBtn = $('titipan-lunasi-btn');
    if (lunasiBtn) {
      if (bal !== 0) {
        lunasiBtn.style.display = 'block';
        lunasiBtn.textContent = bal > 0 ? 'Lunasi — terima ' + formatRp(bal) : 'Lunasi — bayar ' + formatRp(Math.abs(bal));
      } else {
        lunasiBtn.style.display = 'none';
      }
    }

    const accById = {};
    data.accounts.forEach(a => accById[a.id] = a);

    const related = data.txns.filter(t => t.accountId === id || t.toAccountId === id);
    const indexed = related.map((t, i) => ({ t, i }));
    indexed.sort((a, b) => a.t.date !== b.t.date ? b.t.date.localeCompare(a.t.date) : b.i - a.i);

    const histEl = $('titipan-detail-history');
    if (indexed.length === 0) {
      histEl.innerHTML = '<div class="empty">Belum ada riwayat.</div>';
    } else {
      histEl.innerHTML = indexed.map(({ t }) => {
        const increasesDebt = t.toAccountId === id;
        const sign = increasesDebt ? '+' : '−';
        const cls = increasesDebt ? 'keluar' : 'masuk';
        const fundId = increasesDebt ? t.accountId : t.toAccountId;
        const fundName = accById[fundId] ? accById[fundId].name : '?';
        const desc = t.desc || (increasesDebt ? 'Titipan' : 'Terima titipan');
        return `
          <div class="txn-row clickable" onclick="openTxnDetail('${t.id}')">
            <div class="txn-left">
              <span class="dot ${cls}"></span>
              <div class="txn-text">
                <div class="txn-desc">${escapeHtml(desc)}</div>
                <div class="txn-meta">${escapeHtml(fundName)} · ${formatDayLabel(t.date)}</div>
              </div>
            </div>
            <div class="txn-right">
              <span class="txn-amount ${cls}">${sign} ${formatRp(t.amount)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    $('titipan-detail').classList.add('open');
  }

  function closeTitipanDetail() {
    $('titipan-detail').classList.remove('open');
    state.detailTitipanId = null;
  }

  function editTitipanFromDetail() {
    const id = state.detailTitipanId;
    if (!id) return;
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    const input = $('titipan-detail-name-input');
    input.value = acc.name;
    $('titipan-detail-name-edit-row').style.display = 'block';
    input.focus();
  }

  function cancelEditTitipanName() {
    $('titipan-detail-name-edit-row').style.display = 'none';
  }

  function saveTitipanName() {
    const id = state.detailTitipanId;
    if (!id) return;
    const input = $('titipan-detail-name-input');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    const dup = data.accounts.find(a => a.type === 'titipan' && a.id !== id && a.name.toLowerCase() === name.toLowerCase());
    if (dup) { showIoMsg(`Nama "${dup.name}" sudah dipakai.`, 'error'); input.focus(); return; }
    acc.name = name;
    saveData(data);
    $('titipan-detail-name').textContent = name;
    $('titipan-detail-name-edit-row').style.display = 'none';
    render();
  }

  function quickAddTitipanFor(id) {
    closeTitipanDetail();
    openTitipanForm();
    populateTitipanSelects();
    const personSel = $('titipan-person-select');
    if (id && Array.from(personSel.options).some(o => o.value === id)) {
      personSel.value = id;
      onTitipanPersonChange();
    }
  }

  // Isi form titipan otomatis untuk pelunasan penuh: mode & nominal mengikuti arah saldo
  // (bal > 0: mereka berutang -> "Terima bayar"; bal < 0: saya titipan lebih -> "Belanjakan"
  // dianggap sebagai pengembalian). Akun dana & tanggal tetap dipilih manual sebelum simpan.
  function lunasiTitipan(id) {
    const data = loadData();
    const acc = id && data.accounts.find(a => a.id === id && a.type === 'titipan');
    if (!acc) return;
    const bal = accountBalance(data, id);
    if (bal === 0) { showIoMsg(acc.name + ' sudah lunas.', 'ok'); return; }
    closeTitipanDetail();
    openTitipanForm();
    setTitipanMode(bal > 0 ? 'terima' : 'belanja');
    const personSel = $('titipan-person-select');
    if (Array.from(personSel.options).some(o => o.value === id)) {
      personSel.value = id;
      onTitipanPersonChange();
    }
    $('titipan-amount-input').value = Math.abs(bal);
    if (state.titipanMode === 'belanja') $('titipan-desc-input').value = 'Pelunasan';
    showIoMsg('Jumlah pelunasan sudah diisi otomatis — cek akun dananya, lalu simpan.', 'ok');
  }

  async function deleteTitipanFromDetail() {
    const id = state.detailTitipanId;
    if (!id) return;
    await deleteAccount(id);
    const data = loadData();
    if (!data.accounts.find(a => a.id === id)) closeTitipanDetail();
  }

  function renderTitipanSummary(data, balances) {
    if (!balances) balances = computeAllBalances(data);
    const berutangEl = $('titipan-total-berutang');
    const lebihEl = $('titipan-total-lebih');
    if (!berutangEl || !lebihEl) return;
    const people = data.accounts.filter(a => a.type === 'titipan');
    let totalBerutang = 0, totalLebih = 0, countBerutang = 0, countLebih = 0;
    people.forEach(acc => {
      const bal = balances[acc.id];
      if (bal > 0) { totalBerutang += bal; countBerutang++; }
      else if (bal < 0) { totalLebih += Math.abs(bal); countLebih++; }
    });
    berutangEl.textContent = formatRp(totalBerutang);
    lebihEl.textContent = formatRp(totalLebih);
    const countBerutangEl = $('titipan-count-berutang');
    const countLebihEl = $('titipan-count-lebih');
    if (countBerutangEl) countBerutangEl.textContent = countBerutang + ' orang';
    if (countLebihEl) countLebihEl.textContent = countLebih + ' orang';
  }


