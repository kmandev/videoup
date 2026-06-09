-- ============================================================
-- VideoUp — โพสต์ตามเวลาอัตโนมัติ (แทน Raspberry Pi)
-- ใช้ pg_cron + pg_net เรียก Edge Function publish-post (โหมด due) ทุก 1 นาที
--
-- วิธีใช้ (รันใน Supabase → SQL Editor):
--   1) แทนที่ <SERVICE_ROLE_KEY> ด้วย service_role key จริง
--      (Dashboard → Project Settings → API → service_role — ลับ! อย่าแชร์)
--   2) รันทั้งไฟล์
-- ============================================================

-- เปิด extension ที่จำเป็น
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ลบ job เดิม (กันซ้ำ) แล้วตั้งใหม่
select cron.unschedule('videoup-publish-due')
where exists (select 1 from cron.job where jobname = 'videoup-publish-due');

-- ตั้งเวลา: ทุก 1 นาที เรียก publish-post แบบ { due: true }
select cron.schedule(
  'videoup-publish-due',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://qecufglvnslwjogqpnro.supabase.co/functions/v1/publish-post',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := jsonb_build_object('due', true),
    timeout_milliseconds := 60000
  );
  $$
);

-- ตรวจสอบ: ดู job ที่ตั้งไว้
-- select * from cron.job;
-- ดูประวัติการรัน:
-- select * from cron.job_run_details order by start_time desc limit 20;
-- ยกเลิก: select cron.unschedule('videoup-publish-due');
