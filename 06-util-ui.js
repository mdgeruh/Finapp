  // ============================================================
  // UTIL UI: format tanggal, modal konfirmasi, toast pesan
  // ============================================================
  function formatDayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (dateStr === todayStr()) return 'Hari ini';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      const overlay = $('modal-overlay');
      const msgEl = $('modal-msg');
      const okBtn = $('modal-confirm');
      const cancelBtn = $('modal-cancel');
      msgEl.textContent = message;
      overlay.classList.add('open');

      function cleanup(result) {
        overlay.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlay(e) { if (e.target === overlay) cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
    });
  }

  function showIoMsg(text, kind, elId) {
    const el = $(elId || 'io-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'io-msg' + (kind ? ' ' + kind : '');
    if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
  }


