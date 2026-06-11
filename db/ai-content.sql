-- ============================================================
-- VideoUp — ตั้งค่า AI สำหรับ auto-generate ชื่อวิดีโอ/แคปชั่น/แฮชแท็ก
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================
alter table public.user_settings add column if not exists ai_provider text default 'openai';
alter table public.user_settings add column if not exists ai_api_key  text;
alter table public.user_settings add column if not exists ai_model    text;
