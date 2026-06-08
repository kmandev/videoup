/* ============================================================
   VideoUp — Supabase client init
   ถ้าไม่กรอก config.js จะรันใน demo mode (ข้อมูล mock)
   ============================================================ */
(function () {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn('[VideoUp] Supabase ยังไม่ได้ตั้งค่า — รันใน Demo Mode');
    window.sb = null;
    return;
  }
  const { createClient } = window.supabase;
  window.sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'videoup_session',
      autoRefreshToken: true,
    },
  });
  console.log('[VideoUp] Supabase connected ✓');
})();
