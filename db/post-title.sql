-- ============================================================
-- VideoUp — เพิ่ม title ต่อแพลตฟอร์ม (เช่น YouTube ต้องมีชื่อวิดีโอ)
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================
alter table public.post_platforms add column if not exists title text;
