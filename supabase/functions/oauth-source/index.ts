// ============================================================
// VideoUp — Edge Function: oauth-source
// จัดการ OAuth ของ cloud source (Google Drive / Dropbox / OneDrive)
//
// 2 endpoint:
//   POST /oauth-source/start     (ต้องมี Authorization: Bearer <jwt>)
//        body { provider, returnTo } → { authUrl }
//   GET  /oauth-source/callback?code&state
//        ผู้ให้บริการ redirect กลับมาที่นี่ → แลก token → บันทึก → redirect ไป returnTo
//
// Deploy:  supabase functions deploy oauth-source --no-verify-jwt
// Secrets ที่ต้องตั้ง (supabase secrets set ...):
//   APP_URL, FUNCTION_URL,
//   GOOGLE_CLIENT_ID/SECRET, DROPBOX_CLIENT_ID/SECRET, ONEDRIVE_CLIENT_ID/SECRET
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติใน Edge runtime)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL      = Deno.env.get("APP_URL") || "https://videoup-beta.vercel.app";
// URL ของฟังก์ชันนี้เอง (redirect_uri ที่ลงทะเบียนกับผู้ให้บริการ)
const FUNCTION_URL = Deno.env.get("FUNCTION_URL") || `${SUPABASE_URL}/functions/v1/oauth-source`;
const REDIRECT_URI = `${FUNCTION_URL}/callback`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------- ตั้งค่าผู้ให้บริการ ----------
const PROVIDERS: Record<string, any> = {
  gdrive: {
    name: "Google Drive",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: Deno.env.get("GOOGLE_CLIENT_ID"),
    clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
    extraAuth: { access_type: "offline", prompt: "consent" },
    defaultPath: "/VideoUp/clips",
    async account(token: string) {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j.email || "Google account";
    },
  },
  dropbox: {
    name: "Dropbox",
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    clientId: Deno.env.get("DROPBOX_CLIENT_ID"),
    clientSecret: Deno.env.get("DROPBOX_CLIENT_SECRET"),
    scope: "files.content.read files.content.write account_info.read",
    extraAuth: { token_access_type: "offline" },
    defaultPath: "/Videos/Shorts",
    async account(token: string) {
      const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j?.email || "Dropbox account";
    },
  },
  onedrive: {
    name: "OneDrive",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: Deno.env.get("ONEDRIVE_CLIENT_ID"),
    clientSecret: Deno.env.get("ONEDRIVE_CLIENT_SECRET"),
    scope: "Files.ReadWrite offline_access User.Read",
    extraAuth: {},
    defaultPath: "/Videos/VideoUp",
    async account(token: string) {
      const r = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j?.userPrincipalName || j?.mail || "OneDrive account";
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
    // ยืนยันตัวตนผู้ใช้จาก JWT
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    if (error || !user) return json({ error: "unauthorized" }, 401);

    const { provider, returnTo } = await req.json();
    const cfg = PROVIDERS[provider];
    if (!cfg) return json({ error: "provider ไม่รองรับ" }, 400);
    if (!cfg.clientId) return json({ error: `ยังไม่ได้ตั้งค่า client ของ ${cfg.name}` }, 400);

    // สุ่ม state แล้วเก็บผูกกับ user
    const state = crypto.randomUUID();
    await admin.from("oauth_states").insert({
      state, user_id: user.id, provider, return_to: returnTo || `${APP_URL}/index.html`,
    });

    const p = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: cfg.scope,
      state,
      ...cfg.extraAuth,
    });
    return json({ authUrl: `${cfg.authUrl}?${p.toString()}` });
  }

  // ---------- CALLBACK ----------
  if (path === "callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const back = (msg: string) => Response.redirect(`${APP_URL}/index.html?source=${msg}`, 302);

    if (!code || !state) return back("error");

    // ตรวจ state
    const { data: st } = await admin.from("oauth_states").select("*").eq("state", state).single();
    if (!st) return back("expired");
    await admin.from("oauth_states").delete().eq("state", state);

    const cfg = PROVIDERS[st.provider];
    if (!cfg) return back("error");

    // แลก code → token
    const body = new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tr = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const tok = await tr.json();
    if (!tr.ok || !tok.access_token) {
      console.error("token error", tok);
      return back("token_failed");
    }

    let account = cfg.name;
    try { account = await cfg.account(tok.access_token); } catch (_) { /* ignore */ }

    const expires_at = tok.expires_in
      ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;

    // บันทึกลง sources (อัปเดตถ้าเคยเชื่อมแล้ว)
    await admin.from("sources").upsert({
      user_id: st.user_id,
      type: st.provider,
      name: cfg.name,
      account,
      path: cfg.defaultPath,
      connected: true,
      credentials: {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || null,
        expires_at,
        scope: tok.scope || cfg.scope,
      },
    }, { onConflict: "user_id,type" });

    return Response.redirect(`${st.return_to}?source=connected`, 302);
  }

  return json({ error: "not found" }, 404);
});
