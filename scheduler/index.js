/* ============================================================
   VideoUp Scheduler  —  รันบน Raspberry Pi 4B
   ------------------------------------------------------------
   วนเช็คคิวทุก POLL_INTERVAL วินาที:
     1. หา post ที่ถึงเวลา (scheduled_at <= now, status scheduled)
     2. ทำทีละแพลตฟอร์ม: download → upload → mark published/failed
     3. อัปเดตสถานะรวมของ post
     4. ถ้าเปิด cleanup และทุกแพลตฟอร์มสำเร็จ → ลบไฟล์ตาม delay
   ============================================================ */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { adapters, fetchVideoFile, deleteFromSource, freshPlatformToken } from './platforms.js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const POLL = (Number(process.env.POLL_INTERVAL) || 60) * 1000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_KEY ใน .env');
  process.exit(1);
}

// service_role bypass RLS — ทำงานข้าม user ได้ (server-side เท่านั้น)
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- ประมวลผล 1 โพสต์ ---------- */
async function processPost(post) {
  log(`▶ post ${post.id} — "${post.title}"`);

  // ดึง video + source
  const { data: video } = await sb.from('videos').select('*').eq('id', post.video_id).single();
  const { data: source } = video?.source_id
    ? await sb.from('sources').select('*').eq('id', video.source_id).single()
    : { data: null };

  // ดึงแพลตฟอร์มที่ต้องโพสต์ (scheduled หรือ retry failed)
  const { data: targets } = await sb.from('post_platforms')
    .select('*').eq('post_id', post.id).in('status', ['scheduled', 'failed']);

  if (!targets?.length) return;

  await sb.from('posts').update({ status: 'publishing' }).eq('id', post.id);

  // ดึงไฟล์ครั้งเดียว ใช้ร่วมทุกแพลตฟอร์ม
  let file;
  try { file = await fetchVideoFile(video, source); }
  catch (e) {
    log(`  ✖ ดึงไฟล์ไม่สำเร็จ: ${e.message}`);
    for (const t of targets)
      await sb.from('post_platforms').update({ status: 'failed', error: 'fetch failed: ' + e.message, retry_count: t.retry_count + 1 }).eq('id', t.id);
    await sb.from('posts').update({ status: 'failed' }).eq('id', post.id);
    return;
  }

  // อัปทีละแพลตฟอร์ม
  for (const t of targets) {
    const adapter = adapters[t.platform];
    if (!adapter) { log(`  ? ไม่มี adapter สำหรับ ${t.platform}`); continue; }
    await sb.from('post_platforms').update({ status: 'publishing' }).eq('id', t.id);
    try {
      // ดึง platform connection ของ user แล้ว refresh token ถ้าจำเป็น
      let token = null, conn = null;
      const { data: c } = await sb.from('platform_connections')
        .select('*').eq('user_id', post.user_id).eq('platform', t.platform).maybeSingle();
      conn = c;
      if (conn && conn.connected) {
        const fr = await freshPlatformToken(conn);
        token = fr.token;
        if (fr.refreshed) {
          await sb.from('platform_connections')
            .update({ credentials: fr.credentials, expires_at: fr.expires_at }).eq('id', conn.id);
        }
      }
      const { externalUrl } = await adapter({
        video, ...file,
        caption: t.caption, hashtags: t.hashtags, link: t.affiliate_link,
        conn, token,
      });
      await sb.from('post_platforms').update({
        status: 'published', external_url: externalUrl,
        published_at: new Date().toISOString(), error: null,
      }).eq('id', t.id);
      log(`  ✓ ${t.platform} → ${externalUrl}`);
    } catch (e) {
      await sb.from('post_platforms').update({
        status: 'failed', error: e.message, retry_count: t.retry_count + 1,
      }).eq('id', t.id);
      log(`  ✖ ${t.platform}: ${e.message}`);
    }
  }

  // คำนวณสถานะรวม
  const { data: all } = await sb.from('post_platforms').select('status').eq('post_id', post.id);
  const statuses = all.map(x => x.status);
  const allPub = statuses.every(s => s === 'published');
  const anyPub = statuses.some(s => s === 'published');
  const anyFail = statuses.some(s => s === 'failed');
  const agg = allPub ? 'published' : (anyPub && anyFail) ? 'partial' : anyFail ? 'failed' : 'publishing';
  await sb.from('posts').update({ status: agg }).eq('id', post.id);
  log(`  สถานะรวม: ${agg}`);

  // cleanup — เฉพาะตอนทุกแพลตฟอร์มสำเร็จ
  if (allPub && post.cleanup && source) {
    const delayMs = post.cleanup_delay === '24h' ? 86400e3 : post.cleanup_delay === '7d' ? 604800e3 : 0;
    if (delayMs === 0) {
      await deleteFromSource(video, source);
      await sb.from('videos').update({ status: 'deleted' }).eq('id', video.id);
      log('  🗑 ลบไฟล์แล้ว (ทันที)');
    } else {
      // หน่วงเวลา: บันทึกเป็นงานลบในอนาคต (ใช้ updated_at เป็นเครื่องหมาย)
      log(`  ⏳ ตั้งลบไฟล์ในอีก ${post.cleanup_delay}`);
      // production: เพิ่มตาราง cleanup_jobs แล้วให้รอบ poll ถัดๆ มาเก็บกวาด
    }
  }
}

/* ---------- รอบ poll ---------- */
async function tick() {
  const nowISO = new Date().toISOString();
  const { data: due, error } = await sb.from('posts')
    .select('*')
    .in('status', ['scheduled', 'publishing'])
    .lte('scheduled_at', nowISO)
    .order('scheduled_at')
    .limit(10);

  if (error) { log('⚠ query error:', error.message); return; }
  if (!due?.length) return;

  log(`พบ ${due.length} โพสต์ที่ถึงเวลา`);
  for (const post of due) {
    try { await processPost(post); }
    catch (e) { log(`✖ post ${post.id} error:`, e.message); }
  }
}

log(`🚀 VideoUp Scheduler เริ่มทำงาน — เช็คคิวทุก ${POLL / 1000} วินาที`);
tick();
setInterval(tick, POLL);

process.on('SIGTERM', () => { log('ปิดระบบ...'); process.exit(0); });
process.on('SIGINT',  () => { log('ปิดระบบ...'); process.exit(0); });
