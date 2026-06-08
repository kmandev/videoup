// ============================================================
// VideoUp — Edge Function: oauth-platform
// เชื่อมต่อแพลตฟอร์มปลายทาง (เริ่มที่ YouTube) → เก็บ token ใน platform_connections
//
//   POST /oauth-platform/start     (Authorization: Bearer <jwt>)
//        body { platform, returnTo } → { authUrl }
//   GET  /oauth-platform/callback?code&state
//
// Deploy:  supabase functions deploy oauth-platform --no-verify-jwt
// Secrets: ใช้ GOOGLE_CLIENT_ID/SECRET ชุดเดียวกับ Drive (เปิด YouTube Data API v3 ใน Cloud Console)
//          + เพิ่ม redirect URI: <FUNCTION_URL>/callback ใน OAuth client
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL      = Deno.env.get("APP_URL") || "https://videoup-beta.vercel.app";
const FUNCTION_URL = Deno.env.get("PLATFORM_FUNCTION_URL") || `${SUPABASE_URL}/functions/v1/oauth-platform`;
const REDIRECT_URI = `${FUNCTION_URL}/callback`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const PLATFORMS: Record<string, any> = {
  youtube: {
    name: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: Deno.env.get("YOUTUBE_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID"),
    clientSecret: Deno.env.get("YOUTUBE_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET"),
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    extraAuth: { access_type: "offline", prompt: "consent" },
    async handle(token: string) {
      const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      const ch = j.items?.[0]?.snippet;
      return ch ? (ch.customUrl || ch.title) : "YouTube channel";
    },
  },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // ---------- START ----------
  if (path === "start" && req.method === "POST") {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    if (error || !user) return json({ error: "unauthorized" }, 401);

    const { platform, returnTo } = await req.json();
    const cfg = PLATFORMS[platform];
    if (!cfg) return json({ error: "แพลตฟอร์มนี้ยังไม่รองรับ" }, 400);
    if (!cfg.clientId) return json({ error: `ยังไม่ได้ตั้งค่า client ของ ${cfg.name}` }, 400);

    const state = crypto.randomUUID();
    await admin.from("oauth_states").insert({
      state, user_id: user.id, provider: platform, return_to: returnTo || `${APP_URL}/index.html`,
    });

    const p = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: REDIRECT_URI,
      response_type: "code", scope: cfg.scope, state, ...cfg.extraAuth,
    });
    return json({ authUrl: `${cfg.authUrl}?${p.toString()}` });
  }

  // ---------- CALLBACK ----------
  if (path === "callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const back = (msg: string, ret?: string) => Response.redirect(`${ret || APP_URL + "/index.html"}?platform=${msg}`, 302);
    if (!code || !state) return back("error");

    const { data: st } = await admin.from("oauth_states").select("*").eq("state", state).single();
    if (!st) return back("expired");
    await admin.from("oauth_states").delete().eq("state", state);

    const cfg = PLATFORMS[st.provider];
    if (!cfg) return back("error", st.return_to);

    const body = new URLSearchParams({
      code, client_id: cfg.clientId, client_secret: cfg.clientSecret,
      redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
    });
    const tr = await fetch(cfg.tokenUrl, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
    });
    const tok = await tr.json();
    if (!tr.ok || !tok.access_token) {
      console.error("token error", tok);
      return back("token_failed", st.return_to);
    }

    let handle = cfg.name;
    try { handle = await cfg.handle(tok.access_token); } catch (_) { /* ignore */ }

    const expires_at = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;

    await admin.from("platform_connections").upsert({
      user_id: st.user_id, platform: st.provider, handle, connected: true,
      expires_at,
      credentials: {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || null,
        expires_at, scope: tok.scope || cfg.scope,
      },
    }, { onConflict: "user_id,platform" });

    return Response.redirect(`${st.return_to}?platform=connected`, 302);
  }

  return json({ error: "not found" }, 404);
});
