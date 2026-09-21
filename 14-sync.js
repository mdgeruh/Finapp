  // ============================================================
  // SINKRON CLOUD (Supabase): login, tarik/kirim data, penyelesaian bentrok
  // Aktif hanya kalau SUPABASE_URL & SUPABASE_ANON_KEY di js/00-config.js terisi.
  // localStorage tetap jadi penyimpanan utama (app tetap cepat & jalan offline);
  // cloud adalah salinan yang dikirim di latar belakang setelah tiap perubahan.
  // ============================================================
  const SYNC_META_KEY = 'kp_sync_meta';   // {uid, version, dirty}: versi cloud terakhir yang dikenal perangkat ini
  const SYNC_TABLE = 'app_data';
  const sync = { client: null, uid: null, email: '', ready: false, pushing: false, rerun: false, timer: null, status: 'local' };

  function syncConfigured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }

  function syncReadMeta() {
    try { return JSON.parse(localStorage.getItem(SYNC_META_KEY) || 'null'); } catch (e) { return null; }
  }
  function syncWriteMeta(m) {
    try { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); } catch (e) { /* tidak kritis */ }
  }

  // Dipanggil dari saveData() setiap ada perubahan data. Selalu menandai "belum terkirim"
  // (juga saat offline / belum login), supaya perubahan itu pasti dikirim pada sesi berikutnya.
  function syncAfterSave() {
    if (!syncConfigured()) return;
    const meta = syncReadMeta() || { uid: null, version: 0 };
    meta.dirty = true;
    syncWriteMeta(meta);
    if (sync.ready) syncSchedulePush();
  }

  function syncTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  }

  // ---------- Status kecil di bawah footer ----------
  const SYNC_STATUS_TEXT = {
    ok: '☁ Tersinkron',
    saving: '☁ Menyimpan…',
    error: '☁ Belum terkirim, tersimpan di perangkat ini',
    local: 'Mode lokal (tidak tersinkron)',
    stale: '☁ Ada pembaruan dari perangkat lain. '
  };
  function syncSetStatus(s) {
    sync.status = s;
    let el = document.getElementById('sync-status');
    if (!el) {
      const f = document.getElementById('app-footer');
      if (!f) return;
      el = document.createElement('div');
      el.id = 'sync-status';
      f.insertAdjacentElement('afterend', el);
    }
    el.className = 'sync-status no-print ' + s;
    el.textContent = SYNC_STATUS_TEXT[s] || '';
    if (s === 'stale') {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Muat ulang';
      b.addEventListener('click', () => location.reload());
      el.appendChild(b);
    }
  }

  // ---------- Overlay: login & pilihan saat data bentrok ----------
  function syncOverlay(solid) {
    let ov = document.getElementById('sync-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'sync-overlay';
      document.body.appendChild(ov);
    }
    ov.className = 'modal-overlay sync-overlay' + (solid ? ' solid' : '');
    return ov;
  }
  function syncCloseOverlay() {
    const ov = document.getElementById('sync-overlay');
    if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
  }

  function syncShowLogin() {
    return new Promise((resolve) => {
      const ov = syncOverlay(true);
      ov.innerHTML =
        '<div class="modal-box">' +
          '<form id="sync-form" novalidate>' +
            '<div class="sheet-title">Masuk untuk sinkron</div>' +
            '<input id="sync-email" type="email" autocomplete="username" inputmode="email" placeholder="Email" aria-label="Email">' +
            '<input id="sync-pass" type="password" autocomplete="current-password" placeholder="Kata sandi" aria-label="Kata sandi">' +
            '<div id="sync-msg" class="sync-msg" role="status"></div>' +
            '<div class="sync-choices">' +
              '<button type="submit" id="sync-login-btn" class="modal-btn confirm">Masuk</button>' +
              '<button type="button" id="sync-local-btn" class="modal-btn cancel">Pakai mode lokal dulu</button>' +
            '</div>' +
          '</form>' +
        '</div>';
      ov.classList.add('open');
      const msg = (t) => { document.getElementById('sync-msg').textContent = t; };
      const btn = document.getElementById('sync-login-btn');
      document.getElementById('sync-local-btn').addEventListener('click', () => { syncCloseOverlay(); resolve(null); });
      document.getElementById('sync-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('sync-email').value.trim();
        const password = document.getElementById('sync-pass').value;
        if (!email || !password) { msg('Isi email dan kata sandi.'); return; }
        btn.disabled = true;
        msg('Masuk…');
        try {
          const { data, error } = await syncTimeout(sync.client.auth.signInWithPassword({ email, password }), 15000);
          if (error || !data || !data.session) { msg('Email atau kata sandi salah, atau koneksi bermasalah.'); btn.disabled = false; return; }
          syncCloseOverlay();
          resolve(data.session);
        } catch (err) {
          msg('Tidak bisa terhubung. Coba lagi, atau pakai mode lokal dulu.');
          btn.disabled = false;
        }
      });
      setTimeout(() => { const el = document.getElementById('sync-email'); if (el) el.focus(); }, 50);
    });
  }

  // Dialog dengan beberapa tombol; mengembalikan indeks tombol yang dipilih. Tidak bisa ditutup dengan ketuk di luar.
  function syncAsk(title, message, labels) {
    return new Promise((resolve) => {
      const ov = syncOverlay(false);
      ov.innerHTML = '<div class="modal-box"><div class="sheet-title"></div><div class="modal-msg"></div><div class="sync-choices"></div></div>';
      ov.querySelector('.sheet-title').textContent = title;
      ov.querySelector('.modal-msg').textContent = message;
      const box = ov.querySelector('.sync-choices');
      labels.forEach((label, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'modal-btn ' + (i === 0 ? 'confirm' : 'cancel');
        b.textContent = label;
        b.addEventListener('click', () => { syncCloseOverlay(); resolve(i); });
        box.appendChild(b);
      });
      ov.classList.add('open');
    });
  }

  function syncCount(d) {
    const a = d && Array.isArray(d.accounts) ? d.accounts.length : 0;
    const t = d && Array.isArray(d.txns) ? d.txns.length : 0;
    return a + ' akun, ' + t + ' transaksi';
  }

  // ---------- Tarik dari cloud & samakan dengan data lokal ----------
  function syncApplyCloud(row) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row.data));
    syncWriteMeta({ uid: sync.uid, version: row.version, dirty: false });
  }

  // Mengembalikan true kalau data lokal diganti dengan data cloud (pemanggil perlu render ulang).
  async function syncReconcile() {
    const { data: row, error } = await syncTimeout(
      sync.client.from(SYNC_TABLE).select('data,version').eq('user_id', sync.uid).maybeSingle(), 10000);
    if (error) throw error;

    const localRaw = localStorage.getItem(STORAGE_KEY);
    const meta = syncReadMeta();
    const shared = !!(meta && meta.uid === sync.uid && meta.version > 0);   // perangkat ini pernah sinkron dengan baris cloud ini

    if (!row) {                                   // cloud masih kosong: kirim data lokal (kalau ada) sebagai isi awal
      syncWriteMeta({ uid: sync.uid, version: 0, dirty: !!localRaw });
      return false;
    }
    if (!row.data || !Array.isArray(row.data.accounts) || !Array.isArray(row.data.txns)) {
      throw new Error('format data cloud tidak valid');
    }
    if (!localRaw) { syncApplyCloud(row); return true; }
    if (shared && meta.version === row.version) return false;        // sudah sama (kalau dirty, dikirim setelah ini)
    if (shared && !meta.dirty) { syncApplyCloud(row); return true; } // cloud lebih baru, tidak ada perubahan lokal

    let localData = null;
    try { localData = JSON.parse(localRaw); } catch (e) { /* data lokal rusak */ }
    if (!localData) { syncApplyCloud(row); return true; }

    const why = shared
      ? 'Ada perubahan di perangkat ini yang belum terkirim, sementara data di cloud sudah berubah (mungkin dari perangkat lain).'
      : 'Cloud dan perangkat ini sama-sama sudah punya data, dan isinya berbeda.';
    const pick = await syncAsk(
      'Pilih data yang dipakai',
      why + '\n\nCloud: ' + syncCount(row.data) + '\nPerangkat ini: ' + syncCount(localData) +
        '\n\nData yang tidak dipilih dibackup ke file JSON dulu.',
      ['Pakai data cloud', 'Pakai data perangkat ini']);
    if (pick === 0) {
      await autoBackupBeforeReset(localData);
      syncApplyCloud(row);
      return true;
    }
    await autoBackupBeforeReset(row.data);
    syncWriteMeta({ uid: sync.uid, version: row.version, dirty: true });   // dikirim menimpa versi cloud saat ini
    return false;
  }

  // ---------- Kirim ke cloud ----------
  function syncSchedulePush() {
    clearTimeout(sync.timer);
    sync.timer = setTimeout(syncPush, 1500);   // tunggu jeda supaya beberapa perubahan beruntun jadi satu kiriman
    if (sync.status !== 'saving') syncSetStatus('saving');
  }

  async function syncPush() {
    if (!sync.ready) return;
    if (sync.pushing) { sync.rerun = true; return; }
    sync.pushing = true;
    syncSetStatus('saving');
    try {
      let rounds = 0;
      do {
        sync.rerun = false;
        if (++rounds > 5) throw new Error('sinkron berulang tanpa hasil (cek kebijakan RLS)');
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) break;
        const meta = syncReadMeta() || {};
        const v = (meta.uid === sync.uid && meta.version > 0) ? meta.version : 0;
        const payload = JSON.parse(raw);
        let conflict = false;

        if (v === 0) {
          const { error } = await syncTimeout(
            sync.client.from(SYNC_TABLE).insert({ user_id: sync.uid, data: payload, version: 1 }), 20000);
          if (error && error.code === '23505') conflict = true;      // baris sudah ada (dibuat perangkat lain)
          else if (error) throw error;
        } else {
          // Hanya berhasil kalau versi di cloud masih sama dengan yang terakhir kita lihat.
          const { data: rows, error } = await syncTimeout(
            sync.client.from(SYNC_TABLE)
              .update({ data: payload, version: v + 1, updated_at: new Date().toISOString() })
              .eq('user_id', sync.uid).eq('version', v).select('version'), 20000);
          if (error) throw error;
          if (!rows || rows.length === 0) conflict = true;
        }

        if (conflict) {
          const replaced = await syncReconcile();
          if (replaced) render(); else sync.rerun = true;
          continue;
        }
        const after = localStorage.getItem(STORAGE_KEY);
        syncWriteMeta({ uid: sync.uid, version: v === 0 ? 1 : v + 1, dirty: after !== raw });
        if (after !== raw) sync.rerun = true;      // ada perubahan baru selama pengiriman
      } while (sync.rerun);
      syncSetStatus('ok');
    } catch (e) {
      console.error('kirim ke cloud gagal', e);
      syncSetStatus('error');
      clearTimeout(sync.timer);
      sync.timer = setTimeout(syncPush, 30000);    // coba lagi otomatis
    } finally {
      sync.pushing = false;
    }
  }

  // ---------- Pembaruan dari perangkat lain ----------
  async function syncCheckStale() {
    try {
      const { data: row, error } = await syncTimeout(
        sync.client.from(SYNC_TABLE).select('version').eq('user_id', sync.uid).maybeSingle(), 8000);
      if (error || !row) return;
      const m = syncReadMeta();
      if (m && m.uid === sync.uid && !m.dirty && row.version > (m.version || 0)) syncSetStatus('stale');
    } catch (e) { /* abaikan; dicek lagi nanti */ }
  }
  function syncOnBackOnlineOrVisible() {
    if (!sync.ready || sync.pushing) return;
    const m = syncReadMeta();
    if (m && m.dirty) syncSchedulePush(); else syncCheckStale();
  }

  // ---------- Keluar ----------
  function syncShowLogout() {
    const b = document.getElementById('sync-logout-btn');
    if (!b) return;
    b.style.display = 'block';
    b.textContent = 'Keluar (' + sync.email + ')';
  }
  async function syncLogout() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.classList.remove('open');
    const m = syncReadMeta();
    if (m && m.dirty) {
      clearTimeout(sync.timer);
      await syncPush();
      const m2 = syncReadMeta();
      if (m2 && m2.dirty) {
        const ok = await showConfirm('Perubahan terakhir belum terkirim ke cloud. Tetap keluar? Data tetap ada di perangkat ini.');
        if (!ok) return;
      }
    }
    try { await sync.client.auth.signOut(); } catch (e) { /* tetap lanjut */ }
    location.reload();
  }

  // ---------- Titik masuk: dipanggil sekali oleh 15-startup.js sebelum render pertama ----------
  async function syncBoot() {
    if (!syncConfigured()) return;                                        // mode lokal murni
    if (!(window.supabase && window.supabase.createClient)) {             // pustaka gagal dimuat (offline)
      syncSetStatus('local');
      return;
    }
    sync.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let session = null;
    try {
      const r = await syncTimeout(sync.client.auth.getSession(), 8000);
      session = r && r.data ? r.data.session : null;
    } catch (e) { session = null; }
    if (!session) session = await syncShowLogin();
    if (!session) { syncSetStatus('local'); return; }

    sync.uid = session.user.id;
    sync.email = session.user.email || '';
    sync.ready = true;
    syncShowLogout();
    window.addEventListener('online', syncOnBackOnlineOrVisible);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncOnBackOnlineOrVisible(); });

    try {
      await syncReconcile();
      const m = syncReadMeta();
      if (m && m.dirty) syncSchedulePush(); else syncSetStatus('ok');
    } catch (e) {
      console.error('tarik dari cloud gagal, lanjut dengan data lokal', e);
      syncSetStatus('error');
      clearTimeout(sync.timer);
      sync.timer = setTimeout(syncPush, 30000);
    }
  }
