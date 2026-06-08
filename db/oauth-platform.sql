-- ============================================================
-- VideoUp — รองรับ OAuth ของแพลตฟอร์มปลายทาง (YouTube ฯลฯ)
-- เดิม oauth_states.provider จำกัดแค่ gdrive/dropbox/onedrive
-- ทำให้เชื่อม youtube/tiktok ไม่ได้ (insert ถูก CHECK ปฏิเสธ → state หาย → "ลิงก์หมดอายุ")
-- รันครั้งเดียวใน Supabase → SQL Editor
-- ============================================================

-- ลบ CHECK เดิมที่จำกัด provider (ชื่อ default = oauth_states_provider_check)
alter table public.oauth_states drop constraint if exists oauth_states_provider_check;

-- (ไม่ต้องใส่ CHECK ใหม่ — ตารางนี้ใช้ภายในโดย service_role เท่านั้น)
