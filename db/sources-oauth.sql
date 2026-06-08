-- ============================================================
-- VideoUp — Cloud Source OAuth (เพิ่มเติมจาก schema.sql)
-- รันใน Supabase SQL Editor หลังจากรัน schema.sql แล้ว
-- ============================================================

-- 1) reconnect ผู้ให้บริการเดิม → อัปเดตแทนสร้างซ้ำ
--    (ต้องมี unique ก่อนถึง upsert ด้วย onConflict 'user_id,type' ได้)
alter table public.sources
  drop constraint if exists sources_user_type_unique;
alter table public.sources
  add constraint sources_user_type_unique unique (user_id, type);

-- 2) ตารางพัก state ระหว่าง OAuth handshake (กันการปลอม callback)
--    เขียน/อ่านเฉพาะ Edge Function (service_role) — client เข้าไม่ได้
create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text not null check (provider in ('gdrive','dropbox','onedrive')),
  return_to   text,
  created_at  timestamptz not null default now()
);

alter table public.oauth_states enable row level security;
-- ไม่มี policy = ไม่มีใคร (ฝั่ง client) เข้าถึงได้ มีแต่ service_role ที่ bypass RLS

-- 3) ลบ state ที่ค้างเกิน 10 นาที (เรียกเป็นครั้งคราว หรือผ่าน cron)
create or replace function public.cleanup_oauth_states()
returns void language sql as $$
  delete from public.oauth_states where created_at < now() - interval '10 minutes';
$$;
