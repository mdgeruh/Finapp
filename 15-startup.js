  // ============================================================
  // STARTUP: dijalankan terakhir, setelah semua file js/ selesai dimuat
  // (kode yang memanggil fungsi dari file lain harus ada di sini, bukan di file asalnya)
  // ============================================================
  (function () {
    const h = new Date().getHours();
    const sapa = h >= 4 && h < 11 ? 'Selamat pagi' : (h >= 11 && h < 15 ? 'Selamat siang' : (h >= 15 && h < 18 ? 'Selamat sore' : 'Selamat malam'));
    const g = $('greeting');
    if (g) g.innerHTML = escapeHtml(sapa) + ', <b>' + escapeHtml(OWNER_NAME) + '</b>';
  })();
  $('today-date').textContent = todayGmt8().toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  // Sinkron cloud dulu (login + tarik data), baru render pertama — supaya data cloud tidak tertimpa data contoh.
  // Kalau sinkron tidak aktif / gagal, app langsung jalan dengan data lokal.
  (async function start() {
    try { await syncBoot(); } catch (e) { console.error('sinkron gagal, lanjut mode lokal', e); }
    populateCategorySelect();
    render();
  })();
