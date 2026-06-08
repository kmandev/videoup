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

/* ============================================================
   Cloud source — refresh token + download + delete (ของจริง)
   ------------------------------------------------------------
   source.credentials = { access_token, refresh_token, expires_at, scope }
   ถูกบันทึกโดย Edge Function oauth-source ตอนผู้ใช้กดเชื่อมต่อ
   video.file_path = ตัวระบุไฟล์ของผู้ให้บริการนั้น:
     - gdrive   : Google Drive file ID
     - dropbox  : path เช่น /Videos/Shorts/clip.mp4
     - onedrive : item path เช่น /Videos/VideoUp/clip.mp4
   ============================================================ */
import { writeFile, unlink, mkdir } from 'node:fs/promises';

const env = (k) => process.env[k];

// คืน access token ที่ยังไม่หมดอายุ (refresh ถ้าจำเป็น)
async function freshToken(source) {
  const c = source.credentials || {};
  const notExpired = c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000;
  if (c.access_token && notExpired) return c.access_token;
  if (!c.refresh_token) return c.access_token; // ไม่มี refresh → ใช้ของเดิม (อาจหมดอายุ)

  const REFRESH = {
    gdrive: {
      url: 'https://oauth2.googleapis.com/token',
      id: env('GOOGLE_CLIENT_ID'), secret: env('GOOGLE_CLIENT_SECRET'),
    },
    dropbox: {
      url: 'https://api.dropboxapi.com/oauth2/token',
      id: env('DROPBOX_CLIENT_ID'), secret: env('DROPBOX_CLIENT_SECRET'),
    },
    onedrive: {
      url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      id: env('ONEDRIVE_CLIENT_ID'), secret: env('ONEDRIVE_CLIENT_SECRET'),
    },
  }[source.type];
  if (!REFRESH) return c.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: c.refresh_token,
    client_id: REFRESH.id,
    client_secret: REFRESH.secret,
  });
  const r = await fetch(REFRESH.url, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh token ล้มเหลว (${source.type}): ${JSON.stringify(j)}`);
  return j.access_token;
}

// ดึงไฟล์จาก source มาไว้ในเครื่อง
export async function fetchVideoFile(video, source) {
  const dir = env('WORK_DIR') || './tmp';
  await mkdir(dir, { recursive: true });
  const localPath = `${dir}/${video.id}.mp4`;

  // ไม่มี source / เป็น URL ตรง → โหลดจาก file_path ตรงๆ
  if (!source || source.type === 'url') {
    const r = await fetch(video.file_path);
    if (!r.ok) throw new Error(`โหลด URL ไม่สำเร็จ: ${r.status}`);
    await writeFile(localPath, Buffer.from(await r.arrayBuffer()));
    return { localPath };
  }

  const token = await freshToken(source);
  let dl; // download response

  if (source.type === 'gdrive') {
    dl = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(video.file_path)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } });
  } else if (source.type === 'dropbox') {
    dl = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: video.file_path }) },
    });
  } else if (source.type === 'onedrive') {
    dl = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${video.file_path}:/content`,
      { headers: { Authorization: `Bearer ${token}` } });
  } else {
    throw new Error(`source type ไม่รองรับ: ${source.type}`);
  }

  if (!dl.ok) throw new Error(`ดาวน์โหลดจาก ${source.type} ล้มเหลว: ${dl.status}`);
  await writeFile(localPath, Buffer.from(await dl.arrayBuffer()));
  console.log(`   ⤓ ดาวน์โหลดจาก ${source.type} เรียบร้อย → ${localPath}`);
  return { localPath };
}

// ลบไฟล์ออกจาก source หลังโพสต์สำเร็จ + ลบไฟล์ temp
export async function deleteFromSource(video, source) {
  try { await unlink(`${env('WORK_DIR') || './tmp'}/${video.id}.mp4`); } catch (_) {}
  if (!source || source.type === 'url') return;

  const token = await freshToken(source);
  if (source.type === 'gdrive') {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(video.file_path)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } else if (source.type === 'dropbox') {
    await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: video.file_path }),
    });
  } else if (source.type === 'onedrive') {
    await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${video.file_path}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  }
  console.log(`   🗑  ลบไฟล์ออกจาก ${source.type} แล้ว`);
}
