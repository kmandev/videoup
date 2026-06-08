/* ============================================================
   VideoUp — SaaS data: plans, subscription, usage, invoices
   ============================================================ */

const PLANS = [
  {
    id: "free", name: "Free", price: 0, tagline: "ลองใช้ฟรี ไม่มีบัตร",
    accent: "var(--text-dim)",
    limits: { platforms: 1, clips: 10, schedule: "7 วัน", seats: 1, store: 5 },
    features: [
      "เชื่อม 1 แพลตฟอร์ม",
      "อัปโหลด 10 คลิป / เดือน",
      "ตั้งเวลาล่วงหน้า 7 วัน",
      "ใช้ Google Drive ของคุณเอง",
      "พรีวิวก่อนโพสต์",
    ],
    notIncluded: ["Affiliate link อัตโนมัติ", "รายงานยอดวิว"],
    cta: "เริ่มใช้ฟรี",
  },
  {
    id: "pro", name: "Pro", price: 349, popular: true, tagline: "สำหรับนักขายจริงจัง",
    accent: "var(--brand)",
    limits: { platforms: 5, clips: 150, schedule: "ไม่จำกัด", seats: 1, store: 50 },
    features: [
      "ครบทั้ง 5 แพลตฟอร์ม (TikTok, YouTube, Facebook, Shopee, Lazada)",
      "อัปโหลด 150 คลิป / เดือน",
      "ตั้งเวลาไม่จำกัด",
      "เชื่อมหลาย source: Drive, Dropbox, OneDrive, URL",
      "ลบไฟล์อัตโนมัติหลังโพสต์สำเร็จ",
      "แยก caption / แฮชแท็ก / ลิงก์ ต่อแพลตฟอร์ม",
      "Affiliate link แนบอัตโนมัติ",
      "รายงานยอดวิว & คลิกพื้นฐาน",
    ],
    notIncluded: ["หลายร้าน / แบรนด์", "ทีมหลายคน", "API"],
    cta: "อัปเกรดเป็น Pro",
  },
  {
    id: "business", name: "Business", price: 990, tagline: "หลายร้าน + ทีมงาน",
    accent: "var(--brand-2)",
    limits: { platforms: 5, clips: "ไม่จำกัด", schedule: "ไม่จำกัด", seats: 5, store: 200 },
    features: [
      "ทุกอย่างใน Pro",
      "อัปโหลดคลิปไม่จำกัด",
      "จัดการหลายร้าน / แบรนด์",
      "ทีมงานสูงสุด 5 คน + สิทธิ์",
      "รายงานเชิงลึก + export",
      "API & Webhook",
    ],
    notIncluded: [],
    cta: "อัปเกรดเป็น Business",
  },
];
const PLAN = (id) => PLANS.find(p => p.id === id);

/* current subscription (mutable plan lives in App state; this is the meta) */
const SUBSCRIPTION = {
  planId: "pro",
  cycle: "monthly",
  renewAt: "1 ก.ค. 2569",
  startedAt: "1 มี.ค. 2569",
  card: { brand: "Visa", last4: "4242", exp: "08/28" },
  autoRenew: true,
};

/* this-month usage (some tie back to the core mock data) */
const USAGE = {
  clipsUsed: 38,        // of plan.clips
  platformsConnected: 4,
  scheduledNow: 11,
  storeUsedGB: 86,      // shared with Drive
  seatsUsed: 1,
};

const INVOICES = [
  { id: "INV-2026-0603", date: "1 มิ.ย. 2569", amount: 349, plan: "Pro · รายเดือน", status: "paid" },
  { id: "INV-2026-0502", date: "1 พ.ค. 2569", amount: 349, plan: "Pro · รายเดือน", status: "paid" },
  { id: "INV-2026-0401", date: "1 เม.ย. 2569", amount: 349, plan: "Pro · รายเดือน", status: "paid" },
  { id: "INV-2026-0300", date: "1 มี.ค. 2569", amount: 349, plan: "Pro · รายเดือน", status: "paid" },
];

/* landing page content */
const LANDING_FEATURES = [
  { icon: "send", title: "โพสต์ทีเดียว 5 แพลตฟอร์ม", desc: "อัปคลิปเดียว กระจายขึ้น TikTok, YouTube Shorts, Facebook Reels, Shopee และ Lazada พร้อมกัน" },
  { icon: "edit", title: "แยกแคปชั่นรายแพลตฟอร์ม", desc: "caption แฮชแท็ก และลิงก์ affiliate ปรับแยกได้ทุกแพลตฟอร์มในที่เดียว" },
  { icon: "calendar", title: "ตั้งเวลาล่วงหน้า", desc: "วางคิวเป็นสัปดาห์ ปล่อยให้ระบบโพสต์ตามเวลาที่ตั้งไว้แบบอัตโนมัติ" },
  { icon: "link", title: "Affiliate link อัตโนมัติ", desc: "แนบลิงก์ขายของแต่ละแพลตฟอร์มให้เอง ไม่ต้องก๊อปวางทีละอัน" },
  { icon: "drive", title: "รองรับหลาย source", desc: "ดึงไฟล์จาก Google Drive, Dropbox หรือ OneDrive — ยืดหยุ่น ไม่ผูกมัดที่เดียว" },
  { icon: "trash", title: "ลบอัตโนมัติหลังโพสต์", desc: "ตั้งลบไฟล์จาก source หลังโพสต์สำเร็จ ประหยัดพื้นที่ ไม่ต้องมาตามลบทีหลัง" },
  { icon: "trend", title: "เห็นผลทุกคลิป", desc: "รวมยอดวิว เอนเกจ และยอดคลิก affiliate จากทุกแพลตฟอร์มในแดชบอร์ดเดียว" },
];

const LANDING_STEPS = [
  { n: "1", title: "อัปคลิปขึ้น Drive", desc: "วางไฟล์วิดีโอไว้ในโฟลเดอร์ Google Drive ของคุณ" },
  { n: "2", title: "เขียนแคปชั่น + ลิงก์", desc: "ใส่ caption และลิงก์ affiliate แยกแต่ละแพลตฟอร์ม" },
  { n: "3", title: "ตั้งเวลา & ปล่อย", desc: "ระบบอัปโหลดให้อัตโนมัติตามคิวที่ตั้งไว้" },
];

const FAQ = [
  { q: "ไฟล์วิดีโอเก็บที่ไหน?", a: "เก็บบน Cloud Storage ของคุณเอง (Google Drive, Dropbox, OneDrive) VideoUp แค่ดึงไปอัปโหลด ไม่ถือครองไฟล์ของคุณ" },
  { q: "ยกเลิกได้ไหม?", a: "ยกเลิกได้ทุกเมื่อ ใช้งานได้ถึงสิ้นรอบบิลปัจจุบัน ไม่มีสัญญาผูกมัด" },
  { q: "เปลี่ยนแพ็กเกจกลางคันได้ไหม?", a: "ได้ทันที ระบบคิดส่วนต่างตามสัดส่วนวันที่เหลือให้อัตโนมัติ" },
];

Object.assign(window, { PLANS, PLAN, SUBSCRIPTION, USAGE, INVOICES, LANDING_FEATURES, LANDING_STEPS, FAQ });
