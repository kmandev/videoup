// ============================================================
// VideoUp — Edge Function: upload-source
// อัปโหลดไฟล์วิดีโอจากเบราว์เซอร์ → cloud source → บันทึก video record
//
// endpoint:
//   POST /upload-source   (Authorization: Bearer <jwt>, multipart/form-data)
//        fields: sourceId, file
//        → { video }
//
// Deploy:  supabase functions deploy upload-source --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const REFRESH: Record<string, { url: string; id?: string; secret?: string }> = {
  gdrive:   { url: "https://oauth2.googleapis.com/token", id: Deno.env.get("GOOGLE_CLIENT_ID"), secret: Deno.env.get("GOOGLE_CLIENT_SECRET") },
  dropbox:  { url: "https://api.dropboxapi.com/oauth2/token", id: Deno.env.get("DROPBOX_CLIENT_ID"), secret: Deno.env.get("DROPBOX_CLIENT_SECRET") },
  onedrive: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/token", id: Deno.env.get("ONEDRIVE_CLIENT_ID"), secret: Deno.env.get("ONEDRIVE_CLIENT_SECRET") },
};

async function freshToken(source: any): Promise<string> {
  const c = source.credentials || {};
  const notExpired = c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000;
  if (c.access_token && notExpired) return c.access_token;
  if (!c.refresh_token) return c.access_token;
  const cfg = REFRESH[source.type];
  if (!cfg) return c.access_token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: cfg.id || "", client_secret: cfg.secret || "" });
  const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh token ล้มเหลว: ${JSON.stringify(j)}`);
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : c.expires_at;
  await admin.from("sources").update({ credentials: { ...c, access_token: j.access_token, expires_at } }).eq("id", source.id);
  return j.access_token;
}

// หา folder ID ของ Google Drive จาก path
async function gdriveFolderId(token: string, path: string): Promise<string> {
  const segs = (path || "").split("/").filter(Boolean);
  let parent = "root";
  for (const seg of segs) {
    const q = `'${parent}' in parents and name='${seg.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.files && j.files.length) { parent = j.files[0].id; continue; }
    // สร้างโฟลเดอร์ถ้ายังไม่มี
    const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: seg, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
    });
    const cj = await cr.json();
    parent = cj.id;
  }
  return parent;
}

// OneDrive dest path จาก source.path + ชื่อไฟล์
const onedriveDest = (source: any, name: string) =>
  `${(source.path || "").replace(/\/$/, "")}/${name}`;

// บันทึก video record (ใช้ทั้ง multipart และ finalize ของ resumable upload)
async function insertVideo(userId: string, sourceId: string, name: string, sizeMb: number, file_path: string) {
  const cover = "linear-gradient(135deg,#6C4DFF,#2D7BFF)";
  const { data: video } = await admin.from("videos").insert({
    user_id: userId, source_id: sourceId,
    title: name.replace(/\.[^.]+$/, ""), file_path,
    size_mb: sizeMb, duration: 0, cover, status: "ready",
  }).select().single();
  return video;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const ctype = req.headers.get("Content-Type") || "";

  // ── โหมด JSON: resumable upload (อัปจาก browser ตรงไป cloud) ──
  //    action:"init"     → คืน uploadUrl (pre-authorized) ให้ browser อัปไฟล์เอง
  //    action:"finalize" → บันทึก video record หลัง browser อัปเสร็จ
  if (ctype.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const { action, sourceId } = body;
    if (!sourceId) return json({ error: "ต้องมี sourceId" }, 400);
    const { data: source } = await admin.from("sources").select("*").eq("id", sourceId).eq("user_id", user.id).single();
    if (!source) return json({ error: "ไม่พบ source" }, 404);

    try {
      if (action === "init") {
        const name = String(body.name || "video.mp4");
        const type = String(body.type || "video/mp4");
        const token = await freshToken(source);

        if (source.type === "gdrive") {
          const folderId = await gdriveFolderId(token, source.path);
          const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type },
            body: JSON.stringify({ name, parents: [folderId] }),
          });
          if (!r.ok) throw new Error(`เริ่ม resumable (Drive) ล้มเหลว: ${await r.text()}`);
          const uploadUrl = r.headers.get("Location");
          if (!uploadUrl) throw new Error("ไม่ได้ session URL จาก Drive");
          return json({ uploadUrl, provider: "gdrive" });
        }
        if (source.type === "onedrive") {
          const dest = onedriveDest(source, name);
          const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(dest)}:/createUploadSession`, {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
          });
          const j = await r.json();
          if (!r.ok || !j.uploadUrl) throw new Error(`เริ่ม session (OneDrive) ล้มเหลว: ${JSON.stringify(j)}`);
          return json({ uploadUrl: j.uploadUrl, provider: "onedrive", path: dest });
        }
        // dropbox: ไม่มี pre-signed URL → ให้ browser ใช้ทาง multipart เดิม (ไฟล์เล็ก)
        return json({ provider: source.type, fallback: true });
      }

      if (action === "finalize") {
        const name = String(body.name || "video.mp4");
        const sizeMb = Math.round((Number(body.size) || 0) / 1048576);
        const file_path = String(body.file_path || "");
        if (!file_path) return json({ error: "ต้องมี file_path" }, 400);
        const video = await insertVideo(user.id, sourceId, name, sizeMb, file_path);
        return json({ video });
      }

      return json({ error: `action ไม่รองรับ: ${action}` }, 400);
    } catch (e) {
      console.error("upload init/finalize error", e);
      return json({ error: String((e as any)?.message || e) }, 500);
    }
  }

  // ── โหมด multipart เดิม: ส่งไฟล์ผ่าน function (Dropbox / ไฟล์เล็ก) ──
  const form = await req.formData();
  const sourceId = form.get("sourceId") as string;
  const file = form.get("file") as File;
  if (!sourceId || !file) return json({ error: "ต้องมี sourceId และ file" }, 400);

  const { data: source } = await admin.from("sources").select("*").eq("id", sourceId).eq("user_id", user.id).single();
  if (!source) return json({ error: "ไม่พบ source" }, 404);

  try {
    const token = await freshToken(source);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = file.name;
    const sizeMb = Math.round(bytes.byteLength / 1048576);
    let file_path = "";

    if (source.type === "gdrive") {
      const folderId = await gdriveFolderId(token, source.path);
      const meta = JSON.stringify({ name, parents: [folderId] });
      const boundary = "vu" + crypto.randomUUID().replace(/-/g, "");
      const enc = new TextEncoder();
      const pre = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || "video/mp4"}\r\n\r\n`);
      const post = enc.encode(`\r\n--${boundary}--`);
      const bodyBuf = new Uint8Array(pre.length + bytes.length + post.length);
      bodyBuf.set(pre, 0); bodyBuf.set(bytes, pre.length); bodyBuf.set(post, pre.length + bytes.length);
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: bodyBuf,
      });
      const j = await r.json();
      if (!r.ok || !j.id) throw new Error(`อัปโหลด Drive ล้มเหลว: ${JSON.stringify(j)}`);
      file_path = j.id;
    } else if (source.type === "dropbox") {
      const dest = `${(source.path || "").replace(/\/$/, "")}/${name}`;
      const r = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify({ path: dest, mode: "add", autorename: true }) },
        body: bytes,
      });
      const j = await r.json();
      if (!r.ok || !j.path_display) throw new Error(`อัปโหลด Dropbox ล้มเหลว: ${JSON.stringify(j)}`);
      file_path = j.path_display;
    } else if (source.type === "onedrive") {
      const dest = `${(source.path || "").replace(/\/$/, "")}/${name}`;
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(dest)}:/content`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type || "video/mp4" }, body: bytes,
      });
      const j = await r.json();
      if (!r.ok || !j.id) throw new Error(`อัปโหลด OneDrive ล้มเหลว: ${JSON.stringify(j)}`);
      file_path = dest;
    } else return json({ error: `source type ไม่รองรับ: ${source.type}` }, 400);

    const video = await insertVideo(user.id, sourceId, name, sizeMb, file_path);
    return json({ video });
  } catch (e) {
    console.error("upload error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
