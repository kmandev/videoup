-- ============================================================
-- VideoUp — แจ้งเตือนผ่าน Telegram
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================
alter table public.user_settings add column if not exists telegram_on      boolean default false;
alter table public.user_settings add column if not exists telegram_chat_id  text;
