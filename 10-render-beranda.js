  // ============================================================
  // RENDER: BERANDA — transaksi terbaru & ringkasan bulan
  // ============================================================
  function renderRecentTxns(data) {
    const container = $('recent-txn-list');
    if (!container) return;
    const accById = {};
    data.accounts.forEach(a => accById[a.id] = a);

    const indexed = data.txns.map((t, i) => ({ t, i }));
    indexed.sort((a, b) => {
      if (a.t.date !== b.t.date) return b.t.date.localeCompare(a.t.date);
      return b.i - a.i;
    });
    const recent = indexed.slice(0, 3).map(x => x.t);

    if (recent.length === 0) {
      container.innerHTML = '<div class="empty">Belum ada transaksi.</div>';
      return;
    }

    container.innerHTML = recent.map(t => {
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
      metaText += ' · ' + formatDayLabel(t.date);
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
            <button class="del-btn" onclick="event.stopPropagation(); deleteTxn('${t.id}')" aria-label="Hapus">×</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMonthInsights(data) {
    const now = todayGmt8();
    const curMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const monthTxns = data.txns.filter(t => monthKeyFromDate(t.date) === curMonthKey);
    // Pemasukan/pengeluaran "sungguhan": tanpa pembayaran utang & pencairan pinjaman (lihat isDebtFlowTxn).
    const monthIn = monthTxns.filter(t => t.type === 'masuk' && !isDebtFlowTxn(t)).reduce((s, t) => s + t.amount, 0);
    const monthOut = monthTxns.filter(t => t.type === 'keluar' && !isDebtFlowTxn(t)).reduce((s, t) => s + t.amount, 0);
    const rawMonthOut = monthTxns.filter(t => t.type === 'keluar').reduce((s, t) => s + t.amount, 0);
    const net = monthIn - monthOut;
    const debtLineEl = $('month-debt-line');
    if (debtLineEl) {
      const fl = monthDebtFlows(data, curMonthKey);
      const lines = [];
      if (fl.paid > 0) lines.push('Bayar utang & cicilan: ' + formatRp(fl.paid) + ' (tidak dihitung sebagai pengeluaran)');
      if (fl.disbursed > 0) lines.push('Pencairan pinjaman: ' + formatRp(fl.disbursed) + ' (tidak dihitung sebagai pemasukan)');
      debtLineEl.style.display = lines.length ? 'block' : 'none';
      debtLineEl.textContent = lines.join('\n');
    }

    const inEl = $('month-in');
    const outEl = $('month-out');
    const netEl = $('month-net');
    if (inEl) inEl.textContent = formatRp(monthIn);
    if (outEl) outEl.textContent = formatRp(monthOut);
    if (netEl) {
      netEl.textContent = formatRp(net);
      netEl.style.color = net < 0 ? 'var(--red)' : 'var(--green)';
    }

    // Bandingkan dengan bulan lalu, tapi cuma sampai tanggal yang sama (biar adil, bukan bulan lalu penuh vs bulan ini yang belum selesai).
    const daysElapsed = now.getDate();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = prevMonthDate.getFullYear() + '-' + String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const prevMonthTxns = data.txns.filter(t => {
      if (monthKeyFromDate(t.date) !== prevMonthKey) return false;
      const day = Number(t.date.split('-')[2]);
      return day <= daysElapsed;
    });
    const prevIn = prevMonthTxns.filter(t => t.type === 'masuk' && !isDebtFlowTxn(t)).reduce((s, t) => s + t.amount, 0);
    const prevOut = prevMonthTxns.filter(t => t.type === 'keluar' && !isDebtFlowTxn(t)).reduce((s, t) => s + t.amount, 0);

    // higherIsGood: true untuk pemasukan (naik = bagus), false untuk pengeluaran (naik = kurang bagus).
    function renderCompare(elId, current, prev, higherIsGood) {
      const el = $(elId);
      if (!el) return;
      if (prev === 0) {
        if (current === 0) { el.textContent = ''; return; }
        el.textContent = 'Baru dibanding bulan lalu';
        el.style.color = 'var(--ink-soft)';
        return;
      }
      const pct = ((current - prev) / prev) * 100;
      const up = pct > 0.05;
      const down = pct < -0.05;
      const arrow = up ? '▲' : (down ? '▼' : '▬');
      const good = up ? higherIsGood : (down ? !higherIsGood : null);
      el.textContent = `${arrow} ${Math.abs(pct).toFixed(0)}% vs bulan lalu`;
      el.style.color = good === null ? 'var(--ink-soft)' : (good ? 'var(--green)' : 'var(--red)');
    }
    renderCompare('month-in-compare', monthIn, prevIn, true);
    renderCompare('month-out-compare', monthOut, prevOut, false);

    const avgDaily = daysElapsed > 0 ? monthOut / daysElapsed : 0;
    const avgEl = $('avg-daily-expense');
    if (avgEl) avgEl.textContent = formatRp(avgDaily);

    const rawExpenseTxns = monthTxns.filter(t => t.type === 'keluar');
    const expenseTxns = rawExpenseTxns.filter(t => !isDebtFlowTxn(t));
    const labelEl = $('biggest-expense-label');
    const amountEl = $('biggest-expense-amount');
    if (expenseTxns.length === 0) {
      if (labelEl) labelEl.textContent = 'Pengeluaran terbesar (bulan ini)';
      if (amountEl) amountEl.textContent = '—';
    } else {
      const biggest = expenseTxns.reduce((max, t) => t.amount > max.amount ? t : max, expenseTxns[0]);
      if (labelEl) labelEl.textContent = 'Terbesar: ' + biggest.desc;
      if (amountEl) amountEl.textContent = formatRp(biggest.amount);
    }

    renderDebtBurden(rawMonthOut, rawExpenseTxns); // kartu beban utang tetap dihitung dari seluruh pengeluaran
  }

  function renderDebtBurden(monthOut, expenseTxns) {
    const card = $('debt-burden-card');
    if (!card) return;
    const isDebtCat = (cat) => /cicilan|bunga|utang/i.test(cat || '');
    const debtAmount = expenseTxns.filter(t => isDebtCat(t.category)).reduce((s, t) => s + t.amount, 0);

    if (debtAmount <= 0) { card.style.display = 'none'; return; }
    card.style.display = '';

    const pct = monthOut > 0 ? Math.min(100, Math.round((debtAmount / monthOut) * 100)) : 0;
    const barColor = pct >= 50 ? '--red' : (pct >= 30 ? '--amber' : '--green');

    $('debt-burden-amount').textContent = formatRp(debtAmount);
    $('debt-burden-amount').style.color = `var(${barColor})`;
    $('debt-burden-pct').textContent = monthOut > 0 ? `${pct}% dari pengeluaran bulan ini` : '';
    const barEl = $('debt-burden-bar');
    barEl.style.width = pct + '%';
    barEl.style.background = `var(${barColor})`;

    const noteEl = $('debt-burden-note');
    if (pct >= 50) noteEl.textContent = 'Lebih dari separuh pengeluaran habis untuk cicilan/bunga.';
    else if (pct >= 30) noteEl.textContent = 'Porsi cicilan/bunga cukup besar bulan ini.';
    else noteEl.textContent = '';
  }

