// ============================================================
// VideoUp — Edge Function: publish-local
// โพสต์ไฟล์วิดีโอจากเครื่องผู้ใช้โดยตรง → อัปขึ้นแพลตฟอร์มทันที
// (ไม่เก็บไฟล์ไว้บน cloud storage ของผู้ใช้ — ส่งผ่านครั้งเดียว)
//
//   POST /publish-local   (Authorization: Bearer <jwt>, multipart/form-data)
//        fields: file, payload (JSON: { title, platforms[], content{} })
//        → { postId, status }
//
// Deploy:  supabase functions deploy publish-local --no-verify-jwt
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

async function freshPlatformToken(conn: any): Promise<string> {
  const c = conn.credentials || {};
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60000) return c.access_token;
  if (!c.refresh_token || conn.platform !== "youtube") return c.access_token;
  const id = Deno.env.get("YOUTUBE_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID");
  const secret = Deno.env.get("YOUTUBE_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: id!, client_secret: secret! });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`refresh youtube token ล้มเหลว: ${JSON.stringify(j)}`);
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : c.expires_at;
  await admin.from("platform_connections").update({ credentials: { ...c, access_token: j.access_token, expires_at }, expires_at }).eq("id", conn.id);
  return j.access_token;
}

function buildDesc(t: any): string {
  let txt = t.caption || "";
  if (t.hashtags) txt += "\n\n" + t.hashtags;
  if (t.link) txt += "\n\n🛒 ช้อปเลย: " + t.link;
  txt = txt.trim();
  if (!/#shorts/i.test(txt)) txt += "\n\n#Shorts";
  return txt;
}

async function uploadYouTube(token: string, title0: string, t: any, bytes: Uint8Array, contentType: string) {
  const title = ((t.title || title0 || "VideoUp clip")).replace(/[<>]/g, "").slice(0, 100) || "VideoUp clip";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const form = await req.formData();
  const file = form.get("file") as File;
  const payload = JSON.parse((form.get("payload") as string) || "{}");
  if (!file) return json({ error: "ต้องมีไฟล์วิดีโอ" }, 400);
  if (!payload.platforms?.length) return json({ error: "ต้องเลือกแพลตฟอร์มอย่างน้อย 1" }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fname = file.name || "clip.mp4";
  const contentType = /\.mov$/i.test(fname) ? "video/quicktime" : /\.webm$/i.test(fname) ? "video/webm" : "video/mp4";
  const baseTitle = payload.title || fname.replace(/\.[^.]+$/, "");

  // สร้าง video record (ไม่มี source — ไฟล์มาจากเครื่อง) + post + post_platforms
  const cover = "linear-gradient(135deg,#FF6A3D,#FF2E76)";
  const { data: video } = await admin.from("videos").insert({
    user_id: user.id, source_id: null, title: baseTitle, file_path: "",
    size_mb: Math.round(bytes.byteLength / 1048576), duration: 0, cover, status: "ready",
  }).select().single();

  const { data: post } = await admin.from("posts").insert({
    user_id: user.id, video_id: video.id, title: baseTitle,
    mode: "now", scheduled_at: new Date().toISOString(), status: "publishing",
  }).select().single();

  const rows = payload.platforms.map((pl: string) => ({
    post_id: post.id, platform: pl,
    title: payload.content?.[pl]?.title || null,
    caption: payload.content?.[pl]?.caption || "",
    hashtags: payload.content?.[pl]?.hashtags || "",
    affiliate_link: payload.content?.[pl]?.link || "",
    status: "publishing",
  }));
  await admin.from("post_platforms").insert(rows);

  // อัปทีละแพลตฟอร์ม
  for (const pl of payload.platforms) {
    const t = {
      title: payload.content?.[pl]?.title,
      caption: payload.content?.[pl]?.caption,
      hashtags: payload.content?.[pl]?.hashtags,
      link: payload.content?.[pl]?.link,
    };
    try {
      if (pl !== "youtube") throw new Error(`ยังไม่รองรับการโพสต์จริงของ ${pl}`);
      const { data: conn } = await admin.from("platform_connections").select("*").eq("user_id", user.id).eq("platform", "youtube").maybeSingle();
      if (!conn || !conn.connected) throw new Error("ยังไม่ได้เชื่อมต่อ YouTube");
      const token = await freshPlatformToken(conn);
      const { externalUrl, privacy } = await uploadYouTube(token, baseTitle, t, bytes, contentType);
      await admin.from("post_platforms").update({ status: "published", external_url: externalUrl, published_at: new Date().toISOString(), error: privacy && privacy !== "public" ? `อัปสำเร็จ แต่ YouTube ตั้งเป็น ${privacy} (ต้อง audit เพื่อ public)` : null }).eq("post_id", post.id).eq("platform", pl);
    } catch (e) {
      await admin.from("post_platforms").update({ status: "failed", error: (e as Error).message }).eq("post_id", post.id).eq("platform", pl);
    }
  }

  const { data: all } = await admin.from("post_platforms").select("status").eq("post_id", post.id);
  const ss = (all || []).map((x: any) => x.status);
  const agg = ss.every((s: string) => s === "published") ? "published"
            : (ss.some((s: string) => s === "published") && ss.some((s: string) => s === "failed")) ? "partial"
            : ss.some((s: string) => s === "failed") ? "failed" : "publishing";
  await admin.from("posts").update({ status: agg }).eq("id", post.id);

  return json({ postId: post.id, status: agg });
});
