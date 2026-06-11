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
 │             │
 │ pg_cron ───►│ Edge Functions (oauth, scan, publish, telegram)
 │ ทุก 1 นาที   │ อัปโหลดจริงไปแต่ละแพลตฟอร์ม — รันบน cloud ทั้งหมด
 └─────────────┘
```

| ส่วน | บริการที่แนะนำ | ทำไม / Free tier |
|---|---|---|
| **โฮสต์เว็บ** | **Vercel** ⭐ | ไม่ต้อง build, deploy จาก Git ใน 1 คลิก, โดเมน `.vercel.app` ฟรี, bandwidth 100GB/เดือน |
| ทางเลือกโฮสต์ | Netlify / Cloudflare Pages / GitHub Pages | ฟรีเหมือนกัน — เลือกอันใดก็ได้ |
| **ฐานข้อมูล + Auth + Scheduler** | **Supabase** ⭐ | Postgres 500MB, ผู้ใช้ไม่จำกัด, Realtime, Storage 1GB, Edge Functions + pg_cron — ฟรี |
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

## 4. Deploy Edge Functions + ตั้งเวลาด้วย pg_cron (ตัวอัปโหลดจริง)

ทุกอย่างรันบน Supabase — ไม่ต้องมีเครื่องที่บ้าน

```sh
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>

# deploy ฟังก์ชันที่ใช้
supabase functions deploy oauth-source --no-verify-jwt
supabase functions deploy oauth-platform --no-verify-jwt
supabase functions deploy scan-source --no-verify-jwt
supabase functions deploy upload-source --no-verify-jwt
supabase functions deploy publish-post --no-verify-jwt
supabase functions deploy publish-local --no-verify-jwt
supabase functions deploy telegram-test --no-verify-jwt
supabase functions deploy generate-content --no-verify-jwt
```

ตั้ง secrets (client id/secret ของแต่ละ provider + bot token):
```sh
supabase secrets set \
  GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx \
  DROPBOX_CLIENT_ID=xxx DROPBOX_CLIENT_SECRET=xxx \
  ONEDRIVE_CLIENT_ID=xxx ONEDRIVE_CLIENT_SECRET=xxx \
  TELEGRAM_BOT_TOKEN=xxx \
  CRON_SECRET=<สุ่มสตริงยาวๆ>
```

จากนั้นรัน [`db/cron.sql`](db/cron.sql) ใน Supabase SQL Editor — จะตั้ง `pg_cron` job
ให้เรียก `publish-post` ทุก 1 นาทีพร้อม `CRON_SECRET` (แทน service_role key ที่ไม่ควรอยู่ใน SQL)

> ⚠️ **service_role key** ใช้เฉพาะ**ภายใน** Edge Function runtime (ฉีดให้อัตโนมัติ)
> ห้ามใส่ในเว็บ, SQL, หรือ commit ขึ้น Git — `CRON_SECRET` คือสิ่งเดียวที่ pg_cron ต้องรู้

---

## 5. ต่อ API แพลตฟอร์มจริง

ตอนนี้รองรับ **YouTube Shorts** จริงแล้ว (ผ่าน YouTube Data API v3 ใน `publish-post`/`publish-local`)
แพลตฟอร์มอื่นยังเป็น TODO — เพิ่มได้ในไฟล์เดียวกัน:

| แพลตฟอร์ม | API ที่ใช้ | ต้องสมัคร |
|---|---|---|
| YouTube Shorts | YouTube Data API v3 (`videos.insert`) ✅ | Google Cloud Console |
| TikTok | Content Posting API | TikTok for Developers |
| Facebook Reels | Graph API `/video_reels` | Meta for Developers |
| Shopee Video | Shopee Open Platform | Shopee Open Platform |
| Lazada | Lazada Open Platform | Lazada Open Platform |

แต่ละแพลตฟอร์มต้องผ่านการรีวิวแอป + ขอ OAuth scope การโพสต์ — เริ่มสมัครแต่เนิ่นๆ

---

## 6. เช็กลิสต์เริ่มใช้งานฟรี

- [ ] สร้าง Supabase project + รัน `db/schema.sql`
- [ ] กรอก `config.js`
- [ ] Deploy เว็บขึ้น Vercel
- [ ] สมัครสมาชิกผ่านหน้า `auth.html` (สร้าง user จริงใน Supabase)
- [ ] Deploy Edge Functions + ตั้ง secrets + รัน `db/cron.sql`
- [ ] (เมื่อพร้อม) ต่อ API แพลตฟอร์มอื่นเพิ่มใน `publish-post`/`publish-local`

ทั้งหมดนี้ **ค่าใช้จ่าย 0 บาท** จนกว่าจะโตเกิน free tier 🎉
