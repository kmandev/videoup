// ============================================================
// VideoUp — Edge Function: telegram-test
// ส่งข้อความทดสอบไปยัง Telegram chat ของผู้ใช้
//   POST /telegram-test  (Authorization: Bearer <jwt>)  body { chatId }
// Deploy:  supabase functions deploy telegram-test --no-verify-jwt
// Secret:  TELEGRAM_BOT_TOKEN
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN (ผู้ดูแลระบบต้องสร้างบอทก่อน)" }, 400);

  const { chatId } = await req.json();
  if (!chatId) return json({ error: "ต้องระบุ chatId" }, 400);

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: "🔔 <b>VideoUp</b>\nเชื่อมต่อ Telegram สำเร็จ! คุณจะได้รับแจ้งเตือนผลการโพสต์ที่นี่", parse_mode: "HTML" }),
  });
  const j = await r.json();
  if (!j.ok) return json({ error: j.description || "ส่งไม่สำเร็จ (เช็คว่าได้ทักบอทแล้ว)" }, 400);
  return json({ ok: true });
});
