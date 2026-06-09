-- ============================================================
-- VideoUp — ตารางสินค้า + เนื้อหาต่อแพลตฟอร์ม (template)
-- ใช้เลือกตอนสร้างโพสต์ → เติมเนื้อหาอัตโนมัติ (แก้ไขต่อได้)
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  affiliate_link  text default '',
  -- content = { youtube:{title,caption,hashtags,link}, tiktok:{...}, ... }
  content         jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_products_user on public.products(user_id);

alter table public.products enable row level security;

drop policy if exists "products own" on public.products;
create policy "products own" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
