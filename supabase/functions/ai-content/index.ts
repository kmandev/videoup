// ============================================================
// VideoUp — Edge Function: ai-content
// ใช้ Claude ช่วยคิดเนื้อหาสินค้าจากชื่อสินค้า
//   POST /ai-content  (Authorization: Bearer <jwt>)
//   body { name, hint? }  →  { title, caption, hashtags }
// Deploy:  supabase functions deploy ai-content
// Secret:  ANTHROPIC_API_KEY  (สร้างที่ console.anthropic.com)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `คุณเป็นนักการตลาดคอนเทนต์วิดีโอสั้นมืออาชีพสำหรับตลาดไทย เชี่ยวชาญ TikTok, YouTube Shorts, Facebook Reels และ affiliate ขายของ
หน้าที่: จากชื่อสินค้า ให้ช่วยคิดเนื้อหาที่ดึงดูดให้คนหยุดดูและอยากกดซื้อ ตอบเป็นภาษาไทยเท่านั้น
- title: ชื่อหัวข้อวิดีโอ ไม่เกิน 80 ตัวอักษร น่าคลิก เหมาะกับ YouTube (อย่าใส่อิโมจิเยอะ)
- caption: แคปชั่น 1-2 ประโยค กระชับ มีพลัง ชวนซื้อ ใส่อิโมจิ 1-3 ตัวให้พอเหมาะ
- hashtags: แฮชแท็กไทย/อังกฤษที่กำลังเป็นที่นิยม 4-7 แท็ก คั่นด้วยช่องว่าง แต่ละแท็กขึ้นต้นด้วย #`;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "ชื่อหัวข้อวิดีโอ ไม่เกิน 80 ตัวอักษร" },
    caption: { type: "string", description: "แคปชั่นดึงดูด มีอิโมจิพอเหมาะ" },
    hashtags: { type: "string", description: "แฮชแท็กคั่นด้วยช่องว่าง ขึ้นต้นด้วย #" },
  },
  required: ["title", "caption", "hashtags"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY (ผู้ดูแลระบบต้องตั้งค่าก่อน)" }, 400);

  const { name, hint } = await req.json();
  if (!name || !String(name).trim()) return json({ error: "ต้องระบุชื่อสินค้า" }, 400);

  const userMsg = `ชื่อสินค้า: ${String(name).trim()}` + (hint ? `\nข้อมูลเพิ่มเติม: ${String(hint).trim()}` : "");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  const j = await r.json();
  if (!r.ok) return json({ error: j?.error?.message || "เรียก AI ไม่สำเร็จ" }, 502);

  // output_config.format การันตีว่า text block แรกเป็น JSON ที่ถูกต้องตาม schema
  const text = (j.content || []).find((b: any) => b.type === "text")?.text || "";
  let out;
  try { out = JSON.parse(text); } catch { return json({ error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้" }, 502); }

  return json({ title: out.title || "", caption: out.caption || "", hashtags: out.hashtags || "" });
});
