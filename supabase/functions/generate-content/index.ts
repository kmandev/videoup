// ============================================================
// VideoUp — Edge Function: generate-content
// สร้างชื่อวิดีโอ/แคปชั่น/แฮชแท็ก อัตโนมัติด้วย AI จากชื่อสินค้า (keyword)
//   POST /generate-content  (Authorization: Bearer <jwt>)
//   body { productName, platform? }
//   → { title, caption, hashtags }
//
// ผู้ใช้เลือกผู้ให้บริการ AI + ใส่ API key เองในหน้า ตั้งค่า → AI
// (เก็บใน user_settings: ai_provider, ai_api_key, ai_model)
// รองรับ: openai, gemini, anthropic, deepseek
// Deploy:  supabase functions deploy generate-content --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
  deepseek: "deepseek-chat",
};

function buildPrompt(productName: string, platform?: string) {
  const platformHint = platform ? `เนื้อหานี้จะใช้โพสต์บน ${platform}` : "เนื้อหานี้จะใช้โพสต์ขึ้นหลายแพลตฟอร์ม (TikTok, YouTube Shorts, Facebook Reels, Shopee, Lazada)";
  return `คุณเป็นนักเขียนคอนเทนต์การตลาดสำหรับนักขายสินค้าออนไลน์ในไทย
สินค้า/keyword หลัก: "${productName}"
${platformHint}

ช่วยสร้างเนื้อหาภาษาไทยสำหรับโพสต์วิดีโอสั้นรีวิวสินค้านี้ ตอบกลับเป็น JSON เท่านั้น (ไม่ต้องมีคำอธิบายอื่น) รูปแบบ:
{
  "title": "ชื่อวิดีโอ/หัวข้อ ดึงดูด สั้นกระชับ ไม่เกิน 80 ตัวอักษร ใช้คำว่า ${productName} เป็น keyword หลัก",
  "caption": "แคปชั่นโปรโมท 1-3 ประโยค มี emoji เล็กน้อย กระตุ้นให้กดซื้อ/ดูคลิป",
  "hashtags": "แฮชแท็ก 4-6 แท็ก คั่นด้วยเว้นวรรค เกี่ยวข้องกับสินค้าและการรีวิว/ขายของ"
}`;
}

// ดึง JSON object ตัวแรกจาก text (เผื่อโมเดลห่อด้วย \`\`\`json ... \`\`\`)
function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI ไม่ได้ตอบกลับเป็น JSON");
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  return {
    title: String(obj.title || "").slice(0, 100),
    caption: String(obj.caption || ""),
    hashtags: String(obj.hashtags || ""),
  };
}

async function callOpenAI(apiKey: string, model: string, prompt: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, messages: [{ role: "user", content: prompt }],
      temperature: 0.8, response_format: { type: "json_object" },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "OpenAI error");
  return extractJson(j.choices?.[0]?.message?.content || "");
}

async function callDeepseek(apiKey: string, model: string, prompt: string) {
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, messages: [{ role: "user", content: prompt }],
      temperature: 0.8, response_format: { type: "json_object" },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "DeepSeek error");
  return extractJson(j.choices?.[0]?.message?.content || "");
}

async function callAnthropic(apiKey: string, model: string, prompt: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 1024, messages: [{ role: "user", content: prompt }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Anthropic error");
  return extractJson(j.content?.[0]?.text || "");
}

async function callGemini(apiKey: string, model: string, prompt: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Gemini error");
  return extractJson(j.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: "unauthorized" }, 401);

  const { productName, platform } = await req.json();
  if (!productName || !String(productName).trim()) return json({ error: "ต้องระบุชื่อสินค้า" }, 400);

  const { data: settings } = await admin.from("user_settings").select("ai_provider, ai_api_key, ai_model").eq("user_id", user.id).maybeSingle();
  const provider = settings?.ai_provider || "openai";
  const apiKey = settings?.ai_api_key;
  if (!apiKey) return json({ error: "ยังไม่ได้ตั้งค่า AI — ไปที่ ตั้งค่า → AI ออโต้เจน แล้วใส่ API key" }, 400);
  const model = settings?.ai_model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;

  const prompt = buildPrompt(String(productName).trim(), platform);

  try {
    let result;
    switch (provider) {
      case "gemini":    result = await callGemini(apiKey, model, prompt); break;
      case "anthropic": result = await callAnthropic(apiKey, model, prompt); break;
      case "deepseek":  result = await callDeepseek(apiKey, model, prompt); break;
      default:          result = await callOpenAI(apiKey, model, prompt); break;
    }
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "สร้างเนื้อหาไม่สำเร็จ" }, 400);
  }
});
