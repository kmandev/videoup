/* ============================================================
   VideoUp Scheduler — Platform upload adapters
   ------------------------------------------------------------
   แต่ละฟังก์ชันรับ { video, caption, hashtags, link, creds }
   แล้วคืน { externalUrl }  หรือ throw error
   ------------------------------------------------------------
   ตอนนี้เป็น "stub" ที่จำลองการอัปโหลด — เปลี่ยนเป็น API จริง
   ของแต่ละแพลตฟอร์มได้ในจุดที่ทำเครื่องหมาย TODO
   ============================================================ */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// รวม caption + hashtags + affiliate link เป็นข้อความเดียว
export function buildDescription({ caption, hashtags, link }, platform) {
  let txt = caption || '';
  if (hashtags) txt += '\n\n' + hashtags;
  if (link) {
    const label = platform === 'youtube' ? '\n\n🛒 ช้อปเลย: '
                : platform === 'facebook' ? '\n\n🛒 ลิงก์สินค้า: '
                : '\n\n🛒 ';
    txt += label + link;
  }
  return txt.trim();
}

async function fakeUpload(platform, job) {
  const desc = buildDescription(job, platform);
  console.log(`   → [${platform}] uploading "${job.video.title}" (${desc.length} chars)`);
  await sleep(1500); // จำลองเวลาอัป
  // จำลองความล้มเหลวสุ่ม 8% เพื่อทดสอบ retry flow
  if (Math.random() < 0.08) throw new Error(`${platform} API timeout (จำลอง)`);
  return { externalUrl: `https://${platform}.example/post/${job.video.id.slice(0, 8)}` };
}

export const adapters = {
  // TODO: TikTok Content Posting API — POST /v2/post/publish/video/init/
  async tiktok(job)   { return fakeUpload('tiktok', job); },

  // TODO: YouTube Data API v3 — videos.insert (resumable upload)
  async youtube(job)  { return fakeUpload('youtube', job); },

  // TODO: Facebook Graph API — /{page-id}/video_reels
  async facebook(job) { return fakeUpload('facebook', job); },

  // TODO: Shopee Open Platform — media_space.upload_video
  async shopee(job)   { return fakeUpload('shopee', job); },

  // TODO: Lazada Open Platform — /video/upload
  async lazada(job)   { return fakeUpload('lazada', job); },
};

// ดึงไฟล์จาก source (Drive/Dropbox/OneDrive/URL) มาไว้ในเครื่อง
// TODO: ใส่ logic ดาวน์โหลดจริงตาม source.type
export async function fetchVideoFile(video, source) {
  console.log(`   ⤓ fetching from ${source?.type || 'unknown'}: ${video.file_path}`);
  await sleep(500);
  return { localPath: `${process.env.WORK_DIR || './tmp'}/${video.id}.mp4` };
}

// ลบไฟล์ออกจาก source หลังโพสต์สำเร็จ
// TODO: ใส่ logic ลบจริงตาม source.type
export async function deleteFromSource(video, source) {
  console.log(`   🗑  deleting ${video.file_path} from ${source?.type}`);
  await sleep(300);
}
