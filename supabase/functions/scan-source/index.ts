// ============================================================
// VideoUp — Edge Function: scan-source
// สแกนไฟล์วิดีโอจาก cloud source (Google Drive / Dropbox / OneDrive)
// แล้วบันทึก/อัปเดต records ลงตาราง videos
//
// endpoint:
//   POST /scan-source   (ต้องมี Authorization: Bearer <jwt>)
//        body { sourceId } → { added, total, videos }
//
// Deploy:  supabase functions deploy scan-source --no-verify-jwt
// Secrets: ใช้ชุดเดียวกับ oauth-source
//   GOOGLE_CLIENT_ID/SECRET, DROPBOX_CLIENT_ID/SECRET, ONEDRIVE_CLIENT_ID/SECRET
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติใน Edge runtime)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const COVERS = [
  "linear-gradient(135deg,#FF6A3D,#FF2E76)",
  "linear-gradient(135deg,#6C4DFF,#2D7BFF)",
  "linear-gradient(135deg,#14CFA6,#2D7BFF)",
  "linear-gradient(135deg,#FFB02E,#FF6A3D)",
  "linear-gradient(135deg,#FF2E97,#FFC233)",
  "linear-gradient(135deg,#00BBD3,#6C4DFF)",
  "linear-gradient(135deg,#E23D4B,#FFB02E)",
  "linear-gradient(135deg,#2A1D8F,#FF2E76)",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// ---------- refresh token ถ้าหมดอายุ ----------
const REFRESH: Record<string, { url: string; id?: string; secret?: string }> = {
  gdrive: {
    url: "https://oauth2.googleapis.com/token",
    id: Deno.env.get("GOOGLE_CLIENT_ID"), secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
  },
  dropbox: {
    url: "https://api.dropboxapi.com/oauth2/token",
    id: Deno.env.get("DROPBOX_CLIENT_ID"), secret: Deno.env.get("DROPBOX_CLIENT_SECRET"),
  },
  onedrive: {
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    id: Deno.env.get("ONEDRIVE_CLIENT_ID"), secret: Deno.env.get("ONEDRIVE_CLIENT_SECRET"),
  },
};

async function freshToken(source: any): Promise<string> {
  const c = source.credentials || {};
  const notExpired = c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000;
  if (c.access_token && notExpired) return c.access_token;
  if (!c.refresh_token) return c.access_token;

  const cfg = REFRESH[source.type];
  if (!cfg) return c.access_token;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: c.refresh_token,
    client_id: cfg.id || "",
    client_secret: cfg.secret || "",
  });
  const r = await fetch(cfg.url, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh token ล้มเหลว: ${JSON.stringify(j)}`);

  // อัปเดต token ใหม่กลับลง DB
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : c.expires_at;
  await admin.from("sources").update({
    credentials: { ...c, access_token: j.access_token, expires_at },
  }).eq("id", source.id);

  return j.access_token;
}

const isVideoName = (n: string) => /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(n || "");

// ---------- Google Drive ----------
async function scanGdrive(token: string, path: string) {
  // หา folder ID จาก path (เช่น /VideoUp/clips)
  const segs = (path || "").split("/").filter(Boolean);
  let parent = "root";
  for (const seg of segs) {
    const q = `'${parent}' in parents and name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!j.files || !j.files.length) throw new Error(`ไม่พบโฟลเดอร์ "${seg}" ใน path`);
    parent = j.files[0].id;
  }
  // list video files ในโฟลเดอร์
  const q = `'${parent}' in parents and mimeType contains 'video/' and trashed=false`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,videoMediaMetadata(durationMillis))&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return (j.files || []).map((f: any) => ({
    title: f.name.replace(/\.[^.]+$/, ""),
    file_path: f.id,                                              // gdrive ใช้ file ID
    size_mb: f.size ? Math.round(Number(f.size) / 1048576) : 0,
    duration: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : 0,
  }));
}

// ---------- Dropbox ----------
async function scanDropbox(token: string, path: string) {
  const p = path === "/" ? "" : (path || "").replace(/\/$/, "");
  const r = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: p, recursive: false, limit: 500 }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`Dropbox: ${j.error_summary || JSON.stringify(j.error)}`);
  return (j.entries || [])
    .filter((e: any) => e[".tag"] === "file" && isVideoName(e.name))
    .map((e: any) => ({
      title: e.name.replace(/\.[^.]+$/, ""),
      file_path: e.path_display,                                  // dropbox ใช้ path
      size_mb: e.size ? Math.round(e.size / 1048576) : 0,
      duration: 0,
    }));
}

// ---------- OneDrive ----------
async function scanOnedrive(token: string, path: string) {
  const p = (path || "").replace(/\/$/, "");
  const endpoint = p
    ? `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(p)}:/children`
    : `https://graph.microsoft.com/v1.0/me/drive/root/children`;
  const r = await fetch(`${endpoint}?$top=200&$select=id,name,size,file,video`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  if (j.error) throw new Error(`OneDrive: ${j.error.message}`);
  return (j.value || [])
    .filter((e: any) => e.file && isVideoName(e.name))
    .map((e: any) => ({
      title: e.name.replace(/\.[^.]+$/, ""),
      file_path: p ? `${p}/${e.name}` : `/${e.name}`,             // onedrive ใช้ path
      size_mb: e.size ? Math.round(e.size / 1048576) : 0,
      duration: e.video?.duration ? Math.round(e.video.duration / 1000) : 0,
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // ยืนยันตัวตน
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const { sourceId } = await req.json();
  if (!sourceId) return json({ error: "ต้องระบุ sourceId" }, 400);

  // โหลด source (ตรวจว่าเป็นของ user คนนี้)
  const { data: source } = await admin.from("sources")
    .select("*").eq("id", sourceId).eq("user_id", user.id).single();
  if (!source) return json({ error: "ไม่พบ source" }, 404);

  try {
    const token = await freshToken(source);
    let files: any[] = [];
    if (source.type === "gdrive")        files = await scanGdrive(token, source.path);
    else if (source.type === "dropbox")  files = await scanDropbox(token, source.path);
    else if (source.type === "onedrive") files = await scanOnedrive(token, source.path);
    else return json({ error: `source type ไม่รองรับ: ${source.type}` }, 400);

    // upsert videos (ใช้ file_path เป็น key ป้องกันซ้ำ)
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const { data: existing } = await admin.from("videos")
        .select("id").eq("user_id", user.id).eq("source_id", sourceId).eq("file_path", f.file_path).maybeSingle();
      if (existing) {
        await admin.from("videos").update({
          title: f.title, size_mb: f.size_mb, duration: f.duration, status: "ready",
        }).eq("id", existing.id);
      } else {
        await admin.from("videos").insert({
          user_id: user.id, source_id: sourceId,
          title: f.title, file_path: f.file_path,
          size_mb: f.size_mb, duration: f.duration,
          cover: COVERS[i % COVERS.length], status: "ready",
        });
        added++;
      }
    }

    return json({ added, total: files.length });
  } catch (e) {
    console.error("scan error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
