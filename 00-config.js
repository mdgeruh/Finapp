  // ============================================================
  // KONFIGURASI SUPABASE (sinkron cloud)
  // Kosongkan SUPABASE_ANON_KEY untuk memakai app 100% lokal (tanpa login, tanpa cloud).
  // Anon/publishable key memang publik dan aman ada di sini, ASALKAN Row Level Security aktif
  // (lihat supabase/setup.sql). JANGAN PERNAH menaruh kata sandi database atau key "service_role" di file ini.
  // Ambil di: Supabase -> Project Settings -> API (atau API Keys) -> anon / publishable key.
  // ============================================================
  const SUPABASE_URL = 'https://zjqlblhbznhpmzposwto.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_AgrqKY6LHxRyjveTwqBQlw_U_56wKEl';
