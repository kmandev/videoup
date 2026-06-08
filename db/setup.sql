-- ============================================================
-- VideoUp — SETUP รวม (schema + sources OAuth)
-- วางทั้งไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query → Run
-- รันซ้ำได้ปลอดภัย (idempotent)
-- ============================================================

-- ============================================================
-- VideoUp — Database schema (PostgreSQL / Supabase)
-- รันไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES  (ต่อยอดจาก auth.users)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null default 'VideoUp User',
  email       text,
  avatar      text,                    -- ตัวอักษรย่อ หรือ URL
  plan        text        not null default 'free'
              check (plan in ('free','pro','business')),
  created_at  timestamptz not null default now()
);

-- สร้าง profile อัตโนมัติเมื่อมี user ใหม่
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. SOURCES  (แหล่งวิดีโอ: Google Drive / Dropbox / OneDrive / URL)
-- ============================================================
create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('gdrive','dropbox','onedrive','url')),
  name        text not null,
  account     text,
  path        text,
  used_gb     numeric default 0,
  total_gb    numeric default 0,
  -- token สำหรับให้ Pi ดึงไฟล์ (เข้ารหัสฝั่ง app ก่อนบันทึก)
  credentials jsonb,
  connected   boolean default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sources_user on public.sources(user_id);

-- ============================================================
-- 3. PLATFORM CONNECTIONS  (บัญชีแต่ละแพลตฟอร์ม)
-- ============================================================
create table if not exists public.platform_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('tiktok','youtube','facebook','shopee','lazada')),
  handle       text,
  connected    boolean default false,
  credentials  jsonb,            -- access/refresh token (เข้ารหัส)
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, platform)
);
create index if not exists idx_platconn_user on public.platform_connections(user_id);

-- ============================================================
-- 4. VIDEOS  (คลังคลิป)
-- ============================================================
create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_id   uuid references public.sources(id) on delete set null,
  title       text not null,
  duration    int  default 0,        -- วินาที
  size_mb     numeric default 0,
  cover       text,                  -- gradient (linear-gradient…) หรือ public URL รูปใน Storage bucket 'covers'
  file_path   text,                  -- path/URL ในแหล่งเก็บ
  status      text default 'ready' check (status in ('ready','uploading','deleted')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_videos_user on public.videos(user_id);

-- ============================================================
-- 5. POSTS  (โพสต์/แคมเปญ — 1 คลิปต่อหลายแพลตฟอร์ม)
-- ============================================================
create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  video_id       uuid references public.videos(id) on delete set null,
  title          text not null,
  mode           text not null default 'later' check (mode in ('now','later')),
  scheduled_at   timestamptz,                -- null = โพสต์ทันที
  cleanup        boolean default false,      -- ลบไฟล์หลังโพสต์
  cleanup_delay  text default 'immediate' check (cleanup_delay in ('immediate','24h','7d')),
  status         text not null default 'scheduled'
                 check (status in ('draft','scheduled','publishing','published','partial','failed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_posts_user on public.posts(user_id);
create index if not exists idx_posts_sched on public.posts(scheduled_at) where status in ('scheduled','publishing');

-- ============================================================
-- 6. POST_PLATFORMS  (เนื้อหา + สถานะแยกรายแพลตฟอร์ม)
-- ============================================================
create table if not exists public.post_platforms (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.posts(id) on delete cascade,
  platform        text not null check (platform in ('tiktok','youtube','facebook','shopee','lazada')),
  caption         text default '',
  hashtags        text default '',
  affiliate_link  text default '',
  status          text not null default 'scheduled'
                  check (status in ('draft','scheduled','publishing','published','failed')),
  error           text,
  retry_count     int default 0,
  external_url     text,           -- ลิงก์โพสต์ที่ได้กลับมาหลังอัปสำเร็จ
  published_at    timestamptz,
  unique (post_id, platform)
);
create index if not exists idx_postplat_post on public.post_platforms(post_id);
-- Pi ใช้ index นี้ดึงงานที่ค้างอยู่
create index if not exists idx_postplat_status on public.post_platforms(status) where status in ('scheduled','publishing','failed');

-- ============================================================
-- 7. SUBSCRIPTIONS  (แพ็กเกจ/การเงิน)
-- ============================================================
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan_id            text not null default 'free' check (plan_id in ('free','pro','business')),
  status             text not null default 'active' check (status in ('active','canceled','past_due')),
  current_period_end timestamptz,
  clips_used         int default 0,
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 8. NOTIFICATION + DEFAULT SETTINGS
-- ============================================================
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- การแจ้งเตือน
  email_on        boolean default true,
  line_on         boolean default false,
  line_token      text,
  webhook_on      boolean default false,
  webhook_url     text,
  notify_success  boolean default true,
  notify_fail     boolean default true,
  notify_queue    boolean default false,
  -- ค่าเริ่มต้น
  timezone         text default 'Asia/Bangkok',
  cleanup_default  text default 'off',
  default_hashtags jsonb default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_posts_touch on public.posts;
create trigger trg_posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY  — แต่ละ user เห็นเฉพาะข้อมูลตัวเอง
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.sources             enable row level security;
alter table public.platform_connections enable row level security;
alter table public.videos              enable row level security;
alter table public.posts               enable row level security;
alter table public.post_platforms      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.user_settings       enable row level security;

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- helper macro pattern: ตารางที่มี user_id
do $$
declare t text;
begin
  foreach t in array array['sources','platform_connections','videos','posts','subscriptions','user_settings']
  loop
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- post_platforms: เช็คผ่าน parent post
drop policy if exists "own via post" on public.post_platforms;
create policy "own via post" on public.post_platforms
  for all using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- ============================================================
-- STORAGE: bucket รูปปก/พรีวิววิดีโอ
-- เก็บไฟล์ไว้ที่ path  <user_id>/<video_id>.<ext>
-- bucket เป็น public (อ่านได้ทุกคน) แต่เขียน/ลบได้เฉพาะเจ้าของ folder
-- ============================================================
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

-- อ่าน: ใครก็ได้ (รูปปก public)
drop policy if exists "covers read" on storage.objects;
create policy "covers read" on storage.objects
  for select using (bucket_id = 'covers');

-- เขียน/แก้/ลบ: เฉพาะ user ที่เป็นเจ้าของ folder (ชื่อ folder = auth.uid())
drop policy if exists "covers insert own" on storage.objects;
create policy "covers insert own" on storage.objects
  for insert with check (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers update own" on storage.objects;
create policy "covers update own" on storage.objects
  for update using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers delete own" on storage.objects;
create policy "covers delete own" on storage.objects
  for delete using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- VIEW: posts พร้อม platform aggregate (ใช้ใน dashboard/calendar)
-- ============================================================
create or replace view public.posts_full as
select
  p.*,
  v.title    as video_title,
  v.duration as video_duration,
  v.cover    as video_cover,
  v.source_id,
  coalesce(
    jsonb_object_agg(pp.platform, pp.status) filter (where pp.platform is not null),
    '{}'::jsonb
  ) as platforms
from public.posts p
left join public.videos v on v.id = p.video_id
left join public.post_platforms pp on pp.post_id = p.id
group by p.id, v.title, v.duration, v.cover, v.source_id;


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
