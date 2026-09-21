  // ============================================================
  // SINKRON CLOUD (Supabase): login, tarik/kirim data, penyelesaian bentrok
  // Aktif hanya kalau SUPABASE_URL & SUPABASE_ANON_KEY di js/00-config.js terisi.
  // localStorage tetap jadi penyimpanan utama (app tetap cepat & jalan offline);
  // cloud adalah salinan yang dikirim di latar belakang setelah tiap perubahan.
  // ============================================================
  const SYNC_META_KEY = 'kp_sync_meta';   // {uid, version, dirty}: versi cloud terakhir yang dikenal perangkat ini
  const SYNC_TABLE = 'app_data';
  const sync = { client: null, uid: null, email: '', ready: false, pushing: false, rerun: false, timer: null, status: 'local', listening: false, loginBusy: false };

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

  // ---------- Layar masuk: potongan markup & helper kecil ----------
  const AUTH_EYE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M4 4l16 16"/></svg>';

  function authPasswordField(id, label, autocomplete, placeholder, labelExtra) {
    return '<div class="auth-field">' +
      '<div class="auth-label-row"><label for="' + id + '">' + label + '</label>' + (labelExtra || '') + '</div>' +
      '<div class="auth-input-wrap">' +
        '<input class="auth-input has-eye" id="' + id + '" type="password" autocomplete="' + autocomplete + '" placeholder="' + placeholder + '" autocapitalize="none" spellcheck="false">' +
        '<button type="button" class="auth-eye" data-for="' + id + '" aria-label="Tampilkan kata sandi" aria-pressed="false">' + AUTH_EYE_SVG + '</button>' +
      '</div></div>';
  }
  function authWireEyes(root) {
    root.querySelectorAll('.auth-eye').forEach((b) => {
      b.addEventListener('click', () => {
        const input = document.getElementById(b.dataset.for);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.classList.toggle('on', show);
        b.setAttribute('aria-pressed', show ? 'true' : 'false');
        b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
      });
    });
  }
  function authMsg(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'auth-msg' + (kind ? ' ' + kind : '');
  }
  function authBusy(btn, busy) {
    btn.disabled = busy;
    btn.classList.toggle('loading', busy);
  }
  function authShell(inner) {
    return '<div class="auth-shell"><div class="auth-brand" aria-hidden="true">Rp</div>' + inner + '</div>';
  }

  // opts.fromMenu: dibuka dari menu gear (bukan saat app dibuka), jadi tombol bawah berarti "Batal".
  function syncShowLogin(opts) {
    const fromMenu = !!(opts && opts.fromMenu);
    return new Promise((resolve) => {
      const ov = syncOverlay(true);

      function renderLoginView(prefillEmail) {
        ov.innerHTML = authShell(
          '<form class="auth" id="sync-form" novalidate>' +
            '<h2>Masuk</h2>' +
            '<p class="auth-sub">Data keuanganmu disimpan di akun ini dan tersinkron ke semua perangkat.</p>' +
            '<div class="auth-field">' +
              '<div class="auth-label-row"><label for="sync-email">Email</label></div>' +
              '<input class="auth-input" id="sync-email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="nama@email.com" value="' + escapeHtml(prefillEmail || '').replace(/"/g, '&quot;') + '">' +
            '</div>' +
            authPasswordField('sync-pass', 'Kata sandi', 'current-password', 'Kata sandi',
              '<button type="button" class="auth-link" id="sync-forgot-btn">Lupa kata sandi?</button>') +
            '<div id="sync-msg" class="auth-msg" role="status" aria-live="polite"></div>' +
            '<button type="submit" id="sync-login-btn" class="auth-btn">Masuk</button>' +
            '<div class="auth-alt">' +
              '<button type="button" id="sync-local-btn" class="auth-link">' + (fromMenu ? 'Batal' : 'Pakai mode lokal dulu') + '</button>' +
              (fromMenu ? '' : '<p class="auth-note">Data hanya tersimpan di perangkat ini sampai kamu masuk.</p>') +
            '</div>' +
          '</form>');
        ov.classList.add('open');
        authWireEyes(ov);
        const btn = document.getElementById('sync-login-btn');
        document.getElementById('sync-local-btn').addEventListener('click', () => { syncCloseOverlay(); resolve(null); });
        document.getElementById('sync-forgot-btn').addEventListener('click', () => {
          renderForgotView(document.getElementById('sync-email').value.trim());
        });
        document.getElementById('sync-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('sync-email').value.trim();
          const password = document.getElementById('sync-pass').value;
          if (!email || !password) { authMsg('sync-msg', 'Isi email dan kata sandi.', 'error'); return; }
          authMsg('sync-msg', '');
          authBusy(btn, true);
          try {
            const { data, error } = await syncTimeout(sync.client.auth.signInWithPassword({ email, password }), 15000);
            if (error || !data || !data.session) { authMsg('sync-msg', 'Email atau kata sandi salah, atau koneksi bermasalah.', 'error'); authBusy(btn, false); return; }
            syncCloseOverlay();
            resolve(data.session);
          } catch (err) {
            authMsg('sync-msg', 'Tidak bisa terhubung. Coba lagi, atau pakai mode lokal dulu.', 'error');
            authBusy(btn, false);
          }
        });
        setTimeout(() => { const el = document.getElementById(prefillEmail ? 'sync-pass' : 'sync-email'); if (el) el.focus(); }, 50);
      }

      // Sub-view "lupa kata sandi": kirim email reset lewat Supabase. Tautan di email itu akan
      // membuka app ini lagi dengan sesi pemulihan sementara -> ditangkap event PASSWORD_RECOVERY
      // di syncBoot() yang lalu menampilkan syncShowSetNewPassword().
      function renderForgotView(prefillEmail) {
        ov.innerHTML = authShell(
          '<form class="auth" id="sync-forgot-form" novalidate>' +
            '<h2>Atur ulang kata sandi</h2>' +
            '<p class="auth-sub">Kami kirim tautan untuk membuat kata sandi baru ke email ini.</p>' +
            '<div class="auth-field">' +
              '<div class="auth-label-row"><label for="sync-forgot-email">Email</label></div>' +
              '<input class="auth-input" id="sync-forgot-email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="nama@email.com" value="' + escapeHtml(prefillEmail || '').replace(/"/g, '&quot;') + '">' +
            '</div>' +
            '<div id="sync-forgot-msg" class="auth-msg" role="status" aria-live="polite"></div>' +
            '<button type="submit" id="sync-forgot-send-btn" class="auth-btn">Kirim tautan</button>' +
            '<div class="auth-alt">' +
              '<button type="button" id="sync-forgot-back-btn" class="auth-link">Kembali ke halaman masuk</button>' +
            '</div>' +
          '</form>');
        document.getElementById('sync-forgot-back-btn').addEventListener('click', () => {
          renderLoginView(document.getElementById('sync-forgot-email').value.trim());
        });
        document.getElementById('sync-forgot-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('sync-forgot-email').value.trim();
          if (!email) { authMsg('sync-forgot-msg', 'Isi email dulu.', 'error'); return; }
          const sendBtn = document.getElementById('sync-forgot-send-btn');
          authMsg('sync-forgot-msg', '');
          authBusy(sendBtn, true);
          try {
            const { error } = await syncTimeout(sync.client.auth.resetPasswordForEmail(email, { redirectTo: location.href }), 15000);
            if (error) { authMsg('sync-forgot-msg', 'Gagal mengirim: ' + error.message, 'error'); authBusy(sendBtn, false); return; }
            authMsg('sync-forgot-msg', 'Tautan terkirim. Cek email kamu, lalu buka tautannya untuk membuat kata sandi baru.', 'ok');
            authBusy(sendBtn, false);
          } catch (err) {
            authMsg('sync-forgot-msg', 'Tidak bisa terhubung. Coba lagi.', 'error');
            authBusy(sendBtn, false);
          }
        });
        setTimeout(() => { const el = document.getElementById('sync-forgot-email'); if (el) el.focus(); }, 50);
      }

      renderLoginView();
    });
  }

  // Ditampilkan saat Supabase mendeteksi sesi pemulihan password (link dari email reset).
  // Setelah kata sandi baru disimpan, halaman dimuat ulang supaya syncBoot() jalan normal dari awal.
  function syncShowSetNewPassword() {
    const ov = syncOverlay(true);
    ov.innerHTML = authShell(
      '<form class="auth" id="sync-newpass-form" novalidate>' +
        '<h2>Buat kata sandi baru</h2>' +
        '<p class="auth-sub">Gunakan minimal 6 karakter. Setelah disimpan, kamu langsung masuk.</p>' +
        authPasswordField('sync-newpass', 'Kata sandi baru', 'new-password', 'Kata sandi baru') +
        '<div id="sync-newpass-msg" class="auth-msg" role="status" aria-live="polite"></div>' +
        '<button type="submit" id="sync-newpass-btn" class="auth-btn">Simpan kata sandi</button>' +
      '</form>');
    ov.classList.add('open');
    authWireEyes(ov);
    const btn = document.getElementById('sync-newpass-btn');
    document.getElementById('sync-newpass-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = document.getElementById('sync-newpass').value;
      if (!pass || pass.length < 6) { authMsg('sync-newpass-msg', 'Kata sandi minimal 6 karakter.', 'error'); return; }
      authMsg('sync-newpass-msg', '');
      authBusy(btn, true);
      try {
        const { error } = await syncTimeout(sync.client.auth.updateUser({ password: pass }), 15000);
        if (error) { authMsg('sync-newpass-msg', 'Gagal menyimpan: ' + error.message, 'error'); authBusy(btn, false); return; }
        syncCloseOverlay();
        location.reload();
      } catch (err) {
        authMsg('sync-newpass-msg', 'Tidak bisa terhubung. Coba lagi.', 'error');
        authBusy(btn, false);
      }
    });
    setTimeout(() => { const el = document.getElementById('sync-newpass'); if (el) el.focus(); }, 50);
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

  // ---------- Ubah email & password akun sinkron (dipanggil dari tab Profil) ----------
  async function syncChangeEmail() {
    if (!sync.ready) return;
    const input = document.getElementById('profil-email-input');
    const email = input ? input.value.trim() : '';
    if (!email) { showIoMsg('Isi email baru dulu.', 'error', 'profil-sync-msg'); return; }
    try {
      const { error } = await syncTimeout(sync.client.auth.updateUser({ email }), 15000);
      if (error) { showIoMsg('Gagal ubah email: ' + error.message, 'error', 'profil-sync-msg'); return; }
      if (input) input.value = '';
      showIoMsg('Email konfirmasi dikirim ke alamat lama & baru. Buka link di email untuk menyelesaikan perubahan.', 'ok', 'profil-sync-msg');
    } catch (e) {
      showIoMsg('Tidak bisa terhubung. Coba lagi.', 'error', 'profil-sync-msg');
    }
  }

  async function syncChangePassword() {
    if (!sync.ready) return;
    const input = document.getElementById('profil-pass-input');
    const pass = input ? input.value : '';
    if (!pass || pass.length < 6) { showIoMsg('Password minimal 6 karakter.', 'error', 'profil-sync-msg'); return; }
    try {
      const { error } = await syncTimeout(sync.client.auth.updateUser({ password: pass }), 15000);
      if (error) { showIoMsg('Gagal ubah password: ' + error.message, 'error', 'profil-sync-msg'); return; }
      if (input) input.value = '';
      showIoMsg('Password berhasil diubah.', 'ok', 'profil-sync-msg');
    } catch (e) {
      showIoMsg('Tidak bisa terhubung. Coba lagi.', 'error', 'profil-sync-msg');
    }
  }

  // ---------- Menu gear: tampilkan "Masuk" kalau belum login, "Keluar" kalau sudah ----------
  function syncUpdateMenu() {
    const loginBtn = document.getElementById('sync-menu-login-btn');
    const logoutBtn = document.getElementById('sync-logout-btn');
    const showLogin = syncConfigured() && !sync.ready;
    if (loginBtn) loginBtn.style.display = showLogin ? 'block' : 'none';
    if (logoutBtn && !sync.ready) logoutBtn.style.display = 'none';
  }

  function syncInitClient() {
    if (sync.client) return true;
    if (!(window.supabase && window.supabase.createClient)) return false;   // pustaka gagal dimuat (offline)
    sync.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Kalau app dibuka lewat link reset password dari email, Supabase mendeteksi token di URL
    // dan memicu event ini dengan sesi pemulihan sementara -> tampilkan form password baru
    // di atas alur boot normal (yang tetap lanjut di belakang layar, tidak masalah karena
    // overlay-nya solid dan setelah password disimpan halaman dimuat ulang).
    sync.client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') syncShowSetNewPassword();
    });
    return true;
  }

  // Dipakai bersama oleh syncBoot() dan login dari menu gear: aktifkan sinkron untuk sesi ini,
  // lalu samakan data lokal dengan cloud. Mengembalikan true kalau data lokal diganti data cloud.
  async function syncStartSession(session) {
    sync.uid = session.user.id;
    sync.email = session.user.email || '';
    sync.ready = true;
    syncShowLogout();
    if (!sync.listening) {
      sync.listening = true;
      window.addEventListener('online', syncOnBackOnlineOrVisible);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncOnBackOnlineOrVisible(); });
    }
    let replaced = false;
    try {
      replaced = await syncReconcile();
      const m = syncReadMeta();
      if (m && m.dirty) syncSchedulePush(); else syncSetStatus('ok');
    } catch (e) {
      console.error('tarik dari cloud gagal, lanjut dengan data lokal', e);
      syncSetStatus('error');
      clearTimeout(sync.timer);
      sync.timer = setTimeout(syncPush, 30000);
    }
    return replaced;
  }

  // Dipanggil dari menu gear saat belum login (misalnya tadi memilih "Pakai mode lokal dulu").
  async function syncLoginFromMenu() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.classList.remove('open');
    if (sync.ready || sync.loginBusy || !syncConfigured()) return;
    if (!syncInitClient()) {
      await syncAsk('Belum bisa masuk', 'Pustaka sinkron belum termuat. Periksa koneksi internet, lalu muat ulang halaman.', ['Tutup']);
      return;
    }
    sync.loginBusy = true;
    try {
      const session = await syncShowLogin({ fromMenu: true });
      if (!session) return;                           // dibatalkan
      const replaced = await syncStartSession(session);
      if (replaced) { populateCategorySelect(); render(); }
      if (typeof renderProfilTab === 'function') renderProfilTab();
    } finally {
      sync.loginBusy = false;
      syncUpdateMenu();
    }
  }

  // ---------- Titik masuk: dipanggil sekali oleh 15-startup.js sebelum render pertama ----------
  async function syncBoot() {
    try { await syncBootInner(); } finally { syncUpdateMenu(); }
  }
  async function syncBootInner() {
    if (!syncConfigured()) return;                                        // mode lokal murni
    if (!syncInitClient()) { syncSetStatus('local'); return; }            // pustaka gagal dimuat (offline)

    let session = null;
    try {
      const r = await syncTimeout(sync.client.auth.getSession(), 8000);
      session = r && r.data ? r.data.session : null;
    } catch (e) { session = null; }
    if (!session) session = await syncShowLogin();
    if (!session) { syncSetStatus('local'); return; }

    await syncStartSession(session);
  }
