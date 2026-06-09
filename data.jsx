/* ============================================================
   VideoUp — mock data + helpers  (exported to window)
   ============================================================ */

const PLATFORMS = {
  tiktok:   { id: "tiktok",   name: "TikTok",         short: "TikTok",  mono: "T", color: "#111118", accent: "#FE2C55", handle: "@viralshop.th" },
  youtube:  { id: "youtube",  name: "YouTube Shorts", short: "Shorts",  mono: "▸", color: "#FF0033", accent: "#FF0033", handle: "ViralShop TH" },
  facebook: { id: "facebook", name: "Facebook Reels", short: "Reels",   mono: "f", color: "#1877F2", accent: "#1877F2", handle: "ViralShop.TH" },
  shopee:   { id: "shopee",   name: "Shopee Video",   short: "Shopee",  mono: "S", color: "#EE4D2D", accent: "#EE4D2D", handle: "viralshop.official" },
  lazada:   { id: "lazada",   name: "Lazada",         short: "Lazada",  mono: "L", color: "#2A1D8F", accent: "#F57224", handle: "ViralShop Mall" },
};
const PLATFORM_LIST = ["tiktok", "youtube", "facebook", "shopee", "lazada"];

// นามสกุลไฟล์ที่แต่ละแพลตฟอร์มรองรับ (วิดีโอสั้น)
const PLATFORM_FORMATS = {
  tiktok:   ["mp4", "mov", "webm"],
  youtube:  ["mp4", "mov", "webm", "avi", "mpeg4", "3gp"],
  facebook: ["mp4", "mov"],
  shopee:   ["mp4"],
  lazada:   ["mp4"],
};
const SAFE_FORMAT = "mp4"; // mp4 (H.264/AAC) รองรับทุกแพลตฟอร์ม
const fileExt = (name) => (name || "").split(".").pop().toLowerCase();
// คืน list แพลตฟอร์มที่ "ไม่รองรับ" นามสกุลนี้ (จากที่เลือกไว้)
const incompatiblePlatforms = (ext, platforms) =>
  (platforms || []).filter(p => !(PLATFORM_FORMATS[p] || []).includes(ext));

/* video sources — not just Google Drive */
const SOURCES = {
  gdrive:   { id: "gdrive",   name: "Google Drive", short: "Drive",    color: "#1A73E8", icon: "gdrive",   account: "viralshop.media@gmail.com", path: "/VideoUp/clips",     used: 86, total: 200 },
  dropbox:  { id: "dropbox",  name: "Dropbox",      short: "Dropbox",  color: "#0061FF", icon: "dropbox",  account: "viralshop@dropbox",         path: "/Videos/Shorts",     used: 12, total: 50  },
  onedrive: { id: "onedrive", name: "OneDrive",     short: "OneDrive", color: "#0364B8", icon: "onedrive", account: "viralshop@outlook.com",     path: "/Videos/VideoUp",    used: 24, total: 100 },
  url:      { id: "url",      name: "URL / Direct",  short: "URL",      color: "#8A6E80", icon: "link",   account: "ลิงก์ตรงไปยังไฟล์",         path: "https://...",        used: 0,  total: 0   },
};
const SOURCE_LIST = ["gdrive", "dropbox", "onedrive", "url"];
const SRC = (id) => SOURCES[id];

/* gradient covers for video thumbnails (drop-in placeholders for real footage) */
const COVERS = [
  "linear-gradient(135deg,#FF6A3D,#FF2E76)",
  "linear-gradient(135deg,#6C4DFF,#2D7BFF)",
  "linear-gradient(135deg,#14CFA6,#2D7BFF)",
  "linear-gradient(135deg,#FFB02E,#FF6A3D)",
  "linear-gradient(135deg,#FF2E97,#FFC233)",
  "linear-gradient(135deg,#00BBD3,#6C4DFF)",
  "linear-gradient(135deg,#E23D4B,#FFB02E)",
  "linear-gradient(135deg,#2A1D8F,#FF2E76)",
];

const VIDEOS = [
  { id: "v1", title: "รีวิวหูฟัง TWS เบสแน่น", dur: 38, size: 84,  cover: COVERS[0], source: "gdrive",   drive: "/VideoUp/clips/tws-bass-review.mp4",  added: "2 ชม.ที่แล้ว" },
  { id: "v2", title: "เซรั่มหน้าใส 7 วันเห็นผล", dur: 52, size: 118, cover: COVERS[4], source: "gdrive",   drive: "/VideoUp/clips/serum-7days.mp4",     added: "5 ชม.ที่แล้ว" },
  { id: "v3", title: "หม้อทอดไร้น้ำมัน unboxing", dur: 44, size: 96,  cover: COVERS[3], source: "dropbox",  drive: "/Videos/Shorts/airfryer-unbox.mp4",  added: "เมื่อวาน" },
  { id: "v4", title: "กระเป๋าสะพายมินิมอล",      dur: 29, size: 61,  cover: COVERS[7], source: "onedrive", drive: "/Videos/VideoUp/mini-bag.mp4",       added: "เมื่อวาน" },
  { id: "v5", title: "ไฟ LED แต่งห้อง vibe",     dur: 33, size: 72,  cover: COVERS[1], source: "gdrive",   drive: "/VideoUp/clips/led-room.mp4",       added: "2 วันที่แล้ว" },
  { id: "v6", title: "ขวดน้ำเก็บความเย็น 24 ชม.", dur: 41, size: 90,  cover: COVERS[2], source: "gdrive",   drive: "/VideoUp/clips/cold-bottle.mp4",     added: "3 วันที่แล้ว" },
  { id: "v7", title: "รองเท้าวิ่งน้ำหนักเบา",     dur: 47, size: 105, cover: COVERS[5], source: "gdrive",   drive: "/VideoUp/clips/run-shoes.mp4",      added: "3 วันที่แล้ว" },
  { id: "v8", title: "เคสมือถือกันกระแทก",       dur: 26, size: 55,  cover: COVERS[6], source: "dropbox",  drive: "/Videos/Shorts/phone-case.mp4",      added: "4 วันที่แล้ว" },
];
const VID = (id) => VIDEOS.find(v => v.id === id);

/* anchor "today" = Sun 7 Jun 2026 */
const TODAY = new Date();
function dAt(dayOffset, h, m) {
  const d = new Date(2026, 5, 7 + dayOffset, h, m || 0);
  return d;
}

/* statuses: scheduled | publishing | published | failed | draft */
const POSTS = [
  // past — published / failed (for activity + platform stats)
  { id: "p1", vid: "v8", title: "เคสมือถือกันกระแทก", when: dAt(-1, 19, 0),
    platforms: { tiktok: "published", youtube: "published", shopee: "published", lazada: "failed" } },
  { id: "p2", vid: "v7", title: "รองเท้าวิ่งน้ำหนักเบา", when: dAt(-1, 12, 30),
    platforms: { tiktok: "published", shopee: "published" } },
  { id: "p3", vid: "v6", title: "ขวดน้ำเก็บความเย็น 24 ชม.", when: dAt(0, 7, 30),
    platforms: { tiktok: "published", youtube: "published", shopee: "published", lazada: "published" } },
  { id: "p4", vid: "v5", title: "ไฟ LED แต่งห้อง vibe", when: dAt(0, 8, 15),
    platforms: { tiktok: "published", youtube: "failed" } },

  // today — upcoming / publishing
  { id: "p5", vid: "v1", title: "รีวิวหูฟัง TWS เบสแน่น", when: dAt(0, 12, 0),
    platforms: { tiktok: "publishing", youtube: "scheduled", shopee: "scheduled" } },
  { id: "p6", vid: "v2", title: "เซรั่มหน้าใส 7 วันเห็นผล", when: dAt(0, 18, 30),
    platforms: { tiktok: "scheduled", shopee: "scheduled", lazada: "scheduled" } },
  { id: "p7", vid: "v3", title: "หม้อทอดไร้น้ำมัน unboxing", when: dAt(0, 20, 0),
    platforms: { tiktok: "scheduled", youtube: "scheduled" } },

  // upcoming days
  { id: "p8",  vid: "v4", title: "กระเป๋าสะพายมินิมอล", when: dAt(1, 11, 0),
    platforms: { tiktok: "scheduled", shopee: "scheduled", lazada: "scheduled" } },
  { id: "p9",  vid: "v7", title: "รองเท้าวิ่ง รุ่นใหม่ สีพิเศษ", when: dAt(1, 19, 30),
    platforms: { tiktok: "scheduled", youtube: "scheduled" } },
  { id: "p10", vid: "v6", title: "ขวดน้ำ vlog ใช้จริง 1 เดือน", when: dAt(2, 18, 0),
    platforms: { tiktok: "scheduled", shopee: "scheduled" } },
  { id: "p11", vid: "v2", title: "เซรั่ม before/after", when: dAt(2, 20, 30),
    platforms: { youtube: "scheduled", lazada: "scheduled" } },
  { id: "p12", vid: "v5", title: "ไฟ LED set up โต๊ะทำงาน", when: dAt(3, 12, 0),
    platforms: { tiktok: "scheduled", shopee: "scheduled", youtube: "scheduled" } },
  { id: "p13", vid: "v3", title: "หม้อทอด 5 เมนูใน 1 คลิป", when: dAt(4, 18, 30),
    platforms: { tiktok: "scheduled", shopee: "scheduled", lazada: "scheduled" } },
  { id: "p14", vid: "v1", title: "หูฟัง vs คู่แข่ง เทียบชัด", when: dAt(5, 19, 0),
    platforms: { tiktok: "scheduled", youtube: "scheduled" } },
  { id: "p15", vid: "v8", title: "เคสมือถือ 10 สีใหม่", when: dAt(6, 11, 30),
    platforms: { shopee: "scheduled", lazada: "scheduled" } },
  // draft
  { id: "p16", vid: "v4", title: "กระเป๋า มินิมอล (ร่าง)", when: dAt(7, 18, 0),
    platforms: { tiktok: "draft", shopee: "draft" } },
];

const DRIVE = { account: "viralshop.media@gmail.com", usedGB: 86, totalGB: 200, folder: "/VideoUp/clips" };

/* ---------- helpers ---------- */
const TH_DOW = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];
const TH_DOW_FULL = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
const TH_MON = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmtTime(d) { return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); }
function fmtDate(d) { return d.getDate() + " " + TH_MON[d.getMonth()]; }
function fmtDateFull(d) { return TH_DOW_FULL[d.getDay()] + "ที่ " + d.getDate() + " " + TH_MON[d.getMonth()] + " " + (d.getFullYear()+543); }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function relDay(d) {
  if (sameDay(d, TODAY)) return "วันนี้";
  const t2 = new Date(TODAY); t2.setDate(t2.getDate()+1);
  if (sameDay(d, t2)) return "พรุ่งนี้";
  const y = new Date(TODAY); y.setDate(y.getDate()-1);
  if (sameDay(d, y)) return "เมื่อวาน";
  return fmtDate(d);
}
function postStatus(p) {
  const s = Object.values(p.platforms);
  if (s.includes("publishing")) return "publishing";
  if (s.every(x => x === "draft")) return "draft";
  if (s.includes("scheduled")) return "scheduled";
  if (s.includes("failed") && s.includes("published")) return "partial";
  if (s.every(x => x === "published")) return "published";
  if (s.every(x => x === "failed")) return "failed";
  return "scheduled";
}

/* derived dashboard stats */
function platformStats() {
  const out = {};
  PLATFORM_LIST.forEach(k => out[k] = { published: 0, failed: 0, scheduled: 0 });
  POSTS.forEach(p => Object.entries(p.platforms).forEach(([k, st]) => {
    if (!out[k]) return;
    if (st === "published") out[k].published++;
    else if (st === "failed") out[k].failed++;
    else if (st === "scheduled" || st === "publishing") out[k].scheduled++;
  }));
  return out;
}

Object.assign(window, {
  PLATFORMS, PLATFORM_LIST, VIDEOS, VID, POSTS, DRIVE, TODAY, COVERS,
  SOURCES, SOURCE_LIST, SRC,
  TH_DOW, TH_DOW_FULL, TH_MON, fmtTime, fmtDate, fmtDateFull, sameDay, relDay,
  postStatus, platformStats, dAt,
});
