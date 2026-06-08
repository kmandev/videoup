/* ============================================================
   VideoUp — Settings screen
   ============================================================ */

const SETTINGS_TABS = [
  { id: "profile",       label: "โปรไฟล์",          icon: "eye" },
  { id: "platforms",     label: "แพลตฟอร์ม",         icon: "send" },
  { id: "sources",       label: "แหล่งวิดีโอ",        icon: "drive" },
  { id: "notifications", label: "การแจ้งเตือน",       icon: "bell" },
  { id: "defaults",      label: "ค่าเริ่มต้น",         icon: "settings" },
];

/* mock saved state */
const MOCK_NOTIF = { lineToken: "****XYZ1234", email: "viralshop@gmail.com", emailOn: true, lineOn: true, webhookOn: false, webhookUrl: "", notifyOnSuccess: true, notifyOnFail: true, notifyOnQueue: false };
const MOCK_DEFAULTS = { tz: "Asia/Bangkok", cleanupDefault: "off", hashtagsTiktok: "#รีวิวของดี #ของมันต้องมี #ติ๊กต๊อกพาช้อป", hashtagsYoutube: "#Shorts #รีวิว", hashtagsFacebook: "#Reels #รีวิว #ช้อปออนไลน์", hashtagsShopee: "#ShopeeหาดของถูกบนShopee", hashtagsLazada: "#LazadaTH #ดีลเด็ด" };

function Settings({ onToast, user }) {
  const [tab, setTab] = useState("profile");
  const [saved, setSaved] = useState({});

  const save = (section) => {
    setSaved(s => ({ ...s, [section]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [section]: false })), 2000);
    onToast({ kind: "scheduled", title: "บันทึกแล้ว ✓", desc: "การตั้งค่าถูกอัปเดต" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 22, alignItems: "start", maxWidth: 1060 }}>
      {/* left tab list */}
      <div className="card card-pad" style={{ padding: "10px 8px", position: "sticky", top: 92 }}>
        {SETTINGS_TABS.map(t => (
          <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)} style={{ width: "100%" }}>
            <Icon name={t.icon} size={17} />{t.label}
          </button>
        ))}
      </div>

      {/* right content */}
      <div>
        {tab === "profile"       && <ProfileSection onSave={() => save("profile")} saved={saved.profile} user={user} onToast={onToast} />}
        {tab === "platforms"     && <PlatformsSection onSave={() => save("platforms")} saved={saved.platforms} onToast={onToast} />}
        {tab === "sources"       && <SourcesSection onSave={() => save("sources")} saved={saved.sources} onToast={onToast} />}
        {tab === "notifications" && <NotifSection onSave={() => save("notifications")} saved={saved.notifications} />}
        {tab === "defaults"      && <DefaultsSection onSave={() => save("defaults")} saved={saved.defaults} />}
      </div>
    </div>
  );
}

/* ---- shared helpers ---- */
function SettingCard({ title, desc, children, onSave, saved }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
        {desc && <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{desc}</div>}
      </div>
      {children}
      {onSave && (
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant={saved ? "subtle" : "primary"} icon={saved ? "check" : "upload"} onClick={onSave}>
            {saved ? "บันทึกแล้ว" : "บันทึก"}
          </Btn>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="field">
      <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</span>
        {hint && <span className="muted" style={{ fontWeight: 600, fontSize: 11.5 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle2({ value, onChange, label, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
        {desc && <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{desc}</div>}
      </div>
      <button className="toggle" data-on={String(value)} onClick={() => onChange(!value)}>
        <span className="toggle-knob" style={{ transform: value ? "translateX(18px)" : "none" }} />
      </button>
    </div>
  );
}

/* ============================================================
   PROFILE
   ============================================================ */
function ProfileSection({ onSave, saved, user, onToast }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  // sync เมื่อ user โหลดเสร็จ
  useEffect(() => {
    if (user) { setName(user.name || ""); setEmail(user.email || ""); }
  }, [user]);

  const avatarUrl = (user?.avatar && /^https?:\/\//.test(user.avatar)) ? user.avatar : null;
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const provider = user?.provider || "email";

  const saveProfile = async () => {
    // live mode: บันทึกชื่อลง Supabase profiles
    if (window.API && window.API.isLive()) {
      setBusy(true);
      try {
        await window.sb.from("profiles").update({ name }).eq("id", (await window.API.auth.current()).id);
        const cached = JSON.parse(localStorage.getItem("videoup_user") || "{}");
        localStorage.setItem("videoup_user", JSON.stringify({ ...cached, name }));
      } catch (e) { onToast && onToast({ kind: "scheduled", title: "บันทึกไม่สำเร็จ", desc: e.message }); }
      setBusy(false);
    }
    onSave();
  };

  return (
    <>
      <SettingCard title="ข้อมูลโปรไฟล์" desc="ชื่อและอีเมลที่ใช้ในระบบ" onSave={saveProfile} saved={saved}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 68, height: 68, borderRadius: 20, objectFit: "cover", flex: "none" }} />
            : <div style={{ width: 68, height: 68, borderRadius: 20, background: "linear-gradient(135deg,var(--brand),var(--brand-2))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 26, flex: "none" }}>{initial}</div>}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{user?.name || "—"}</span>
              {provider === "google" && <span className="badge mute" style={{ fontSize: 10.5 }}>เข้าผ่าน Google</span>}
            </div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{user?.email || ""}</div>
          </div>
        </div>
        <FieldRow label="ชื่อร้าน / แบรนด์">
          <input className="input" value={name} onChange={e => setName(e.target.value)} disabled={busy} />
        </FieldRow>
        <FieldRow label="อีเมล" hint={provider === "google" ? "อีเมลจาก Google เปลี่ยนไม่ได้" : "ใช้สำหรับแจ้งเตือนและบิล"}>
          <input className="input" type="email" value={email} readOnly disabled style={{ opacity: .7 }} />
        </FieldRow>
        <FieldRow label="เบอร์โทรศัพท์" hint="ไม่บังคับ">
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="081-234-5678" />
        </FieldRow>
      </SettingCard>

      <SettingCard title="รหัสผ่าน" desc="เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ">
        <FieldRow label="รหัสผ่านปัจจุบัน">
          <input className="input" type="password" placeholder="••••••••" />
        </FieldRow>
        <FieldRow label="รหัสผ่านใหม่">
          <input className="input" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" />
        </FieldRow>
        <FieldRow label="ยืนยันรหัสผ่านใหม่">
          <input className="input" type="password" placeholder="••••••••" />
        </FieldRow>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" icon="check" onClick={onSave}>เปลี่ยนรหัสผ่าน</Btn>
        </div>
      </SettingCard>
    </>
  );
}

/* ============================================================
   PLATFORMS
   ============================================================ */
const PLAT_CONNECTED = { tiktok: true, youtube: true, facebook: true, shopee: true, lazada: false };
const PLAT_HANDLES   = { tiktok: "@viralshop.th", youtube: "ViralShop TH", facebook: "ViralShop.TH", shopee: "viralshop.official", lazada: "" };
const PLAT_TOKEN_EXP = { tiktok: "ต่ออายุ 30 ก.ย. 2569", youtube: "ไม่มีหมดอายุ (OAuth)", facebook: "ต่ออายุ 5 ก.ค. 2569", shopee: "ต่ออายุ 15 ส.ค. 2569", lazada: "" };

// แพลตฟอร์มที่ต่อ API จริงแล้ว (เชื่อมผ่าน OAuth) — เจ้าอื่นยังเป็น demo
const LIVE_PLATFORMS = ["youtube"];

function PlatformsSection({ onSave, saved, onToast }) {
  const live = window.API && window.API.isLive();
  const [connected, setConnected] = useState(live ? {} : { ...PLAT_CONNECTED });
  const [rows, setRows] = useState({});       // platform → connection row (live)
  const [busy, setBusy] = useState(null);

  const load = async () => {
    if (!live) return;
    try {
      const conns = await window.API.listConnections();
      const c = {}, r = {};
      (conns || []).forEach(x => { c[x.platform] = !!x.connected; r[x.platform] = x; });
      setConnected(c); setRows(r);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const connect = async (id) => {
    if (live && LIVE_PLATFORMS.includes(id)) {
      setBusy(id);
      try {
        const authUrl = await window.API.startPlatformOAuth(id);
        window.location.href = authUrl;
      } catch (e) { setBusy(null); onToast({ kind: "scheduled", title: "เชื่อมต่อไม่สำเร็จ", desc: e.message }); }
      return;
    }
    // demo / แพลตฟอร์มที่ยังไม่ต่อ API จริง
    setConnected(c => ({ ...c, [id]: true }));
    onToast({ kind: "publishing", title: live ? "ยังไม่รองรับการเชื่อมจริง" : "เชื่อมต่อแล้ว! (demo)", desc: PLATFORMS[id].name });
  };

  const disconnect = async (id) => {
    if (live && rows[id]) { try { await window.API.disconnectPlatform(rows[id].id); } catch (e) {} }
    setConnected(c => ({ ...c, [id]: false }));
    setRows(r => { const n = { ...r }; delete n[id]; return n; });
    onToast({ kind: "scheduled", title: "ยกเลิกเชื่อมต่อ", desc: PLATFORMS[id].name });
  };

  return (
    <SettingCard title="เชื่อมต่อแพลตฟอร์ม" desc="จัดการบัญชีและ API token แต่ละแพลตฟอร์ม">
      <div className="grid" style={{ gap: 12 }}>
        {PLATFORM_LIST.map(id => {
          const p = PLATFORMS[id], on = connected[id];
          const liveReady = LIVE_PLATFORMS.includes(id);
          const handle = live ? (rows[id]?.handle || PLAT_HANDLES[id]) : PLAT_HANDLES[id];
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1.5px solid ${on ? "var(--ok-bg)" : "var(--border)"}`, borderRadius: 14, background: on ? "color-mix(in oklab,var(--ok) 4%,var(--surface))" : "var(--surface)", transition: ".15s" }}>
              <PlatformBadge id={id} size="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                  {p.name}
                  {liveReady && <span className="badge ok" style={{ fontSize: 10 }}>API จริง</span>}
                </div>
                {on
                  ? <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                      <span style={{ color: "var(--ok)" }}>{handle}</span>
                    </div>
                  : <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>ยังไม่ได้เชื่อมต่อ</div>}
              </div>
              {on
                ? <Btn size="sm" variant="ghost" icon="x" onClick={() => disconnect(id)}>ยกเลิก</Btn>
                : <Btn size="sm" variant="primary" icon="link" disabled={busy === id} onClick={() => connect(id)}>
                    {busy === id ? "กำลังเปิด..." : "เชื่อมต่อ"}
                  </Btn>}
            </div>
          );
        })}
      </div>
    </SettingCard>
  );
}

/* ============================================================
   SOURCES
   ============================================================ */
function SourcesSection({ onSave, saved, onToast }) {
  const live = window.API && window.API.isLive();
  // demo: ใช้ mock; live: โหลดจาก Supabase
  const [rows, setRows] = useState(live ? [] : [
    { id: "gdrive", type: "gdrive", account: SOURCES.gdrive.account, path: "/VideoUp/clips", connected: true },
    { id: "dropbox", type: "dropbox", account: SOURCES.dropbox.account, path: "/Videos/Shorts", connected: true },
    { id: "onedrive", type: "onedrive", account: SOURCES.onedrive.account, path: "/Videos/VideoUp", connected: true },
  ]);
  const [paths, setPaths] = useState({});
  const [busy, setBusy] = useState(null);
  const [syncing, setSyncing] = useState(null);

  const load = async () => {
    if (!live) return;
    try {
      const data = await window.API.listSources();
      setRows(data);
      const pp = {}; data.forEach(r => { pp[r.id] = r.path; });
      setPaths(pp);
    } catch (e) { onToast({ kind: "scheduled", title: "โหลด source ไม่สำเร็จ", desc: e.message }); }
  };
  useEffect(() => { load(); }, []);

  const byType = (t) => rows.find(r => r.type === t);

  const connect = async (id) => {
    if (!live) { // demo
      setRows(r => [...r, { id, type: id, account: SOURCES[id].account, path: "", connected: true }]);
      onToast({ kind: "publishing", title: "เชื่อมต่อแล้ว! (demo)", desc: SOURCES[id].name });
      return;
    }
    setBusy(id);
    try {
      const authUrl = await window.API.startSourceOAuth(id);
      window.location.href = authUrl; // redirect ไปหน้า consent ของผู้ให้บริการ
    } catch (e) {
      setBusy(null);
      onToast({ kind: "scheduled", title: "เชื่อมต่อไม่สำเร็จ", desc: e.message });
    }
  };

  const disconnect = async (row) => {
    if (live) { try { await window.API.disconnectSource(row.id); } catch (e) {} }
    setRows(r => r.filter(x => x.id !== row.id));
    onToast({ kind: "scheduled", title: "ยกเลิก source", desc: SOURCES[row.type]?.name || row.type });
  };

  const savePath = async (row) => {
    const path = paths[row.id] ?? row.path;
    if (live) { try { await window.API.updateSourcePath(row.id, path); } catch (e) {} }
    onToast({ kind: "scheduled", title: "บันทึก path แล้ว", desc: `${SOURCES[row.type]?.name}: ${path}` });
  };

  // สแกนไฟล์วิดีโอจาก source → บันทึกลง DB
  const sync = async (row) => {
    if (!live) {
      onToast({ kind: "publishing", title: "Sync แล้ว! (demo)", desc: SOURCES[row.type]?.name });
      return;
    }
    // บันทึก path ล่าสุดก่อนสแกน
    const path = paths[row.id] ?? row.path;
    if (path && path !== row.path) { try { await window.API.updateSourcePath(row.id, path); } catch (e) {} }
    setSyncing(row.id);
    try {
      const r = await window.API.scanSource(row.id);
      onToast({ kind: "publishing", title: "Sync วิดีโอสำเร็จ ✓",
        desc: `พบ ${r.total} คลิป · เพิ่มใหม่ ${r.added} คลิป` });
    } catch (e) {
      onToast({ kind: "scheduled", title: "Sync ไม่สำเร็จ", desc: e.message });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <SettingCard title="แหล่งวิดีโอ (Sources)" desc="เชื่อมต่อ Cloud Storage ที่ต้องการ">
      <div className="grid" style={{ gap: 12 }}>
        {SOURCE_LIST.filter(id => id !== "url").map(id => {
          const s = SOURCES[id], row = byType(id), on = !!row;
          return (
            <div key={id} style={{ border: `1.5px solid ${on ? `color-mix(in oklab,${s.color} 30%,var(--border))` : "var(--border)"}`, borderRadius: 14, overflow: "hidden", transition: ".15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", background: on ? `color-mix(in oklab,${s.color} 5%,var(--surface))` : "var(--surface)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in oklab,${s.color} 16%,var(--surface))`, color: s.color, display: "grid", placeItems: "center", flex: "none" }}>
                  <Icon name={s.icon} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{on ? (row.account || s.account) : "ยังไม่ได้เชื่อมต่อ"}</div>
                </div>
                {on
                  ? <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge ok"><span className="dot" />เชื่อมแล้ว</span>
                      <Btn size="sm" variant="ghost" icon="x" onClick={() => disconnect(row)}>ยกเลิก</Btn>
                    </div>
                  : <Btn size="sm" variant="primary" icon="link" disabled={busy === id} onClick={() => connect(id)}>
                      {busy === id ? "กำลังเปิด..." : "เชื่อมต่อ"}
                    </Btn>}
              </div>
              {on && (
                <div style={{ borderTop: `1px solid color-mix(in oklab,${s.color} 15%,var(--border))`, padding: "10px 15px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="film" size={14} style={{ color: "var(--text-mute)", flex: "none" }} />
                  <input className="input" value={paths[row.id] ?? row.path ?? ""} style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", padding: "7px 10px", flex: 1 }}
                    onChange={e => setPaths(p => ({ ...p, [row.id]: e.target.value }))}
                    placeholder="/path/to/videos" />
                  <Btn size="sm" variant="ghost" onClick={() => savePath(row)}>บันทึก</Btn>
                  <Btn size="sm" variant="primary" icon="upload" disabled={syncing === row.id} onClick={() => sync(row)}>
                    {syncing === row.id ? "กำลัง Sync..." : "Sync วิดีโอ"}
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
        {/* URL source */}
        <div style={{ border: "1.5px dashed var(--border-2)", borderRadius: 14, padding: "14px 15px", display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", color: "var(--text-mute)", display: "grid", placeItems: "center", flex: "none" }}>
            <Icon name="link" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>URL / Direct Link</div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>ระบุ URL ตรงเมื่อสร้างโพสต์ ไม่ต้องเชื่อมล่วงหน้า</div>
          </div>
          <span className="badge mute">ใช้ได้ทันที</span>
        </div>
      </div>
    </SettingCard>
  );
}
/* ============================================================
   NOTIFICATIONS
   ============================================================ */
function NotifSection({ onSave, saved }) {
  const [cfg, setCfg] = useState({ ...MOCK_NOTIF });

  return (
    <>
      <SettingCard title="การแจ้งเตือน" desc="รับแจ้งเตือนเมื่อโพสต์สำเร็จ ล้มเหลว หรือคิวเต็ม" onSave={onSave} saved={saved}>
        <Toggle2 value={cfg.notifyOnSuccess} onChange={v => setCfg(c => ({ ...c, notifyOnSuccess: v }))} label="โพสต์สำเร็จ" desc="แจ้งทุกครั้งที่อัปโหลดขึ้นแพลตฟอร์มสำเร็จ" />
        <Toggle2 value={cfg.notifyOnFail}    onChange={v => setCfg(c => ({ ...c, notifyOnFail: v }))}    label="อัปโหลดล้มเหลว" desc="แจ้งทันทีเมื่อ retry หมดครั้งหรือ token หมดอายุ" />
        <Toggle2 value={cfg.notifyOnQueue}   onChange={v => setCfg(c => ({ ...c, notifyOnQueue: v }))}   label="คิวใกล้เต็ม" desc="แจ้งเมื่อคิวเหลือน้อยกว่า 2 ช่อง" />
      </SettingCard>

      <SettingCard title="Line Notify" desc="ส่งข้อความแจ้งเตือนเข้า Line ของคุณ" onSave={onSave} saved={saved}>
        <Toggle2 value={cfg.lineOn} onChange={v => setCfg(c => ({ ...c, lineOn: v }))} label="เปิดใช้ Line Notify" desc="ต้องมี Line Notify Token" />
        <FieldRow label="Line Notify Token" hint="ได้จาก notify-bot.line.me">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input mono" value={cfg.lineToken} onChange={e => setCfg(c => ({ ...c, lineToken: e.target.value }))} placeholder="xxxxxxxxxxxxxxxxxxxxxxx" style={{ flex: 1 }} />
            <Btn size="sm" variant="ghost" icon="send">ทดสอบ</Btn>
          </div>
        </FieldRow>
      </SettingCard>

      <SettingCard title="Email" desc="รับสรุปรายวันและแจ้งเตือนสำคัญทางอีเมล" onSave={onSave} saved={saved}>
        <Toggle2 value={cfg.emailOn} onChange={v => setCfg(c => ({ ...c, emailOn: v }))} label="เปิดใช้ Email" desc="ส่งไปที่อีเมลที่ตั้งค่าในโปรไฟล์" />
        <FieldRow label="อีเมลรับแจ้งเตือน">
          <input className="input" type="email" value={cfg.email} onChange={e => setCfg(c => ({ ...c, email: e.target.value }))} />
        </FieldRow>
      </SettingCard>

      <SettingCard title="Webhook" desc="ส่ง HTTP POST ไปยัง URL ที่กำหนด (Zapier, Make, custom API)" onSave={onSave} saved={saved}>
        <Toggle2 value={cfg.webhookOn} onChange={v => setCfg(c => ({ ...c, webhookOn: v }))} label="เปิดใช้ Webhook" desc="เหมาะสำหรับเชื่อมกับ Zapier, Make, หรือระบบ custom" />
        <FieldRow label="Webhook URL">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input mono" value={cfg.webhookUrl} onChange={e => setCfg(c => ({ ...c, webhookUrl: e.target.value }))} placeholder="https://hooks.zapier.com/..." style={{ flex: 1 }} disabled={!cfg.webhookOn} />
            <Btn size="sm" variant="ghost" icon="send" disabled={!cfg.webhookOn}>ทดสอบ</Btn>
          </div>
        </FieldRow>
      </SettingCard>
    </>
  );
}

/* ============================================================
   DEFAULTS
   ============================================================ */
function DefaultsSection({ onSave, saved }) {
  const [cfg, setCfg] = useState({ ...MOCK_DEFAULTS });

  return (
    <>
      <SettingCard title="ค่าทั่วไป" desc="Timezone และพฤติกรรมเริ่มต้น" onSave={onSave} saved={saved}>
        <FieldRow label="Timezone" hint="ใช้สำหรับแสดงเวลาและตั้งเวลาโพสต์">
          <select className="input" value={cfg.tz} onChange={e => setCfg(c => ({ ...c, tz: e.target.value }))}>
            <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
            <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
            <option value="UTC">UTC (GMT+0)</option>
          </select>
        </FieldRow>
        <FieldRow label="ค่าเริ่มต้นลบไฟล์หลังโพสต์" hint="สามารถปรับในแต่ละโพสต์ได้">
          <select className="input" value={cfg.cleanupDefault} onChange={e => setCfg(c => ({ ...c, cleanupDefault: e.target.value }))}>
            <option value="off">ไม่ลบ (เก็บไว้)</option>
            <option value="immediate">ลบทันทีหลังโพสต์สำเร็จ</option>
            <option value="24h">ลบหลัง 24 ชั่วโมง</option>
            <option value="7d">ลบหลัง 7 วัน</option>
          </select>
        </FieldRow>
      </SettingCard>

      <SettingCard title="แฮชแท็กเริ่มต้น" desc="แฮชแท็กที่จะเติมอัตโนมัติเมื่อสร้างโพสต์ใหม่ (แก้ไขในโพสต์ได้เสมอ)" onSave={onSave} saved={saved}>
        {PLATFORM_LIST.map(id => {
          const p = PLATFORMS[id];
          const key = `hashtags${id.charAt(0).toUpperCase() + id.slice(1)}`;
          return (
            <FieldRow key={id} label={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><PlatformBadge id={id} size="sm" />{p.name}</span>}>
              <input className="input" value={cfg[key] || ""} placeholder={`#แฮชแท็กสำหรับ ${p.short}`}
                onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))} />
            </FieldRow>
          );
        })}
      </SettingCard>
    </>
  );
}

Object.assign(window, { Settings });
