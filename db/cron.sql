-- ============================================================
-- VideoUp — ตั้งเวลาโพสต์อัตโนมัติบนคลาวด์
-- ใช้ pg_cron + pg_net เรียก Edge Function publish-post (โหมด due) ทุก 1 นาที
-- ใช้ CRON_SECRET (ตั้งค่าด้วย `supabase secrets set CRON_SECRET=...`)
-- แทน service_role key — ปลอดภัยกว่า เพราะ CRON_SECRET ใช้ได้แค่โหมด due เท่านั้น
-- รันใน Supabase → SQL Editor
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ลบ job เดิม (กันซ้ำ) แล้วตั้งใหม่
select cron.unschedule('videoup-publish-due')
where exists (select 1 from cron.job where jobname = 'videoup-publish-due');

select cron.schedule(
  'videoup-publish-due',
  '* * * * *',                -- ทุก 1 นาที
  $$
  select net.http_post(
    url     := 'https://qecufglvnslwjogqpnro.supabase.co/functions/v1/publish-post',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer vucron_b7c97e4cc04d83bb1ad91709c71573c7'
               ),
    body    := jsonb_build_object('due', true),
    timeout_milliseconds := 60000
  );
  $$
);

-- ตรวจสอบ:  select * from cron.job;
-- ดู log:    select * from cron.job_run_details order by start_time desc limit 10;
-- ยกเลิก:    select cron.unschedule('videoup-publish-due');
