# 🔌 VideoUp — เชื่อมต่อ Cloud Source จริง (Google Drive / Dropbox / OneDrive)

คู่มือนี้ทำให้ปุ่ม **"เชื่อมต่อ"** ในหน้า Settings → แหล่งวิดีโอ ทำงานได้จริง
โดยใช้ **Supabase Edge Functions** แลก OAuth token (ฟรี)

```
ผู้ใช้กด "เชื่อมต่อ Google Drive"
   │  เรียก Edge Function /start (แนบ JWT)
   ▼
Edge Function สร้าง state + คืน consent URL
   │  redirect ไปหน้า login ของผู้ให้บริการ
   ▼
ผู้ใช้อนุญาต → ผู้ให้บริการ redirect มาที่ /callback?code
   ▼
Edge Function แลก code → access/refresh token (ใช้ client secret)
   │  บันทึกลงตาราง sources (credentials)
   ▼
redirect กลับเว็บ → แสดง "เชื่อมต่อสำเร็จ ✓"
   ▼
Edge Function publish-post ใช้ token นั้นดึง/ลบไฟล์ตอนโพสต์ (รันบน cloud)
```

---

## ขั้นที่ 0 — เตรียม Database

รัน [`db/sources-oauth.sql`](db/sources-oauth.sql) ใน Supabase SQL Editor
(เพิ่มตาราง `oauth_states` + unique constraint บน `sources`)

---

## ขั้นที่ 1 — ลงทะเบียน OAuth App ของแต่ละผู้ให้บริการ

> **Redirect URI ที่ต้องใส่ทุกเจ้า** (เปลี่ยน `<ref>` เป็น project ref ของคุณ):
> ```
> https://<ref>.supabase.co/functions/v1/oauth-source/callback
> ```
> ของคุณคือ: `https://qecufglvnslwjogqpnro.supabase.co/functions/v1/oauth-source/callback`

### 🟦 Google Drive
1. https://console.cloud.google.com → **APIs & Services**
2. เปิดใช้ **Google Drive API** (Library → ค้น "Drive" → Enable)
3. **OAuth consent screen** → External → กรอกข้อมูล → เพิ่ม scope `.../auth/drive`
4. **Credentials → Create → OAuth client ID → Web application**
5. ใส่ Redirect URI ข้างบน → ได้ **Client ID** + **Client Secret**

### 🟦 Dropbox
1. https://www.dropbox.com/developers/apps → **Create app**
2. เลือก **Scoped access** → **Full Dropbox**
3. แท็บ **Permissions** เปิด: `files.content.read`, `files.content.write`, `account_info.read`
4. แท็บ **Settings** → ใส่ Redirect URI → ได้ **App key** + **App secret**

### 🟦 OneDrive (Microsoft)
1. https://entra.microsoft.com → **App registrations → New registration**
2. Supported account types: **Personal + Org** (หรือตามที่ใช้)
3. Redirect URI: เลือก **Web** → ใส่ URI ข้างบน
4. **Certificates & secrets → New client secret** → ได้ **Value** (= secret)
5. Application (client) ID = **Client ID**

---

## ขั้นที่ 2 — Deploy Edge Function

ติดตั้ง Supabase CLI แล้วที่โฟลเดอร์โปรเจกต์:
```sh
npm i -g supabase
supabase login
supabase link --project-ref qecufglvnslwjogqpnro

# deploy ฟังก์ชัน (ปิด verify-jwt เพราะ /callback ถูกเรียกจากผู้ให้บริการ)
supabase functions deploy oauth-source --no-verify-jwt
```

---

## ขั้นที่ 3 — ตั้ง Secrets ให้ Edge Function

```sh
supabase secrets set \
  APP_URL=https://videoup-beta.vercel.app \
  GOOGLE_CLIENT_ID=xxx       GOOGLE_CLIENT_SECRET=xxx \
  DROPBOX_CLIENT_ID=xxx      DROPBOX_CLIENT_SECRET=xxx \
  ONEDRIVE_CLIENT_ID=xxx     ONEDRIVE_CLIENT_SECRET=xxx
```

> `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` มีให้อัตโนมัติใน Edge runtime
> ไม่ต้องตั้งเอง (ถ้า CLI ไม่ให้ตั้ง 2 ค่านี้เป็นเรื่องปกติ)

---

## ขั้นที่ 4 — ทดสอบ

1. เปิด https://videoup-beta.vercel.app → Settings → **แหล่งวิดีโอ**
2. กด **เชื่อมต่อ** ที่ Google Drive → ควรเด้งไปหน้า consent ของ Google
3. กดอนุญาต → กลับมาเว็บ เห็น toast "เชื่อมต่อ source สำเร็จ ✓"
4. เช็คใน Supabase → Table `sources` ควรมีแถวใหม่พร้อม `credentials`

---

## ขั้นที่ 5 — ให้ Edge Function `publish-post` ใช้ token

ใส่ client id/secret ชุดเดียวกันด้วย `supabase secrets set` (ดูขั้นที่ 3)
เพื่อให้ `publish-post` refresh token แล้วดึง/ลบไฟล์ได้ตอนถึงเวลาโพสต์ (รันบน cloud ผ่าน pg_cron)

> **หมายเหตุ `video.file_path`** ต้องเป็นตัวระบุไฟล์ของผู้ให้บริการ:
> - Google Drive → **file ID**
> - Dropbox / OneDrive → **path** เช่น `/Videos/Shorts/clip.mp4`

---

## เช็กลิสต์

- [ ] รัน `db/sources-oauth.sql`
- [ ] ลงทะเบียน OAuth app ครบ 3 เจ้า + ใส่ redirect URI
- [ ] `supabase functions deploy oauth-source --no-verify-jwt`
- [ ] `supabase secrets set ...` ครบทุกค่า
- [ ] กดเชื่อมต่อในเว็บแล้วได้ token จริง
