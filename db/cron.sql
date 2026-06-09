-- ============================================================
-- VideoUp — ตั้งเวลาโพสต์อัตโนมัติ (แทน Raspberry Pi)
-- ใช้ pg_cron เรียก Edge Function publish-post (โหมด due) ทุก 1 นาที
-- ⚠️ ต้องแทน <SERVICE_ROLE_KEY> ด้วย service_role key จริง
--    (Supabase Dashboard → Settings → API → service_role — secret!)
-- รันใน Supabase → SQL Editor
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ลบ job เดิม (ถ้ามี) แล้วตั้งใหม่
select cron.unschedule('videoup-publish-due')
where exists (select 1 from cron.job where jobname = 'videoup-publish-due');

select cron.schedule(
  'videoup-publish-due',
  '* * * * *',                -- ทุก 1 นาที
  $$
  select net.http_post(
    url := 'https://qecufglvnslwjogqpnro.supabase.co/functions/v1/publish-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('due', true)
  );
  $$
);

-- ตรวจสอบ:  select * from cron.job;
-- ดู log:    select * from cron.job_run_details order by start_time desc limit 10;
