/* ============================================================
   VideoUp — shared primitives + icons  (exported to window)
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- icon set (simple line glyphs) ---------- */
const ICONS = {
  grid:     "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  calendar: "M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Z",
  plus:     "M12 5v14M5 12h14",
  film:     "M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16",
  link:     "M9 15l6-6M10.5 6.5l1.8-1.8a3.5 3.5 0 0 1 5 5l-1.8 1.8M13.5 17.5l-1.8 1.8a3.5 3.5 0 0 1-5-5l1.8-1.8",
  clock:    "M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z",
  check:    "M4 12.5l5 5L20 6.5",
  x:        "M6 6l12 12M18 6 6 18",
  alert:    "M12 8v5M12 16.5v.5M12 3 2.5 20h19L12 3Z",
  upload:   "M12 16V5M7 10l5-5 5 5M5 20h14",
  bolt:     "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  rocket:   "M5 14c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3 0 6 3 6 6 0 2.5-2 6-6 9-4-3-6-6.5-6-9 0-3 3-6 6-6ZM14 9.5h.01",
  drive:    "M8 3h8l5.5 9.5L18 19H6L2.5 12.5 8 3ZM8 3l4 7M16 3l-4 7M2.5 12.5h9M21.5 12.5h-9",
  cpu:      "M7 7h10v10H7zM9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2",
  menu:     "M4 7h16M4 12h16M4 17h16",
  trend:    "M3 17l6-6 4 4 7-7M14 8h6v6",
  eye:      "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  heart:    "M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z",
  send:     "M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z",
  copy:     "M9 9h10v10H9zM5 15H4V4h11v1",
  bell:     "M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10.5 21a2 2 0 0 0 3 0",
  search:   "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  edit:     "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
  trash:    "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  refresh:  "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  list:     "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  chevL:    "M15 6l-6 6 6 6",
  chevR:    "M9 6l6 6-6 6",
  tag:      "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9ZM7.5 7.5h.01",
  hash:     "M9 3 7 21M17 3l-2 18M4 8h16M3 16h16",
  cart:     "M3 4h2l2.5 12h11L21 7H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2M18 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2",
  star:     "M12 3l2.8 6 6.2.6-4.7 4 1.5 6L12 16.8 6.2 19.6l1.5-6L3 9.6 9.2 9 12 3Z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z",
};

function Icon({ name, size = 19, stroke = 2, fill = false, style }) {
  const d = ICONS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none", ...style }}>
      {d.split("M").filter(Boolean).map((seg, i) => <path key={i} d={"M" + seg} />)}
    </svg>
  );
}

/* ---------- buttons ---------- */
function Btn({ variant = "subtle", size, icon, iconR, children, ...rest }) {
  return (
    <button className={`btn ${variant} ${size === "sm" ? "sm" : ""}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
      {iconR && <Icon name={iconR} size={size === "sm" ? 16 : 18} />}
    </button>
  );
}

/* ---------- platform badge ---------- */
const STATUS_COLOR = {
  published: "var(--ok)", scheduled: "var(--info)", publishing: "var(--warn)",
  failed: "var(--err)", draft: "var(--text-mute)",
};
function PlatformBadge({ id, size = "", status }) {
  const p = PLATFORMS[id];
  if (!p) return null;
  return (
    <div className={`pbadge ${size}`} style={{ background: p.color }} title={p.name}>
      <span style={{ color: id === "lazada" ? p.accent : "#fff" }}>{p.mono}</span>
      {status && <span className="pstatus" style={{ background: STATUS_COLOR[status] }} />}
    </div>
  );
}
function PlatformStack({ ids, size = "sm" }) {
  return <div className="plat-stack">{ids.map(id => <PlatformBadge key={id} id={id} size={size} />)}</div>;
}

/* ---------- status badge ---------- */
const STATUS_META = {
  published:  { cls: "ok",   label: "สำเร็จ" },
  scheduled:  { cls: "info", label: "ตั้งเวลา" },
  publishing: { cls: "warn", label: "กำลังโพสต์" },
  partial:    { cls: "warn", label: "บางส่วน" },
  failed:     { cls: "err",  label: "ล้มเหลว" },
  draft:      { cls: "mute", label: "ร่าง" },
};
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.scheduled;
  return <span className={`badge ${m.cls}`}><span className="dot" />{m.label}</span>;
}

/* ---------- video thumbnail ---------- */
function VideoThumb({ vid, showPlay = true }) {
  const v = typeof vid === "string" ? VID(vid) : vid;
  if (!v) return null;
  const mm = Math.floor(v.dur / 60), ss = String(v.dur % 60).padStart(2, "0");
  // cover อาจเป็น CSS gradient (placeholder) หรือ public URL รูปจริงจาก Storage
  const isImg = typeof v.cover === "string" && /^(https?:|\/|data:)/.test(v.cover);
  const bg = isImg
    ? { backgroundImage: `url("${v.cover}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: v.cover || COVERS[0] };
  return (
    <div className="vidthumb" style={bg}>
      {showPlay && <div className="play"><Icon name="film" size={16} /></div>}
      <span className="dur">{mm}:{ss}</span>
    </div>
  );
}

/* ---------- progress ring / bar ---------- */
function Bar({ value, max, color = "var(--brand)", height = 7 }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 99, height, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .4s" }} />
    </div>
  );
}

Object.assign(window, { Icon, Btn, PlatformBadge, PlatformStack, StatusBadge, VideoThumb, Bar, STATUS_META, STATUS_COLOR });
