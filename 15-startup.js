  // ============================================================
  // STARTUP: dijalankan terakhir, setelah semua file js/ selesai dimuat
  // (kode yang memanggil fungsi dari file lain harus ada di sini, bukan di file asalnya)
  // ============================================================
  updateGreeting();
  $('today-date').textContent = todayGmt8().toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  // Sinkron cloud dulu (login + tarik data), baru render pertama — supaya data cloud tidak tertimpa data contoh.
  // Kalau sinkron tidak aktif / gagal, app langsung jalan dengan data lokal.
  (async function start() {
    try { await syncBoot(); } catch (e) { console.error('sinkron gagal, lanjut mode lokal', e); }
    populateCategorySelect();
    render();
  })();
