/* ============================================================
   VideoUp — App shell, routing, modals, toasts, tweaks
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "sunset",
  "accent": "default",
  "radius": 18
}/*EDITMODE-END*/;

const ACCENTS = {
  default: null,
  coral:   { brand: "#FF6A3D", brand2: "#FF2E76" },
  violet:  { brand: "#6C4DFF", brand2: "#2D7BFF" },
  green:   { brand: "#12B281", brand2: "#14CFA6" },
  pink:    { brand: "#FF2E97", brand2: "#FFC233" },
};

const NAV = [
  { id: "dashboard", label: "ภาพรวม", en: "Dashboard", icon: "grid" },
  { id: "calendar",  label: "ปฏิทินโพสต์", en: "Schedule", icon: "calendar" },
  { id: "create",    label: "สร้างโพสต์", en: "Compose", icon: "plus" },
];
const BIZ_NAV = [
  { id: "billing",  label: "แพ็กเกจ & การเงิน", en: "Billing",  icon: "star" },
];
const PAGE_SUB = {
  dashboard: "ภาพรวมการอัปโหลดทุกแพลตฟอร์ม",
  calendar:  "จัดการคิวและตารางตั้งเวลาโพสต์",
  create:    "อัปโหลดคลิปไป TikTok · YouTube · Facebook · Shopee · Lazada",
  billing:   "จัดการแพ็กเกจ โควต้าการใช้งาน และบิล",
  settings:  "เชื่อมต่อบัญชี · แพลตฟอร์ม · การแจ้งเตือน · ค่าเริ่มต้น",
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [createSeed, setCreateSeed] = useState({});
  const [plan, setPlan] = useState(SUBSCRIPTION.planId);
  const [upgradeTo, setUpgradeTo] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // real posts + videos + sources from Supabase (live mode), fallback to mock
  const [livePosts, setLivePosts] = useState(null);   // null = ยังไม่โหลด, [] = โหลดแล้วแต่ว่าง
  const [liveVideos, setLiveVideos] = useState(null);
  const [liveSources, setLiveSources] = useState(null);
  const [liveConnections, setLiveConnections] = useState(null);

  // แพลตฟอร์มที่เชื่อมต่อแล้ว (live: จาก DB, demo: โชว์ทั้งหมด)
  const connectedPlatforms = liveConnections !== null
    ? liveConnections.filter(c => c.connected).map(c => c.platform)
    : PLATFORM_LIST;

  // normalize posts จาก view (scheduled_at string) → ให้มี when(Date) + title สำหรับ UI
  const normPosts = (arr) => (arr || []).map(p => ({
    ...p,
    title: p.title || p.video_title || "โพสต์",
    when: p.scheduled_at ? new Date(p.scheduled_at) : new Date(),
    platforms: p.platforms || {},
  }));

  const posts   = livePosts   !== null ? livePosts   : POSTS;
  const videos  = liveVideos  !== null ? liveVideos  : VIDEOS;
  const sources = liveSources !== null ? liveSources : SOURCE_LIST.filter(id => id !== "url").map(id => ({ ...SOURCES[id], type: id }));

  // reload videos+sources+posts (เรียกหลัง upload/sync/publish)
  const reloadLibrary = async () => {
    if (!window.API || !window.API.isLive()) return;
    try {
      const srcs = await window.API.listSources();
      setLiveSources(srcs || []);
      const byId = {}; (srcs || []).forEach(s => { byId[s.id] = s.type; });
      const vids = await window.API.listVideos();
      setLiveVideos((vids || []).map(v => ({
        id: v.id, title: v.title, dur: v.duration || 0, size: v.size_mb || 0,
        cover: v.cover || "linear-gradient(135deg,#6C4DFF,#2D7BFF)",
        source: byId[v.source_id] || "gdrive", source_id: v.source_id, file_path: v.file_path,
      })));
      try { setLivePosts(normPosts(await window.API.listPosts())); } catch (_) {}
    } catch (e) { console.warn("[VideoUp] reload library:", e.message); }
  };

  // load user — ดึง profile จริงจาก Supabase ใน live mode, fallback mock ใน demo
  const mockUser = (() => { try { return JSON.parse(localStorage.getItem("videoup_user")); } catch { return null; } })() || { name: "ViralShop TH", email: "viralshop@gmail.com", avatar: "V" };
  const [user, setUser] = useState(mockUser);

  useEffect(() => {
    if (!window.API || !window.API.isLive()) return;
    (async () => {
      // โหลด profile
      try {
        const authUser = await window.API.auth.current();
        if (!authUser) return;
        let profile = null;
        try { profile = await window.API.getProfile(); } catch (e) { /* profile row อาจยังไม่ถูกสร้าง */ }
        const meta = authUser.user_metadata || {};
        const u = {
          name:     profile?.name || meta.full_name || meta.name || authUser.email.split("@")[0],
          email:    authUser.email,
          avatar:   profile?.avatar || meta.avatar_url || meta.picture || null,
          plan:     profile?.plan || meta.plan || "free",
          provider: authUser.app_metadata?.provider || "email",
        };
        setUser(u);
        if (u.plan) setPlan(u.plan);
        localStorage.setItem("videoup_user", JSON.stringify(u));
      } catch (e) { console.warn("[VideoUp] โหลดโปรไฟล์ไม่สำเร็จ:", e.message); }

      // โหลด posts จริงจาก Supabase
      try {
        const data = await window.API.listPosts();
        setLivePosts(normPosts(data));
      } catch (e) { console.warn("[VideoUp] โหลด posts ไม่สำเร็จ:", e.message); setLivePosts([]); }

      // โหลด platform connections
      try { setLiveConnections(await window.API.listConnections() || []); }
      catch (e) { setLiveConnections([]); }

      // โหลด sources + videos จริงจาก Supabase
      try {
        const srcs = await window.API.listSources();
        setLiveSources(srcs || []);
        const byId = {}; (srcs || []).forEach(s => { byId[s.id] = s.type; });
        const vids = await window.API.listVideos(); // ดึงทั้งหมดของ user
        const norm = (vids || []).map(v => ({
          id: v.id, title: v.title, dur: v.duration || 0, size: v.size_mb || 0,
          cover: v.cover || "linear-gradient(135deg,#6C4DFF,#2D7BFF)",
          source: byId[v.source_id] || "gdrive", source_id: v.source_id, file_path: v.file_path,
        }));
        setLiveVideos(norm);
      } catch (e) { console.warn("[VideoUp] โหลด library ไม่สำเร็จ:", e.message); setLiveSources([]); setLiveVideos([]); }
    })();
  }, []);

  const logout = async () => {
    try { if (window.API) await window.API.auth.signOut(); } catch (e) {}
    localStorage.removeItem("videoup_user");
    window.location.href = "auth.html";
  };

  const avatarUrl = (user.avatar && /^https?:\/\//.test(user.avatar)) ? user.avatar : null;
  const userInitial = (!avatarUrl && user.avatar && user.avatar.length > 1) ? user.avatar : (user.name || user.email || "U").charAt(0).toUpperCase();
  const UserAvatar = ({ size = 36 }) => (
    avatarUrl
      ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer"
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none", cursor: "pointer", userSelect: "none" }} />
      : <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,var(--brand),var(--brand-2))", color: "#fff", fontWeight: 800, fontSize: size * 0.4, display: "grid", placeItems: "center", flex: "none", cursor: "pointer", userSelect: "none" }}>
          {userInitial}
        </div>
  );

  // apply theme + accent + radius
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    const a = ACCENTS[t.accent];
    if (a) { root.style.setProperty("--brand", a.brand); root.style.setProperty("--brand-2", a.brand2);
             root.style.setProperty("--brand-soft", `color-mix(in oklab, ${a.brand} 16%, white)`); }
    else { root.style.removeProperty("--brand"); root.style.removeProperty("--brand-2"); root.style.removeProperty("--brand-soft"); }
    root.style.setProperty("--radius", t.radius + "px");
    root.style.setProperty("--radius-sm", Math.max(8, t.radius - 6) + "px");
  }, [t.theme, t.accent, t.radius]);

  const pushToast = (toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, ...toast }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4200);
  };

  // แจ้งผล OAuth หลัง redirect กลับ (?source=... หรือ ?platform=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("source");
    const pl = p.get("platform");
    if (!s && !pl) return;
    const okTitle = s ? "เชื่อมต่อ source สำเร็จ! ✓" : "เชื่อมต่อแพลตฟอร์มสำเร็จ! ✓";
    const map = {
      connected:    { kind: "publishing", title: okTitle, desc: s ? "พร้อมเลือกคลิปมาโพสต์ได้แล้ว" : "พร้อมโพสต์ขึ้นแพลตฟอร์มได้แล้ว" },
      expired:      { kind: "scheduled",  title: "ลิงก์หมดอายุ", desc: "กรุณาลองเชื่อมต่อใหม่อีกครั้ง" },
      token_failed: { kind: "scheduled",  title: "แลก token ไม่สำเร็จ", desc: "ตรวจสอบ client ID/secret ใน Supabase" },
      error:        { kind: "scheduled",  title: "เชื่อมต่อไม่สำเร็จ", desc: "เกิดข้อผิดพลาดระหว่าง OAuth" },
    };
    pushToast(map[s || pl] || map.error);
    if ((s || pl) === "connected") setRoute("settings");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const go = (r) => { setRoute(r); setMenuOpen(false); window.scrollTo({ top: 0 }); };
  const openCreate = (date) => { setCreateSeed({ date: date instanceof Date ? date : null, vid: null }); go("create"); };
  const openPost = (p) => setDetail(p);

  const handlePublish = async (payload) => {
    const cleanupTxt = payload.cleanup
      ? ` · ลบไฟล์${payload.cleanupDelay === "immediate" ? "ทันที" : payload.cleanupDelay === "24h" ? "หลัง 24 ชม." : "หลัง 7 วัน"}`
      : "";

    // Demo mode — แค่ toast
    if (!window.API || !window.API.isLive()) {
      pushToast({
        kind: payload.mode === "now" ? "publishing" : "scheduled",
        title: payload.mode === "now" ? "ส่งเข้าคิวแล้ว! 🚀" : "ตั้งเวลาเรียบร้อย ✓",
        desc: `${payload.title} · ${payload.platforms.length} แพลตฟอร์ม · ${payload.when}${cleanupTxt}`,
      });
      go(payload.mode === "now" ? "dashboard" : "calendar");
      return;
    }

    // Live mode — บันทึกลง DB จริง
    try {
      const post = await window.API.createPost(payload);
      if (payload.mode === "now") {
        pushToast({ kind: "publishing", title: "กำลังอัปโหลดขึ้นแพลตฟอร์ม... 🚀", desc: `${payload.title} · ${payload.platforms.length} แพลตฟอร์ม` });
        go("dashboard");
        // เรียก Edge Function โพสต์จริงทันที
        const r = await window.API.publishPost(post.id);
        const ok = r.status === "published";
        pushToast({
          kind: ok ? "publishing" : "scheduled",
          title: ok ? "โพสต์สำเร็จ ✓" : r.status === "partial" ? "โพสต์บางส่วนสำเร็จ" : "โพสต์ไม่สำเร็จ",
          desc: ok ? `${payload.title} ขึ้นแพลตฟอร์มแล้ว` : "ดูรายละเอียดใน Dashboard",
        });
        await reloadLibrary();
      } else {
        pushToast({ kind: "scheduled", title: "ตั้งเวลาเรียบร้อย ✓", desc: `${payload.title} · ${payload.when}${cleanupTxt}` });
        go("calendar");
      }
    } catch (e) {
      pushToast({ kind: "scheduled", title: "เกิดข้อผิดพลาด", desc: e.message });
    }
  };

  const upcomingCount = posts.filter(p => ["scheduled", "publishing"].includes(postStatus(p))).length;

  const requestPlan = (planId) => { if (planId !== plan) setUpgradeTo(planId); };
  const confirmPlan = () => {
    const order = { free: 0, pro: 1, business: 2 };
    const isUp = order[upgradeTo] > order[plan];
    const p = PLAN(upgradeTo);
    setPlan(upgradeTo);
    pushToast({ kind: "publishing", title: isUp ? `อัปเกรดเป็น ${p.name} แล้ว! \ud83c\udf89` : `เปลี่ยนเป็น ${p.name} แล้ว`,
      desc: p.price === 0 ? "แพ็กเกจฟรี" : `\u0e3f${p.price.toLocaleString()} / \u0e40\u0e14\u0e37\u0e2d\u0e19` });
    setUpgradeTo(null);
  };

  let screen;
  if (route === "dashboard") screen = <Dashboard go={go} openCreate={() => openCreate()} openPost={openPost} posts={posts} connectedPlatforms={connectedPlatforms} primarySource={(liveSources || []).find(s => s.total_gb > 0) || (liveSources || [])[0]} />;
  else if (route === "calendar") screen = <Calendar openCreate={openCreate} openPost={openPost} posts={posts} />;
  else if (route === "billing")  screen = <Billing currentPlan={plan} onChangePlan={requestPlan} onToast={pushToast} />;
  else if (route === "settings") screen = <Settings onToast={pushToast} user={user} />;
  else screen = <CreatePost initialVid={createSeed.vid} initialDate={createSeed.date}
                   videos={videos} sources={sources} connectedPlatforms={connectedPlatforms}
                   onToast={pushToast} onReload={reloadLibrary}
                   onPublish={handlePublish} onCancel={() => go("dashboard")} />;

  const cur = [...NAV, ...BIZ_NAV].find(n => n.id === route) || NAV[0];

  const SidebarInner = () => (
    <>
      <div className="brand">
        <div className="brand-mark"><Icon name="rocket" size={21} /></div>
        <div>
          <div className="brand-name">VideoUp</div>
          <div className="brand-sub">Multi-platform uploader</div>
        </div>
      </div>
      <div className="nav-label">เมนู</div>
      {NAV.map(n => (
        <button key={n.id} className={`nav-item ${route === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
          <Icon name={n.icon} size={19} />
          <span>{n.label}</span>
          {n.id === "calendar" && upcomingCount > 0 && <span className="nav-badge">{upcomingCount}</span>}
        </button>
      ))}
      <div className="nav-label">ธุรกิจ / แพ็กเกจ</div>
      {BIZ_NAV.map(n => (
        <button key={n.id} className={`nav-item ${route === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
          <Icon name={n.icon} size={19} />
          <span>{n.label}</span>
        </button>
      ))}
      <div className="nav-label">บัญชี</div>
      <button className="nav-item" onClick={() => go("settings")}><Icon name="settings" size={19} /><span>ตั้งค่า</span></button>

      <div className="sidebar-foot">
        <button onClick={() => go("billing")} style={{ width: "100%", textAlign: "left", border: "1px solid var(--border)", background: "var(--brand-soft)", borderRadius: 13, padding: "11px 13px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,var(--brand),var(--brand-2))", color: "#fff", display: "grid", placeItems: "center", flex: "none" }}><Icon name="star" size={15} fill={true} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)" }}>แพ็กเกจ {PLAN(plan).name}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>{posts.length}/{PLAN(plan).limits.clips} โพสต์</div>
          </div>
          <Icon name="chevR" size={15} style={{ color: "var(--brand)" }} />
        </button>
        {(() => {
          // source หลัก (ตัวแรกที่เชื่อมต่อ) — แสดง storage จริง
          const ps = (sources || []).find(s => (s.used_gb ?? s.used ?? 0) > 0 || s.total_gb > 0) || (sources || [])[0];
          const usedGB = ps ? (ps.used_gb ?? ps.used ?? 0) : 0;
          const totalGB = ps ? (ps.total_gb ?? ps.total ?? 0) : 0;
          const folder = ps ? (ps.path || "—") : "—";
          const label = ps ? (SOURCES[ps.type]?.short || "Storage") : "Storage";
          return (
            <div className="device-pill">
              <div className="row"><Icon name={ps ? (SOURCES[ps.type]?.icon || "drive") : "drive"} size={15} style={{ color: "var(--warn)" }} /><span className="lbl">{label}</span>
                <span className="val">{totalGB > 0 ? `${usedGB}/${totalGB}GB` : "—"}</span></div>
              <div className="row"><Icon name="film" size={15} style={{ color: "var(--brand)" }} /><span className="lbl">คลัง</span>
                <span className="val">{videos.length} คลิป</span></div>
            </div>
          );
        })()}
      </div>
    </>
  );

  return (
    <div className="app">
      {/* sidebar */}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}><SidebarInner /></aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        {/* desktop topbar */}
        <div className="topbar">
          <div>
            <h1>{cur.label}</h1>
            <div className="sub">{PAGE_SUB[route] || ""}</div>
          </div>
          <div className="topbar-spacer" />
          {(route === "dashboard" || route === "calendar") && <Btn variant="primary" icon="plus" onClick={() => openCreate()}>สร้างโพสต์ใหม่</Btn>}
          <Btn variant="ghost" icon="bell" style={{ padding: 10 }} onClick={() => pushToast({ kind: "scheduled", title: "ไม่มีแจ้งเตือนใหม่", desc: "ทุกอย่างกำลังทำงานปกติ" })} />
          <div style={{ position: "relative" }}>
            <div onClick={() => setUserMenuOpen(o => !o)}><UserAvatar /></div>
            {userMenuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", minWidth: 220, zIndex: 200, overflow: "hidden", animation: "toastIn .2s cubic-bezier(.2,.9,.3,1.2)" }}
                onMouseLeave={() => setUserMenuOpen(false)}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 11 }}>
                  <UserAvatar size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                  </div>
                </div>
                <div style={{ padding: "6px" }}>
                  <button style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", background: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit" }}
                    onClick={() => { go("settings"); setUserMenuOpen(false); }}>
                    <Icon name="settings" size={16} />ตั้งค่าบัญชี
                  </button>
                  <button style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", background: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit" }}
                    onClick={() => { go("billing"); setUserMenuOpen(false); }}>
                    <Icon name="star" size={16} />แพ็กเกจ: {PLAN(plan).name}
                  </button>
                  <div style={{ height: 1, background: "var(--border)", margin: "5px 6px" }} />
                  <button style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", background: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "var(--err)", cursor: "pointer", fontFamily: "inherit" }}
                    onClick={logout}>
                    <Icon name="x" size={16} />ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* mobile top */}
        <div className="mobile-top">
          <button className="menu-btn" onClick={() => setMenuOpen(true)}><Icon name="menu" size={20} /></button>
          <div className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }}><Icon name="rocket" size={16} /></div>
          <div className="brand-name">{cur.label}</div>
        </div>

        <div className="content">{screen}</div>
      </div>

      {/* mobile bottom nav */}
      <nav className="bottom-nav">
        <button className={`bn-item ${route === "dashboard" ? "active" : ""}`} onClick={() => go("dashboard")}>
          <Icon name="grid" size={21} />ภาพรวม
        </button>
        <button className={`bn-item ${route === "calendar" ? "active" : ""}`} onClick={() => go("calendar")}>
          <Icon name="calendar" size={21} />ปฏิทิน
          {upcomingCount > 0 && <span className="bn-badge">{upcomingCount}</span>}
        </button>
        <button className="bn-item" onClick={() => openCreate()} style={{ flex: "none" }}>
          <span className="bn-fab"><Icon name="plus" size={24} /></span>
        </button>
        <button className="bn-item" onClick={() => pushToast({ kind: "scheduled", title: "คลังวิดีโอ", desc: `${VIDEOS.length} คลิปใน Google Drive` })}>
          <Icon name="film" size={21} />คลัง
        </button>
        <button className="bn-item" onClick={() => go("settings")}>
          <Icon name="settings" size={21} />ตั้งค่า
        </button>
      </nav>

      {/* post detail modal */}
      {detail && <PostDetail post={detail} onClose={() => setDetail(null)}
        onEdit={() => { setDetail(null); setCreateSeed({ vid: detail.vid }); go("create"); }}
        onToast={pushToast} />}

      {/* upgrade / change plan modal */}
      {upgradeTo && <PlanChangeModal fromPlan={plan} toPlan={upgradeTo} onConfirm={confirmPlan} onClose={() => setUpgradeTo(null)} />}

      {/* toasts */}
      <div className="toasts">
        {toasts.map(ti => {
          const conf = ti.kind === "publishing" ? { c: "var(--brand)", bg: "var(--brand-soft)", ic: "rocket" }
            : ti.kind === "scheduled" ? { c: "var(--info)", bg: "var(--info-bg)", ic: "check" }
            : { c: "var(--ok)", bg: "var(--ok-bg)", ic: "check" };
          return (
            <div key={ti.id} className="toast">
              <div className="ti" style={{ background: conf.bg, color: conf.c }}><Icon name={conf.ic} size={17} /></div>
              <div style={{ minWidth: 0 }}><div className="tt">{ti.title}</div><div className="td">{ti.desc}</div></div>
            </div>
          );
        })}
      </div>

      {/* tweaks */}
      <TweaksPanel>
        <TweakSection label="ธีมสี · Theme" />
        <TweakRadio label="โทนหลัก" value={t.theme}
          options={["sunset", "electric", "candy"]}
          onChange={v => setTweak("theme", v)} />
        <TweakColor label="สีแบรนด์" value={t.accent === "default" ? "#FF6A3D" : ACCENTS[t.accent].brand}
          options={["#FF6A3D", "#6C4DFF", "#12B281", "#FF2E97"]}
          onChange={hex => {
            const key = Object.keys(ACCENTS).find(k => ACCENTS[k] && ACCENTS[k].brand === hex) || "default";
            setTweak("accent", key);
          }} />
        <TweakSection label="รูปทรง · Shape" />
        <TweakSlider label="ความมนของมุม" value={t.radius} min={8} max={26} unit="px"
          onChange={v => setTweak("radius", v)} />
      </TweaksPanel>
    </div>
  );
}

/* ---------- post detail modal ---------- */
function PostDetail({ post, onClose, onEdit, onToast }) {
  // โพสต์จริงจาก DB ใช้ video_id/video_cover ฯลฯ; mock ใช้ vid
  const v = VID(post.vid) || {
    dur: post.video_duration || 0,
    cover: post.video_cover || COVERS[0],
    title: post.video_title || post.title,
    drive: "",
  };
  const ps = postStatus(post);
  return (
    <div className="scrim2" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="thumb" style={{ width: 44, height: 56, borderRadius: 10, overflow: "hidden", flex: "none" }}>
            <VideoThumb vid={post.vid || v} showPlay={false} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{post.title}</div>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Icon name="clock" size={13} />{relDay(post.when)} · {fmtTime(post.when)} น.
            </div>
          </div>
          <button className="btn icon ghost" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <StatusBadge status={ps} />
            <span className="muted mono" style={{ fontSize: 11.5 }}>{v.drive || v.title || ""}</span>
          </div>
          <div className="nav-label" style={{ padding: "0 0 8px" }}>สถานะรายแพลตฟอร์ม</div>
          <div className="grid" style={{ gap: 8 }}>
            {Object.entries(post.platforms).map(([k, st]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 11 }}>
                <PlatformBadge id={k} size="sm" status={st} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{PLATFORMS[k].name}</span>
                <span style={{ marginLeft: "auto" }}>
                  {st === "failed"
                    ? <button className="btn sm subtle" style={{ color: "var(--err)" }} onClick={() => onToast({ kind: "publishing", title: "กำลังลองใหม่", desc: `${PLATFORMS[k].name} · ${post.title}` })}><Icon name="refresh" size={14} />ลองใหม่</button>
                    : <StatusBadge status={st} />}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <Btn variant="ghost" icon="trash" onClick={() => { onClose(); onToast({ kind: "scheduled", title: "ลบโพสต์แล้ว", desc: post.title }); }}>ลบ</Btn>
          <Btn variant="primary" icon="edit" onClick={onEdit}>แก้ไขโพสต์</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------- plan change / upgrade modal ---------- */
function PlanChangeModal({ fromPlan, toPlan, onConfirm, onClose }) {
  const order = { free: 0, pro: 1, business: 2 };
  const isUp = order[toPlan] > order[fromPlan];
  const from = PLAN(fromPlan), to = PLAN(toPlan);
  const diff = to.price - from.price;
  return (
    <div className="scrim2" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="ico" style={{ width: 40, height: 40, borderRadius: 12, background: isUp ? "var(--brand-soft)" : "var(--surface-2)", color: isUp ? "var(--brand)" : "var(--text-dim)", display: "grid", placeItems: "center" }}>
            <Icon name={isUp ? "rocket" : "refresh"} size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{isUp ? "ยืนยันการอัปเกรด" : "เปลี่ยนแพ็กเกจ"}</div>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{from.name} → {to.name}</div>
          </div>
          <button className="btn icon ghost" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--surface-2)", borderRadius: 14, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>แพ็กเกจใหม่</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: to.accent }}>{to.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{to.price === 0 ? "ฟรี" : `฿${to.price.toLocaleString()}`}</div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{to.price === 0 ? "" : "/ เดือน"}</div>
            </div>
          </div>
          <ul className="price-feats" style={{ margin: 0 }}>
            {to.features.slice(0, 4).map((f, i) => (
              <li key={i} className="yes"><span className="fi"><Icon name="check" size={12} /></span>{f}</li>
            ))}
          </ul>
          {to.price > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12.5, color: "var(--text-dim)", fontWeight: 600 }}>
              <Icon name="link" size={14} />
              {isUp && diff > 0 ? `เก็บเงินส่วนต่าง ฿${diff.toLocaleString()} วันนี้ จากนั้น ฿${to.price.toLocaleString()}/เดือน` : `เริ่มคิด ฿${to.price.toLocaleString()}/เดือน รอบบิลถัดไป`}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <Btn variant="ghost" onClick={onClose}>ยกเลิก</Btn>
          <Btn variant="primary" icon={isUp ? "rocket" : "check"} onClick={onConfirm}>
            {isUp ? "ยืนยันอัปเกรด" : "ยืนยันเปลี่ยน"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
