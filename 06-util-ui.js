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

  // ============================================================
  // CUSTOM SELECT: dropdown ber-tampilan sendiri untuk field akun/kategori
  // di form transaksi (bukan <select> bawaan browser).
  // Pendekatan: <select> asli tetap ada tapi disembunyikan (class csel-native)
  // dan tetap dipakai sebagai satu-satunya "sumber kebenaran" — kode lain yang
  // baca/tulis .value, .innerHTML, .selectedIndex, atau pasang onchange="..."
  // pada select ini TIDAK perlu diubah sama sekali. Dropdown custom cuma
  // lapisan tampilan: dia baca opsi dari <select> asli tiap kali dibuka, dan
  // waktu opsi dipilih, dia isi .value <select> lalu trigger event 'change'
  // seperti select biasa. Supaya label tombolnya ikut ter-update walau
  // .value/.innerHTML/.selectedIndex di-set langsung dari file lain (bukan
  // lewat klik), setter ketiga properti itu "disadap" (masih jalan seperti
  // asli, cuma nambah refresh label sesudahnya).
  // ============================================================
  function enhanceSelect(id) {
    const native = typeof id === 'string' ? $(id) : id;
    if (!native || native.dataset.cselDone) return;
    native.dataset.cselDone = '1';

    const wrap = document.createElement('div');
    wrap.className = 'csel';
    if (native.style.width) {
      wrap.style.width = native.style.width;
      if (native.style.width !== '100%') {
        wrap.style.flex = '0 0 ' + native.style.width;
      }
    }
    if (native.style.flex) {
      wrap.style.flex = native.style.flex;
    }
    native.parentNode.insertBefore(wrap, native);
    wrap.appendChild(native);
    native.classList.add('csel-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'csel-trigger';
    const label = document.createElement('span');
    label.className = 'csel-label';
    trigger.appendChild(label);
    wrap.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'csel-panel';
    panel.setAttribute('role', 'listbox');
    document.body.appendChild(panel);

    function refreshLabel() {
      const opt = native.options && native.selectedIndex >= 0 ? native.options[native.selectedIndex] : null;
      label.textContent = opt ? opt.textContent : '—';
      trigger.disabled = !!native.disabled;
      wrap.classList.toggle('disabled', !!native.disabled);
    }

    function closePanel() {
      panel.classList.remove('open');
      wrap.classList.remove('open');
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('touchstart', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', closePanel);
      document.removeEventListener('scroll', onScroll, true);
    }
    function onOutside(e) {
      if (!panel.contains(e.target) && !trigger.contains(e.target)) closePanel();
    }
    function onKey(e) {
      if (e.key === 'Escape') closePanel();
    }
    function onScroll(e) {
      if (panel.contains(e.target)) return; // scroll di dalam panel sendiri, jangan tutup
      closePanel();
    }

    function buildOption(opt) {
      const row = document.createElement('div');
      const isDisabled = !!opt.disabled;
      row.className = 'csel-option' + (opt.value === native.value ? ' active' : '') + (isDisabled ? ' disabled' : '');
      row.setAttribute('role', 'option');
      row.textContent = opt.textContent;
      if (!isDisabled) {
        row.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (native.value !== opt.value) {
            native.value = opt.value;
            native.dispatchEvent(new Event('change', { bubbles: true }));
          }
          refreshLabel();
          closePanel();
        });
      }
      return row;
    }

    function buildPanel() {
      panel.innerHTML = '';
      const nodes = Array.from(native.children);
      if (!nodes.length) {
        const empty = document.createElement('div');
        empty.className = 'csel-empty';
        empty.textContent = 'Tidak ada pilihan';
        panel.appendChild(empty);
        return;
      }
      nodes.forEach(node => {
        if (node.tagName === 'OPTGROUP') {
          const visibleOpts = Array.from(node.children).filter(opt => opt.style.display !== 'none');
          if (visibleOpts.length) {
            const gl = document.createElement('div');
            gl.className = 'csel-optgroup-label';
            gl.textContent = node.label;
            panel.appendChild(gl);
            visibleOpts.forEach(opt => panel.appendChild(buildOption(opt)));
          }
        } else if (node.tagName === 'OPTION') {
          if (node.style.display !== 'none') panel.appendChild(buildOption(node));
        }
      });
    }

    function openPanel() {
      if (native.disabled) return;
      document.querySelectorAll('.csel-panel.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.csel.open').forEach(w => w.classList.remove('open'));

      buildPanel();
      const rect = trigger.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const minW = Math.max(rect.width, 150);
      const targetW = Math.min(Math.max(rect.width, minW), winW - 20);
      const left = Math.min(Math.max(10, rect.left), Math.max(10, winW - targetW - 10));
      panel.style.left = left + 'px';
      panel.style.width = targetW + 'px';

      panel.classList.add('open');
      const panelH = panel.offsetHeight || 200;
      const spaceBelow = winH - rect.bottom - 10;
      const spaceAbove = rect.top - 10;

      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        const maxH = Math.min(280, Math.max(100, spaceAbove));
        panel.style.maxHeight = maxH + 'px';
        panel.style.top = Math.max(10, rect.top - Math.min(panelH, maxH) - 4) + 'px';
      } else {
        const maxH = Math.min(280, Math.max(100, spaceBelow));
        panel.style.maxHeight = maxH + 'px';
        panel.style.top = (rect.bottom + 4) + 'px';
      }

      wrap.classList.add('open');
      const activeOpt = panel.querySelector('.csel-option.active');
      if (activeOpt) activeOpt.scrollIntoView({ block: 'nearest' });

      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('touchstart', onOutside, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', closePanel);
      document.addEventListener('scroll', onScroll, true);
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    });

    ['value', 'innerHTML', 'selectedIndex', 'disabled'].forEach(prop => {
      const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop) ||
                   Object.getOwnPropertyDescriptor(Element.prototype, prop) ||
                   Object.getOwnPropertyDescriptor(Node.prototype, prop);
      if (!desc || !desc.set) return;
      Object.defineProperty(native, prop, {
        configurable: true,
        get() { return desc.get.call(native); },
        set(v) { desc.set.call(native, v); refreshLabel(); }
      });
    });

    refreshLabel();
  }

  function enhanceAllSelects() {
    document.querySelectorAll('select').forEach(sel => {
      if (sel.id) enhanceSelect(sel.id);
    });
  }

  enhanceAllSelects();


