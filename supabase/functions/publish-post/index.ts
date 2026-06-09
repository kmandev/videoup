// ============================================================
// VideoUp — Edge Function: publish-post
// โพสต์จริง (แทน Raspberry Pi) — ดึงไฟล์จาก cloud source → อัปขึ้นแพลตฟอร์ม
//
//   POST /publish-post   (Authorization: Bearer <jwt>)
//        body { postId }            → โพสต์ทันที 1 โพสต์ (กดจากเว็บ)
//        body { due: true }         → ประมวลผลโพสต์ที่ถึงเวลา (เรียกจาก cron)  *ต้องใช้ service key*
//
// Deploy:  supabase functions deploy publish-post --no-verify-jwt
// Secrets: ใช้ชุดเดียวกับ oauth-source/platform (GOOGLE/DROPBOX/ONEDRIVE + YOUTUBE)
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

const GOOGLE = { id: () => Deno.env.get("GOOGLE_CLIENT_ID"), secret: () => Deno.env.get("GOOGLE_CLIENT_SECRET") };

// ---------- แจ้งเตือน Telegram ----------
async function notifyTelegram(userId: string, text: string, kind: "success" | "fail") {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return;
  const { data: s } = await admin.from("user_settings").select("telegram_on, telegram_chat_id, notify_success, notify_fail").eq("user_id", userId).maybeSingle();
  if (!s || !s.telegram_on || !s.telegram_chat_id) return;
  if (kind === "success" && s.notify_success === false) return;
  if (kind === "fail" && s.notify_fail === false) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: false }),
    });
  } catch (_) { /* ignore */ }
}

// ---------- refresh token (sources) ----------
async function freshSourceToken(source: any): Promise<string> {
  const c = source.credentials || {};
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000) return c.access_token;
  if (!c.refresh_token) return c.access_token;
  const M: Record<string, any> = {
    gdrive:   { url: "https://oauth2.googleapis.com/token", id: GOOGLE.id(), secret: GOOGLE.secret() },
    dropbox:  { url: "https://api.dropboxapi.com/oauth2/token", id: Deno.env.get("DROPBOX_CLIENT_ID"), secret: Deno.env.get("DROPBOX_CLIENT_SECRET") },
    onedrive: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/token", id: Deno.env.get("ONEDRIVE_CLIENT_ID"), secret: Deno.env.get("ONEDRIVE_CLIENT_SECRET") },
  };
  const cfg = M[source.type]; if (!cfg) return c.access_token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: cfg.id, client_secret: cfg.secret });
  const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh source token ล้มเหลว: ${JSON.stringify(j)}`);
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : c.expires_at;
  await admin.from("sources").update({ credentials: { ...c, access_token: j.access_token, expires_at } }).eq("id", source.id);
  return j.access_token;
}

// ---------- refresh token (platform_connections) ----------
async function freshPlatformToken(conn: any): Promise<string> {
  const c = conn.credentials || {};
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000) return c.access_token;
  if (!c.refresh_token) return c.access_token;
  if (conn.platform !== "youtube") return c.access_token;
  const id = Deno.env.get("YOUTUBE_CLIENT_ID") || GOOGLE.id();
  const secret = Deno.env.get("YOUTUBE_CLIENT_SECRET") || GOOGLE.secret();
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: id!, client_secret: secret! });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh youtube token ล้มเหลว: ${JSON.stringify(j)}`);
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : c.expires_at;
  await admin.from("platform_connections").update({ credentials: { ...c, access_token: j.access_token, expires_at }, expires_at }).eq("id", conn.id);
  return j.access_token;
}

// ---------- download ไฟล์จาก source → bytes ----------
async function downloadFile(video: any, source: any): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!source || source.type === "url") {
    const r = await fetch(video.file_path);
    if (!r.ok) throw new Error(`โหลด URL ไม่สำเร็จ: ${r.status}`);
    return { bytes: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get("content-type") || "video/mp4" };
  }
  const token = await freshSourceToken(source);
  let dl: Response;
  if (source.type === "gdrive") {
    dl = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(video.file_path)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  } else if (source.type === "dropbox") {
    dl = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": JSON.stringify({ path: video.file_path }) } });
  } else if (source.type === "onedrive") {
    dl = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(video.file_path)}:/content`, { headers: { Authorization: `Bearer ${token}` } });
  } else throw new Error(`source type ไม่รองรับ: ${source.type}`);
  if (!dl.ok) throw new Error(`ดาวน์โหลดจาก ${source.type} ล้มเหลว: ${dl.status}`);
  return { bytes: new Uint8Array(await dl.arrayBuffer()), contentType: "video/mp4" };
}

// ---------- build description + #Shorts ----------
function buildDesc(t: any): string {
  let txt = t.caption || "";
  if (t.hashtags) txt += "\n\n" + t.hashtags;
  if (t.affiliate_link) txt += "\n\n🛒 ช้อปเลย: " + t.affiliate_link;
  txt = txt.trim();
  if (!/#shorts/i.test(txt)) txt += "\n\n#Shorts";
  return txt;
}

// ---------- อัปขึ้น YouTube (resumable, จัดเป็น Short ด้วย #Shorts) ----------
async function uploadYouTube(token: string, video: any, t: any, bytes: Uint8Array, contentType: string) {
  const title = ((t.title || video.title || "VideoUp clip")).replace(/[<>]/g, "").slice(0, 100) || "VideoUp clip";
  const description = buildDesc(t).slice(0, 4900);
  const tags = [...new Set([...(t.hashtags || "").split(/\s+/).map((x: string) => x.replace(/^#/, "")).filter(Boolean), "Shorts"])].slice(0, 15);
  const metadata = {
    snippet: { title, description, tags, categoryId: "22", defaultLanguage: "th" },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true, license: "youtube" },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": contentType, "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`YouTube init ล้มเหลว: ${init.status} ${await init.text()}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube ไม่คืน upload URL");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType, "Content-Length": String(bytes.length) }, body: bytes });
  const j = await put.json();
  if (!put.ok || !j.id) throw new Error(`YouTube upload ล้มเหลว: ${JSON.stringify(j)}`);
  return { externalUrl: `https://youtube.com/shorts/${j.id}`, privacy: j.status?.privacyStatus };
}

// ---------- ประมวลผล 1 โพสต์ ----------
async function processPost(post: any) {
  const { data: video } = await admin.from("videos").select("*").eq("id", post.video_id).single();
  if (!video) throw new Error("ไม่พบวิดีโอ");
  const { data: source } = video.source_id
    ? await admin.from("sources").select("*").eq("id", video.source_id).single()
    : { data: null };

  const { data: targets } = await admin.from("post_platforms").select("*").eq("post_id", post.id).in("status", ["scheduled", "failed", "publishing"]);
  if (!targets?.length) return { skipped: true };

  await admin.from("posts").update({ status: "publishing" }).eq("id", post.id);

  // ดึงไฟล์ครั้งเดียว
  let file;
  try { file = await downloadFile(video, source); }
  catch (e) {
    for (const t of targets) await admin.from("post_platforms").update({ status: "failed", error: "fetch: " + (e as Error).message, retry_count: t.retry_count + 1 }).eq("id", t.id);
    await admin.from("posts").update({ status: "failed" }).eq("id", post.id);
    return { error: (e as Error).message };
  }

  for (const t of targets) {
    await admin.from("post_platforms").update({ status: "publishing" }).eq("id", t.id);
    try {
      if (t.platform !== "youtube") throw new Error(`ยังไม่รองรับการโพสต์จริงของ ${t.platform}`);
      const { data: conn } = await admin.from("platform_connections").select("*").eq("user_id", post.user_id).eq("platform", "youtube").maybeSingle();
      if (!conn || !conn.connected) throw new Error("ยังไม่ได้เชื่อมต่อ YouTube");
      const token = await freshPlatformToken(conn);
      const { externalUrl, privacy } = await uploadYouTube(token, video, t, file.bytes, file.contentType);
      await admin.from("post_platforms").update({ status: "published", external_url: externalUrl, published_at: new Date().toISOString(), error: privacy && privacy !== "public" ? `อัปสำเร็จ แต่ YouTube ตั้งเป็น ${privacy} (ต้อง audit เพื่อ public)` : null }).eq("id", t.id);
    } catch (e) {
      await admin.from("post_platforms").update({ status: "failed", error: (e as Error).message, retry_count: t.retry_count + 1 }).eq("id", t.id);
    }
  }

  // สถานะรวม
  const { data: all } = await admin.from("post_platforms").select("platform, status, external_url, error").eq("post_id", post.id);
  const ss = (all || []).map((x: any) => x.status);
  const agg = ss.every((s: string) => s === "published") ? "published"
            : (ss.some((s: string) => s === "published") && ss.some((s: string) => s === "failed")) ? "partial"
            : ss.some((s: string) => s === "failed") ? "failed" : "publishing";
  await admin.from("posts").update({ status: agg }).eq("id", post.id);

  // แจ้งเตือน Telegram
  const lines = (all || []).map((r: any) =>
    r.status === "published" ? `✅ ${r.platform}: ${r.external_url || "สำเร็จ"}` : `❌ ${r.platform}: ${r.error || "ล้มเหลว"}`);
  const ok = agg === "published";
  await notifyTelegram(post.user_id,
    `${ok ? "🎉" : agg === "partial" ? "⚠️" : "❌"} <b>${post.title}</b>\n${lines.join("\n")}`,
    ok ? "success" : "fail");

  return { status: agg };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));

  // โหมด cron: ประมวลผลโพสต์ที่ถึงเวลา (ใช้ service key หรือ CRON_SECRET)
  if (body.due) {
    const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    if (auth !== SERVICE_KEY && !(CRON_SECRET && auth === CRON_SECRET))
      return json({ error: "unauthorized (cron secret required)" }, 401);
    const { data: due } = await admin.from("posts").select("*").in("status", ["scheduled", "publishing"]).lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
    const results = [];
    for (const p of (due || [])) { try { results.push(await processPost(p)); } catch (e) { results.push({ error: (e as Error).message }); } }
    return json({ processed: results.length, results });
  }

  // โหมดโพสต์ทันที: postId เดียว (ยืนยันเจ้าของด้วย JWT)
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const { postId } = body;
  if (!postId) return json({ error: "ต้องระบุ postId" }, 400);
  const { data: post } = await admin.from("posts").select("*").eq("id", postId).eq("user_id", user.id).single();
  if (!post) return json({ error: "ไม่พบโพสต์" }, 404);

  try {
    const r = await processPost(post);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
