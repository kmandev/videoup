# 🚀 VideoUp — คู่มือ Deploy & เริ่มใช้งานจริง (ฟรี)

เอกสารนี้พาคุณจาก prototype → ระบบใช้งานจริงบนอินเทอร์เน็ต โดย**เริ่มต้นได้ฟรีทั้งหมด**

---

## 1. สรุปสถาปัตยกรรม (Free-tier Stack)

```
 ผู้ใช้ (เบราว์เซอร์)
      │
      ▼
 ┌─────────────┐     เว็บ static (HTML/JS)
 │   Vercel    │ ◄── deploy ฟรี, โดเมนฟรี, HTTPS อัตโนมัติ
 └─────────────┘
      │  อ่าน/เขียนข้อมูล + ล็อกอิน
      ▼
 ┌─────────────┐     PostgreSQL + Auth + Realtime + Storage
 │  Supabase   │ ◄── ฐานข้อมูล + ระบบสมาชิก (ฟรี)
 └─────────────┘
      ▲  poll คิวที่ถึงเวลา (ทุก 1 นาที)
      │
 ┌─────────────┐     อัปโหลดจริงไปแต่ละแพลตฟอร์ม
 │ Raspberry   │ ◄── เครื่องที่บ้าน (ฟรี — ใช้ของเดิม)
 │   Pi 4B     │     ดึงไฟล์จาก Google Drive แล้วโพสต์
 └─────────────┘
```

| ส่วน | บริการที่แนะนำ | ทำไม / Free tier |
|---|---|---|
| **โฮสต์เว็บ** | **Vercel** ⭐ | ไม่ต้อง build, deploy จาก Git ใน 1 คลิก, โดเมน `.vercel.app` ฟรี, bandwidth 100GB/เดือน |
| ทางเลือกโฮสต์ | Netlify / Cloudflare Pages / GitHub Pages | ฟรีเหมือนกัน — เลือกอันใดก็ได้ |
| **ฐานข้อมูล + Auth** | **Supabase** ⭐ | Postgres 500MB, ผู้ใช้ไม่จำกัด, Realtime, Storage 1GB — ฟรี |
| **ตัวอัปโหลดจริง** | **Raspberry Pi 4B** | ตามแผนเดิม รันที่บ้าน ไม่มีค่าโฮสต์ |
| **เก็บไฟล์วิดีโอ** | Google Drive / Dropbox / OneDrive | ตามแผนเดิม |

> **ทำไมเลือก Vercel + Supabase:** ทั้งคู่มี free tier ถาวร (ไม่ใช่ทดลอง), ตั้งค่าง่าย,
> และเว็บนี้เป็น static + React CDN จึง deploy ได้ทันทีโดยไม่ต้องมี build step

---

## 2. ตั้งค่า Supabase (ฐานข้อมูล + ระบบสมาชิก)

1. สมัครฟรีที่ **https://supabase.com** → **New Project**
   - ตั้งรหัสผ่าน database, เลือก region **Southeast Asia (Singapore)** ใกล้ไทยสุด
2. ไปที่ **SQL Editor → New query** → วางเนื้อหาทั้งหมดจาก
   [`db/schema.sql`](db/schema.sql) → กด **Run**
   (สร้างตาราง, RLS, trigger สร้าง profile อัตโนมัติ ครบในรอบเดียว)
3. ไปที่ **Project Settings → API** คัดลอก 2 ค่า:
   - `Project URL`
   - `anon public` key
4. เปิดไฟล์ [`config.js`](config.js) กรอกค่า:
   ```js
   window.SUPABASE_URL      = 'https://xxxx.supabase.co';
   window.SUPABASE_ANON_KEY = 'eyJhbGci...';
   ```
5. (ออปชัน) เปิดล็อกอินด้วย Google: **Authentication → Providers → Google** →
   ใส่ Client ID/Secret จาก Google Cloud Console แล้วเพิ่ม redirect URL
   `https://<โดเมนเว็บ>/index.html`

> 💡 **anon key ใส่ในเว็บได้ปลอดภัย** เพราะทุกตารางเปิด Row Level Security
> ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลของตัวเองเท่านั้น

---

## 3. Deploy เว็บขึ้น Vercel (ฟรี)

**วิธี A — ผ่าน GitHub (แนะนำ):**
1. push โค้ดขึ้น GitHub repo
2. ไปที่ **https://vercel.com** → Sign up ด้วย GitHub → **Add New Project**
3. เลือก repo → Framework Preset เลือก **Other** → **Deploy**
4. เสร็จ! ได้ URL `https://videoup-xxx.vercel.app`

**วิธี B — ผ่าน CLI:**
```sh
npm i -g vercel
cd VideoUp
vercel          # ตอบคำถาม แล้วได้ลิงก์ preview
vercel --prod   # ขึ้น production
```

> ไฟล์ [`vercel.json`](vercel.json) ตั้ง `cleanUrls` และ security headers ให้แล้ว
> เปิด `auth.html` ก่อนเพื่อสมัคร/ล็อกอิน แล้วระบบพาเข้า `index.html` อัตโนมัติ

**ทางเลือกอื่น (ฟรีเหมือนกัน):**
- **Netlify** — ลาก-วางโฟลเดอร์ที่ app.netlify.com/drop ได้เลย
- **Cloudflare Pages** — เชื่อม GitHub, build command เว้นว่าง, output dir = `.`
- **GitHub Pages** — Settings → Pages → branch `main` / root

---

## 4. ตั้งค่า Raspberry Pi (ตัวอัปโหลดจริง)

บน Pi (Raspberry Pi OS):
```sh
# 1. ติดตั้ง Node 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. ดึงโค้ด
git clone <repo> ~/videoup && cd ~/videoup/scheduler
npm install

# 3. ตั้งค่า secret
cp .env.example .env
nano .env      # กรอก SUPABASE_URL และ SUPABASE_SERVICE_KEY (service_role!)

# 4. ทดสอบรัน
npm start      # ควรเห็น "🚀 VideoUp Scheduler เริ่มทำงาน"
```

ให้รันอัตโนมัติตลอด (แม้ไฟดับแล้วเปิดใหม่):
```sh
sudo cp videoup-scheduler.service /etc/systemd/system/
# แก้ User/WorkingDirectory ในไฟล์ให้ตรงเครื่อง
sudo systemctl enable --now videoup-scheduler
sudo journalctl -u videoup-scheduler -f   # ดู log สด
```

> ⚠️ **service_role key** อยู่บน Pi เท่านั้น ห้ามใส่ในเว็บหรือ commit ขึ้น Git
> มันข้าม RLS ได้ (จำเป็นเพราะ Pi ทำงานแทนผู้ใช้ทุกคน)

---

## 5. ต่อ API แพลตฟอร์มจริง

ตอนนี้ [`scheduler/platforms.js`](scheduler/platforms.js) เป็น **stub** (จำลองอัปโหลด)
ให้ระบบ flow ทำงานครบ end-to-end ทดสอบได้เลย เมื่อพร้อมต่อจริงให้แก้ที่จุด `TODO`:

| แพลตฟอร์ม | API ที่ใช้ | ต้องสมัคร |
|---|---|---|
| TikTok | Content Posting API | TikTok for Developers |
| YouTube Shorts | YouTube Data API v3 (`videos.insert`) | Google Cloud Console |
| Facebook Reels | Graph API `/video_reels` | Meta for Developers |
| Shopee Video | Shopee Open Platform | Shopee Open Platform |
| Lazada | Lazada Open Platform | Lazada Open Platform |

แต่ละแพลตฟอร์มต้องผ่านการรีวิวแอป + ขอ OAuth scope การโพสต์ — เริ่มสมัครแต่เนิ่นๆ

---

## 5.5 AI ช่วยคิดเนื้อหาสินค้า (Claude)

หน้า **สินค้า → เพิ่ม/แก้ไขสินค้า** มีปุ่ม **"AI ช่วยคิดเนื้อหา"** ที่สร้าง
title / แคปชั่น / แฮชแท็ก จากชื่อสินค้าโดยอัตโนมัติ ผ่าน Edge Function
[`supabase/functions/ai-content`](supabase/functions/ai-content/index.ts)
ที่เรียก Claude (`claude-opus-4-8`) — API key อยู่ฝั่ง server เท่านั้น

```sh
# 1. ขอ API key ที่ https://console.anthropic.com → API Keys
# 2. ตั้งเป็น secret ของ Supabase
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 3. deploy ฟังก์ชัน
supabase functions deploy ai-content
```

> โหมดสาธิต (config.js ว่าง) ปุ่มจะจำลองผลลัพธ์ในเครื่อง ไม่เรียก API จริง
> ค่าใช้จ่าย Claude คิดตามการใช้งาน (pay-as-you-go) แยกจาก free tier ของ Supabase/Vercel

---

## 6. เช็กลิสต์เริ่มใช้งานฟรี

- [ ] สร้าง Supabase project + รัน `db/schema.sql`
- [ ] กรอก `config.js`
- [ ] Deploy เว็บขึ้น Vercel
- [ ] สมัครสมาชิกผ่านหน้า `auth.html` (สร้าง user จริงใน Supabase)
- [ ] ตั้ง Pi + กรอก `.env` + เปิด systemd service
- [ ] (เมื่อพร้อม) ต่อ API แพลตฟอร์มจริงใน `platforms.js`

ทั้งหมดนี้ **ค่าใช้จ่าย 0 บาท** จนกว่าจะโตเกิน free tier 🎉
