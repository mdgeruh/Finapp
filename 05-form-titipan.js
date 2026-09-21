  // ============================================================
  // TITIPAN / PIUTANG: form tambah
  // ============================================================
  function openTitipanForm() {
    $('titipan-card').classList.add('open');
    const dateEl = $('titipan-date-input');
    if (dateEl) { dateEl.value = todayStr(); dateEl.max = todayStr(); }
  }

  function closeTitipanForm() {
    $('titipan-card').classList.remove('open');
  }

  function setTitipanMode(mode) {
    state.titipanMode = mode;
    document.querySelectorAll('#titipan-card .type-btn').forEach(b => b.classList.toggle('active', b.dataset.titipanMode === mode));
    $('titipan-desc-row').style.display = mode === 'belanja' ? 'flex' : 'none';
    populateTitipanSelects();
  }

  function populateTitipanSelects(data) {
    if (!data) data = loadData();
    const personSel = $('titipan-person-select');
    const fundSel = $('titipan-fund-select');
    const prevPerson = personSel.value;
    const prevFund = fundSel.value;

    const people = data.accounts.filter(a => a.type === 'titipan');
    let personOpts = people.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    personOpts += `<option value="__new__">+ Orang baru</option>`;
    personSel.innerHTML = personOpts;
    if (Array.from(personSel.options).some(o => o.value === prevPerson)) personSel.value = prevPerson;

    const funds = data.accounts.filter(a => a.type !== 'titipan');
    const fundLabel = state.titipanMode === 'belanja' ? 'Bayar pakai...' : 'Terima ke...';
    let fundOpts = `<option value="" disabled>${fundLabel}</option>`;
    fundOpts += funds.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    fundSel.innerHTML = fundOpts;
    if (Array.from(fundSel.options).some(o => o.value === prevFund && prevFund !== '')) {
      fundSel.value = prevFund;
    } else {
      fundSel.value = '';
    }

    onTitipanPersonChange();
  }

  function onTitipanPersonChange() {
    const personSel = $('titipan-person-select');
    $('titipan-newperson-row').style.display = personSel.value === '__new__' ? 'flex' : 'none';
  }

  async function submitTitipan() {
    const data = loadData();
    const personSel = $('titipan-person-select');
    const fundSel = $('titipan-fund-select');
    const amtEl = $('titipan-amount-input');
    const descEl = $('titipan-desc-input');
    const newNameEl = $('titipan-newperson-input');

    const amount = parseFloat(amtEl.value);
    if (!amount || amount <= 0) { amtEl.focus(); return; }
    if (!fundSel.value) { fundSel.focus(); showIoMsg('Pilih akun dulu.', 'error'); return; }
    const txnDate = $('titipan-date-input').value || todayStr();
    if (txnDate > todayStr()) { $('titipan-date-input').focus(); showIoMsg('Tanggal tidak boleh di masa depan.', 'error'); return; }

    let personId = personSel.value;
    let personName;

    if (personId === '__new__') {
      const name = newNameEl.value.trim();
      if (!name) { newNameEl.focus(); return; }
      const dup = data.accounts.find(a => a.type === 'titipan' && a.name.toLowerCase() === name.toLowerCase());
      if (dup) { showIoMsg(`"${dup.name}" sudah ada di daftar titipan.`, 'error'); newNameEl.focus(); return; }
      personId = generateId('acc');
      data.accounts.push({ id: personId, name, type: 'titipan', initialBalance: 0 });
      personName = name;
    } else {
      const acc = data.accounts.find(a => a.id === personId);
      if (!acc) { showIoMsg('Pilih orang dulu.', 'error'); return; }
      personName = acc.name;
    }

    const fundAcc = data.accounts.find(a => a.id === fundSel.value);
    const fundName = fundAcc ? fundAcc.name : '?';

    if (state.titipanMode === 'belanja') {
      const keterangan = descEl.value.trim();
      const desc = 'Titipan' + (keterangan ? ': ' + keterangan : '') + ' - ' + personName;
      const ok = await showConfirm(`Belanjakan ${formatRp(amount)} untuk ${personName}\npakai ${fundName}?` + (txnDate !== todayStr() ? `\nTanggal: ${fmtTgl(txnDate)}` : ''));
      if (!ok) return;
      data.txns.push({ id: generateId('txn'), date: txnDate, type: 'transfer', desc, amount, accountId: fundSel.value, toAccountId: personId, category: 'Titipan/piutang' });
    } else {
      const desc = 'Terima titipan - ' + personName;
      const ok = await showConfirm(`Terima ${formatRp(amount)} dari ${personName}\nmasuk ke ${fundName}?` + (txnDate !== todayStr() ? `\nTanggal: ${fmtTgl(txnDate)}` : ''));
      if (!ok) return;
      data.txns.push({ id: generateId('txn'), date: txnDate, type: 'transfer', desc, amount, accountId: personId, toAccountId: fundSel.value, category: 'Titipan/piutang' });
    }

    amtEl.value = '';
    descEl.value = '';
    newNameEl.value = '';
    saveData(data);
    render();
    closeTitipanForm();
    showIoMsg('Titipan tercatat.', 'ok');
  }

  // Pembayaran pinjaman dicatat sebagai 2 transaksi (bunga + pokok) pada hari & akun sumber yang sama.
  // Kembalikan pasangannya kalau tepat satu kandidat; kalau ambigu (mis. dua pembayaran di hari sama), null.
  function findLoanPaymentPartner(data, t) {
    const isBunga = x => x.type === 'keluar' && x.loanId && x.category === 'Bunga & biaya bank' && /^Bunga pinjaman /.test(x.desc || '');
    const isPokok = x => x.type === 'transfer' && x.toAccountId && /^(Angsuran|Bayar) pokok /.test(x.desc || '');
    let cands = [];
    if (isBunga(t)) cands = data.txns.filter(x => x.id !== t.id && isPokok(x) && x.toAccountId === t.loanId && x.date === t.date && x.accountId === t.accountId);
    else if (isPokok(t)) cands = data.txns.filter(x => x.id !== t.id && isBunga(x) && x.loanId === t.toAccountId && x.date === t.date && x.accountId === t.accountId);
    return cands.length === 1 ? cands[0] : null;
  }

  async function deleteTxn(id) {
    const data = loadData();
    const t = data.txns.find(x => x.id === id);
    if (!t) return;
    const partner = t.planId ? null : findLoanPaymentPartner(data, t);
    if (partner) {
      const bungaTx = t.type === 'keluar' ? t : partner;
      const pokokTx = t.type === 'transfer' ? t : partner;
      const okPair = await showConfirm(`Ini bagian dari satu pembayaran pinjaman yang tercatat 2 transaksi: bunga ${formatRp(bungaTx.amount)} + pokok ${formatRp(pokokTx.amount)}. Hapus keduanya supaya sisa hutang tetap sinkron?`);
      if (!okPair) return;
      data.txns = data.txns.filter(x => x.id !== t.id && x.id !== partner.id);
      saveData(data);
      render();
      return;
    }
    const label = t.type === 'transfer' ? 'Transfer' : t.desc;
    if (t.planId) {
      // Transaksi cicilan PayLater: pokok, bunga, dan admin satu paket, hapus semuanya + rencana cicilan di akun.
      const group = data.txns.filter(x => x.planId === t.planId);
      const totalGroup = group.reduce((sum, x) => sum + x.amount, 0);
      const okPlan = await showConfirm(`Ini bagian dari cicilan PayLater. Hapus seluruh paket cicilan (${group.length} transaksi, total ${formatRp(totalGroup)})?`);
      if (!okPlan) return;
      data.txns = data.txns.filter(x => x.planId !== t.planId);
      data.accounts.forEach(a => { if (Array.isArray(a.plans)) a.plans = a.plans.filter(pl => pl.id !== t.planId); });
      saveData(data);
      render();
      return;
    }
    const ok = await showConfirm(`Hapus transaksi "${label}" sebesar ${formatRp(t.amount)}?`);
    if (!ok) return;
    data.txns = data.txns.filter(x => x.id !== id);
    saveData(data);
    render();
  }


