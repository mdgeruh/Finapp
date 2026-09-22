  // ============================================================
  // TAB LAPORAN: filter periode & breakdown
  // ============================================================
  function dateToStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function setLaporanPeriod(p) {
    state.laporanPeriod = p;
    document.querySelectorAll('#laporan-period-row .type-btn').forEach(b => b.classList.toggle('active', b.dataset.laporanPeriod === p));
    $('laporan-custom-row').style.display = p === 'custom' ? 'flex' : 'none';
    $('laporan-date-nav').style.display = (p === 'custom' || p === 'alltime') ? 'none' : 'flex';
    renderLaporan();
  }

  function shiftLaporanPeriod(dir) {
    const d = new Date(state.laporanRefDate);
    if (state.laporanPeriod === 'harian') d.setDate(d.getDate() + dir);
    else if (state.laporanPeriod === 'mingguan') d.setDate(d.getDate() + dir * 7);
    else if (state.laporanPeriod === 'bulanan') d.setMonth(d.getMonth() + dir);
    else if (state.laporanPeriod === '3bulan') d.setMonth(d.getMonth() + dir * 3);
    else if (state.laporanPeriod === '1tahun') d.setFullYear(d.getFullYear() + dir);
    state.laporanRefDate = d;
    renderLaporan();
  }

  // Baris lipat (Saran, Rincian utang, dst) yang sedang tertutup tidak ikut tercetak, jadi dibuka dulu
  // selama proses cetak/Export PDF lalu dikembalikan seperti semula.
  (function () {
    let opened = [];
    window.addEventListener('beforeprint', () => {
      opened = Array.from(document.querySelectorAll('#laporan-extra details:not([open])'));
      opened.forEach(d => { d.open = true; });
    });
    window.addEventListener('afterprint', () => { opened.forEach(d => { d.open = false; }); opened = []; });
  })();

  function exportLaporanPdf() {
    const label = $('laporan-period-label')?.textContent || '';
    const prevTitle = document.title;
    document.title = 'Laporan Keuangan' + (label ? ' - ' + label : '');
    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
  }

  function onLaporanCustomChange() {
    state.laporanCustomStart = $('laporan-custom-start').value || null;
    state.laporanCustomEnd = $('laporan-custom-end').value || null;
    renderLaporan();
  }

  function getLaporanRange(data) {
    if (state.laporanPeriod === 'custom') {
      const s = state.laporanCustomStart || todayStr();
      const e = state.laporanCustomEnd || s;
      return e < s ? { start: e, end: s } : { start: s, end: e };
    }
    if (state.laporanPeriod === 'alltime') {
      const txns = (data && data.txns) || [];
      if (txns.length === 0) { const t = todayStr(); return { start: t, end: t }; }
      const dates = txns.map(t => t.date).sort();
      return { start: dates[0], end: dates[dates.length - 1] };
    }
    const d = state.laporanRefDate;
    if (state.laporanPeriod === 'harian') {
      const s = dateToStr(d);
      return { start: s, end: s };
    }
    if (state.laporanPeriod === 'mingguan') {
      const day = d.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return { start: dateToStr(monday), end: dateToStr(sunday) };
    }
    if (state.laporanPeriod === 'bulanan') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start: dateToStr(first), end: dateToStr(last) };
    }
    if (state.laporanPeriod === '3bulan') {
      const first = new Date(d.getFullYear(), d.getMonth() - 2, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start: dateToStr(first), end: dateToStr(last) };
    }
    // 1tahun
    const first = new Date(d.getFullYear(), 0, 1);
    const last = new Date(d.getFullYear(), 11, 31);
    return { start: dateToStr(first), end: dateToStr(last) };
  }

  function laporanPeriodLabel(range) {
    if (state.laporanPeriod === 'harian') return formatDayLabel(range.start);
    if (state.laporanPeriod === 'mingguan') return dayShortLabel(range.start) + ' – ' + dayShortLabel(range.end);
    if (state.laporanPeriod === 'bulanan') {
      const [y, m] = range.start.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    if (state.laporanPeriod === '3bulan') {
      const [ys, ms] = range.start.split('-').map(Number);
      const [ye, me] = range.end.split('-').map(Number);
      const startLabel = new Date(ys, ms - 1, 1).toLocaleDateString('id-ID', { month: 'short' });
      const endLabel = new Date(ye, me - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      return startLabel + ' – ' + endLabel;
    }
    if (state.laporanPeriod === '1tahun') {
      const [y] = range.start.split('-').map(Number);
      return String(y);
    }
    if (state.laporanPeriod === 'alltime') {
      return 'Semua Waktu (' + dayShortLabel(range.start) + ' – ' + dayShortLabel(range.end) + ')';
    }
    return dayShortLabel(range.start) + ' – ' + dayShortLabel(range.end);
  }

  function renderLaporanFilters(data) {
    const accRow = $('laporan-acc-filter-row');
    accRow.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = 'chip' + (state.laporanAccFilter === 'all' ? ' active' : '');
    allChip.textContent = 'Semua akun';
    allChip.onclick = () => { state.laporanAccFilter = 'all'; renderLaporan(); };
    accRow.appendChild(allChip);
    data.accounts.forEach(acc => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.laporanAccFilter === acc.id ? ' active' : '');
      chip.textContent = acc.name;
      chip.onclick = () => { state.laporanAccFilter = acc.id; renderLaporan(); };
      accRow.appendChild(chip);
    });

    const catsMasuk = Array.from(new Set(data.txns.filter(t => t.type === 'masuk' && !isDebtFlowTxn(t)).map(t => t.category || 'Tanpa kategori')));
    const catMasukRow = $('laporan-cat-masuk-row');
    catMasukRow.innerHTML = '';
    const allMasukChip = document.createElement('button');
    allMasukChip.className = 'chip' + (state.laporanCatMasukFilter === 'all' ? ' active' : '');
    allMasukChip.textContent = 'Semua';
    allMasukChip.onclick = () => { state.laporanCatMasukFilter = 'all'; renderLaporan(); };
    catMasukRow.appendChild(allMasukChip);
    catsMasuk.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.laporanCatMasukFilter === cat ? ' active' : '');
      chip.textContent = cat;
      chip.onclick = () => { state.laporanCatMasukFilter = cat; renderLaporan(); };
      catMasukRow.appendChild(chip);
    });

    const catsKeluar = Array.from(new Set(data.txns.filter(t => t.type === 'keluar' && !isDebtFlowTxn(t)).map(t => t.category || 'Tanpa kategori')));
    const catKeluarRow = $('laporan-cat-keluar-row');
    catKeluarRow.innerHTML = '';
    const allKeluarChip = document.createElement('button');
    allKeluarChip.className = 'chip' + (state.laporanCatKeluarFilter === 'all' ? ' active' : '');
    allKeluarChip.textContent = 'Semua';
    allKeluarChip.onclick = () => { state.laporanCatKeluarFilter = 'all'; renderLaporan(); };
    catKeluarRow.appendChild(allKeluarChip);
    catsKeluar.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (state.laporanCatKeluarFilter === cat ? ' active' : '');
      chip.textContent = cat;
      chip.onclick = () => { state.laporanCatKeluarFilter = cat; renderLaporan(); };
      catKeluarRow.appendChild(chip);
    });
  }

  function renderLaporanCatBreakdown(containerId, txns, total, colorVar) {
    const container = $(containerId);
    if (!container) return;
    if (txns.length === 0 || total <= 0) {
      container.innerHTML = '<div class="empty">Tidak ada transaksi di periode ini.</div>';
      return;
    }
    const sums = {};
    txns.forEach(t => {
      const key = t.category || 'Tanpa kategori';
      sums[key] = (sums[key] || 0) + t.amount;
    });
    const items = Object.entries(sums).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    container.innerHTML = items.map(item => {
      const pct = Math.round((item.amount / total) * 100);
      return `
        <div class="acc-card" style="min-width:0; width:100%; padding:9px 12px; margin-bottom:6px;">
          <div class="acc-top" style="justify-content:space-between; margin-bottom:0;">
            <span class="acc-name" style="margin-bottom:0;">${escapeHtml(item.category)}</span>
            <span class="acc-balance" style="color:var(${colorVar});">${formatRp(item.amount)} <span style="font-weight:500; color:var(--ink-soft); font-size:11.5px;">${pct}%</span></span>
          </div>
          <div class="acc-bar" style="margin-top:5px;"><div class="acc-bar-fill" style="width:${pct}%; background:var(${colorVar});"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderLaporanTrendChart(range, masukTxns, keluarTxns) {
    const svg = $('laporan-trend-chart');
    if (!svg) return;

    const days = [];
    const cursor = new Date(range.start + 'T00:00:00');
    const endDate = new Date(range.end + 'T00:00:00');
    while (cursor <= endDate && days.length < 366) {
      days.push(dateToStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (days.length === 0) days.push(range.start);

    const inByDay = {}, outByDay = {};
    days.forEach(d => { inByDay[d] = 0; outByDay[d] = 0; });
    masukTxns.forEach(t => { if (t.date in inByDay) inByDay[t.date] += t.amount; });
    keluarTxns.forEach(t => { if (t.date in outByDay) outByDay[t.date] += t.amount; });

    const inVals = days.map(d => inByDay[d]);
    const outVals = days.map(d => outByDay[d]);
    const maxVal = Math.max(1, ...inVals, ...outVals);

    const W = 320, H = 138;
    const padTop = 20, padBottom = 18, padSide = 4;
    const chartH = H - padTop - padBottom;
    const chartW = W - padSide * 2;
    const n = days.length;
    const stepX = chartW / (n - 1 || 1);
    const xAt = i => padSide + i * stepX;
    const yAt = v => padTop + chartH - (v / maxVal) * chartH;
    const baseY = padTop + chartH;

    const inXs = inVals.map((_, i) => xAt(i));
    const inYs = inVals.map(v => yAt(v));
    const outXs = outVals.map((_, i) => xAt(i));
    const outYs = outVals.map(v => yAt(v));
    const inLineD = smoothPathD(inXs, inYs);
    const outLineD = smoothPathD(outXs, outYs);
    const inAreaD = `${inLineD} L${inXs[inXs.length - 1].toFixed(2)},${baseY.toFixed(2)} L${inXs[0].toFixed(2)},${baseY.toFixed(2)} Z`;

    let svgContent = '';
    svgContent += `<line x1="${padSide}" y1="${baseY.toFixed(1)}" x2="${W - padSide}" y2="${baseY.toFixed(1)}" style="stroke:var(--line)" stroke-width="1" stroke-dasharray="3,3"></line>`;
    svgContent += `<path d="${inAreaD}" style="fill:var(--green); opacity:0.12"></path>`;
    svgContent += `<path d="${outLineD}" style="fill:none; stroke:var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`;
    svgContent += `<path d="${inLineD}" style="fill:none; stroke:var(--green)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`;

    const lastX = xAt(n - 1);

    // Tandai titik puncak (nilai tertinggi) tiap garis — bukan titik hari terakhir, karena
    // hari terakhir bisa saja belum ada transaksi (nilainya 0) meski hari lain di periode ini ada.
    const inPeakIdx = inVals.reduce((best, v, i) => (v > inVals[best] ? i : best), 0);
    const outPeakIdx = outVals.reduce((best, v, i) => (v > outVals[best] ? i : best), 0);
    const inPeakVal = inVals[inPeakIdx], outPeakVal = outVals[outPeakIdx];
    const inPeakX = xAt(inPeakIdx), inPeakY = yAt(inPeakVal);
    const outPeakX = xAt(outPeakIdx), outPeakY = yAt(outPeakVal);
    svgContent += `<circle cx="${inPeakX.toFixed(1)}" cy="${inPeakY.toFixed(1)}" r="3.5" style="fill:var(--green)"></circle>`;
    svgContent += `<circle cx="${outPeakX.toFixed(1)}" cy="${outPeakY.toFixed(1)}" r="3.5" style="fill:var(--red)"></circle>`;

    // Label nilai puncak, nempel di kurva (sama seperti kurva cashflow di Ringkasan).
    const anchorFor = x => (x < 40 ? 'start' : (x > W - 40 ? 'end' : 'middle'));
    let inLabelY = Math.max(inPeakY - 10, 11);
    let outLabelY = Math.max(outPeakY - 10, 11);
    if (Math.abs(inPeakX - outPeakX) < 34 && Math.abs(inLabelY - outLabelY) < 12) {
      if (inLabelY <= outLabelY) { outLabelY = inLabelY + 12; } else { inLabelY = outLabelY + 12; }
    }

    const labelIdx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
    svgContent += `<g id="laporan-trend-chart-perm-labels" style="transition:opacity 0.12s;">`;
    if (inPeakVal > 0) {
      svgContent += `<text x="${inPeakX.toFixed(1)}" y="${inLabelY.toFixed(1)}" text-anchor="${anchorFor(inPeakX)}" font-size="11" font-weight="600" style="fill:var(--green)" font-family="Inter, sans-serif">${formatRp(inPeakVal)}</text>`;
    }
    if (outPeakVal > 0) {
      svgContent += `<text x="${outPeakX.toFixed(1)}" y="${outLabelY.toFixed(1)}" text-anchor="${anchorFor(outPeakX)}" font-size="11" font-weight="600" style="fill:var(--red)" font-family="Inter, sans-serif">${formatRp(outPeakVal)}</text>`;
    }
    labelIdx.forEach(i => {
      const anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
      svgContent += `<text x="${xAt(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" font-size="9" style="fill:var(--ink-soft)" font-family="Inter, sans-serif">${dayShortLabel(days[i])}</text>`;
    });
    svgContent += `</g>`;
    svgContent += tooltipGroupSvgMulti('laporan-trend-chart', 2);

    svg.innerHTML = svgContent;
    chartGeom['laporan-trend-chart'] = {
      days, xAt, yAt, W, H, padTop, padBottom, padSide,
      series: [
        { label: 'Masuk', values: inVals, color: 'var(--green)' },
        { label: 'Keluar', values: outVals, color: 'var(--red)' }
      ],
      formatValue: v => formatRp(v),
      formatDate: dayShortLabel
    };
    bindChartInteraction('laporan-trend-chart');
  }

  function renderLaporan(data) {
    if (!data) data = loadData();
    const labelEl = $('laporan-period-label');
    if (!labelEl) return;

    const range = getLaporanRange(data);
    labelEl.textContent = laporanPeriodLabel(range);

    renderLaporanFilters(data);

    let txns = data.txns.filter(t => t.date >= range.start && t.date <= range.end);
    if (state.laporanAccFilter !== 'all') {
      txns = txns.filter(t => t.accountId === state.laporanAccFilter || t.toAccountId === state.laporanAccFilter);
    }

    // Sama dengan Ringkasan: bayar utang & pencairan pinjaman tidak dihitung sebagai pengeluaran/pemasukan.
    const masukTxns = txns.filter(t => t.type === 'masuk' && !isDebtFlowTxn(t) && (state.laporanCatMasukFilter === 'all' || (t.category || 'Tanpa kategori') === state.laporanCatMasukFilter));
    const keluarTxns = txns.filter(t => t.type === 'keluar' && !isDebtFlowTxn(t) && (state.laporanCatKeluarFilter === 'all' || (t.category || 'Tanpa kategori') === state.laporanCatKeluarFilter));

    const totalIn = masukTxns.reduce((s, t) => s + t.amount, 0);
    const totalOut = keluarTxns.reduce((s, t) => s + t.amount, 0);
    const net = totalIn - totalOut;

    $('laporan-total-in').textContent = formatRp(totalIn);
    $('laporan-total-out').textContent = formatRp(totalOut);
    const netEl = $('laporan-net');
    netEl.textContent = formatRp(net);
    netEl.style.color = net < 0 ? 'var(--red)' : 'var(--green)';
    const debtNoteEl = $('laporan-debt-note');
    if (debtNoteEl) {
      const fl = debtFlowsOf(data, txns);
      const bits = [];
      if (fl.paid > 0) bits.push('bayar utang & cicilan ' + formatRp(fl.paid));
      if (fl.disbursed > 0) bits.push('pencairan pinjaman ' + formatRp(fl.disbursed));
      debtNoteEl.style.display = bits.length ? 'block' : 'none';
      debtNoteEl.textContent = bits.length ? 'Tidak dihitung di atas: ' + bits.join(' · ') : '';
    }

    renderLaporanTrendChart(range, masukTxns, keluarTxns);
    renderLaporanCatBreakdown('laporan-cat-masuk-list', masukTxns, totalIn, '--green');
    renderLaporanCatBreakdown('laporan-cat-keluar-list', keluarTxns, totalOut, '--red');

    const biggestLabelEl = $('laporan-biggest-expense-label');
    const biggestAmountEl = $('laporan-biggest-expense-amount');
    if (keluarTxns.length > 0) {
      const biggest = keluarTxns.reduce((max, t) => t.amount > max.amount ? t : max, keluarTxns[0]);
      biggestLabelEl.textContent = 'Pengeluaran terbesar: ' + (biggest.desc || biggest.category || 'Transaksi');
      biggestAmountEl.textContent = formatRp(biggest.amount);
    } else {
      biggestLabelEl.textContent = 'Pengeluaran terbesar';
      biggestAmountEl.textContent = '—';
    }

    const dayCount = Math.max(1, Math.round((new Date(range.end + 'T00:00:00') - new Date(range.start + 'T00:00:00')) / 86400000) + 1);
    $('laporan-avg-daily-expense').textContent = formatRp(Math.round(totalOut / dayCount));

    renderLaporanExtra(data, range, dayCount, txns, masukTxns, keluarTxns, totalIn, totalOut);
  }


  // ---------- LAPORAN: RINCIAN UTANG & SARAN ----------
  // Rata-rata pemasukan per bulan (90 hari terakhir, tanpa pencairan pinjaman), dipakai buat rasio beban cicilan.
  // ---------- LAPORAN: cache sementara, helper kartu, dan baris ringkas ----------
  // Cache berlaku hanya selama SATU kali render Laporan (lapMemoScope): jadwal/sisa pinjaman, daftar jatuh tempo,
  // dan rata-rata pemasukan dipakai berulang oleh beberapa kartu. Di luar scope selalu dihitung ulang (aman).
  let _lapMemo = null;
  function lapMemoScope(fn) {
    if (_lapMemo) return fn();
    _lapMemo = { sched: new Map(), rem: new Map(), duesAll: null, income: undefined };
    try { return fn(); } finally { _lapMemo = null; }
  }
  function lapLoanSchedule(data, acc, bal) {
    if (!_lapMemo) return computeLoanSchedule(data, acc, bal);
    if (!_lapMemo.sched.has(acc.id)) _lapMemo.sched.set(acc.id, computeLoanSchedule(data, acc, bal));
    return _lapMemo.sched.get(acc.id);
  }
  function lapLoanRemaining(data, acc, bal) {
    if (!_lapMemo) return computeLoanRemaining(data, acc, bal);
    if (!_lapMemo.rem.has(acc.id)) _lapMemo.rem.set(acc.id, computeLoanRemaining(data, acc, bal));
    return _lapMemo.rem.get(acc.id);
  }
  // computeUpcomingDues hanya menyaring hasil akhirnya menurut jumlah hari (urutan tetap), jadi cukup dihitung sekali
  // untuk semua tanggal lalu disaring per kebutuhan (365 hari untuk Saran, 30/60 hari untuk Proyeksi kas).
  function lapUpcomingDues(data, balances, days) {
    if (!_lapMemo) return computeUpcomingDues(data, balances, days);
    if (!_lapMemo.duesAll) _lapMemo.duesAll = computeUpcomingDues(data, balances, Infinity);
    return _lapMemo.duesAll.filter(x => x.days <= days);
  }
  function lapRow(label, val, color) {
    return `<div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13px;"><span style="color:var(--ink-soft);">${label}</span><strong style="font-variant-numeric:tabular-nums; text-align:right;${color ? ' color:' + color + ';' : ''}">${val}</strong></div>`;
  }
  function lapCard(title, body) {
    return `<div class="chart-card" style="margin-top:10px;"><div class="section-title" style="margin-bottom:4px;">${title}</div>${body}</div>`;
  }
  // Baris ringkas seperti kartu Saran: titik status + judul (+ nilai di kanan) + petunjuk satu baris; kalau ada
  // `lines`, baris bisa diketuk untuk membuka detail. title = teks biasa (di-escape di sini); hint & lines = HTML yang sudah aman.
  const LAP_DOT = { red: 'var(--red)', amber: 'var(--amber)', ok: 'var(--green)', none: 'var(--ink-soft)' };
  function lapItem(o) {
    const dot = o.noDot ? '' : `<span style="flex:0 0 8px; width:8px; height:8px; margin-top:5px; border-radius:50%; background:${LAP_DOT[o.level || 'none']};"></span>`;
    const head = `<div style="display:flex; justify-content:space-between; gap:10px; font-size:13px;"><strong>${escapeHtml(o.title)}</strong>` +
      (o.right ? `<strong style="font-variant-numeric:tabular-nums; white-space:nowrap;${o.rightColor ? ' color:' + o.rightColor + ';' : ''}">${o.right}</strong>` : '') + '</div>' +
      (o.hint ? `<div class="acc-sub"${o.hintColor ? ` style="color:${o.hintColor};"` : ''}>${o.hint}</div>` : '');
    const lines = (o.lines || []).filter(Boolean);
    const chev = lines.length ? '<span class="adv-chev" style="color:var(--ink-soft); font-size:11px; margin-top:2px;">▾</span>' : '';
    const row = `<div style="display:flex; align-items:flex-start; gap:9px; padding:9px 0;">${dot}<div style="flex:1; min-width:0;">${head}</div>${chev}</div>`;
    if (!lines.length) return `<div style="border-bottom:1px solid var(--line);">${row}</div>`;
    return `<details class="adv-item" style="border-bottom:1px solid var(--line);"><summary>${row}</summary><div class="acc-sub" style="padding:0 0 10px ${o.noDot ? 0 : 17}px; line-height:1.5;">` +
      lines.map(l => `<div${l.color ? ` style="color:${l.color};"` : ''}>${l.text}</div>`).join('') + '</div></details>';
  }
  // Daftar panjang: tampilkan `show` baris pertama, sisanya di "Tampilkan N lagi".
  function lapMore(items, show) {
    const top = items.slice(0, show), rest = items.slice(show);
    return top.join('') + (rest.length ? `<details class="adv-more"><summary class="acc-sub" style="padding:8px 0; cursor:pointer;">Tampilkan ${rest.length} lagi</summary>${rest.join('')}</details>` : '');
  }
  function lapNote(text) { return `<div class="acc-sub" style="margin-top:8px; font-size:11px; line-height:1.45;">${text}</div>`; }

  function laporanMonthlyIncome(data) {
    if (_lapMemo && _lapMemo.income !== undefined) return _lapMemo.income;
    const v = laporanMonthlyIncomeCalc(data);
    if (_lapMemo) _lapMemo.income = v;
    return v;
  }
  function laporanMonthlyIncomeCalc(data) {
    const today = todayStr();
    const d0 = new Date(today + 'T00:00:00'); d0.setDate(d0.getDate() - 90);
    const from = d0.getFullYear() + '-' + padMonth(d0.getMonth() + 1) + '-' + padMonth(d0.getDate());
    const inc = data.txns.filter(t => t.type === 'masuk' && !isDebtFlowTxn(t) && t.date >= from && t.date <= today);
    if (!inc.length) return 0;
    const firstAny = data.txns.reduce((m, t) => (t.date && t.date < m) ? t.date : m, today);
    const startD = firstAny > from ? firstAny : from;
    const days = Math.round((new Date(today + 'T00:00:00') - new Date(startD + 'T00:00:00')) / 86400000) + 1;
    const months = Math.min(3, Math.max(1, days / 30));
    return inc.reduce((s2, t) => s2 + t.amount, 0) / months;
  }

  // Kumpulkan data utang per jenis (kartu kredit, PayLater, pinjol, pinjaman bank) + tagihan terdekat.
  function laporanDebtAnalysis(data, balances) {
    const today = todayStr();
    const dues = lapUpcomingDues(data, balances, 365);
    const dueById = {};
    dues.forEach(d => { if (!dueById[d.id] || d.days < dueById[d.id].days) dueById[d.id] = d; });
    const res = { cards: [], paylaters: [], online: [], bank: [], totalDebt: 0, due30: 0, dues, liquid: 0 };
    data.accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (!TYPE_DEBT[acc.type]) {
        if (acc.type === 'kas' || acc.type === 'bank' || acc.type === 'ewallet') res.liquid += Math.max(0, bal);
        return;
      }
      const used = bal < 0 ? Math.abs(bal) : 0;
      const due = dueById[acc.id] || null;
      if (acc.type === 'kartu_kredit') {
        if (used <= 0) return;
        const limit = acc.limit || 0;
        res.cards.push({ acc, used, limit, pct: limit > 0 ? Math.round(used / limit * 100) : null, ci: cardStatementInfo(data, acc, today), due, total: used });
      } else if (acc.type === 'paylater') {
        if (used <= 0) return;
        const limit = acc.limit || 0;
        const credit = paylaterCreditUsed(data, acc, bal);
        res.paylaters.push({ acc, used, credit, limit, pct: limit > 0 ? Math.round(credit / limit * 100) : null, due, total: used, meta: paylaterMetaExtra(data, acc).replace(/^ · /, '') });
      } else if (TYPE_LOAN[acc.type]) {
        const rem = lapLoanRemaining(data, acc, bal);
        if (rem.total <= 0) return;
        const sch = lapLoanSchedule(data, acc, bal);
        const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
        const monthlyCost = pokokAwal > 0 ? computeLoanMonthlyInterest(data, acc, bal) / pokokAwal * 100 : 0;
        const item = { acc, rem, sch, due, monthlyCost, effMonthly: loanEffectiveMonthlyRate(data, acc), total: rem.total };
        (acc.type === 'pinjaman_online' ? res.online : res.bank).push(item);
      }
    });
    [res.cards, res.paylaters, res.online, res.bank].forEach(g => g.forEach(x => { res.totalDebt += x.total; }));
    res.due30 = dues.filter(d => d.days <= 30).reduce((s2, d) => s2 + d.amount, 0);
    return res;
  }

  // Baris biaya pinjaman: bunga menurun dari sisa pokok; bunga flat dari pokok awal + bunga efektifnya
  // (kalau tenor diketahui), supaya tidak tertukar dengan pinjaman berbunga menurun.
  function costLine(a, c) {
    const feeNote = a.type === 'pinjaman_online' ? ' (bunga' + ((a.loanInsurancePercent || 0) > 0 || a.loanAdminMode === 'cicil' ? ' + biaya' : '') + ')' : '';
    if (a.loanInterestType === 'menurun') {
      return c.effMonthly > 0 ? { text: 'Bunga menurun ≈ ' + c.effMonthly.toFixed(2) + '%/bln dari sisa pokok' } : null;
    }
    if (!(c.monthlyCost > 0)) return null;
    let t = 'Bunga flat ≈ ' + c.monthlyCost.toFixed(2) + '%/bln dari pokok awal' + feeNote;
    if (c.effMonthly > 0) {
      const yr = (Math.pow(1 + c.effMonthly / 100, 12) - 1) * 100;
      t += ' · efektif ≈ ' + c.effMonthly.toFixed(2) + '%/bln (≈ ' + Math.round(yr) + '%/thn)';
    }
    return { text: t };
  }

  function laporanDebtDetailHtml(an, card, row) {
    if (an.totalDebt <= 0) return '';
    const head = (title, total) => `<div style="display:flex; justify-content:space-between; margin-top:10px; padding-bottom:2px; font-size:12px; font-weight:700; letter-spacing:.02em; color:var(--ink-soft); text-transform:uppercase;"><span>${title}</span><span>${formatRp(total)}</span></div>`;
    const dueLine = (d) => {
      if (!d) return null;
      const late = d.days < 0;
      return { text: escapeHtml(d.label) + ' · ' + formatRp(d.amount) + ' · jatuh tempo ' + escapeHtml(fmtTgl(d.due)) + (late ? ' (lewat ' + (-d.days) + ' hari)' : (d.days === 0 ? ' (hari ini)' : ' (' + d.days + ' hari lagi)')), color: late ? 'var(--red)' : '' };
    };
    // Petunjuk satu baris di bawah nama akun (detail lengkap ada di baris yang bisa dibuka)
    const dueShort = (d) => !d ? '' : (d.days < 0 ? 'lewat ' + (-d.days) + ' hari' : (d.days === 0 ? 'jatuh tempo hari ini' : 'jatuh tempo ' + escapeHtml(fmtTgl(d.due)) + ' (' + d.days + ' hari lagi)'));
    const pctColor = (pct) => pct === null ? '' : (pct >= 70 ? 'var(--red)' : (pct >= 30 ? 'var(--amber)' : 'var(--green)'));
    const levelOf = (pct, d) => ((d && d.days < 0) || (pct !== null && pct >= 70)) ? 'red' : (((pct !== null && pct >= 30) || (d && d.days <= 7)) ? 'amber' : 'ok');
    const hintOf = (parts, d) => ({ hint: parts.concat(dueShort(d) || []).filter(Boolean).join(' · '), hintColor: d && d.days < 0 ? 'var(--red)' : '' });
    let html = row('Total semua utang', formatRp(an.totalDebt), 'var(--red)') +
      row('Tagihan & angsuran 30 hari ke depan', formatRp(an.due30), an.due30 > 0 ? 'var(--red)' : '');

    if (an.cards.length) {
      html += head('Kartu kredit', an.cards.reduce((s2, c) => s2 + c.total, 0));
      html += an.cards.map(c => lapItem(Object.assign({
        title: c.acc.name, right: formatRp(c.used), rightColor: 'var(--red)', level: levelOf(c.pct, c.due),
        lines: [
          c.limit > 0 ? { text: 'Terpakai ' + c.pct + '% dari limit ' + formatRp(c.limit) + ' · sisa limit ' + formatRp(Math.max(0, c.limit - c.used)), color: pctColor(c.pct) } : null,
          c.ci ? { text: 'Tagihan cetak ' + escapeHtml(fmtTgl(c.ci.statementDate)) + ' ' + formatRp(c.ci.statement) + ' · belum dibayar ' + formatRp(c.ci.remaining) + (c.ci.remaining > 0 ? ' (minimum ' + formatRp(c.ci.minRemaining) + ')' : '') + (c.due ? ' · jatuh tempo ' + escapeHtml(fmtTgl(c.due.due)) + (c.due.days < 0 ? ' (lewat ' + (-c.due.days) + ' hari)' : ' (' + c.due.days + ' hari lagi)') : ''), color: (c.due && c.due.days < 0) ? 'var(--red)' : '' } : dueLine(c.due),
          c.acc.interestPercent ? { text: 'Bunga ' + c.acc.interestPercent + '%/bln kalau tidak lunas penuh ≈ ' + formatRp(Math.round(c.used * c.acc.interestPercent / 100)) + '/bln dari saldo sekarang' } : null
        ]
      }, hintOf([c.limit > 0 ? 'Limit ' + c.pct + '%' : ''], c.due)))).join('');
    }
    if (an.paylaters.length) {
      html += head('PayLater', an.paylaters.reduce((s2, c) => s2 + c.total, 0));
      html += an.paylaters.map(c => lapItem(Object.assign({
        title: c.acc.name, right: formatRp(c.used), rightColor: 'var(--red)', level: levelOf(c.pct, c.due),
        lines: [
          c.limit > 0 ? { text: 'Limit terpakai ' + formatRp(c.credit) + ' dari ' + formatRp(c.limit) + ' (' + c.pct + '%)', color: pctColor(c.pct) } : null,
          c.meta ? { text: escapeHtml(c.meta) } : null,
          dueLine(c.due)
        ]
      }, hintOf([c.limit > 0 ? 'Limit ' + c.pct + '%' : ''], c.due)))).join('');
    }
    if (an.online.length) {
      html += head('Pinjaman online', an.online.reduce((s2, c) => s2 + c.total, 0));
      html += an.online.map(c => loanBlock(c, dueLine, dueShort, hintOf, levelOf)).join('');
    }
    if (an.bank.length) {
      html += head('Pinjaman bank', an.bank.reduce((s2, c) => s2 + c.total, 0));
      html += an.bank.map(c => loanBlock(c, dueLine, dueShort, hintOf, levelOf)).join('');
    }
    return card('Rincian utang (saat ini)', html);
  }
  function loanBlock(c, dueLine, dueShort, hintOf, levelOf) {
    const a = c.acc;
    const sisaBiaya = c.rem.flat ? c.rem.sisaBunga : 0;
    const angs = c.sch ? 'Angsuran ' + c.sch.paid + '/' + c.sch.tenor : '';
    return lapItem(Object.assign({
      title: a.name, right: formatRp(c.total), rightColor: 'var(--red)', level: levelOf(null, c.due),
      lines: [
        { text: 'Sisa pokok ' + formatRp(c.rem.sisaPokok) + (sisaBiaya > 0 ? ' + bunga & biaya ' + formatRp(sisaBiaya) : '') },
        c.sch ? { text: 'Angsuran ' + c.sch.paid + '/' + c.sch.tenor + (c.sch.rows[0] ? ' · ' + formatRp(c.sch.rows[0].total) + '/bln' : '') } : (a.loanInstallment ? { text: 'Angsuran ' + formatRp(a.loanInstallment) + '/bln' } : null),
        dueLine(c.due),
        costLine(a, c)
      ]
    }, hintOf([angs], c.due)));
  }

  // Saran otomatis, dipadatkan: tiap saran satu baris judul (ketuk untuk detail), maksimal 3 tampil awal.
  // level: red (segera), amber (waspada), info, green (aman).
  function laporanAdviceHtml(data, an, ctx, card) {
    const items = [];
    const add = (level, title, detail) => items.push({ level, title, detail });
    const names = (arr) => arr.map(escapeHtml).join(', ');

    // Sudah lewat jatuh tempo
    const late = an.dues.filter(d => d.days < 0);
    if (late.length) {
      add('red', late.length + ' tagihan lewat jatuh tempo',
        late.map(d => escapeHtml(d.name) + ' ' + formatRp(d.amount) + ' (lewat ' + (-d.days) + ' hari)').join('<br>') + '<br>Bayar ini paling dulu supaya denda dan catatan kredit (SLIK) tidak makin buruk.');
    }
    // Dana likuid vs tagihan 30 hari
    if (an.due30 > 0 && an.liquid < an.due30) {
      add('red', 'Dana 30 hari kurang ' + formatRp(an.due30 - an.liquid),
        'Saldo kas, bank, dan e-wallet ' + formatRp(an.liquid) + ', tagihan 30 hari ke depan ' + formatRp(an.due30) + '. Sisihkan dulu sebelum belanja lain. Lihat urutannya di Proyeksi kas.');
    }
    // Beban cicilan vs pemasukan
    const inc = laporanMonthlyIncome(data);
    if (an.due30 > 0 && inc > 0) {
      const r = Math.round(an.due30 / inc * 100);
      const det = 'Tagihan & angsuran 30 hari ' + formatRp(an.due30) + ' dibanding rata-rata pemasukan bulanan ± ' + formatRp(Math.round(inc)) + '. Batas sehat umumnya di bawah 30–35%.';
      if (r >= 50) add('red', 'Cicilan ' + r + '% dari pemasukan', det + ' Hindari utang baru dan cari yang bisa dipercepat atau dinegosiasikan.');
      else if (r > 35) add('amber', 'Cicilan ' + r + '% dari pemasukan', det + ' Tahan dulu utang baru.');
    } else if (an.due30 > 0 && inc <= 0) {
      add('info', 'Rasio cicilan belum bisa dihitung', 'Belum ada pemasukan tercatat 90 hari terakhir. Catat pemasukan supaya analisis akurat.');
    }
    // Limit kartu / PayLater
    const hi = an.cards.concat(an.paylaters).filter(c => c.pct !== null && c.pct >= 30).sort((x, y) => y.pct - x.pct);
    if (hi.length) {
      const worst = hi[0].pct;
      add(worst >= 70 ? 'red' : 'amber', 'Limit tinggi: ' + hi.slice(0, 2).map(c => escapeHtml(c.acc.name) + ' ' + c.pct + '%').join(', ') + (hi.length > 2 ? ' +' + (hi.length - 2) : ''),
        hi.map(c => escapeHtml(c.acc.name) + ' terpakai ' + c.pct + '% dari limit').join('<br>') + '<br>Idealnya di bawah 30%; di atas 70% berisiko dan menekan skor kredit. Bayar lebih sebelum tanggal cetak tagihan dan tahan belanja baru.');
    }
    // Pinjol berbiaya tinggi
    const costly = an.online.filter(c => c.monthlyCost >= 2).sort((x, y) => y.monthlyCost - x.monthlyCost);
    if (costly.length) {
      const c0 = costly[0];
      add('amber', costly.length === 1 ? escapeHtml(c0.acc.name) + ' ≈ ' + c0.monthlyCost.toFixed(1) + '%/bln' : costly.length + ' pinjol berbiaya tinggi (≈' + c0.monthlyCost.toFixed(1) + '%/bln)',
        costly.map(c => escapeHtml(c.acc.name) + ': ≈ ' + c.monthlyCost.toFixed(1) + '%/bln (≈ ' + Math.round(c.monthlyCost * 12) + '%/thn dari pokok awal)').join('<br>') +
        '<br>Tergolong mahal. Jangan perpanjang atau ambil pinjol baru untuk menutup tagihan lain.' +
        (costly.some(c => c.rem.flat && c.rem.sisaBunga > 0) ? '<br>Bunga flat sudah terkunci di angsuran, jadi melunasi lebih awal biasanya tidak mengurangi total bunga kecuali ada diskon pelunasan dipercepat. Cek dulu di aplikasinya.' : ''));
    }
    // Arus kas & beban bunga periode terpilih
    if (ctx.totalIn > 0 && ctx.totalOut > ctx.totalIn) {
      add('amber', 'Pengeluaran melebihi pemasukan ' + formatRp(ctx.totalOut - ctx.totalIn), 'Di periode yang dipilih. Kalau berulang, saldo menipis dan utang bisa bertambah.');
    }
    if (ctx.totalIn > 0 && ctx.bungaPaid > 0) {
      const r = Math.round(ctx.bungaPaid / ctx.totalIn * 100);
      if (r >= 10) add('amber', 'Bunga & biaya ' + r + '% dari pemasukan', 'Bunga & biaya yang dibayar periode ini ' + formatRp(ctx.bungaPaid) + ' tidak mengurangi pokok. Prioritaskan mengurangi utang berbunga.');
    }
    // Prioritas dana ekstra
    const cand = [];
    an.cards.forEach(c => { if (c.acc.interestPercent > 0) cand.push({ name: c.acc.name, rate: c.acc.interestPercent }); });
    an.bank.forEach(c => { if (c.acc.loanInterestType === 'menurun' && c.acc.loanRatePercent > 0) cand.push({ name: c.acc.name, rate: c.acc.loanRateUnit === 'bulan' ? c.acc.loanRatePercent : c.acc.loanRatePercent / 12 }); });
    if (cand.length) {
      cand.sort((x, y) => y.rate - x.rate);
      add('info', 'Dana ekstra: dahulukan ' + escapeHtml(cand[0].name), 'Bunga ' + (Math.round(cand[0].rate * 100) / 100) + '%/bln, tertinggi yang bisa turun kalau dilunasi. Bandingkan skenarionya di Simulasi pelunasan.');
    }
    // Aman
    if (an.totalDebt <= 0) add('green', 'Tidak ada utang tercatat', '');
    else if (!items.some(i => i.level === 'red' || i.level === 'amber')) add('green', 'Tidak ada tanda bahaya', 'Tidak ada tunggakan dan beban cicilan masih wajar. Pertahankan bayar tepat waktu.');

    const order = { red: 0, amber: 1, info: 2, green: 3 };
    items.sort((x, y) => order[x.level] - order[y.level]);
    const color = { red: 'var(--red)', amber: 'var(--amber)', info: 'var(--ink-soft)', green: 'var(--green)' };
    const one = (i) => {
      const dot = `<span style="flex:0 0 8px; width:8px; height:8px; border-radius:50%; background:${color[i.level]};"></span>`;
      const row = `<div style="display:flex; align-items:center; gap:9px; padding:9px 0; font-size:13px;">${dot}<span style="flex:1; min-width:0;">${i.title}</span>${i.detail ? '<span class="adv-chev" style="color:var(--ink-soft); font-size:11px;">▾</span>' : ''}</div>`;
      if (!i.detail) return `<div style="border-bottom:1px solid var(--line);">${row}</div>`;
      return `<details class="adv-item" style="border-bottom:1px solid var(--line);"><summary>${row}</summary><div class="acc-sub" style="padding:0 0 10px 17px; line-height:1.5;">${i.detail}</div></details>`;
    };
    const SHOW = 3;
    const top = items.slice(0, SHOW), rest = items.slice(SHOW);
    const nRed = items.filter(i => i.level === 'red').length, nAmber = items.filter(i => i.level === 'amber').length;
    const badge = (nRed ? `<span style="color:var(--red); font-size:11.5px; font-weight:600; margin-left:8px;">${nRed} segera</span>` : '') + (nAmber ? `<span style="color:var(--amber); font-size:11.5px; font-weight:600; margin-left:8px;">${nAmber} waspada</span>` : '');
    const body = top.map(one).join('') +
      (rest.length ? `<details class="adv-more"><summary class="acc-sub" style="padding:8px 0; cursor:pointer;">Tampilkan ${rest.length} lagi</summary>${rest.map(one).join('')}</details>` : '') +
      '<div class="acc-sub" style="margin-top:8px; font-size:11px;">Otomatis dari data yang dicatat, bukan nasihat keuangan profesional.</div>';
    return card('Saran' + badge, body);
  }

  // ---------- LAPORAN: PROYEKSI KAS, TOTAL BIAYA UTANG, SIMULASI PELUNASAN ----------
  function laporanMonthLabel(offsetMonths) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offsetMonths);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  }
  // Ganti 30/60 hari cukup menggambar ulang kartu proyeksi (bukan seluruh Laporan), jadi baris lain yang
  // sedang dibuka dan posisi gulir tidak ikut berubah.
  function setLaporanProjDays(d) {
    state.laporanProjDays = d;
    const host = document.getElementById('laporan-proj-host');
    if (!host) { renderLaporan(); return; }
    const data = loadData();
    host.innerHTML = lapMemoScope(() => laporanCashProjectionHtml(data, computeAllBalances(data), lapCard, lapRow));
  }

  // 1. Proyeksi saldo kas/bank/e-wallet setelah tagihan & angsuran jatuh tempo (pengeluaran rutin lain & pemasukan belum dihitung).
  function laporanCashProjectionHtml(data, balances, card, row) {
    const horizon = state.laporanProjDays === 60 ? 60 : 30;
    const today = todayStr();
    const t0 = new Date(today + 'T00:00:00');
    const daysTo = (ds) => Math.round((new Date(ds + 'T00:00:00') - t0) / 86400000);
    const accById = {}; data.accounts.forEach(a => { accById[a.id] = a; });
    let liquid = 0;
    data.accounts.forEach(a => { if (a.type === 'kas' || a.type === 'bank' || a.type === 'ewallet') liquid += balances[a.id]; });
    const events = [];
    data.accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (TYPE_LOAN[acc.type]) {
        const sc = lapLoanSchedule(data, acc, bal);
        if (sc) sc.rows.forEach(r => {
          if (r.status === 'lunas') return;
          const d = daysTo(r.due);
          if (d <= horizon) events.push({ name: acc.name, label: 'Angsuran ' + r.no + '/' + sc.tenor, amount: r.total, date: d < 0 ? today : r.due, late: d < 0 });
        });
      } else if (acc.type === 'paylater' && bal < 0) {
        (Array.isArray(acc.plans) ? acc.plans : []).forEach(pl => {
          const sc = paylaterPlanSchedule(data, acc, pl);
          if (!sc || sc.k >= sc.tenor) return;
          for (let i = sc.k + 2; i <= sc.tenor; i++) { // periode berikutnya sudah ada di daftar jatuh tempo di bawah
            const due = paylaterPeriodDue(acc, pl, i);
            if (daysTo(due) > horizon) break;
            const amount = i === sc.tenor ? Math.max(0, pl.total - (sc.tenor - 1) * pl.monthly) : pl.monthly;
            if (amount > 0) events.push({ name: acc.name, label: 'Cicilan PayLater ' + i + '/' + sc.tenor, amount, date: due, late: false });
          }
        });
      }
    });
    lapUpcomingDues(data, balances, horizon).forEach(d => {
      const acc = accById[d.id];
      if (acc && TYPE_LOAN[acc.type]) return; // angsuran pinjaman sudah diambil dari jadwal (semua bulan)
      events.push({ name: d.name, label: d.label.split(' · ')[0], amount: d.amount, date: d.days < 0 ? today : d.due, late: d.days < 0 });
    });
    events.sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));
    let run = liquid, minBal = liquid, minDate = today, firstNeg = null, totalOut = 0;
    events.forEach(e => {
      run -= e.amount; totalOut += e.amount; e.after = run;
      if (run < minBal) { minBal = run; minDate = e.date; }
      if (run < 0 && !firstNeg) firstNeg = e;
    });
    const btn = (d) => `<button type="button" class="type-btn${d === horizon ? ' active' : ''}" style="padding:6px 0; font-size:11px;" onclick="setLaporanProjDays(${d})">${d} hari</button>`;
    const stat = (label, val, color) => `<div><div class="acc-sub" style="margin:0;">${label}</div><strong style="font-size:13.5px; font-variant-numeric:tabular-nums;${color ? ' color:' + color + ';' : ''}">${val}</strong></div>`;
    let body = `<div class="type-toggle no-print" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; margin:6px 0 4px;">${btn(30)}${btn(60)}</div>` +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; padding:8px 0 10px; border-bottom:1px solid var(--line);">' +
      stat('Saldo sekarang', formatRp(liquid), liquid < 0 ? 'var(--red)' : '') +
      stat('Tagihan & angsuran ' + horizon + ' hr', formatRp(totalOut), totalOut > 0 ? 'var(--red)' : '') +
      stat('Setelah dibayar semua', formatRp(liquid - totalOut), liquid - totalOut < 0 ? 'var(--red)' : 'var(--green)') +
      (events.length ? stat('Terendah (' + escapeHtml(fmtTgl(minDate)) + ')', formatRp(minBal), minBal < 0 ? 'var(--red)' : '') : '') + '</div>';
    if (firstNeg) {
      body += `<div style="border-left:3px solid var(--red); padding:6px 0 6px 10px; margin:8px 0; font-size:13px;"><strong style="color:var(--red);">Minus mulai ${escapeHtml(fmtTgl(firstNeg.date))}</strong> saat bayar ${escapeHtml(firstNeg.name)} ${formatRp(firstNeg.amount)}. Siapkan tambahan dana atau atur ulang urutan bayar.</div>`;
    }
    if (!events.length) {
      body += '<div class="acc-sub" style="margin-top:8px;">Tidak ada tagihan atau angsuran jatuh tempo dalam ' + horizon + ' hari ke depan.</div>';
    } else {
      const shown = events.slice(0, 20);
      body += '<div class="acc-sub" style="margin:10px 0 0;">Urutan bayar & saldo sesudahnya</div>' + lapMore(shown.map(e => lapItem({
        noDot: true, title: e.name + ' · ' + formatRp(e.amount), right: formatRp(e.after), rightColor: e.after < 0 ? 'var(--red)' : 'var(--ink)',
        hint: escapeHtml(e.label) + ' · ' + (e.late ? '<span style="color:var(--red);">sudah lewat, bayar sekarang</span>' : escapeHtml(fmtTgl(e.date)))
      })), 5) + (events.length > 20 ? '<div class="acc-sub" style="margin-top:4px;">+' + (events.length - 20) + ' tagihan lain tidak ditampilkan.</div>' : '');
    }
    body += lapNote('Saldo = kas + bank + e-wallet. Hanya tagihan & angsuran yang sudah terjadwal; pemasukan (gaji dll.), belanja harian, dan tagihan kartu yang belum dicetak belum ikut dihitung.');
    return card('Proyeksi kas ' + horizon + ' hari', body);
  }

  // 2. Total biaya utang: bunga + admin + asuransi + materai, sudah dibayar vs sisa.
  function laporanDebtCostHtml(data, balances, card, row) {
    // Satu kali lewat semua transaksi: total 'Bunga & biaya bank' per akun dan per loanId
    // (dulu difilter ulang di seluruh transaksi untuk tiap akun utang).
    const feeByAcc = {}, feeByLoan = {};
    data.txns.forEach(t => {
      if (t.type !== 'keluar' || t.category !== 'Bunga & biaya bank') return;
      feeByAcc[t.accountId] = (feeByAcc[t.accountId] || 0) + t.amount;
      if (t.loanId) feeByLoan[t.loanId] = (feeByLoan[t.loanId] || 0) + t.amount;
    });
    const items = [];
    data.accounts.forEach(acc => {
      if (!TYPE_DEBT[acc.type]) return;
      const bal = balances[acc.id];
      const pokokAwal = Math.abs(acc.originalPrincipal || acc.initialBalance || 0);
      if (TYPE_LOAN[acc.type]) {
        const rem = lapLoanRemaining(data, acc, bal);
        if (rem.total <= 0 && bal >= 0) return;
        const awal = (acc.loanAdminMode === 'cicil' ? 0 : (acc.loanAdminFee || 0)) + (acc.loanStampFee || 0);
        const tenor = acc.loanTenorMonths || 0;
        const monthly = computeLoanMonthlyInterest(data, acc, bal);
        const isMenurun = acc.loanInterestType === 'menurun';
        const kindBase = acc.type === 'pinjaman_online' ? 'Pinjol' : 'Pinjaman bank';
        // Kalau jadwalnya bisa dibuat (tenor + tanggal pencairan, dan untuk bunga menurun juga suku
        // bunganya), bunga terbayar/tersisa dijumlah dari jadwal itu — berlaku untuk flat maupun menurun.
        const sc = lapLoanSchedule(data, acc, bal);
        if (sc) {
          const paidBunga = sc.rows.slice(0, sc.paid).reduce((s, r) => s + r.bunga, 0);
          const remBunga = sc.rows.slice(sc.paid).reduce((s, r) => s + r.bunga, 0);
          const paid = paidBunga + awal, remaining = remBunga, total = paid + remaining;
          items.push({ name: acc.name, kind: kindBase + (isMenurun ? ' (menurun)' : ''), paid, remaining, total, pct: pokokAwal > 0 ? total / pokokAwal * 100 : null, pokokAwal, estimated: true });
        } else if (!isMenurun && tenor > 0 && monthly > 0) {
          // Flat tanpa jadwal (tenor & bunga diketahui, tapi tanggal pencairan belum diisi): pakai bunga
          // yang sudah tercatat lewat transaksi, dan sisa bunga dari kontrak (computeLoanRemaining).
          const paid = (feeByLoan[acc.id] || 0) + awal;
          const remaining = rem.sisaBunga;
          const total = paid + remaining;
          items.push({ name: acc.name, kind: kindBase, paid, remaining, total, pct: pokokAwal > 0 ? total / pokokAwal * 100 : null, pokokAwal });
        } else {
          // Menurun tanpa jadwal (tenor/tanggal pencairan/suku bunga belum lengkap): sisa bunga tidak diketahui.
          const paid = (feeByLoan[acc.id] || 0) + awal;
          items.push({ name: acc.name, kind: kindBase + ' (bunga menurun)', paid, remaining: null, total: null, pct: null, pokokAwal, monthly });
        }
      } else if (acc.type === 'paylater') {
        const fs = paylaterFeeSummary(data, acc);
        if (fs.feeAllTime <= 0 && bal >= 0) return;
        items.push({ name: acc.name, kind: 'PayLater', paid: fs.feePaidSoFar, remaining: fs.feeRemaining, total: fs.feeAllTime, pct: fs.feeAvgPct || null, pokokAwal: null });
      } else if (acc.type === 'kartu_kredit') {
        const paid = (feeByAcc[acc.id] || 0);
        const used = bal < 0 ? Math.abs(bal) : 0;
        if (paid <= 0 && used <= 0) return;
        items.push({ name: acc.name, kind: 'Kartu kredit', paid, remaining: null, total: null, pct: null, pokokAwal: null, monthly: acc.interestPercent ? Math.round(used * acc.interestPercent / 100) : 0 });
      }
    });
    if (!items.length) return '';
    let sumPaid = 0, sumRem = 0;
    items.forEach(i => { sumPaid += i.paid || 0; sumRem += i.remaining || 0; });
    let body = row('Bunga & biaya sudah dibayar', formatRp(Math.round(sumPaid)), 'var(--red)') +
      row('Bunga & biaya masih harus dibayar', formatRp(Math.round(sumRem)), sumRem > 0 ? 'var(--red)' : '') +
      row('Total biaya utang (yang bisa dihitung)', formatRp(Math.round(sumPaid + sumRem)));
    body += items.map(i => {
      const lines = [];
      let right = '—', hint;
      if (i.total !== null) {
        right = formatRp(Math.round(i.total));
        hint = escapeHtml(i.kind) + (i.pct != null ? ' · ' + i.pct.toFixed(1) + '% dari pokok' : '') + ' · sisa ' + formatRp(Math.round(i.remaining));
        lines.push({ text: 'Total biaya kontrak ' + formatRp(Math.round(i.total)) + (i.pct != null && i.pokokAwal ? ' = ' + i.pct.toFixed(1) + '% dari pokok ' + formatRp(i.pokokAwal) : (i.pct != null ? ' (rata-rata ' + i.pct.toFixed(1) + '% dari pokok)' : '')) });
        lines.push({ text: 'Sudah dibayar ' + formatRp(Math.round(i.paid)) + ' · sisa ' + formatRp(Math.round(i.remaining)) + (i.estimated ? ' (dihitung dari jadwal angsuran)' : '') });
      } else {
        hint = escapeHtml(i.kind) + ' · sudah dibayar ' + formatRp(Math.round(i.paid)) + ' · total belum pasti';
        if (i.monthly > 0) lines.push({ text: 'Perkiraan bunga bulan ini ' + formatRp(i.monthly) + ' kalau tidak lunas penuh' });
        lines.push({ text: 'Total sisa biaya tidak bisa dipastikan karena bunganya menurun / tergantung pelunasan.' });
      }
      return lapItem({ noDot: true, title: i.name, right, hint, lines });
    }).join('');
    body += lapNote('Untuk pinjaman yang sudah berjalan sebelum dipakai di app ini, angka "sudah dibayar" adalah estimasi dari jadwal angsuran.');
    return card('Total biaya utang', body);
  }

  // 3. Simulasi pelunasan: bayar minimum saja vs gulung cicilan + ekstra per bulan (bunga tertinggi / saldo terkecil dulu).
  function laporanSimDebts(data, balances) {
    const debts = [];
    const skipped = [];   // pinjaman yang angsuran bulanannya belum diketahui
    data.accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (!TYPE_DEBT[acc.type]) return;
      if (acc.type === 'kartu_kredit') {
        if (bal >= 0) return;
        debts.push({ name: acc.name, kind: 'Kartu kredit', bal: Math.abs(bal), rate: acc.interestPercent || 0, minFn: (b) => Math.min(b, cardMinPayOf(acc, b)), noRate: !(acc.interestPercent > 0) });
      } else if (acc.type === 'paylater') {
        if (bal >= 0) return;
        let monthly = 0;
        (Array.isArray(acc.plans) ? acc.plans : []).forEach(pl => { const sc = paylaterPlanSchedule(data, acc, pl); if (sc && sc.k < sc.tenor) monthly += pl.monthly || 0; });
        const total = Math.abs(bal);
        debts.push({ name: acc.name, kind: 'PayLater', bal: total, rate: 0, minFn: (b) => Math.min(b, monthly > 0 ? monthly : b) });
      } else if (TYPE_LOAN[acc.type]) {
        const rem = lapLoanRemaining(data, acc, bal);
        if (rem.total <= 0) return;
        const sc = lapLoanSchedule(data, acc, bal);
        const inst = acc.loanInstallment || (sc && sc.rows[0] ? sc.rows[0].total : 0);
        // Tanpa angsuran per bulan, cicilan wajibnya tak diketahui (dulu dianggap = seluruh saldo, jadi
        // "lunas dalam 1 bulan"). Pinjaman ini dikeluarkan dari simulasi dan diberi catatan.
        if (!(inst > 0)) { skipped.push(acc.name); return; }
        if (acc.loanInterestType === 'menurun') {
          const rate = acc.loanRatePercent ? (acc.loanRateUnit === 'bulan' ? acc.loanRatePercent : acc.loanRatePercent / 12) : 0;
          debts.push({ name: acc.name, kind: 'Pinjaman bank', bal: rem.sisaPokok, rate, minFn: (b) => Math.min(b, inst > 0 ? inst : b) });
        } else {
          // Bunga flat: bunga & biaya sisa sudah terkunci, jadi masuk ke saldo dan tidak bertambah lagi.
          let total = rem.total;
          if (sc && sc.next) total = Math.max(rem.sisaPokok, (sc.tenor - sc.paid) * (sc.rows[0] ? sc.rows[0].total : 0));
          debts.push({ name: acc.name, kind: acc.type === 'pinjaman_online' ? 'Pinjol (flat)' : 'Pinjaman (flat)', bal: total, rate: 0, flat: true, minFn: (b) => Math.min(b, inst > 0 ? inst : b) });
        }
      }
    });
    debts.skipped = skipped;
    return debts;
  }
  function laporanSimulate(debts, extra, strategy, roll) {
    const ds = debts.map(d => Object.assign({}, d, { done: 0 }));
    const mins0 = ds.reduce((s2, d) => s2 + d.minFn(d.bal), 0);
    const budget = mins0 + extra;
    let interest = 0, months = 0;
    while (months < 240 && ds.some(d => d.bal > 0.5)) {
      months++;
      ds.forEach(d => { if (d.bal > 0.5 && d.rate > 0) { const i = d.bal * d.rate / 100; d.bal += i; interest += i; } });
      let spent = 0;
      ds.forEach(d => { if (d.bal > 0.5) { const pay = Math.min(d.bal, d.minFn(d.bal)); d.bal -= pay; spent += pay; } });
      if (roll) {
        let left = budget - spent;
        const order = ds.filter(d => d.bal > 0.5).sort((a, b) => strategy === 'saldo' ? a.bal - b.bal : (b.rate - a.rate) || (a.bal - b.bal));
        for (let k = 0; k < order.length && left > 0.5; k++) { const pay = Math.min(left, order[k].bal); order[k].bal -= pay; left -= pay; }
      }
      ds.forEach(d => { if (d.bal <= 0.5 && !d.done) d.done = months; });
    }
    return { months, interest: Math.round(interest), finished: !ds.some(d => d.bal > 0.5) };
  }
  function laporanSimResultHtml(data, balances) {
    const debts = laporanSimDebts(data, balances);
    const skipped = debts.skipped || [];
    const skipNote = skipped.length
      ? '<div class="acc-sub" style="margin-top:8px; line-height:1.5;">Belum disertakan: ' + skipped.map(escapeHtml).join(', ') + ' (angsuran per bulan belum diisi). Isi di Edit akun, atau catat satu angsuran dulu supaya terisi otomatis.</div>'
      : '';
    if (!debts.length) return skipped.length ? skipNote : '<div class="acc-sub">Tidak ada utang aktif untuk disimulasikan.</div>';
    const extra = state.laporanSimExtra != null ? state.laporanSimExtra : (() => { const inc = laporanMonthlyIncome(data); return inc > 0 ? Math.round(inc * 0.1 / 50000) * 50000 : 500000; })();
    const base = laporanSimulate(debts, 0, 'bunga', false);
    const sc = [
      { label: 'Tanpa ekstra', r: base },
      { label: 'Ekstra · bunga tertinggi dulu', r: laporanSimulate(debts, extra, 'bunga', true) },
      { label: 'Ekstra · saldo terkecil dulu', r: laporanSimulate(debts, extra, 'saldo', true) }
    ];
    const mLabel = (r) => r.finished ? r.months + ' bln (' + laporanMonthLabel(r.months) + ')' : '&gt; 20 tahun';
    const totalBal = debts.reduce((s2, d) => s2 + d.bal, 0);
    const totalMin = debts.reduce((s2, d) => s2 + d.minFn(d.bal), 0);
    let html = '<div class="acc-sub" style="margin-bottom:4px;">' + debts.length + ' utang · total ' + formatRp(Math.round(totalBal)) + ' · cicilan wajib ± ' + formatRp(Math.round(totalMin)) + '/bln</div>';
    html += sc.map((x, i) => {
      const saved = i === 0 ? null : base.interest - x.r.interest;
      const faster = i === 0 || !base.finished ? null : base.months - x.r.months;
      return `<div style="padding:8px 0; border-bottom:1px solid var(--line);"><div style="font-size:13px; font-weight:600;">${x.label}</div>
        <div class="acc-sub" style="margin-top:2px;">Bebas utang: <strong>${mLabel(x.r)}</strong> · bunga tambahan ${formatRp(x.r.interest)}${saved !== null && saved > 0 ? ' · <span style="color:var(--green);">hemat ' + formatRp(saved) + '</span>' : ''}${faster !== null && faster > 0 ? ' · <span style="color:var(--green);">' + faster + ' bln lebih cepat</span>' : ''}</div></div>`;
    }).join('');
    const notes = ['Tanpa ekstra: kartu bayar minimum, lainnya sesuai angsuran. Skenario ekstra: cicilan yang sudah lunas digulung ke utang lain, ditambah dana ekstra tiap bulan.'];
    if (debts.some(d => d.flat)) notes.push('Bunga pinjaman flat (pinjol, dll.) sudah terkunci di saldo, jadi bayar lebih awal tidak menghemat bunga di simulasi ini. Manfaatnya: cicilan yang lunas bisa digulung ke utang lain.');
    const noRate = debts.filter(d => d.noRate).map(d => d.name);
    if (noRate.length) notes.push('Bunga kartu ' + noRate.map(escapeHtml).join(', ') + ' belum diisi di akun, jadi dianggap 0%. Isi bunganya supaya hasil lebih akurat.');
    notes.push('Hitungan pakai bunga bulanan sederhana dan tidak memasukkan belanja baru di kartu / PayLater.');
    html += '<details class="adv-more"><summary class="acc-sub" style="padding:8px 0; cursor:pointer;">Catatan simulasi</summary>' + notes.map(n => '<div class="acc-sub" style="margin-bottom:6px; line-height:1.5;">' + n + '</div>').join('') + '</details>';
    html += skipNote;
    return html;
  }
  // Elemen simulasi dibuat ulang tiap Laporan digambar, jadi selalu diambil lewat getElementById
  // (bukan cache $(), yang setelah render ulang menunjuk ke elemen lama yang sudah lepas dari halaman).
  let _simTimer = null;
  function onLaporanSimInput() {
    const el = document.getElementById('laporan-sim-extra');
    if (!el) return;
    state.laporanSimExtra = Math.max(0, parseFloat(el.value) || 0);
    clearTimeout(_simTimer);
    _simTimer = setTimeout(() => { // tunggu jeda ketik sebentar supaya tidak menghitung ulang di tiap ketukan angka
      const out = document.getElementById('laporan-sim-result');
      if (!out) return;
      const wasOpen = !!out.querySelector('details[open]');
      const data = loadData();
      out.innerHTML = lapMemoScope(() => laporanSimResultHtml(data, computeAllBalances(data)));
      if (wasOpen) { const dt = out.querySelector('details'); if (dt) dt.open = true; }
    }, 120);
  }
  function laporanSimHtml(data, balances, card) {
    { const sd = laporanSimDebts(data, balances); if (!sd.length && !(sd.skipped && sd.skipped.length)) return ''; }
    const shown = state.laporanSimExtra != null ? state.laporanSimExtra : (() => { const inc = laporanMonthlyIncome(data); return inc > 0 ? Math.round(inc * 0.1 / 50000) * 50000 : 500000; })();
    return card('Simulasi pelunasan',
      '<div class="acc-sub" style="margin:4px 0 6px;">Dana ekstra per bulan (Rp), di luar cicilan wajib</div>' +
      `<div class="field-row no-print" style="margin-bottom:8px;"><input type="number" id="laporan-sim-extra" value="${shown}" inputmode="numeric" min="0" step="50000" oninput="onLaporanSimInput()" aria-label="Dana ekstra per bulan untuk bayar utang" style="width:100%;"></div>` +
      '<div id="laporan-sim-result">' + laporanSimResultHtml(data, balances) + '</div>');
  }

  // Informasi tambahan di Laporan: rasio tabungan, perbandingan periode lalu, hari terboros,
  // beban utang, posisi kekayaan saat ini, dan 5 pengeluaran terbesar.
  function renderLaporanExtra(...args) { return lapMemoScope(() => renderLaporanExtraInner(...args)); }
  function renderLaporanExtraInner(data, range, dayCount, txns, masukTxns, keluarTxns, totalIn, totalOut) {
    const el = $('laporan-extra');
    if (!el) return;
    const net = totalIn - totalOut;
    const row = lapRow, card = lapCard;
    let html = '';

    // 1. Ringkasan cepat
    const saveRate = totalIn > 0 ? Math.round((net / totalIn) * 100) : null;
    const byDay = {};
    keluarTxns.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + t.amount; });
    const worst = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    html += card('Ringkasan periode',
      row('Rasio tabungan (sisa dari pemasukan)', saveRate === null ? '—' : saveRate + '%', saveRate !== null && saveRate < 0 ? 'var(--red)' : (saveRate !== null ? 'var(--green)' : '')) +
      row('Rata-rata pemasukan/hari', formatRp(Math.round(totalIn / dayCount)), 'var(--green)') +
      row('Hari terboros', worst ? escapeHtml(fmtTgl(worst[0])) + ' · ' + formatRp(worst[1]) : '—') +
      row('Jumlah transaksi', masukTxns.length + keluarTxns.length + ' (' + masukTxns.length + ' masuk, ' + keluarTxns.length + ' keluar)'));

    // 2. Dibanding periode sebelumnya (panjang sama, tepat sebelum periode ini)
    if (state.laporanPeriod !== 'alltime') {
      const ymd = (d) => d.getFullYear() + '-' + padMonth(d.getMonth() + 1) + '-' + padMonth(d.getDate());
      const pe = new Date(range.start + 'T00:00:00'); pe.setDate(pe.getDate() - 1);
      const ps = new Date(pe); ps.setDate(ps.getDate() - (dayCount - 1));
      const prevStart = ymd(ps), prevEnd = ymd(pe);
      let pt = data.txns.filter(t => t.date >= prevStart && t.date <= prevEnd);
      if (state.laporanAccFilter !== 'all') pt = pt.filter(t => t.accountId === state.laporanAccFilter || t.toAccountId === state.laporanAccFilter);
      pt = pt.filter(t => !isDebtFlowTxn(t)); // konsisten dengan periode ini
      const pIn = pt.filter(t => t.type === 'masuk' && (state.laporanCatMasukFilter === 'all' || (t.category || 'Tanpa kategori') === state.laporanCatMasukFilter)).reduce((s2, t) => s2 + t.amount, 0);
      const pOut = pt.filter(t => t.type === 'keluar' && (state.laporanCatKeluarFilter === 'all' || (t.category || 'Tanpa kategori') === state.laporanCatKeluarFilter)).reduce((s2, t) => s2 + t.amount, 0);
      const delta = (cur, prev, upGood) => {
        if (prev <= 0) return cur > 0 ? 'baru' : '—';
        const pct = Math.round(((cur - prev) / prev) * 100);
        if (pct === 0) return '0%';
        return (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%';
      };
      const deltaColor = (cur, prev, upGood) => { if (prev <= 0 || cur === prev) return ''; return ((cur > prev) === upGood) ? 'var(--green)' : 'var(--red)'; };
      html += card('Dibanding periode sebelumnya',
        `<div class="acc-sub" style="margin-bottom:4px;">${escapeHtml(fmtTgl(prevStart))} – ${escapeHtml(fmtTgl(prevEnd))}</div>` +
        row('Pemasukan', formatRp(totalIn) + ' <span style="font-weight:500; font-size:11.5px;">(sebelumnya ' + formatRp(pIn) + ')</span> ' + delta(totalIn, pIn, true), deltaColor(totalIn, pIn, true)) +
        row('Pengeluaran', formatRp(totalOut) + ' <span style="font-weight:500; font-size:11.5px;">(sebelumnya ' + formatRp(pOut) + ')</span> ' + delta(totalOut, pOut, false), deltaColor(totalOut, pOut, false)) +
        row('Selisih (laba bersih)', formatRp(net) + ' <span style="font-weight:500; font-size:11.5px;">(sebelumnya ' + formatRp(pIn - pOut) + ')</span>', net >= (pIn - pOut) ? 'var(--green)' : 'var(--red)'));
    }

    // 3. Beban utang di periode ini
    const loanIds = {};
    data.accounts.forEach(a => { if (TYPE_DEBT[a.type]) loanIds[a.id] = true; });
    const bungaPaid = txns.filter(t => t.type === 'keluar' && t.category === 'Bunga & biaya bank').reduce((s2, t) => s2 + t.amount, 0);
    const flows = debtFlowsOf(data, txns);
    const pokokPaid = flows.paid; // transfer ke akun utang + pengeluaran berkategori utang
    if (bungaPaid > 0 || pokokPaid > 0 || flows.disbursed > 0) {
      const totalBayar = bungaPaid + pokokPaid;
      html += card('Pembayaran utang',
        (flows.disbursed > 0 ? row('Pencairan pinjaman (bukan pemasukan)', formatRp(flows.disbursed)) : '') +
        row('Angsuran pokok / bayar tagihan', formatRp(pokokPaid)) +
        row('Bunga & biaya bank', formatRp(bungaPaid), 'var(--red)') +
        row('Total keluar untuk utang', formatRp(totalBayar)) +
        row('Porsi terhadap pemasukan', totalIn > 0 ? Math.round((totalBayar / totalIn) * 100) + '%' : '—'));
    }

    // 4. Posisi saat ini (semua akun, tidak terpengaruh periode)
    const balances = computeAllBalances(data);
    let aset = 0, utang = 0, sisaBunga = 0;
    data.accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (TYPE_DEBT[acc.type]) {
        utang += bal < 0 ? Math.abs(bal) : 0;
        if (bal > 0) aset += bal;
        if (TYPE_LOAN[acc.type]) sisaBunga += lapLoanRemaining(data, acc, bal).sisaBunga;
      } else if (acc.type === 'titipan') {
        if (bal > 0) aset += bal; else if (bal < 0) utang += Math.abs(bal);
      } else {
        if (bal >= 0) aset += bal; else utang += Math.abs(bal);
      }
    });
    const kekayaan = aset - utang;
    html += card('Posisi saat ini (semua akun)',
      row('Total aset', formatRp(aset), 'var(--green)') +
      row('Total utang (sisa pokok)', formatRp(utang), utang > 0 ? 'var(--red)' : '') +
      (sisaBunga > 0 ? row('Sisa bunga kontrak (belum jatuh tempo)', formatRp(sisaBunga)) : '') +
      row('Kekayaan bersih', formatRp(kekayaan), kekayaan < 0 ? 'var(--red)' : 'var(--green)'));

    // 4b. Rincian utang per jenis (kartu kredit, PayLater, pinjol, pinjaman bank) + saran
    const debtAn = laporanDebtAnalysis(data, balances);
    html += laporanDebtDetailHtml(debtAn, card, row);
    html += '<div id="laporan-proj-host">' + laporanCashProjectionHtml(data, balances, card, row) + '</div>';
    html += laporanDebtCostHtml(data, balances, card, row);
    html += laporanSimHtml(data, balances, card);

    // 5. Lima pengeluaran terbesar
    const top = keluarTxns.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (top.length) {
      html += card('5 pengeluaran terbesar', top.map(t => `
        <div style="display:flex; justify-content:space-between; gap:10px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13px;">
          <div style="min-width:0;"><div style="font-weight:600;">${escapeHtml(t.desc || t.category || 'Transaksi')}</div><div class="acc-sub">${escapeHtml((t.category || 'Tanpa kategori') + ' · ' + fmtTgl(t.date))}</div></div>
          <strong style="color:var(--red); font-variant-numeric:tabular-nums; white-space:nowrap;">${formatRp(t.amount)}</strong>
        </div>`).join(''));
    }

    html += laporanAdviceHtml(data, debtAn, { totalIn, totalOut, bungaPaid }, card);

    el.innerHTML = html;
  }


