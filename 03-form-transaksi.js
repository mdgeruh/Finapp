  // ============================================================
  // FORM TRANSAKSI (tambah/edit/detail/hapus)
  // ============================================================
  function openAddTxnForm() {
    state.editingTxnId = null;
    $('txn-form-title').textContent = 'Tambah transaksi';
    $('txn-submit-btn').textContent = 'Tambah transaksi';
    $('txn-cancel-btn').style.display = 'none';
    $('desc-input').value = '';
    $('amount-input').value = '';
    $('category-custom-input').value = '';
    $('date-input').value = todayStr();
    state.pendingTransferLabel = null;
    state.pendingPlanPayment = null;
    $('paylater-method').value = 'nanti'; $('paylater-tenor').value = ''; $('paylater-rate').value = ''; $('paylater-admin').value = '';
    setType('masuk');
    $('txn-form').classList.add('open');
  }

  function startEditTxn(id) {
    const data = loadData();
    const t = data.txns.find(x => x.id === id);
    if (!t) return;
    if (t.planId) return; // transaksi cicilan tidak diedit satuan (hapus paketnya lalu catat ulang)
    state.editingTxnId = id;

    const accSel = $('account-select');
    if (Array.from(accSel.options).some(o => o.value === t.accountId)) accSel.value = t.accountId;
    setType(t.type);
    updateTypeAvailability();

    const catSel = $('category-select');
    const catCustomEl = $('category-custom-input');
    const hasPreset = Array.from(catSel.options).some(o => o.value === t.category);
    if (t.category && hasPreset) {
      catSel.value = t.category;
      catCustomEl.value = '';
    } else if (t.category) {
      catSel.value = CATEGORY_CUSTOM;
      catCustomEl.value = t.category;
    }
    onCategoryChange();

    $('desc-input').value = t.type === 'transfer' ? '' : (t.desc || '');
    $('amount-input').value = t.amount;
    $('date-input').value = t.date;

    if (t.type === 'transfer') {
      const toSel = $('to-account-select');
      if (Array.from(toSel.options).some(o => o.value === t.toAccountId)) toSel.value = t.toAccountId;
      state.pendingTransferLabel = (t.desc && t.desc !== 'Transfer') ? t.desc : null;
      updateQuickPayButtons();
    }

    $('txn-form-title').textContent = 'Edit transaksi';
    $('txn-submit-btn').textContent = 'Simpan perubahan';
    $('txn-cancel-btn').style.display = 'block';
    $('txn-form').classList.add('open');
  }

  function closeTxnForm() {
    $('txn-form').classList.remove('open');
    state.editingTxnId = null;
    state.pendingPlanPayment = null;
  }

  function openTxnDetail(id) {
    const data = loadData();
    const t = data.txns.find(x => x.id === id);
    if (!t) return;
    state.detailTxnId = id;

    const accById = {};
    data.accounts.forEach(a => accById[a.id] = a);
    const accName = accById[t.accountId] ? accById[t.accountId].name : '?';

    let sign, descText;
    if (t.type === 'transfer') {
      sign = '⇄';
      descText = (t.desc && t.desc !== 'Transfer') ? t.desc : 'Transfer';
    } else {
      sign = t.type === 'masuk' ? '+' : '−';
      descText = t.desc || '(Tanpa keterangan)';
    }

    $('txn-detail-dot').className = 'dot ' + t.type;
    const amountEl = $('txn-detail-amount');
    amountEl.textContent = sign + ' ' + formatRp(t.amount);
    amountEl.className = 'txn-detail-amount ' + t.type;
    $('txn-detail-desc').textContent = descText;

    const rows = [['Jenis', t.type === 'masuk' ? 'Pemasukan' : t.type === 'keluar' ? 'Pengeluaran' : 'Transfer']];
    if (t.type === 'transfer') {
      const toName = accById[t.toAccountId] ? accById[t.toAccountId].name : '?';
      rows.push(['Dari akun', accName]);
      rows.push(['Ke akun', toName]);
    } else {
      rows.push(['Akun', accName]);
    }
    if (t.category) rows.push(['Kategori', t.category]);
    rows.push(['Tanggal', formatDayLabel(t.date)]);
    if (t.method === 'nanti') rows.push(['Metode PayLater', 'Bayar nanti (bunga 0%)']);
    if (t.planId) {
      const owner = accById[t.accountId];
      const plan = owner && Array.isArray(owner.plans) ? owner.plans.find(pl => pl.id === t.planId) : null;
      rows.push(['Metode PayLater', 'Cicilan']);
      if (plan) {
        rows.push(['Cicilan', formatRp(plan.monthly) + '/bln × ' + plan.tenor + ' bulan']);
        rows.push(['Bunga flat', plan.ratePercent + '%/bln = ' + formatRp(plan.bunga)]);
        if (plan.admin > 0) rows.push(['Admin', formatRp(plan.admin)]);
        rows.push(['Total tagihan', formatRp(plan.total)]);
      }
    }

    $('txn-detail-rows').innerHTML = rows.map(([label, val]) => `
      <div class="txn-detail-row">
        <span class="txn-detail-label">${escapeHtml(label)}</span>
        <span class="txn-detail-value">${escapeHtml(val)}</span>
      </div>
    `).join('');

    const editBtn = document.querySelector('#txn-detail .submit-btn');
    if (editBtn) editBtn.style.display = t.planId ? 'none' : '';
    $('txn-detail').classList.add('open');
  }

  function closeTxnDetail() {
    $('txn-detail').classList.remove('open');
    state.detailTxnId = null;
  }

  function editFromDetail() {
    const id = state.detailTxnId;
    closeTxnDetail();
    if (id) startEditTxn(id);
  }

  async function deleteFromDetail() {
    const id = state.detailTxnId;
    if (!id) return;
    await deleteTxn(id);
    const data = loadData();
    if (!data.txns.find(x => x.id === id)) closeTxnDetail();
  }

  function setType(t) {
    const data = loadData();
    const accSel = $('account-select');
    const acc = data.accounts.find(a => a.id === accSel.value);
    if (t === 'masuk' && acc && TYPE_DEBT[acc.type]) return; // pemasukan tidak berlaku untuk akun utang
    if ((t === 'masuk' || t === 'keluar') && acc && acc.type === 'aset' && !state.editingTxnId) return; // aset: pakai Transfer
    state.currentType = t;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === t));
    $('to-account-row').style.display = t === 'transfer' ? 'flex' : 'none';
    $('desc-row').style.display = t === 'transfer' ? 'none' : 'flex';
    populateCategorySelect();
    updateQuickPayButtons();
    updatePaylaterUI();
    updateAssetHint();
  }

  function populateCategorySelect() {
    const sel = $('category-select');
    const list = CATEGORIES[state.currentType] || [];
    sel.innerHTML = list.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    onCategoryChange();
  }

  function onCategoryChange() {
    const sel = $('category-select');
    $('category-custom-row').style.display = sel.value === CATEGORY_CUSTOM ? 'flex' : 'none';
  }

  function updateTypeAvailability() {
    const data = loadData();
    const accSel = $('account-select');
    const acc = data.accounts.find(a => a.id === accSel.value);
    const masukBtn = document.querySelector('.type-btn[data-type="masuk"]');
    const hint = $('debt-hint');
    const isDebt = acc && TYPE_DEBT[acc.type];
    // Aset tidak dipakai untuk pemasukan/pengeluaran harian (nilainya mengikuti penilaian + beli/jual lewat Transfer).
    // Transaksi lama yang sedang diedit tidak dipaksa.
    const blockAsset = !!(acc && acc.type === 'aset') && !state.editingTxnId;
    const keluarBtn = document.querySelector('.type-btn[data-type="keluar"]');

    masukBtn.disabled = !!isDebt || blockAsset;
    masukBtn.style.opacity = (isDebt || blockAsset) ? '0.35' : '';
    masukBtn.style.cursor = (isDebt || blockAsset) ? 'not-allowed' : '';
    if (keluarBtn) {
      keluarBtn.disabled = blockAsset;
      keluarBtn.style.opacity = blockAsset ? '0.35' : '';
      keluarBtn.style.cursor = blockAsset ? 'not-allowed' : '';
    }

    if (isDebt) {
      if (state.currentType === 'masuk') setType('keluar');
      hint.style.display = 'block';
      hint.textContent = `Transaksi di "${acc.name}" otomatis tercatat sebagai pengeluaran (menambah tagihan). Untuk bayar tagihan, gunakan Transfer dari akun lain ke sini.`;
    } else if (blockAsset) {
      if (state.currentType !== 'transfer') setType('transfer');
      hint.style.display = 'block';
      hint.textContent = `"${acc.name}" adalah aset. Untuk membeli atau menjual aset gunakan Transfer; nilainya diperbarui lewat detail akun.`;
    } else {
      hint.style.display = 'none';
    }
    updatePaylaterUI();
    updateAssetHint();
  }

  // Petunjuk saat Transfer melibatkan aset (beli / jual) + kategori otomatis "Beli/jual aset".
  function updateAssetHint() {
    const el = $('asset-hint');
    if (!el) return;
    const data = loadData();
    const from = data.accounts.find(a => a.id === $('account-select').value);
    const to = data.accounts.find(a => a.id === $('to-account-select').value);
    const fromAsset = !!(from && from.type === 'aset'), toAsset = !!(to && to.type === 'aset');
    let msg = '';
    if (state.currentType === 'transfer' && from && to && from.id !== to.id) {
      if (toAsset && !fromAsset) msg = `Beli aset: nilai "${to.name}" bertambah sebesar nominal ini. Kalau harga pasarnya berbeda, perbarui nilainya di detail akun.`;
      else if (fromAsset && !toAsset) msg = `Jual aset: nilai "${from.name}" berkurang sebesar nominal ini. Kalau terjual habis, perbarui nilainya jadi 0 di detail akun.`;
      if (msg && !state.editingTxnId) {
        const cs = $('category-select');
        if (cs && (cs.value === 'Top up saldo' || cs.value === 'Pindah dana antar akun') && Array.from(cs.options).some(o => o.value === 'Beli/jual aset')) {
          cs.value = 'Beli/jual aset';
          onCategoryChange();
        }
      }
    }
    el.style.display = msg ? 'block' : 'none';
    el.textContent = msg;
  }

  // Pilihan Bayar nanti / Cicilan hanya muncul untuk pengeluaran baru di akun PayLater.
  function updatePaylaterUI() {
    const row = $('paylater-row');
    if (!row) return;
    const data = loadData();
    const acc = data.accounts.find(a => a.id === $('account-select').value);
    const show = !!acc && acc.type === 'paylater' && state.currentType === 'keluar' && !state.editingTxnId;
    row.style.display = show ? 'block' : 'none';
    $('paylater-cicilan-fields').style.display = (show && $('paylater-method').value === 'cicilan') ? 'block' : 'none';
    updatePaylaterPreview();
  }

  function readPaylaterCicilanInput() {
    const pokok = Math.round(parseFloat($('amount-input').value) || 0);
    const tenor = Math.round(parseFloat($('paylater-tenor').value) || 0);
    const rate = Math.max(0, parseFloat($('paylater-rate').value) || 0);
    const admin = Math.max(0, Math.round(parseFloat($('paylater-admin').value) || 0));
    return { pokok, tenor, rate, admin };
  }

  function updatePaylaterPreview() {
    const el = $('paylater-preview');
    if (!el || $('paylater-cicilan-fields').style.display === 'none') return;
    const { pokok, tenor, rate, admin } = readPaylaterCicilanInput();
    if (pokok <= 0 || tenor < 1) { el.textContent = 'Isi jumlah dan tenor untuk melihat rincian cicilan.'; return; }
    const c = computeFlatCicilan(pokok, tenor, rate, admin);
    el.textContent = 'Cicilan ' + formatRp(c.monthly) + '/bln × ' + tenor + ' bln · Bunga flat total ' + formatRp(c.bunga) +
      (admin > 0 ? ' · Admin ' + formatRp(admin) : '') + ' · Total tagihan ' + formatRp(c.total);
  }

  // Pilihan akun di form transaksi dikelompokkan per jenis supaya mudah dicari.
  // Kalau semua akun cuma satu kelompok, tampil biasa tanpa judul kelompok.
  const ACCOUNT_GROUPS = [
    { label: 'Kas & rekening', types: ['kas', 'bank', 'ewallet'] },
    { label: 'Aset', types: ['aset'] },
    { label: 'Kartu & utang', types: ['kartu_kredit', 'paylater', 'pinjaman', 'pinjaman_online'] },
    { label: 'Titipan / piutang', types: ['titipan'] }
  ];
  function accountOptionsHtml(accounts) {
    const opt = a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`;
    const known = new Set([].concat(...ACCOUNT_GROUPS.map(g => g.types)));
    const groups = ACCOUNT_GROUPS.map(g => ({ label: g.label, list: accounts.filter(a => g.types.indexOf(a.type) >= 0) }));
    const rest = accounts.filter(a => !known.has(a.type));
    if (rest.length) groups.push({ label: 'Lainnya', list: rest });
    const filled = groups.filter(g => g.list.length);
    if (filled.length <= 1) return accounts.map(opt).join('');
    return filled.map(g => `<optgroup label="${g.label}">${g.list.map(opt).join('')}</optgroup>`).join('');
  }

  function populateAccountSelects(data) {
    if (!data) data = loadData();
    const accSel = $('account-select');
    const toSel = $('to-account-select');
    const prevSelected = accSel.value;
    const opts = accountOptionsHtml(data.accounts);
    accSel.innerHTML = opts;
    toSel.innerHTML = opts;
    if (data.accounts.some(a => a.id === prevSelected)) accSel.value = prevSelected;
    if (data.accounts.length > 1) toSel.selectedIndex = 1;
    updateTypeAvailability();
  }

  let editingAccountId = null;
  let loanInstallmentManual = false; // true kalau angsuran diisi/diubah manual (auto-hitung pinjol berhenti menimpa)
  let accFormPrevType = '';


