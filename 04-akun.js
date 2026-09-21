  // ============================================================
  // AKUN: REKENING / KAS / KARTU (form, detail, CRUD)
  // ============================================================
  function toggleAccForm() {
    const form = $('acc-form');
    if (form.classList.contains('open') && !editingAccountId) {
      form.classList.remove('open');
    } else {
      openAccForm('add');
    }
  }

  function startEditAccount(id) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    // Form edit akun berada di dalam tab Akun. Kalau detail akun dibuka dari tab lain (mis. dari kartu
    // "Jatuh tempo" di Ringkasan), pindah ke tab Akun dulu supaya form-nya benar-benar terlihat.
    if (currentTabName() !== 'akun') setTab('akun');
    openAccForm('edit', acc);
  }

  function openAccForm(mode, acc) {
    const form = $('acc-form');
    const nameEl = $('acc-name-input');
    const typeEl = $('acc-type-input');
    const balEl = $('acc-balance-input');
    const limitEl = $('acc-limit-input');
    const feeAmountEl = $('acc-fee-amount-input');
    const feeDayEl = $('acc-fee-day-input');
    const interestEl = $('acc-interest-input');
    const loanTypeEl = $('acc-loan-type-input');
    const loanRateEl = $('acc-loan-rate-input');
    const loanRateUnitEl = $('acc-loan-rate-unit-input');
    const loanAdminEl = $('acc-loan-admin-input');
    const loanStampEl = $('acc-loan-stamp-input');
    const loanSavingsEl = $('acc-loan-savings-input');
    const loanInstallmentEl = $('acc-loan-installment-input');
    const loanTenorEl = $('acc-loan-tenor-input');
    const loanOriginalEl = $('acc-loan-original-input');
    const loanStageEl = $('acc-loan-stage-input');
    const loanAdminPctEl = $('acc-loan-admin-pct-input');

    if (mode === 'edit' && acc) {
      editingAccountId = acc.id;
      nameEl.value = acc.name;
      typeEl.value = acc.type;
      updateAccFormFields();
      const isDebt = TYPE_DEBT[acc.type];
      const isLoan = TYPE_LOAN[acc.type];
      loanInstallmentManual = !!(isLoan && acc.loanInstallment);
      balEl.value = isDebt ? Math.abs(acc.initialBalance) : acc.initialBalance;
      limitEl.value = isDebt ? (acc.limit || '') : '';
      feeAmountEl.value = isDebt ? (acc.feeAmount || '') : '';
      feeDayEl.value = isDebt ? (acc.feeDay || '') : '';
      interestEl.value = isDebt ? (acc.interestPercent || '') : '';
      $('acc-asset-kind-input').value = acc.type === 'aset' && acc.assetKind && Array.from($('acc-asset-kind-input').options).some(o => o.value === acc.assetKind) ? acc.assetKind : 'Lainnya';
      $('acc-asset-qty-input').value = acc.type === 'aset' ? (acc.assetQty || '') : '';
      $('acc-asset-unit-input').value = acc.type === 'aset' ? (acc.assetUnit || '') : '';
      $('acc-card-stmt-input').value = acc.type === 'kartu_kredit' ? (acc.cardStatementDay || '') : '';
      $('acc-card-min-input').value = acc.type === 'kartu_kredit' ? (acc.cardMinValue || '') : '';
      $('acc-card-min-type-input').value = acc.cardMinType === 'nominal' ? 'nominal' : 'percent';
      $('acc-fee-type-input').value = acc.feeType || 'nominal';
      $('acc-fee-period-input').value = acc.feePeriod || 'bulanan';
      updateFeeAmountLabel();
      loanTypeEl.value = isLoan ? (acc.loanInterestType || 'tetap') : 'tetap';
      loanRateEl.value = isLoan ? (acc.loanRatePercent || '') : '';
      loanRateUnitEl.value = isLoan ? (acc.loanRateUnit || 'tahun') : 'tahun';
      loanAdminEl.value = isLoan ? (acc.loanAdminFee || '') : '';
      loanAdminPctEl.value = (acc.type === 'pinjaman_online') ? (adminPctOf(acc) || '') : '';
      $('acc-loan-admin-mode-input').value = acc.loanAdminMode === 'cicil' ? 'cicil' : 'cair';
      $('acc-loan-insurance-input').value = (acc.type === 'pinjaman_online') ? (acc.loanInsurancePercent || '') : '';
      loanStampEl.value = isLoan ? (acc.loanStampFee || '') : '';
      loanSavingsEl.value = isLoan ? (acc.loanMandatorySavings || '') : '';
      loanInstallmentEl.value = isLoan ? (acc.loanInstallment || '') : '';
      loanTenorEl.value = isLoan ? (acc.loanTenorMonths || '') : '';
      loanOriginalEl.value = isLoan ? (acc.originalPrincipal || '') : '';
      $('acc-loan-start-input').value = isLoan ? (acc.loanStartDate || '') : '';
      $('acc-loan-dueday-input').value = isLoan ? (acc.loanDueDay || '') : '';
      loanStageEl.value = 'baru';
      updateOnlineLoanEstimate();
      $('acc-form-title').textContent = 'Edit akun';
      $('acc-submit-btn').textContent = 'Simpan perubahan';
      $('acc-cancel-btn').style.display = 'block';
    } else {
      editingAccountId = null;
      loanInstallmentManual = false; accFormPrevType = '';
      loanAdminPctEl.value = '';
      $('acc-loan-admin-mode-input').value = 'cair'; $('acc-loan-insurance-input').value = '';
      nameEl.value = ''; balEl.value = ''; limitEl.value = '';
      feeAmountEl.value = ''; feeDayEl.value = ''; interestEl.value = '';
      $('acc-asset-kind-input').value = 'Emas'; $('acc-asset-qty-input').value = ''; $('acc-asset-unit-input').value = '';
      $('acc-card-stmt-input').value = ''; $('acc-card-min-input').value = ''; $('acc-card-min-type-input').value = 'percent';
      $('acc-fee-type-input').value = 'nominal';
      $('acc-fee-period-input').value = 'bulanan';
      updateFeeAmountLabel();
      loanTypeEl.value = 'tetap'; loanRateEl.value = ''; loanRateUnitEl.value = 'tahun'; loanAdminEl.value = ''; loanStampEl.value = ''; loanSavingsEl.value = ''; loanInstallmentEl.value = ''; loanTenorEl.value = ''; loanOriginalEl.value = ''; loanStageEl.value = 'baru';
      $('acc-loan-start-input').value = ''; $('acc-loan-dueday-input').value = '';
      typeEl.value = 'kas';
      updateAccFormFields();
      $('acc-form-title').textContent = 'Tambah akun';
      $('acc-submit-btn').textContent = 'Simpan akun';
      $('acc-cancel-btn').style.display = 'none';
    }
    form.classList.add('open');
  }

  function cancelAccForm() {
    editingAccountId = null;
    $('acc-form').classList.remove('open');
  }

  // Persen admin pinjol: pakai yang tersimpan; kalau akun lama cuma punya nominal Rp, turunkan dari pokok awal.
  function adminPctOf(acc) {
    if (acc.loanAdminPercent != null) return acc.loanAdminPercent;
    const pokok = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
    return (acc.loanAdminFee && pokok > 0) ? Math.round(acc.loanAdminFee / pokok * 10000) / 100 : 0;
  }

  function feeAdminMetaText(acc) {
    if (!acc.feeAmount || acc.type === 'paylater') return '';
    const period = acc.feePeriod === 'tahunan' ? 'iuran tahunan' : 'biaya admin/bln';
    const val = acc.feeType === 'percent' ? acc.feeAmount + '%' : formatRp(acc.feeAmount);
    return ' · ' + val + ' ' + period;
  }

  function updateFeeAmountLabel() {
    const type = $('acc-fee-type-input').value;
    const period = $('acc-fee-period-input').value;
    const label = $('acc-fee-amount-label');
    const input = $('acc-fee-amount-input');
    if (!label || !input) return;
    label.textContent = period === 'tahunan' ? 'Iuran tahunan' : 'Biaya admin/bulan';
    if (type === 'percent') {
      input.placeholder = '%, opsional';
      input.step = '0.01';
    } else {
      input.placeholder = 'Rp, opsional';
      input.step = '1';
    }
  }

  function updateAccFormFields() {
    const type = $('acc-type-input').value;
    const isDebt = TYPE_DEBT[type];
    const isLoan = TYPE_LOAN[type];
    const isOnlineLoan = type === 'pinjaman_online';
    const isPaylater = type === 'paylater';
    $('acc-limit-row').style.display = (isDebt && !isLoan) ? 'flex' : 'none';
    $('acc-fee-row').style.display = (isDebt && !isLoan) ? 'flex' : 'none';
    // PayLater: tanggal jatuh tempo baku saja. Bunga & admin dicatat per transaksi cicilan, bukan per akun.
    $('acc-interest-row').style.display = (isDebt && !isLoan && !isPaylater) ? 'flex' : 'none';
    $('acc-card-row').style.display = type === 'kartu_kredit' ? 'flex' : 'none';
    $('acc-asset-row').style.display = type === 'aset' ? 'flex' : 'none';
    $('acc-fee-amount-wrap').style.display = isPaylater ? 'none' : 'block';
    $('acc-fee-day-wrap').style.flex = isPaylater ? '1' : '0 0 110px';
    $('acc-fee-opts-wrap').style.display = isPaylater ? 'none' : 'flex';
    updateFeeAmountLabel();
    const limitLabel = document.querySelector('#acc-limit-row .field-label');
    if (limitLabel) limitLabel.textContent = isPaylater ? 'Limit PayLater' : 'Limit kartu';
    $('acc-loan-row').style.display = isLoan ? 'flex' : 'none';
    // Pinjaman online: bunga selalu flat (tanpa pilihan jenis), tabungan wajib disembunyikan (khas pinjaman bank).
    // Biaya admin diisi dalam persen dari pokok; angsuran dihitung otomatis dari pokok, tenor, dan bunga flat.
    $('acc-loan-type-wrap').style.display = isOnlineLoan ? 'none' : 'block';
    $('acc-loan-rate-label').textContent = isOnlineLoan ? 'Bunga flat' : 'Suku bunga';
    $('acc-loan-rate-input').placeholder = isOnlineLoan ? '%, mis. 2.5' : '%, opsional';
    if (isOnlineLoan && accFormPrevType !== 'pinjaman_online' && !editingAccountId) $('acc-loan-rate-unit-input').value = 'bulan';
    accFormPrevType = type;
    $('acc-loan-savings-wrap').style.display = isOnlineLoan ? 'none' : 'block';
    $('acc-loan-admin-rp-wrap').style.display = isOnlineLoan ? 'none' : 'block';
    $('acc-loan-admin-pct-wrap').style.display = isOnlineLoan ? 'block' : 'none';
    $('acc-loan-admin-label').textContent = 'Biaya admin (sekali)';
    $('acc-loan-online-extra').style.display = isOnlineLoan ? 'flex' : 'none';
    $('acc-loan-installment-label').textContent = 'Angsuran per bulan (otomatis kalau tenor & bunga diisi, bisa diubah)';
    $('acc-loan-installment-input').placeholder = 'Rp, terisi otomatis kalau pokok, tenor & bunga diisi';
    $('acc-loan-tenor-row').style.display = isLoan ? 'block' : 'none';
    $('acc-balance-input').placeholder = isLoan
      ? 'Sisa pokok belum dibayar SEKARANG (Rp), boleh 0'
      : (isDebt ? 'Sudah terpakai saat ini (Rp), boleh 0' : (type === 'aset' ? 'Nilai awal / harga beli (Rp)' : 'Saldo awal (Rp), boleh 0'));
    // Status pinjaman (baru cair vs sudah berjalan) cuma relevan pas BIKIN akun baru — sesudah akun ada,
    // pilihan ini tidak bisa diubah lagi (disbursement cuma sekali di awal), tapi "pokok awal" tetap bisa dikoreksi lewat Edit akun.
    const editing = !!editingAccountId;
    const stageRow = $('acc-loan-stage-row');
    if (stageRow) stageRow.style.display = (isLoan && !editing) ? 'block' : 'none';
    const stageEl = $('acc-loan-stage-input');
    const stage = editing ? 'berjalan' : (stageEl ? stageEl.value : 'baru');
    // Field "pokok awal" ditampilkan kalau: sedang edit akun pinjaman (buat koreksi belakangan),
    // atau saat bikin baru dan user pilih "sudah berjalan" (karena sisa sekarang ≠ pokok awal).
    $('acc-loan-original-row').style.display = (isLoan && (editing || stage === 'berjalan')) ? 'block' : 'none';
    updateLoanDisburseRow();
    updateOnlineLoanEstimate();
  }

  function onLoanStageChange() {
    updateAccFormFields();
  }

  // Baca isian form pinjaman (pinjol maupun bank). Pokok awal = "pokok awal" (kalau barisnya tampil)
  // atau pokok/sisa yang diisi. Admin % dan asuransi cuma dibaca untuk pinjol (baris itu disembunyikan
  // di form pinjaman bank, jadi nilainya tidak berlaku di sana).
  function readOnlineLoanForm() {
    const type = $('acc-type-input').value;
    const isOnlineLoan = type === 'pinjaman_online';
    const balVal = Math.abs(parseFloat($('acc-balance-input').value) || 0);
    const origVisible = $('acc-loan-original-row').style.display !== 'none';
    const origVal = origVisible ? Math.abs(parseFloat($('acc-loan-original-input').value) || 0) : 0;
    const rate = Math.max(0, parseFloat($('acc-loan-rate-input').value) || 0);
    const ratePerBulan = $('acc-loan-rate-unit-input').value === 'tahun' ? rate / 12 : rate; // dalam persen
    return {
      pokok: origVal > 0 ? origVal : balVal,
      rate: rate,
      ratePerBulan: ratePerBulan,
      tenor: Math.max(0, Math.round(parseFloat($('acc-loan-tenor-input').value) || 0)),
      adminPct: isOnlineLoan ? Math.max(0, parseFloat($('acc-loan-admin-pct-input').value) || 0) : 0,
      adminMode: $('acc-loan-admin-mode-input').value === 'cicil' ? 'cicil' : 'cair',
      insPct: isOnlineLoan ? Math.max(0, parseFloat($('acc-loan-insurance-input').value) || 0) : 0,
      // Menurun (anuitas) cuma dipilih lewat dropdown "Jenis bunga" di pinjaman bank; pinjol selalu flat.
      declining: !isOnlineLoan && $('acc-loan-type-input').value === 'menurun'
    };
  }

  // Bunga flat: angsuran = pokok/tenor + pokok x bunga per bulan.
  // Angsuran = pokok/tenor + bunga flat + asuransi bulanan + (admin/tenor kalau admin dicicil).
  function computeOnlineInstallment(pokok, tenor, ratePerBulanPct, insPct, adminCicilPct) {
    return Math.round(pokok / tenor + pokok * ratePerBulanPct / 100 + pokok * (insPct || 0) / 100 + (adminCicilPct > 0 ? pokok * adminCicilPct / 100 / tenor : 0));
  }

  function onInstallmentManualInput() {
    loanInstallmentManual = ($('acc-loan-installment-input').value !== '');
    updateOnlineLoanEstimate();
  }

  function resetInstallmentAuto() {
    loanInstallmentManual = false;
    updateOnlineLoanEstimate();
  }

  // Form pinjol: hitung otomatis biaya admin (Rp dari %) dan angsuran (flat), plus estimasi bunga efektif kalau
  // bunga tidak diisi. Angsuran tersimpan di akun; bunga flat dipakai saat catat angsuran (bunga dipisah dari pokok).
  function updateOnlineLoanEstimate() {
    const hint = $('acc-loan-tenor-hint');
    if (!hint) return;
    const type = $('acc-type-input').value;
    const adminHint = $('acc-loan-admin-hint');
    const instHint = $('acc-loan-installment-hint');
    const autoBtn = $('acc-loan-installment-auto-btn');
    if (!TYPE_LOAN[type]) {
      hint.textContent = ''; adminHint.style.display = 'none'; adminHint.textContent = '';
      instHint.textContent = ''; autoBtn.style.display = 'none';
      return;
    }
    const f = readOnlineLoanForm();
    const instEl = $('acc-loan-installment-input');

    // Biaya admin: persen -> Rupiah (cuma ada di form pinjol; f.adminPct selalu 0 untuk pinjaman bank)
    if (f.adminPct > 0 && f.pokok > 0) {
      adminHint.textContent = 'Biaya admin ' + f.adminPct + '% = ' + formatRp(Math.round(f.pokok * f.adminPct / 100)) +
        (f.adminMode === 'cicil' ? ', dibagi rata ke ' + (f.tenor > 0 ? f.tenor + ' angsuran' : 'tiap angsuran (isi tenor)') + '.' : ', dipotong dari pencairan.');
      adminHint.style.display = 'block';
    } else if (f.adminPct > 0) {
      adminHint.textContent = 'Isi pokok pinjaman untuk melihat nominal biaya admin.';
      adminHint.style.display = 'block';
    } else {
      adminHint.textContent = ''; adminHint.style.display = 'none';
    }

    // Angsuran otomatis: anuitas (PMT) untuk bunga menurun, atau pokok rata + bunga flat untuk bunga tetap.
    const canAuto = f.pokok > 0 && f.tenor > 0 && f.ratePerBulan > 0;
    const adminCicilPct = f.adminMode === 'cicil' ? f.adminPct : 0;
    const autoVal = canAuto
      ? (f.declining ? loanAnnuityPMT(f.pokok, f.ratePerBulan, f.tenor) : computeOnlineInstallment(f.pokok, f.tenor, f.ratePerBulan, f.insPct, adminCicilPct))
      : 0;
    if (!loanInstallmentManual) instEl.value = canAuto ? autoVal : '';
    const curVal = Math.round(parseFloat(instEl.value) || 0);
    if (canAuto) {
      let txt;
      if (f.declining) {
        const bunga1 = Math.round(f.pokok * f.ratePerBulan / 100);
        const pokok1 = Math.max(0, autoVal - bunga1);
        const total = autoVal * f.tenor;
        txt = 'Anuitas: angsuran tetap ' + formatRp(autoVal) + '/bulan selama ' + f.tenor + ' bulan. Bulan pertama: pokok ' + formatRp(pokok1) + ' + bunga ' + formatRp(bunga1) +
          '. Porsi bunga mengecil & porsi pokok membesar tiap bulan seiring sisa pokok berkurang. Total bayar ' + formatRp(total) + ' (bunga ' + formatRp(total - f.pokok) + ').';
      } else {
        const bungaBulan = Math.round(f.pokok * f.ratePerBulan / 100);
        const asuransiBulan = Math.round(f.pokok * f.insPct / 100);
        const adminBulan = adminCicilPct > 0 ? Math.round(f.pokok * adminCicilPct / 100 / f.tenor) : 0;
        const pokokBulan = Math.round(f.pokok / f.tenor);
        const total = autoVal * f.tenor;
        txt = 'Hitungan: pokok ' + formatRp(pokokBulan) + ' + bunga ' + formatRp(bungaBulan) +
          (adminBulan > 0 ? ' + admin ' + formatRp(adminBulan) : '') + (asuransiBulan > 0 ? ' + asuransi ' + formatRp(asuransiBulan) : '') +
          ' per bulan = ' + formatRp(autoVal) + '. Total bayar ' + formatRp(total) + ' (bunga & biaya ' + formatRp(total - f.pokok) + ').';
      }
      if (loanInstallmentManual && curVal !== autoVal) txt = 'Diisi manual ' + formatRp(curVal) + '. ' + txt;
      instHint.textContent = txt;
      autoBtn.style.display = (loanInstallmentManual && curVal !== autoVal) ? 'block' : 'none';
    } else {
      instHint.textContent = f.declining
        ? 'Isi pokok, tenor & suku bunga supaya angsuran (anuitas) terhitung otomatis. Atau isi angsuran langsung.'
        : 'Isi pokok, tenor, dan suku bunga supaya angsuran terhitung otomatis. Atau isi angsuran langsung.';
      autoBtn.style.display = 'none';
    }

    // Estimasi bunga efektif hanya bila bunga tidak diisi (angsuran manual) dan bukan anuitas — anuitas
    // sudah pasti bunganya dari suku bunga yang diisi, tidak perlu ditaksir. Info saja.
    if (canAuto || f.declining) { hint.textContent = ''; return; }
    if (f.pokok <= 0 || curVal <= 0 || f.tenor <= 0) { hint.textContent = ''; return; }
    const totalBayar = curVal * f.tenor;
    const bungaEfektifTotal = totalBayar - f.pokok;
    if (bungaEfektifTotal <= 0) { hint.textContent = 'Total angsuran (' + formatRp(totalBayar) + ') tidak lebih besar dari pokok — cek lagi angkanya.'; return; }
    const bungaPerBulan = bungaEfektifTotal / f.tenor;
    const persenPerBulan = (bungaPerBulan / f.pokok) * 100;
    hint.textContent = 'Estimasi: total bayar ' + formatRp(totalBayar) + ', bunga efektif ' + formatRp(bungaEfektifTotal) +
      ' (≈' + formatRp(Math.round(bungaPerBulan)) + '/bulan, ≈' + persenPerBulan.toFixed(1) + '%/bulan dari pokok). Info saja: tanpa bunga flat di atas, semua angsuran mengurangi sisa pinjaman.';
  }

  // Baris "catat pencairan": cuma relevan saat BIKIN akun pinjaman baru YANG BARU DICAIRKAN
  // (bukan edit akun lama, dan bukan pinjaman yang sudah berjalan/sudah dipakai sebagian —
  // buat kasus itu duitnya sudah lama cair & sudah kepakai, jadi tidak ada apa-apa yang perlu
  // dicatat masuk ke akun manapun sekarang).
  function updateLoanDisburseRow() {
    const row = $('acc-loan-disburse-row');
    if (!row) return;
    const type = $('acc-type-input').value;
    const isLoan = TYPE_LOAN[type];
    const stageEl = $('acc-loan-stage-input');
    const stage = stageEl ? stageEl.value : 'baru';
    const show = isLoan && !editingAccountId && stage === 'baru';
    row.style.display = show ? 'block' : 'none';
    if (!show) return;
    const sel = $('acc-loan-disburse-input');
    const data = loadData();
    const options = data.accounts.filter(a => !TYPE_DEBT[a.type] && a.type !== 'titipan');
    sel.innerHTML = '<option value="">— Jangan catat otomatis —</option>' +
      options.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  }

  function saveAccount() {
    const nameEl = $('acc-name-input');
    const typeEl = $('acc-type-input');
    const balEl = $('acc-balance-input');
    const limitEl = $('acc-limit-input');
    const feeAmountEl = $('acc-fee-amount-input');
    const feeDayEl = $('acc-fee-day-input');
    const interestEl = $('acc-interest-input');
    const loanTypeEl = $('acc-loan-type-input');
    const loanRateEl = $('acc-loan-rate-input');
    const loanRateUnitEl = $('acc-loan-rate-unit-input');
    const loanAdminEl = $('acc-loan-admin-input');
    const loanStampEl = $('acc-loan-stamp-input');
    const loanSavingsEl = $('acc-loan-savings-input');
    const loanInstallmentEl = $('acc-loan-installment-input');
    const loanTenorEl = $('acc-loan-tenor-input');
    const loanOriginalEl = $('acc-loan-original-input');
    const loanStageEl = $('acc-loan-stage-input');
    const loanDisburseEl = $('acc-loan-disburse-input');
    const name = nameEl.value.trim();
    const type = typeEl.value;
    const isDebt = TYPE_DEBT[type];
    const isLoan = TYPE_LOAN[type];
    const isOnlineLoan = type === 'pinjaman_online';
    const balVal = parseFloat(balEl.value) || 0;
    const limitVal = parseFloat(limitEl.value) || 0;
    const feeAmountVal = type === 'paylater' ? 0 : (parseFloat(feeAmountEl.value) || 0);
    const feeDayVal = Math.min(31, Math.max(0, parseInt(feeDayEl.value, 10) || 0));
    const feeTypeVal = $('acc-fee-type-input').value === 'percent' ? 'percent' : 'nominal';
    const feePeriodVal = $('acc-fee-period-input').value === 'tahunan' ? 'tahunan' : 'bulanan';
    const cardStmtVal = type === 'kartu_kredit' ? Math.min(31, Math.max(0, parseInt($('acc-card-stmt-input').value, 10) || 0)) : 0;
    const cardMinValueVal = type === 'kartu_kredit' ? (parseFloat($('acc-card-min-input').value) || 0) : 0;
    const cardMinTypeVal = $('acc-card-min-type-input').value === 'nominal' ? 'nominal' : 'percent';
    const isAsset = type === 'aset';
    const assetKindVal = isAsset ? $('acc-asset-kind-input').value : '';
    const assetQtyVal = isAsset ? Math.max(0, parseFloat($('acc-asset-qty-input').value) || 0) : 0;
    const assetUnitVal = isAsset ? normalizeAssetUnit($('acc-asset-unit-input').value) : '';
    const interestVal = type === 'paylater' ? 0 : Math.max(0, parseFloat(interestEl.value) || 0);
    const loanRateVal = Math.max(0, parseFloat(loanRateEl.value) || 0);
    const loanRateUnitVal = loanRateUnitEl.value === 'bulan' ? 'bulan' : 'tahun';
    const onlineForm = isOnlineLoan ? readOnlineLoanForm() : null;
    const loanAdminPctVal = isOnlineLoan ? onlineForm.adminPct : 0;
    let loanAdminVal = isOnlineLoan ? Math.round(onlineForm.pokok * loanAdminPctVal / 100) : Math.max(0, parseFloat(loanAdminEl.value) || 0);
    const loanAdminModeVal = (isOnlineLoan && onlineForm.adminMode === 'cicil' && loanAdminPctVal > 0) ? 'cicil' : 'cair';
    const loanInsuranceVal = isOnlineLoan ? onlineForm.insPct : 0;
    const loanStampVal = Math.max(0, parseFloat(loanStampEl.value) || 0);
    const loanSavingsVal = isOnlineLoan ? 0 : Math.max(0, parseFloat(loanSavingsEl.value) || 0);
    const loanInstallmentVal = Math.max(0, Math.round(parseFloat(loanInstallmentEl.value) || 0));
    const loanTenorVal = isLoan ? Math.max(0, Math.round(parseFloat(loanTenorEl.value) || 0)) : 0;
    const loanStartRaw = isLoan ? String($('acc-loan-start-input').value || '') : '';
    const loanStartVal = /^\d{4}-\d{2}-\d{2}$/.test(loanStartRaw) ? loanStartRaw : '';
    const loanDueDayVal = isLoan ? Math.min(31, Math.max(0, parseInt($('acc-loan-dueday-input').value, 10) || 0)) : 0;
    // Pokok awal cuma dibaca kalau barisnya tampil (kalau tersembunyi, nilai sisa di kolom itu sudah tidak berlaku).
    const loanOriginalVal = (isLoan && $('acc-loan-original-row').style.display !== 'none') ? Math.max(0, parseFloat(loanOriginalEl.value) || 0) : 0;
    // Stage cuma dibaca saat BIKIN akun baru (baris & selectnya disembunyikan/tidak berlaku pas edit).
    const loanStage = (isLoan && !editingAccountId) ? (loanStageEl.value === 'berjalan' ? 'berjalan' : 'baru') : 'baru';
    const loanDisburseId = (isLoan && !editingAccountId && loanStage === 'baru') ? (loanDisburseEl.value || '') : '';
    if (!name) { nameEl.focus(); return; }
    if (isOnlineLoan && loanInstallmentVal <= 0) { loanInstallmentEl.focus(); showIoMsg('Isi tenor dan bunga flat supaya angsuran terhitung otomatis, atau isi angsuran per bulan langsung.', 'error'); return; }
    const data = loadData();
    if (isOnlineLoan && editingAccountId) {
      // Persen admin tidak diubah -> pertahankan nominal Rp yang sudah tersimpan (hindari geser karena pembulatan / pokok awal kosong).
      const ex = data.accounts.find(a => a.id === editingAccountId);
      if (ex && ex.loanAdminFee && adminPctOf(ex) === loanAdminPctVal) loanAdminVal = ex.loanAdminFee;
    }
    const dup = data.accounts.find(a => a.id !== editingAccountId && a.name.toLowerCase() === name.toLowerCase());
    if (dup) { showIoMsg(`Nama "${dup.name}" sudah dipakai akun lain.`, 'error'); nameEl.focus(); return; }
    if (type === 'kartu_kredit' && cardStmtVal > 0 && feeDayVal <= 0) { feeDayEl.focus(); showIoMsg('Isi tanggal jatuh tempo juga kalau tanggal cetak tagihan diisi.', 'error'); return; }
    if (type === 'kartu_kredit' && cardMinValueVal > 0 && cardMinTypeVal === 'percent' && cardMinValueVal > 100) { $('acc-card-min-input').focus(); showIoMsg('Pembayaran minimum persen tidak boleh lebih dari 100%.', 'error'); return; }
    if (isDebt && !isLoan && limitVal <= 0) { limitEl.focus(); showIoMsg('Isi limit untuk kartu kredit / paylater.', 'error'); return; }
    if (isDebt && !isLoan && interestVal > 0 && feeDayVal <= 0) { feeDayEl.focus(); showIoMsg('Isi tanggal jatuh tempo untuk bisa menghitung bunga bulanan.', 'error'); return; }
    if (loanDisburseId && ((loanAdminModeVal === 'cicil' ? 0 : loanAdminVal) + loanStampVal) > Math.abs(balVal)) {
      loanAdminEl.focus();
      showIoMsg('Total biaya admin + materai tidak boleh lebih besar dari pokok pinjaman.', 'error');
      return;
    }
    if (isLoan && loanOriginalVal > 0 && loanOriginalVal < Math.abs(balVal)) {
      loanOriginalEl.focus();
      showIoMsg('Pokok awal tidak boleh lebih kecil dari sisa pokok sekarang.', 'error');
      return;
    }

    const initialBalance = isDebt ? -Math.abs(balVal) : balVal;

    if (editingAccountId) {
      const acc = data.accounts.find(a => a.id === editingAccountId);
      if (acc) {
        acc.name = name;
        acc.type = type;
        acc.initialBalance = initialBalance;
        delete acc.cardStatementDay; delete acc.cardMinType; delete acc.cardMinValue;
        delete acc.assetKind; delete acc.assetQty; delete acc.assetUnit;
        if (isAsset) {
          if (assetKindVal) acc.assetKind = assetKindVal;
          if (assetQtyVal > 0) acc.assetQty = assetQtyVal;
          if (assetUnitVal) acc.assetUnit = assetUnitVal;
        } else { delete acc.valuations; }
        if (isLoan) {
          delete acc.limit; delete acc.feeAmount; delete acc.feeDay; delete acc.lastFeeAppliedMonth; delete acc.interestPercent; delete acc.feeType; delete acc.feePeriod; delete acc.feeAnniversaryMonth;
          acc.loanInterestType = (!isOnlineLoan && loanTypeEl.value === 'menurun') ? 'menurun' : 'tetap';
          if (loanRateVal > 0) { acc.loanRatePercent = loanRateVal; acc.loanRateUnit = loanRateUnitVal; } else { delete acc.loanRatePercent; delete acc.loanRateUnit; }
          if (loanAdminVal > 0) acc.loanAdminFee = loanAdminVal; else delete acc.loanAdminFee;
          if (isOnlineLoan && loanAdminPctVal > 0) acc.loanAdminPercent = loanAdminPctVal; else delete acc.loanAdminPercent;
          if (loanAdminModeVal === 'cicil') acc.loanAdminMode = 'cicil'; else delete acc.loanAdminMode;
          if (loanInsuranceVal > 0) acc.loanInsurancePercent = loanInsuranceVal; else delete acc.loanInsurancePercent;
          if (loanStampVal > 0) acc.loanStampFee = loanStampVal; else delete acc.loanStampFee;
          if (loanSavingsVal > 0) acc.loanMandatorySavings = loanSavingsVal; else delete acc.loanMandatorySavings;
          if (loanInstallmentVal > 0) acc.loanInstallment = loanInstallmentVal; else delete acc.loanInstallment;
          if (loanTenorVal > 0) acc.loanTenorMonths = loanTenorVal; else delete acc.loanTenorMonths;
          if (loanStartVal) acc.loanStartDate = loanStartVal; else delete acc.loanStartDate;
          if (loanDueDayVal > 0) acc.loanDueDay = loanDueDayVal; else delete acc.loanDueDay;
          if (loanOriginalVal > 0) acc.originalPrincipal = loanOriginalVal; else delete acc.originalPrincipal;
        } else if (isDebt) {
          acc.limit = limitVal;
          if (type === 'kartu_kredit') {
            if (cardStmtVal > 0) acc.cardStatementDay = cardStmtVal;
            if (cardMinValueVal > 0) { acc.cardMinType = cardMinTypeVal; acc.cardMinValue = cardMinValueVal; }
          }
          if (feeDayVal > 0) { acc.feeDay = feeDayVal; } else { delete acc.feeDay; delete acc.lastFeeAppliedMonth; delete acc.feeAnniversaryMonth; }
          if (feeAmountVal > 0 && feeDayVal > 0) {
            acc.feeAmount = feeAmountVal;
            acc.feeType = feeTypeVal;
            if (acc.feePeriod !== feePeriodVal) delete acc.feeAnniversaryMonth; // ganti periode -> hitung ulang titik tahunannya
            acc.feePeriod = feePeriodVal;
          } else { delete acc.feeAmount; delete acc.feeType; delete acc.feePeriod; delete acc.feeAnniversaryMonth; }
          if (interestVal > 0 && feeDayVal > 0) { acc.interestPercent = interestVal; }
          else { delete acc.interestPercent; }
          delete acc.loanInterestType; delete acc.loanRatePercent; delete acc.loanRateUnit; delete acc.loanAdminFee; delete acc.loanAdminPercent; delete acc.loanAdminMode; delete acc.loanInsurancePercent; delete acc.loanStampFee; delete acc.loanMandatorySavings; delete acc.loanInstallment; delete acc.loanTenorMonths; delete acc.originalPrincipal; delete acc.loanStartDate; delete acc.loanDueDay;
        } else {
          delete acc.limit; delete acc.feeAmount; delete acc.feeDay; delete acc.lastFeeAppliedMonth; delete acc.interestPercent; delete acc.feeType; delete acc.feePeriod; delete acc.feeAnniversaryMonth;
          delete acc.loanInterestType; delete acc.loanRatePercent; delete acc.loanRateUnit; delete acc.loanAdminFee; delete acc.loanAdminPercent; delete acc.loanAdminMode; delete acc.loanInsurancePercent; delete acc.loanStampFee; delete acc.loanMandatorySavings; delete acc.loanInstallment; delete acc.loanTenorMonths; delete acc.originalPrincipal; delete acc.loanStartDate; delete acc.loanDueDay;
        }
      }
    } else {
      const acc = { id: generateId('acc'), name, type, initialBalance };
      if (isAsset) {
        if (assetKindVal) acc.assetKind = assetKindVal;
        if (assetQtyVal > 0) acc.assetQty = assetQtyVal;
        if (assetUnitVal) acc.assetUnit = assetUnitVal;
      }
      if (isLoan) {
        acc.loanInterestType = (!isOnlineLoan && loanTypeEl.value === 'menurun') ? 'menurun' : 'tetap';
        if (loanRateVal > 0) { acc.loanRatePercent = loanRateVal; acc.loanRateUnit = loanRateUnitVal; }
        if (loanAdminVal > 0) acc.loanAdminFee = loanAdminVal;
        if (isOnlineLoan && loanAdminPctVal > 0) acc.loanAdminPercent = loanAdminPctVal;
        if (loanAdminModeVal === 'cicil') acc.loanAdminMode = 'cicil';
        if (loanInsuranceVal > 0) acc.loanInsurancePercent = loanInsuranceVal;
        if (loanStampVal > 0) acc.loanStampFee = loanStampVal;
        if (loanSavingsVal > 0) acc.loanMandatorySavings = loanSavingsVal;
        if (loanInstallmentVal > 0) acc.loanInstallment = loanInstallmentVal;
        if (loanTenorVal > 0) acc.loanTenorMonths = loanTenorVal;
        if (loanStartVal) acc.loanStartDate = loanStartVal;
        if (loanDueDayVal > 0) acc.loanDueDay = loanDueDayVal;
        if (loanOriginalVal > 0) acc.originalPrincipal = loanOriginalVal;
      } else if (isDebt) {
        acc.limit = limitVal;
        if (type === 'kartu_kredit') {
          if (cardStmtVal > 0) acc.cardStatementDay = cardStmtVal;
          if (cardMinValueVal > 0) { acc.cardMinType = cardMinTypeVal; acc.cardMinValue = cardMinValueVal; }
        }
        if (feeDayVal > 0) { acc.feeDay = feeDayVal; }
        if (feeAmountVal > 0 && feeDayVal > 0) { acc.feeAmount = feeAmountVal; acc.feeType = feeTypeVal; acc.feePeriod = feePeriodVal; }
        if (interestVal > 0 && feeDayVal > 0) { acc.interestPercent = interestVal; }
      }
      data.accounts.push(acc);

      // Catat pencairan pinjaman: pokok penuh masuk ke akun tujuan, lalu biaya admin + materai
      // langsung keluar dari akun yang sama — jadi saldo bersih yang kamu terima sudah otomatis
      // terpotong, dan kedua biaya itu ikut kehitung sebagai pengeluaran di laporan (bukan cuma info mati).
      if (isLoan && loanDisburseId) {
        const destAcc = data.accounts.find(a => a.id === loanDisburseId);
        const pokok = Math.abs(balVal);
        if (destAcc && pokok > 0) {
          const today = todayStr();
          data.txns.push({
            id: generateId('txn'), date: today, type: 'masuk',
            desc: 'Pencairan pinjaman ' + name, amount: pokok, accountId: destAcc.id, loanId: acc.id
          });
          // Kategori sengaja dibedakan dari 'Bunga & biaya bank' (dipakai computeLoanInterestDue untuk
          // menghitung bunga bulanan yang sudah dibayar) supaya biaya admin/materai di awal ini TIDAK
          // ketukar/keitung sebagai bunga sudah dibayar bulan ini.
          if (loanAdminVal > 0 && loanAdminModeVal !== 'cicil') {
            data.txns.push({
              id: generateId('txn'), date: today, type: 'keluar',
              desc: 'Biaya admin/provisi ' + name, amount: loanAdminVal, accountId: destAcc.id,
              category: 'Biaya admin & materai pinjaman', loanId: acc.id
            });
          }
          if (loanStampVal > 0) {
            data.txns.push({
              id: generateId('txn'), date: today, type: 'keluar',
              desc: 'Biaya materai ' + name, amount: loanStampVal, accountId: destAcc.id,
              category: 'Biaya admin & materai pinjaman', loanId: acc.id
            });
          }
        }
      }
    }

    saveData(data);
    editingAccountId = null;
    $('acc-form').classList.remove('open');
    render();
  }

  async function deleteAccount(id) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    const relatedCount = data.txns.filter(t => t.accountId === id || t.toAccountId === id || t.loanId === id).length;

    // Akun titipan/piutang: hapus beserta riwayat transaksinya (konsisten dengan tab Titipan).
    if (acc.type === 'titipan') {
      const msg = relatedCount > 0
        ? `Hapus "${acc.name}" beserta ${relatedCount} riwayat titipannya? Tindakan ini tidak bisa dibatalkan.`
        : `Hapus "${acc.name}"?`;
      const ok = await showConfirm(msg);
      if (!ok) return;
      data.txns = data.txns.filter(t => t.accountId !== id && t.toAccountId !== id);
      data.accounts = data.accounts.filter(a => a.id !== id);
      saveData(data);
      render();
      return;
    }

    // Akun keuangan biasa: jangan sampai riwayat transaksi asli ikut terhapus tanpa sadar.
    if (relatedCount > 0) { showIoMsg(`Akun ini masih punya ${relatedCount} transaksi, hapus transaksinya dulu.`, 'error'); return; }
    if (data.accounts.length <= 1) { showIoMsg('Minimal harus ada satu akun.', 'error'); return; }
    const ok = await showConfirm(`Hapus akun "${acc.name}"?`);
    if (!ok) return;
    data.accounts = data.accounts.filter(a => a.id !== id);
    saveData(data);
    render();
  }

  let detailAccountId = null;

  function openAccountDetail(id) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    detailAccountId = id;

    const bal = accountBalance(data, id);
    const isDebt = TYPE_DEBT[acc.type];
    const colorVar = TYPE_COLOR_VAR[acc.type] || '--teal';
    let valueText, color, metaExtra = '', pct = 0, barColor = colorVar;

    if (isDebt) {
      const limit = acc.limit || 0;
      const used = acc.type === 'paylater' ? paylaterCreditUsed(data, acc, bal) : (bal < 0 ? Math.abs(bal) : 0);
      const overpaid = bal > 0 ? bal : 0;
      const sisa = limit - used;
      pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      const remD = TYPE_LOAN[acc.type] ? computeLoanRemaining(data, acc, bal) : null;
      const usedD = remD ? remD.total : used;
      valueText = overpaid > 0 ? 'Lebih bayar ' + formatRp(overpaid) : (TYPE_LOAN[acc.type] ? (usedD > 0 ? 'Sisa hutang ' + formatRp(usedD) : 'Lunas') : 'Terpakai ' + formatRp(used));
      color = usedD > 0 ? 'var(--red)' : 'var(--ink)';
      metaExtra = limit > 0 ? ' · Sisa limit ' + formatRp(sisa) : '';
      if (remD && remD.flat && usedD > 0) metaExtra += ' · Sisa pokok ' + formatRp(remD.sisaPokok) + ' + bunga ' + formatRp(remD.sisaBunga);
      if (acc.interestPercent && acc.type !== 'paylater') metaExtra += ' · Bunga ' + acc.interestPercent + '%/bln jika belum lunas';
      metaExtra += feeAdminMetaText(acc);
      metaExtra += cardSchemeMetaText(acc);
      metaExtra += assetMetaText(acc);
      if (acc.type === 'paylater') metaExtra += paylaterMetaExtra(data, acc);
      if (acc.loanRatePercent) metaExtra += ' · Bunga ' + acc.loanRatePercent + (acc.loanRateUnit === 'bulan' ? '%/bln (' : '%/thn (') + (acc.loanInterestType === 'menurun' ? 'menurun' : 'tetap') + ')';
      if (acc.type === 'pinjaman_online' && acc.loanInstallment && acc.loanTenorMonths) {
        const totalBayar = acc.loanInstallment * acc.loanTenorMonths;
        const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
        const bungaEfektifTotal = totalBayar - pokokAwal;
        if (bungaEfektifTotal > 0 && pokokAwal > 0) {
          const persenPerBulan = (bungaEfektifTotal / acc.loanTenorMonths / pokokAwal) * 100;
          metaExtra += ' · Estimasi bunga efektif ≈' + persenPerBulan.toFixed(1) + '%/bln';
        }
      }
      if (TYPE_LOAN[acc.type] && ((acc.loanAdminFee || 0) > 0 || (acc.loanStampFee || 0) > 0) && acc.loanAdminMode !== 'cicil') {
        const feeBits = [];
        if (acc.loanAdminFee) feeBits.push('admin ' + formatRp(acc.loanAdminFee) + (acc.loanAdminPercent ? ' (' + acc.loanAdminPercent + '%)' : ''));
        if (acc.loanStampFee) feeBits.push('materai ' + formatRp(acc.loanStampFee));
        metaExtra += ' · Biaya awal: ' + feeBits.join(' + ');
      } else if (TYPE_LOAN[acc.type] && (acc.loanStampFee || 0) > 0) {
        metaExtra += ' · Biaya awal: materai ' + formatRp(acc.loanStampFee);
      }
      if (acc.type === 'pinjaman_online' && acc.loanAdminMode === 'cicil' && acc.loanAdminFee) metaExtra += ' · Admin ' + formatRp(acc.loanAdminFee) + (acc.loanAdminPercent ? ' (' + acc.loanAdminPercent + '%)' : '') + ' dicicil';
      if (acc.type === 'pinjaman_online' && (acc.loanInsurancePercent || 0) > 0) metaExtra += ' · Asuransi ' + acc.loanInsurancePercent + '%/bln (' + formatRp(Math.round(Math.abs(acc.originalPrincipal || acc.initialBalance || 0) * acc.loanInsurancePercent / 100)) + '/bln)';
      barColor = pct >= 90 ? '--red' : (pct >= 70 ? '--amber' : colorVar);
    } else if (acc.type === 'titipan') {
      if (bal > 0) { valueText = 'Berutang ' + formatRp(bal); color = 'var(--red)'; }
      else if (bal < 0) { valueText = 'Lebih ' + formatRp(Math.abs(bal)); color = 'var(--green)'; }
      else { valueText = 'Lunas'; color = 'var(--ink-soft)'; }
    } else {
      valueText = formatRp(bal);
      color = bal < 0 ? 'var(--red)' : 'var(--ink)';
      metaExtra += assetMetaText(acc);
    }

    // Jadwal angsuran (pinjaman bunga flat bertenor)
    const schedEl = $('acc-detail-schedule');
    if (schedEl) {
      const sch = TYPE_LOAN[acc.type] ? computeLoanSchedule(data, acc, bal) : null;
      if (sch) {
        metaExtra += ' · Angsuran ' + sch.paid + '/' + sch.tenor;
        const icon = { lunas: '✓', telat: '!', belum: '○' };
        const colr = { lunas: 'var(--green)', telat: 'var(--red)', belum: 'var(--ink-soft)' };
        const nextNo = sch.next ? sch.next.no : 0;
        schedEl.style.display = 'block';
        schedEl.innerHTML = '<details' + (sch.paid < sch.tenor ? ' open' : '') + '><summary class="section-title" style="cursor:pointer; margin-bottom:8px;">Jadwal angsuran (' + sch.paid + '/' + sch.tenor + ')</summary>' +
          sch.rows.map(r => `
            <div class="txn-row" style="${r.no === nextNo ? 'background:var(--teal-soft); border-radius:10px;' : ''}">
              <div class="txn-left">
                <span style="color:${colr[r.status]}; font-weight:700; width:16px; text-align:center;">${icon[r.status]}</span>
                <div class="txn-text">
                  <div class="txn-desc">Ke-${r.no} · ${escapeHtml(fmtTgl(r.due))}${r.status === 'telat' ? ' · lewat jatuh tempo' : ''}</div>
                  <div class="txn-meta">Pokok ${formatRp(r.pokok)} + ${loanMonthlyFees(acc) > 0 ? 'bunga & biaya' : 'bunga'} ${formatRp(r.bunga)} · sisa pokok ${formatRp(r.sisa)}</div>
                </div>
              </div>
              <div class="txn-right"><span class="txn-amount" style="color:${colr[r.status]};">${formatRp(r.total)}</span></div>
            </div>`).join('') + '</details>';
      } else if (TYPE_LOAN[acc.type] && (acc.loanTenorMonths || 0) > 0) {
        schedEl.style.display = 'block';
        schedEl.innerHTML = '<div class="acc-sub">Isi tanggal pencairan di Edit akun untuk melihat jadwal angsuran & pengingat jatuh tempo.</div>';
      } else if (acc.type === 'kartu_kredit' && cardStatementInfo(data, acc, todayStr())) {
        const ci = cardStatementInfo(data, acc, todayStr());
        const usedNow = bal < 0 ? Math.abs(bal) : 0;
        const newCharges = Math.max(0, Math.round((usedNow - ci.remaining) * 100) / 100);
        const late = ci.remaining > 0 && ci.dueDate < todayStr();
        const rows = [
          ['Cetak terakhir · ' + fmtTgl(ci.statementDate), formatRp(ci.statement), 'var(--ink)'],
          ['Sudah dibayar sejak cetak', formatRp(ci.paid), 'var(--green)'],
          ['Sisa tagihan cetak · jatuh tempo ' + fmtTgl(ci.dueDate) + (late ? ' (lewat)' : ''), formatRp(ci.remaining), ci.remaining > 0 ? 'var(--red)' : 'var(--green)'],
          ['Minimum yang masih harus dibayar', formatRp(ci.minRemaining), 'var(--ink)'],
          ['Belanja setelah cetak (masuk tagihan berikutnya)', formatRp(newCharges), 'var(--ink-soft)'],
          ['Cetak berikutnya', fmtTgl(ci.nextStatement), 'var(--ink-soft)']
        ];
        schedEl.style.display = 'block';
        schedEl.innerHTML = '<div class="section-title" style="margin-bottom:8px;">Tagihan kartu</div>' + rows.map(r => `
          <div class="txn-row">
            <div class="txn-left"><div class="txn-text"><div class="txn-desc">${escapeHtml(r[0])}</div></div></div>
            <div class="txn-right"><span class="txn-amount" style="color:${r[2]};">${r[1]}</span></div>
          </div>`).join('');
      } else if (acc.type === 'kartu_kredit' && acc.feeDay) {
        schedEl.style.display = 'block';
        schedEl.innerHTML = '<div class="acc-sub">Isi tanggal cetak tagihan di Edit akun supaya tagihan cetak dipisah dari belanja baru.</div>';
      } else {
        schedEl.style.display = 'none'; schedEl.innerHTML = '';
      }
    }

    $('acc-detail-name').textContent = acc.name;
    $('acc-detail-type').textContent = TYPE_LABELS[acc.type] + metaExtra;
    const amtEl = $('acc-detail-amount');
    amtEl.textContent = valueText;
    amtEl.style.color = color;

    const barWrap = $('acc-detail-bar-wrap');
    const barLabel = $('acc-detail-bar-label');
    const loanProg = TYPE_LOAN[acc.type] ? computeLoanProgress(acc, bal) : null;
    if (loanProg) {
      // Pinjaman: bar = persen pokok yang sudah terbayar (bukan pemakaian limit).
      barWrap.style.display = 'block';
      barWrap.style.marginBottom = '6px';
      const fill = $('acc-detail-bar-fill');
      fill.style.width = loanProg.pct + '%';
      fill.style.background = 'var(--green)';
      barLabel.style.display = 'block';
      barLabel.textContent = loanProg.pct + '% terbayar · ' + formatRp(loanProg.terbayar) + ' dari ' + formatRp(loanProg.pokokAwal) + (loanProg.sisa > 0 ? ' · sisa pokok ' + formatRp(loanProg.sisa) : ' · lunas');
    } else if (isDebt && (acc.limit || 0) > 0) {
      barWrap.style.display = 'block';
      barWrap.style.marginBottom = '16px';
      barLabel.style.display = 'none';
      const fill = $('acc-detail-bar-fill');
      fill.style.width = pct + '%';
      fill.style.background = `var(${barColor})`;
    } else {
      barWrap.style.display = 'none';
      barLabel.style.display = 'none';
    }

    renderAssetPanel(data, acc, bal);

    // Tombol bayar tagihan kartu kredit
    const payEl = $('acc-detail-pay');
    if (payEl) {
      const opts = acc.type === 'kartu_kredit' ? cardPayOptions(data, acc, bal) : null;
      if (opts) {
        const q = (k) => `payCardFromDetail('${acc.id}','${k}')`;
        let html = '<div class="section-title" style="margin-bottom:8px;">Bayar tagihan</div>';
        if (opts.note) html += `<div class="acc-sub" style="margin-bottom:8px;">${escapeHtml(opts.note)}</div>`;
        html += `<div class="acc-form-actions" style="margin-bottom:8px;"><button type="button" class="submit-btn" onclick="${q(opts.primary.kind)}">${escapeHtml(opts.primary.text)} — ${formatRp(opts.primary.amount)}</button></div>`;
        if (opts.others.length) {
          html += '<div class="acc-form-actions">' + opts.others.map(o => `<button type="button" class="io-btn" onclick="${q(o.kind)}">${escapeHtml(o.text)} — ${formatRp(o.amount)}</button>`).join('') + '</div>';
        }
        payEl.style.display = 'block';
        payEl.innerHTML = html;
      } else {
        payEl.style.display = 'none'; payEl.innerHTML = '';
      }
    }

    const loanPayWrap = $('acc-detail-loan-pay');
    if (TYPE_LOAN[acc.type] && bal < 0) {
      loanPayWrap.style.display = 'block';
      const sourceSel = $('loan-pay-source-input');
      const sourceOptions = data.accounts.filter(a => a.id !== id && !TYPE_DEBT[a.type] && a.type !== 'titipan');
      sourceSel.innerHTML = sourceOptions.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      $('loan-pay-amount-input').value = '';
      const dateEl = $('loan-pay-date-input');
      if (dateEl) { dateEl.value = todayStr(); dateEl.max = todayStr(); }
      // Pinjaman online: angsuran sudah gabungan pokok+bunga, jadi opsi "bayar bunga saja" tidak relevan.
      const bungaOption = document.querySelector('#loan-pay-mode-input option[value="bunga"]');
      if (bungaOption) bungaOption.style.display = acc.type === 'pinjaman_online' ? 'none' : '';
      $('loan-pay-mode-input').value = 'pokok_bunga';
      onLoanPayModeChange();
    } else {
      loanPayWrap.style.display = 'none';
    }

    const plansWrap = $('acc-detail-plans');
    const plans = acc.type === 'paylater' && Array.isArray(acc.plans) ? acc.plans : [];
    if (plans.length > 0) {
      plansWrap.style.display = 'block';
      const feeSum = paylaterFeeSummary(data, acc);
      const feeSummaryHtml = feeSum.feeAllTime > 0 ? `
          <div class="acc-sub" style="margin-bottom:10px; line-height:1.6;">
            Sisa bunga belum jatuh tempo: <b>${formatRp(feeSum.feeRemaining)}</b><br>
            Bunga sudah terbayar: <b>${formatRp(feeSum.feePaidSoFar)}</b> dari total ${formatRp(feeSum.feeAllTime)} seumur cicilan<br>
            Rata-rata bunga: <b>${feeSum.feeAvgPct.toFixed(1)}%</b> dari pokok per cicilan
          </div>` : '';
      $('acc-detail-plans-list').innerHTML = feeSummaryHtml + plans.slice().sort((a, b) => b.date.localeCompare(a.date)).map(pl => {
        const sc = paylaterPlanSchedule(data, acc, pl);
        let jadwal, pct = 0;
        if (!sc) jadwal = 'Isi tanggal jatuh tempo di Edit akun untuk melihat jadwal';
        else {
          pct = Math.round((sc.k / sc.tenor) * 100);
          jadwal = sc.next
            ? 'Jadwal: cicilan ke-' + Math.min(sc.k + 1, sc.tenor) + ' dari ' + sc.tenor + ' · jatuh tempo berikutnya ' + formatDayLabel(sc.next)
            : 'Jadwal selesai · cicilan terakhir ' + formatDayLabel(sc.last);
        }
        return `
          <div class="txn-row">
            <div class="txn-left"><div class="txn-text">
              <div class="txn-desc">${escapeHtml(pl.desc)}</div>
              <div class="txn-meta">${formatRp(pl.monthly)}/bln × ${pl.tenor} bln · bunga flat ${pl.ratePercent}%/bln${pl.admin > 0 ? ' · admin ' + formatRp(pl.admin) : ''} · total ${formatRp(pl.total)}</div>
              <div class="txn-meta">${escapeHtml(jadwal)}</div>
              ${sc ? `<div class="acc-bar" style="margin-top:6px;"><div class="acc-bar-fill" style="width:${pct}%; background:var(--amber);"></div></div>` : ''}
            </div></div>
          </div>`;
      }).join('');
    } else {
      plansWrap.style.display = 'none';
    }

    const monthlyWrap = $('acc-detail-monthly');
    const monthlyGroups = acc.type === 'paylater' ? paylaterMonthlyBreakdown(data, acc, bal) : [];
    if (monthlyGroups.length > 0) {
      monthlyWrap.style.display = 'block';
      $('acc-detail-monthly-list').innerHTML = monthlyGroups.map((g, idx) => `
        <div class="txn-row">
          <div class="txn-left"><div class="txn-text">
            <div class="txn-desc">${escapeHtml(fmtBulanTahun(g.due))}</div>
            <div class="txn-meta">Jatuh tempo ${formatDayLabel(g.due)} · ${g.items.length} cicilan</div>
            <div class="txn-meta" style="color:var(--ink-soft);">${g.items.map(it => escapeHtml(it.desc) + ' (ke-' + it.no + '/' + it.tenor + ')').join(', ')}</div>
          </div></div>
          <div class="txn-right" style="text-align:right;">
            <div class="txn-amount" style="display:block; margin-bottom:6px;">${formatRp(g.total)}</div>
            <button type="button" class="mini-btn-like" style="border:1px solid var(--line); background:var(--card); color:var(--ink); font-size:11px; font-weight:700; padding:5px 9px; border-radius:8px; cursor:pointer;" onclick="payMonthFromDetail('${acc.id}', ${idx})">Bayar bulan ini</button>
          </div>
        </div>`).join('');
    } else {
      monthlyWrap.style.display = 'none';
    }

    const accById = {};
    data.accounts.forEach(a => accById[a.id] = a);
    const related = data.txns.filter(t => t.accountId === id || t.toAccountId === id || t.loanId === id);
    const indexed = related.map((t, i) => ({ t, i }));
    indexed.sort((a, b) => a.t.date !== b.t.date ? b.t.date.localeCompare(a.t.date) : b.i - a.i);

    const histEl = $('acc-detail-history');
    if (indexed.length === 0) {
      histEl.innerHTML = '<div class="empty">Belum ada transaksi.</div>';
    } else {
      histEl.innerHTML = indexed.map(({ t }) => {
        let metaText, descText, sign;
        if (t.type === 'transfer') {
          const otherId = t.accountId === id ? t.toAccountId : t.accountId;
          const otherName = accById[otherId] ? accById[otherId].name : '?';
          const increases = t.toAccountId === id;
          descText = (t.desc && t.desc !== 'Transfer') ? t.desc : 'Transfer';
          metaText = (increases ? 'dari ' : 'ke ') + otherName;
          sign = increases ? '+' : '−';
        } else if (t.loanId === id && t.accountId !== id) {
          // Pembayaran bunga pinjaman: uang keluar dari akun sumber, tidak mengubah sisa pokok.
          const srcName = accById[t.accountId] ? accById[t.accountId].name : '?';
          descText = t.desc;
          metaText = 'Bunga, dibayar dari ' + srcName + ' (pokok tidak berubah)';
          sign = '';
        } else {
          descText = t.desc;
          metaText = t.category || '';
          if (t.planId) metaText += (metaText ? ' · ' : '') + 'Cicilan'; else if (t.method === 'nanti') metaText += (metaText ? ' · ' : '') + 'Bayar nanti';
          sign = t.type === 'masuk' ? '+' : '−';
        }
        metaText += (metaText ? ' · ' : '') + formatDayLabel(t.date);
        return `
          <div class="txn-row clickable" onclick="openTxnDetail('${t.id}')">
            <div class="txn-left">
              <span class="dot ${t.type}"></span>
              <div class="txn-text">
                <div class="txn-desc">${escapeHtml(descText)}</div>
                <div class="txn-meta">${escapeHtml(metaText)}</div>
              </div>
            </div>
            <div class="txn-right">
              <span class="txn-amount ${t.type}">${sign} ${formatRp(t.amount)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    $('acc-detail').classList.add('open');
  }

  function closeAccountDetail() {
    $('acc-detail').classList.remove('open');
    detailAccountId = null;
  }

  // ---------- PANEL NILAI ASET (detail akun) ----------
  // Daftar assetKind baku (harus sinkron dengan opsi <select id="acc-asset-kind-input">) dan alias
  // satuan mata uang/kripto yang umum, supaya variasi penulisan dari file import atau input manual
  // (beda huruf besar-kecil) disamakan ke bentuk baku sebelum disimpan.
  const ASSET_KIND_OPTIONS = ['Emas', 'Kendaraan', 'Properti', 'Investasi', 'Forex', 'Kripto', 'Lainnya'];
  const ASSET_UNIT_ALIASES = { usd: 'USD', usdt: 'USDT', idr: 'IDR', eur: 'EUR', gbp: 'GBP', sgd: 'SGD', jpy: 'JPY', btc: 'BTC', eth: 'ETH' };
  function normalizeAssetKind(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const match = ASSET_KIND_OPTIONS.find(k => k.toLowerCase() === trimmed.toLowerCase());
    return (match || trimmed).slice(0, 40);
  }
  function normalizeAssetUnit(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const alias = ASSET_UNIT_ALIASES[trimmed.toLowerCase()];
    return (alias || trimmed).slice(0, 12);
  }
  function sanitizeValuations(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    arr.forEach(v => {
      if (!v || typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || typeof v.value !== 'number' || !isFinite(v.value) || seen.has(v.date)) return;
      seen.add(v.date);
      const e = { date: v.date, value: v.value };
      if (typeof v.price === 'number' && isFinite(v.price) && v.price >= 0) e.price = v.price;
      out.push(e);
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function copyAssetFields(src, dst) {
    if (dst.type !== 'aset') return;
    if (typeof src.assetKind === 'string') { const k = normalizeAssetKind(src.assetKind); if (k) dst.assetKind = k; }
    if (typeof src.assetQty === 'number' && src.assetQty > 0) dst.assetQty = src.assetQty;
    if (typeof src.assetUnit === 'string') { const u = normalizeAssetUnit(src.assetUnit); if (u) dst.assetUnit = u; }
    const vals = sanitizeValuations(src.valuations);
    if (vals.length) dst.valuations = vals;
  }

  function renderAssetPanel(data, acc, bal) {
    const wrap = $('acc-detail-asset');
    if (!wrap) return;
    if (acc.type !== 'aset') { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    let tin = 0, tout = 0;
    data.txns.forEach(t => {
      if (t.type !== 'transfer') return;
      if (t.toAccountId === acc.id) tin += t.amount;
      if (t.accountId === acc.id) tout += t.amount;
    });
    const modal = (acc.initialBalance || 0) + tin - tout;
    const pl = bal - modal;
    const qty = acc.assetQty > 0 ? acc.assetQty : 0;
    const unit = acc.assetUnit || 'satuan';
    const rows = [['Nilai sekarang', formatRp(bal), 'var(--ink)'], ['Modal (nilai awal + beli − jual)', formatRp(modal), 'var(--ink-soft)'],
      ['Selisih nilai vs modal', (pl >= 0 ? '+' : '−') + formatRp(Math.abs(pl)), pl >= 0 ? 'var(--green)' : 'var(--red)']];
    if (qty > 0) rows.push(['Harga per ' + unit + ' sekarang', formatRp(Math.round(bal / qty)), 'var(--ink-soft)']);
    $('asset-val-summary').innerHTML = rows.map(r => `
      <div class="txn-row">
        <div class="txn-left"><div class="txn-text"><div class="txn-desc txn-desc-wrap">${escapeHtml(r[0])}</div></div></div>
        <div class="txn-right"><span class="txn-amount" style="color:${r[2]};">${r[1]}</span></div>
      </div>`).join('') + (hasValuations(acc) ? '' : '<div class="acc-sub" style="margin-top:6px;">Belum pernah diperbarui: nilai = nilai awal + transaksi.</div>');
    const dateEl = $('asset-val-date-input');
    dateEl.value = todayStr(); dateEl.max = todayStr();
    $('asset-val-price-row').style.display = qty > 0 ? 'flex' : 'none';
    $('asset-val-price-input').placeholder = 'Harga per ' + unit + ' (Rp), jumlah ' + (Math.round(qty * 1000) / 1000).toLocaleString('id-ID');
    $('asset-val-price-input').value = '';
    $('asset-val-total-input').value = '';
    const vals = (acc.valuations || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    $('asset-val-history').innerHTML = vals.length ? vals.map(v => `
      <div class="txn-row">
        <div class="txn-left"><div class="txn-text"><div class="txn-desc">${escapeHtml(fmtTgl(v.date))}</div>${v.price > 0 ? `<div class="txn-meta">${formatRp(v.price)} per ${escapeHtml(unit)}</div>` : ''}</div></div>
        <div class="txn-right"><span class="txn-amount">${formatRp(v.value)}</span><button type="button" class="io-btn" style="padding:4px 10px;" onclick="deleteAssetValuation('${v.date}')" aria-label="Hapus penilaian ${escapeHtml(v.date)}">×</button></div>
      </div>`).join('') : '<div class="acc-sub">Belum ada riwayat.</div>';
  }
  function onAssetPriceInput() {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === detailAccountId);
    const price = parseFloat($('asset-val-price-input').value);
    if (acc && acc.assetQty > 0 && price >= 0) $('asset-val-total-input').value = Math.round(price * acc.assetQty * 100) / 100;
  }
  function saveAssetValuation() {
    const id = detailAccountId;
    const data = loadData();
    const acc = id && data.accounts.find(a => a.id === id);
    if (!acc || acc.type !== 'aset') return;
    const date = $('asset-val-date-input').value || todayStr();
    if (date > todayStr()) { showIoMsg('Tanggal penilaian tidak boleh di masa depan.', 'error', 'asset-val-msg'); return; }
    const totalStr = String($('asset-val-total-input').value).trim();
    const price = parseFloat($('asset-val-price-input').value);
    let total = totalStr !== '' ? parseFloat(totalStr) : (acc.assetQty > 0 && price >= 0 ? price * acc.assetQty : NaN);
    if (!isFinite(total)) { $('asset-val-total-input').focus(); showIoMsg('Isi nilai total (atau harga per satuan).', 'error', 'asset-val-msg'); return; }
    total = Math.round(total * 100) / 100;
    const entry = { date, value: total };
    if (acc.assetQty > 0) entry.price = price >= 0 && totalStr === '' ? price : Math.round((total / acc.assetQty) * 100) / 100;
    acc.valuations = (acc.valuations || []).filter(v => v.date !== date);
    acc.valuations.push(entry);
    acc.valuations.sort((a, b) => a.date.localeCompare(b.date));
    saveData(data);
    render();
    openAccountDetail(id);
    showIoMsg('Nilai ' + acc.name + ' diperbarui: ' + formatRp(total) + '.', 'ok', 'asset-val-msg');
  }
  async function deleteAssetValuation(date) {
    const id = detailAccountId;
    const data = loadData();
    const acc = id && data.accounts.find(a => a.id === id);
    if (!acc || !Array.isArray(acc.valuations)) return;
    const v = acc.valuations.find(x => x.date === date);
    if (!v) return;
    const ok = await showConfirm(`Hapus penilaian ${fmtTgl(date)} sebesar ${formatRp(v.value)}? Nilai aset kembali mengikuti penilaian sebelumnya.`);
    if (!ok) return;
    acc.valuations = acc.valuations.filter(x => x.date !== date);
    if (!acc.valuations.length) delete acc.valuations;
    saveData(data);
    render();
    openAccountDetail(id);
  }

  // ---------- BAYAR TAGIHAN KARTU KREDIT ----------
  // Pilihan pembayaran untuk satu kartu: tagihan cetak (sisa), minimum, atau seluruh hutang.
  // Return null kalau tidak ada hutang yang perlu dibayar.
  function cardPayOptions(data, acc, bal) {
    const used = bal < 0 ? Math.abs(bal) : 0;
    if (used <= 0) return null;
    const ci = cardStatementInfo(data, acc, todayStr());
    const full = { kind: 'full', text: 'Bayar penuh (seluruh hutang)', amount: used };
    if (ci && ci.remaining > 0) {
      const remaining = Math.min(used, ci.remaining);
      const others = [];
      const minPay = Math.min(remaining, ci.minRemaining);
      if (minPay > 0 && minPay < remaining) others.push({ kind: 'min', text: 'Minimal', amount: minPay });
      if (remaining < used) others.push(full);
      const late = ci.dueDate < todayStr();
      return { note: 'Jatuh tempo ' + fmtTgl(ci.dueDate) + (late ? ' (sudah lewat)' : '') + ' · tagihan cetak ' + fmtTgl(ci.statementDate), primary: { kind: 'tagihan', text: 'Bayar tagihan cetak', amount: remaining }, others };
    }
    if (ci) { // tagihan cetak sudah lunas, sisanya hanya belanja baru
      return { note: 'Tagihan cetak ' + fmtTgl(ci.statementDate) + ' sudah lunas. Sisa hutang = belanja setelah cetak.', primary: full, others: [] };
    }
    const minPay = cardMinPayOf(acc, used);
    return { note: '', primary: full, others: minPay > 0 && minPay < used ? [{ kind: 'min', text: 'Minimal', amount: minPay }] : [] };
  }

  // Tutup detail/daftar akun lalu buka form Transfer dengan kartu sebagai akun tujuan & nominal terisi.
  function payCardFromDetail(accId, kind) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === accId);
    if (!acc) return;
    const opts = cardPayOptions(data, acc, accountBalance(data, accId));
    if (!opts) return;
    const all = [opts.primary].concat(opts.others);
    const pick = all.find(o => o.kind === kind) || opts.primary;
    const labels = { tagihan: 'Bayar KK - Tagihan cetak', min: 'Bayar KK - Minimal', full: 'Bayar KK - Penuh' };
    closeAccountDetail();
    openAddTxnForm();
    setType('transfer');
    const toSel = $('to-account-select');
    if (Array.from(toSel.options).some(o => o.value === accId)) toSel.value = accId;
    updateQuickPayButtons();
    fillTransferAmount(pick.amount, labels[pick.kind] || 'Bayar KK');
    const form = $('txn-form');
    if (form && form.scrollIntoView) form.scrollIntoView({ block: 'start' });
  }

  // Tombol "Bayar" di kartu Jatuh tempo (Ringkasan). Tiap jenis akun memakai alur bayarnya sendiri:
  //  - kartu kredit : form Transfer, nominal tagihan cetak
  //  - PayLater     : form Transfer per bulan tagihan (periode cicilan ikut ditandai lunas)
  //  - pinjaman     : panel "Catat pembayaran" di detail akun, nominal angsuran terisi
  function payDueFromRingkasan(accId) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === accId);
    if (!acc) return;
    const balances = computeAllBalances(data);
    const due = computeUpcomingDues(data, balances, 100000).find(x => x.id === accId);
    if (acc.type === 'kartu_kredit') { payCardFromDetail(accId, 'tagihan'); return; }
    if (TYPE_LOAN[acc.type]) {
      openAccountDetail(accId);
      const amt = due ? Math.round(due.amount) : 0;
      const amountEl = $('loan-pay-amount-input');
      if (amt > 0 && amountEl) { amountEl.value = amt; updateLoanPaySplit(); }
      const wrap = $('acc-detail-loan-pay');
      if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ block: 'center' });
      return;
    }
    if (acc.type === 'paylater') {
      if (paylaterMonthlyBreakdown(data, acc, balances[accId] || 0).length > 0) { payMonthFromDetail(accId, 0); return; }
      if (!due || !(due.amount > 0)) { openAccountDetail(accId); return; }
      closeAccountDetail();
      openAddTxnForm();
      setType('transfer');
      const toSel = $('to-account-select');
      if (Array.from(toSel.options).some(o => o.value === accId)) toSel.value = accId;
      updateQuickPayButtons();
      fillTransferAmount(Math.round(due.amount), 'Bayar tagihan PayLater');
    }
  }

  // Tombol "Bayar bulan ini" di breakdown tagihan bulanan PayLater: tutup detail akun, buka form
  // transaksi Transfer dengan akun tujuan & nominal sudah terisi sesuai total tagihan bulan itu.
  function payMonthFromDetail(accId, groupIdx) {
    const data = loadData();
    const acc = data.accounts.find(a => a.id === accId);
    if (!acc) return;
    const balances = computeAllBalances(data);
    const bal = balances[accId] || 0;
    const groups = paylaterMonthlyBreakdown(data, acc, bal);
    const g = groups[groupIdx];
    if (!g) return;
    closeAccountDetail();
    openAddTxnForm();
    setType('transfer');
    const toSel = $('to-account-select');
    if (Array.from(toSel.options).some(o => o.value === accId)) toSel.value = accId;
    $('amount-input').value = g.total;
    updateQuickPayButtons(); // refresh tombol quick-pay untuk akun tujuan yang baru dipilih
    // Isi label & penanda pembayaran plan PALING TERAKHIR — updateQuickPayButtons() di atas mereset
    // state.pendingTransferLabel ke null, jadi urutan ini penting supaya labelnya tidak ketimpa.
    state.pendingTransferLabel = 'Bayar tagihan PayLater ' + fmtBulanTahun(g.due);
    // Tandai plan mana saja yang tercakup di tagihan bulan ini, DAN sampai periode ke berapa —
    // begitu transaksinya benar-benar disubmit, periode itu langsung dianggap lunas (tidak perlu
    // menunggu tanggal jatuh tempo lewat, penting untuk bayar lebih awal).
    const planIds = [];
    const planPaymentThrough = {};
    g.items.forEach(it => {
      if (!it.planId) return;
      if (!planIds.includes(it.planId)) planIds.push(it.planId);
      planPaymentThrough[it.planId] = Math.max(planPaymentThrough[it.planId] || 0, it.no);
    });
    state.pendingPlanPayment = { accId, planIds, planPaymentThrough };
    const catSel = $('category-select');
    if (catSel && [...catSel.options].some(o => o.value === 'Bayar tagihan/utang')) {
      catSel.value = 'Bayar tagihan/utang';
      onCategoryChange();
    }
  }

  // Bunga bulan ini yang MASIH harus dibayar = perkiraan bunga bulan ini dikurangi bunga yang
  // sudah dibayar bulan ini (supaya bayar bunga dua kali di bulan yang sama tidak terhitung dobel).
  function computeLoanInterestDue(data, acc, mode) {
    const monthly = computeLoanMonthlyInterest(data, acc);
    if (monthly <= 0) return 0;
    // Angsuran pinjaman bunga flat bertenor: TIAP angsuran memuat bunga sebulan penuh (bukan sekali per bulan
    // kalender), sampai total bunga kontrak habis. Jadi bayar beberapa angsuran di hari/bulan yang sama tetap
    // masing-masing kena bunga.
    if (mode === 'pokok_bunga') {
      const remF = computeLoanRemaining(data, acc);
      if (remF.flat) return Math.min(monthly, remF.sisaBunga);
    }
    const ym = todayStr().slice(0, 7);
    const paid = data.txns
      .filter(t => t.loanId === acc.id && t.type === 'keluar' && t.category === 'Bunga & biaya bank' && (t.date || '').slice(0, 7) === ym)
      .reduce((sum, t) => sum + t.amount, 0);
    let due = Math.max(0, monthly - paid);
    const rem = computeLoanRemaining(data, acc);
    if (rem.flat) due = Math.min(due, rem.sisaBunga);
    return due;
  }

  // Pecah nominal pembayaran: bunga terutang dilunasi dulu, sisanya baru mengurangi pokok.
  function splitLoanPayment(data, acc, nominal, mode) {
    const sisaPokok = Math.max(0, -accountBalance(data, acc.id));
    let bungaDue = computeLoanInterestDue(data, acc, mode);
    // Pinjaman flat bertenor dibayar per angsuran: kalau nominalnya cukup untuk beberapa angsuran sekaligus,
    // tiap angsuran memuat bunga sebulan penuh (mis. 3 angsuran = 3x bunga), bukan bunga satu bulan saja.
    if (mode === 'pokok_bunga') {
      const remF = computeLoanRemaining(data, acc);
      const tenor = acc.loanTenorMonths || 0;
      if (remF.flat && tenor > 0) {
        const monthly = computeLoanMonthlyInterest(data, acc);
        const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
        const perAngsuran = Math.floor(pokokAwal / tenor) + monthly;
        const k = perAngsuran > 0 ? Math.floor(nominal / perAngsuran) : 1;
        if (k > 1) bungaDue = Math.min(monthly * k, remF.sisaBunga);
      }
    }
    const bunga = Math.min(nominal, bungaDue);
    const pokok = Math.min(sisaPokok, Math.max(0, nominal - bunga));
    const kelebihan = Math.max(0, nominal - bunga - pokok);
    return { sisaPokok, bungaDue, bunga, pokok, kelebihan };
  }

  function onLoanPayModeChange() {
    const id = detailAccountId;
    if (!id) return;
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    const mode = $('loan-pay-mode-input').value;
    const isOnline = acc.type === 'pinjaman_online';
    const noRate = isOnline && !acc.loanRatePercent; // pinjol lama tanpa bunga flat: semua angsuran mengurangi sisa pinjaman
    const monthly = computeLoanMonthlyInterest(data, acc);
    const due = computeLoanInterestDue(data, acc, mode);
    const hint = $('loan-interest-hint');
    const amountEl = $('loan-pay-amount-input');
    const rateInfo = acc.loanRatePercent
      ? ' (' + (acc.loanInterestType === 'menurun' ? 'dari sisa pokok' : 'dari pokok awal') + ', ' + (acc.loanRateUnit === 'bulan' ? acc.loanRatePercent + '%/bln' : acc.loanRatePercent + '%/thn') + ')'
      : (isOnline ? '' : ' (suku bunga belum diisi di akun ini, jadi seluruh nominal dihitung sebagai pokok)');
    const bungaInfo = acc.loanRatePercent
      ? 'Bunga bulan ini ' + formatRp(monthly) + (monthly > due ? ', sudah dibayar ' + formatRp(monthly - due) + ', belum dibayar ' + formatRp(due) : '') + rateInfo + '. '
      : (isOnline ? '' : 'Bunga' + rateInfo + '. ');

    if (mode === 'bunga') {
      hint.textContent = bungaInfo + 'Semua nominal dianggap bunga, TIDAK mengurangi sisa pokok.';
      amountEl.value = due || '';
    } else if (mode === 'pokok_bunga') {
      const sisaPokok = Math.max(0, -accountBalance(data, id));
      const installment = acc.loanInstallment || 0;
      hint.textContent = bungaInfo + (installment > 0
        ? (noRate ? 'Nominal diisi otomatis dari angsuran tetap per bulan (bisa diubah); langsung mengurangi sisa pinjaman.' : 'Nominal diisi otomatis dari angsuran per bulan (bisa diubah). Bunga dilunasi dulu, sisanya mengurangi pokok.')
        : (noRate ? 'Isi angsuran tetap per bulan.' : 'Isi TOTAL angsuran. Bunga dilunasi dulu, sisanya mengurangi pokok. Angsuran pertama yang dicatat diingat untuk bulan berikutnya.'));
      amountEl.value = installment > 0 ? Math.min(installment, sisaPokok + due) : '';
    } else {
      hint.textContent = bungaInfo + (noRate ? 'Nominal bebas: langsung mengurangi sisa pinjaman.' : 'Nominal bebas: bunga yang belum dibayar bulan ini dilunasi dulu, sisanya langsung mengurangi pokok.');
      amountEl.value = '';
    }
    updateLoanPaySplit();
  }

  // Rincian otomatis: berapa bunga, berapa pokok, dan sisa hutang setelah pembayaran ini.
  function updateLoanPaySplit() {
    const el = $('loan-pay-split');
    if (!el) return;
    const id = detailAccountId;
    const data = loadData();
    const acc = id && data.accounts.find(a => a.id === id);
    if (!acc) { el.textContent = ''; return; }
    const mode = $('loan-pay-mode-input').value;
    const nominal = Math.round(parseFloat($('loan-pay-amount-input').value) || 0);
    if (nominal <= 0) { el.textContent = ''; return; }
    const rem = computeLoanRemaining(data, acc);
    if (mode === 'bunga') {
      el.textContent = 'Bunga ' + formatRp(nominal) + ' · Sisa hutang jadi ' + formatRp(Math.max(0, rem.total - (rem.flat ? Math.min(nominal, rem.sisaBunga) : 0)));
      return;
    }
    const r = splitLoanPayment(data, acc, nominal, mode);
    el.textContent = (r.bunga > 0 ? 'Bunga ' + formatRp(r.bunga) + ' + ' : '') + 'Pokok ' + formatRp(r.pokok) +
      ' → sisa hutang jadi ' + formatRp(Math.max(0, rem.total - r.pokok - (rem.flat ? r.bunga : 0))) +
      (r.kelebihan > 0 ? ' · Kelebihan ' + formatRp(r.kelebihan) + ' tidak dicatat' : '');
  }

  async function submitLoanPayment() {
    const id = detailAccountId;
    if (!id) return;
    const data = loadData();
    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;
    const mode = $('loan-pay-mode-input').value;
    const sourceId = $('loan-pay-source-input').value;
    const sourceAcc = data.accounts.find(a => a.id === sourceId);
    const nominal = Math.round(parseFloat($('loan-pay-amount-input').value) || 0);
    if (!sourceId || !sourceAcc) { showIoMsg('Tidak ada akun sumber untuk membayar.', 'error', 'loan-pay-msg'); return; }
    if (nominal <= 0) { $('loan-pay-amount-input').focus(); showIoMsg('Isi nominal pembayaran.', 'error', 'loan-pay-msg'); return; }
    const payDate = $('loan-pay-date-input').value || todayStr();
    if (payDate > todayStr()) { $('loan-pay-date-input').focus(); showIoMsg('Tanggal pembayaran tidak boleh di masa depan.', 'error', 'loan-pay-msg'); return; }

    const today = payDate;
    const remP = computeLoanRemaining(data, acc);
    let confirmMsg, bunga = 0, pokok = 0, sisaPokok = remP.total;
    if (mode === 'bunga') {
      bunga = nominal;
      confirmMsg = `Catat bayar bunga ${acc.name} sebesar ${formatRp(nominal)} dari ${sourceAcc.name}?\n(Sisa hutang jadi ${formatRp(Math.max(0, sisaPokok - (remP.flat ? Math.min(nominal, remP.sisaBunga) : 0)))})`;
    } else {
      // 'pokok_bunga' (angsuran) dan 'nominal' (bebas): bunga terutang dilunasi dulu, sisanya ke pokok.
      const r = splitLoanPayment(data, acc, nominal, mode);
      bunga = r.bunga; pokok = r.pokok;
      const total = bunga + pokok;
      confirmMsg = `Catat ${mode === 'pokok_bunga' ? 'angsuran' : 'pembayaran'} ${acc.name} ${formatRp(total)} dari ${sourceAcc.name}?\n(Bunga ${formatRp(bunga)} + Pokok ${formatRp(pokok)})\nSisa hutang jadi ${formatRp(Math.max(0, sisaPokok - pokok - (remP.flat ? bunga : 0)))}` +
        (r.kelebihan > 0 ? `\nKelebihan ${formatRp(r.kelebihan)} tidak dicatat.` : '');
      if (total <= 0) { showIoMsg('Tidak ada yang perlu dibayar (bunga sudah lunas dan sisa hutang 0).', 'error', 'loan-pay-msg'); return; }
    }
    if (payDate !== todayStr()) confirmMsg += `\nTanggal: ${fmtTgl(payDate)}`;
    const ok = await showConfirm(confirmMsg);
    if (!ok) return;

    if (bunga > 0) {
      data.txns.push({
        id: generateId('txn'), date: today, type: 'keluar',
        desc: 'Bunga pinjaman ' + acc.name, amount: bunga, accountId: sourceId, category: 'Bunga & biaya bank', loanId: id
      });
    }
    if (pokok > 0) {
      data.txns.push({
        id: generateId('txn'), date: today, type: 'transfer',
        desc: (mode === 'pokok_bunga' ? 'Angsuran pokok ' : 'Bayar pokok ') + acc.name, amount: pokok, accountId: sourceId, toAccountId: id
      });
    }
    // Ingat total angsuran pertama sebagai default bulan berikutnya (bisa diubah di Edit akun).
    if (mode === 'pokok_bunga' && !acc.loanInstallment && pokok > 0) acc.loanInstallment = bunga + pokok;

    saveData(data);
    render();
    openAccountDetail(id);
    showIoMsg(mode === 'bunga'
      ? 'Bunga dicatat. Sisa pokok tidak berubah (ini hanya bunga).'
      : 'Dicatat: bunga ' + formatRp(bunga) + ', pokok ' + formatRp(pokok) + '. Sisa hutang ' + formatRp(Math.max(0, sisaPokok - pokok - (remP.flat ? bunga : 0))) + '.', 'ok', 'loan-pay-msg');
  }

  function editAccountFromDetail() {
    const id = detailAccountId;
    if (!id) return;
    closeAccountDetail();
    startEditAccount(id);
  }

  async function deleteAccountFromDetail() {
    const id = detailAccountId;
    if (!id) return;
    await deleteAccount(id);
    const data = loadData();
    if (!data.accounts.find(a => a.id === id)) closeAccountDetail();
  }

  async function addTxn() {
    const descEl = $('desc-input');
    const amtEl = $('amount-input');
    const accSel = $('account-select');
    const toSel = $('to-account-select');
    const catSel = $('category-select');
    const catCustomEl = $('category-custom-input');
    const dateEl = $('date-input');
    const amount = parseFloat(amtEl.value);

    if (!amount || amount <= 0) { amtEl.focus(); return; }

    let category = catSel.value;
    if (category === CATEGORY_CUSTOM) {
      const custom = catCustomEl.value.trim();
      if (!custom) { catCustomEl.focus(); showIoMsg('Isi nama kategorinya dulu.', 'error'); return; }
      category = custom;
    }

    const date = dateEl.value || todayStr();
    const data = loadData();
    const accName = (id) => { const a = data.accounts.find(x => x.id === id); return a ? a.name : '?'; };
    const isEditing = !!state.editingTxnId;

    if (state.currentType === 'transfer') {
      if (accSel.value === toSel.value) { showIoMsg('Akun asal dan tujuan harus beda.', 'error'); return; }
      const transferDesc = state.pendingTransferLabel || 'Transfer';
      const confirmMsg = isEditing
        ? `Simpan perubahan: ${transferDesc}\n${formatRp(amount)} dari ${accName(accSel.value)} ke ${accName(toSel.value)}, ${formatDayLabel(date)}?`
        : `${transferDesc}: ${formatRp(amount)}\ndari ${accName(accSel.value)} ke ${accName(toSel.value)}?`;
      const ok = await showConfirm(confirmMsg);
      if (!ok) return;
      if (isEditing) {
        const t = data.txns.find(x => x.id === state.editingTxnId);
        if (t) Object.assign(t, { date, type: 'transfer', desc: transferDesc, amount, accountId: accSel.value, toAccountId: toSel.value, category });
      } else {
        const newTransfer = {
          id: generateId('txn'), date, type: 'transfer',
          desc: transferDesc, amount, accountId: accSel.value, toAccountId: toSel.value, category
        };
        // Kalau transfer ini memang dari tombol "Bayar bulan ini" dan akun tujuannya cocok, tandai
        // plan-plan yang terbayar supaya periode cicilannya langsung dianggap lunas.
        if (state.pendingPlanPayment && state.pendingPlanPayment.accId === toSel.value && state.pendingPlanPayment.planIds.length) {
          newTransfer.planPaymentIds = state.pendingPlanPayment.planIds;
          newTransfer.planPaymentThrough = state.pendingPlanPayment.planPaymentThrough;
        }
        data.txns.push(newTransfer);
      }
      state.pendingTransferLabel = null;
      state.pendingPlanPayment = null;
    } else {
      const desc = descEl.value.trim();
      if (!desc) { descEl.focus(); return; }
      const label = state.currentType === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
      const payAcc = data.accounts.find(a => a.id === accSel.value);
      const isPaylaterNew = !isEditing && state.currentType === 'keluar' && payAcc && payAcc.type === 'paylater';
      if (isPaylaterNew && $('paylater-method').value === 'cicilan') {
        // Cicilan PayLater: pokok + bunga flat + admin, dicatat di transaksi DAN di akun (rencana cicilan).
        const { tenor, rate, admin } = readPaylaterCicilanInput();
        if (tenor < 1 || tenor > 60) { $('paylater-tenor').focus(); showIoMsg('Isi tenor 1 sampai 60 bulan.', 'error'); return; }
        const c = computeFlatCicilan(Math.round(amount), tenor, rate, admin);
        const cicMsg = `Cicilan PayLater: ${desc}\n${formatRp(c.pokok)} — ${tenor} bulan, bunga flat ${rate}%/bln\nCicilan ${formatRp(c.monthly)}/bln · Bunga total ${formatRp(c.bunga)}` +
          (admin > 0 ? ` · Admin ${formatRp(admin)}` : '') + `\nTotal tagihan ${formatRp(c.total)} (masuk ke sisa hutang ${payAcc.name})\n\nTambahkan?`;
        const okCic = await showConfirm(cicMsg);
        if (!okCic) return;
        const planId = generateId('plan');
        const base = { date, type: 'keluar', accountId: accSel.value, planId, method: 'cicilan' };
        data.txns.push({ id: generateId('txn'), ...base, desc, amount: c.pokok, category });
        if (c.bunga > 0) data.txns.push({ id: generateId('txn'), ...base, desc: 'Bunga cicilan: ' + desc, amount: c.bunga, category: 'Bunga & biaya bank' });
        if (admin > 0) data.txns.push({ id: generateId('txn'), ...base, desc: 'Admin cicilan: ' + desc, amount: admin, category: 'Bunga & biaya bank' });
        if (!Array.isArray(payAcc.plans)) payAcc.plans = [];
        payAcc.plans.push({ id: planId, desc, date, pokok: c.pokok, tenor, ratePercent: rate, bunga: c.bunga, admin, monthly: c.monthly, total: c.total });
        descEl.value = '';
        amtEl.value = ''; catCustomEl.value = '';
        $('paylater-tenor').value = ''; $('paylater-rate').value = ''; $('paylater-admin').value = ''; $('paylater-method').value = 'nanti';
        saveData(data);
        render();
        closeTxnForm();
        return;
      }
      const confirmMsg = isEditing
        ? `Simpan perubahan: ${label} "${desc}"\n${formatRp(amount)} — ${accName(accSel.value)}, ${formatDayLabel(date)}?`
        : `${label}: ${desc}\n${formatRp(amount)} — ${accName(accSel.value)}\n\nTambahkan transaksi ini?`;
      const ok = await showConfirm(confirmMsg);
      if (!ok) return;
      if (isEditing) {
        const t = data.txns.find(x => x.id === state.editingTxnId);
        if (t) Object.assign(t, { date, type: state.currentType, desc, amount, accountId: accSel.value, category });
      } else {
        const newTxn = { id: generateId('txn'), date, type: state.currentType, desc, amount, accountId: accSel.value, category };
        if (isPaylaterNew) newTxn.method = 'nanti'; // Bayar nanti: bunga 0%
        data.txns.push(newTxn);
      }
      descEl.value = '';
    }
    amtEl.value = '';
    catCustomEl.value = '';
    saveData(data);
    render();
    if (isEditing) showIoMsg('Transaksi diperbarui.', 'ok');
    closeTxnForm();
  }


