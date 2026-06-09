/* ============================================================
   VideoUp — Dashboard screen
   ============================================================ */
function Dashboard({ go, openCreate, openPost, posts: propPosts, connectedPlatforms, primarySource }) {
  const allPosts = propPosts || POSTS;
  const platList = (connectedPlatforms && connectedPlatforms.length >= 0) ? connectedPlatforms : PLATFORM_LIST;

  // คำนวณสถิติต่อแพลตฟอร์มจากโพสต์จริง
  const stats = {};
  PLATFORM_LIST.forEach(id => stats[id] = { published: 0, scheduled: 0, failed: 0 });
  allPosts.forEach(p => Object.entries(p.platforms || {}).forEach(([k, st]) => {
    if (!stats[k]) stats[k] = { published: 0, scheduled: 0, failed: 0 };
    if (st === "published") stats[k].published++;
    else if (st === "failed") stats[k].failed++;
    else stats[k].scheduled++;  // scheduled/publishing/draft
  }));

  // storage card — ใช้ source จริง (ตัวแรกที่เชื่อมต่อ) ถ้ามี
  const ds = primarySource ? {
    name:    SOURCES[primarySource.type]?.name || primarySource.name || "Storage",
    icon:    SOURCES[primarySource.type]?.icon || "drive",
    folder:  primarySource.path || "—",
    account: primarySource.account || "",
    usedGB:  primarySource.used_gb ?? 0,
    totalGB: primarySource.total_gb ?? 0,
  } : { name: DRIVE && !window.API?.isLive() ? "Google Drive" : "ยังไม่เชื่อมต่อ", icon: "drive", folder: "—", account: "", usedGB: 0, totalGB: 0 };
  const now = TODAY;
  const in24 = new Date(now); in24.setHours(now.getHours() + 24);

  const scheduledPosts = allPosts.filter(p => ["scheduled", "publishing"].includes(postStatus(p)));
  const upcoming = scheduledPosts.filter(p => p.when >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => a.when - b.when);
  const next24 = scheduledPosts.filter(p => p.when >= now && p.when <= in24);

  let publishedToday = 0, failedTotal = 0;
  allPosts.forEach(p => Object.entries(p.platforms).forEach(([k, st]) => {
    if (st === "published" && sameDay(p.when, now)) publishedToday++;
    if (st === "failed") failedTotal++;
  }));

  const STAT_CARDS = [
    { ico: "calendar", color: "var(--info)",  bg: "var(--info-bg)",  num: scheduledPosts.length, lbl: "คลิปตั้งเวลาไว้", sub: "Scheduled" },
    { ico: "rocket",   color: "var(--brand)", bg: "var(--brand-soft)", num: next24.length, lbl: "กำลังจะโพสต์ 24 ชม.", sub: "Next 24h" },
    { ico: "check",    color: "var(--ok)",    bg: "var(--ok-bg)",    num: publishedToday, lbl: "โพสต์สำเร็จวันนี้", sub: "Published today" },
    { ico: "alert",    color: "var(--err)",   bg: "var(--err-bg)",   num: failedTotal, lbl: "ล้มเหลว ต้องแก้", sub: "Failed" },
  ];

  // activity feed (recent published / failed / publishing)
  const activity = [];
  allPosts.forEach(p => Object.entries(p.platforms).forEach(([k, st]) => {
    if (["published", "failed", "publishing"].includes(st))
      activity.push({ post: p, plat: k, st, when: p.when });
  }));
  activity.sort((a, b) => b.when - a.when);

  return (
    <div className="grid" style={{ gap: 22 }}>
      {/* stat cards */}
      <div className="grid stat-grid">
        {STAT_CARDS.map((s, i) => (
          <button key={i} className="stat" style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
            onClick={() => go(s.ico === "alert" ? "calendar" : "calendar")}>
            <div className="ico" style={{ background: s.bg, color: s.color }}><Icon name={s.ico} size={19} /></div>
            <div className="num">{s.num}</div>
            <div className="lbl">{s.lbl}</div>
          </button>
        ))}
      </div>

      {/* platform status row */}
      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 13 }}>
          <h2 className="section-title">สถานะแพลตฟอร์ม</h2>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, marginLeft: 9 }}>Platform status</span>
        </div>
        <div className="plat-row">
          {platList.length === 0 ? (
            <div className="muted" style={{ padding: "18px 4px", fontWeight: 600, fontSize: 13 }}>
              ยังไม่ได้เชื่อมต่อแพลตฟอร์ม — ไปที่ ตั้งค่า → แพลตฟอร์ม เพื่อเชื่อมต่อ
            </div>
          ) : platList.map(id => {
            const p = PLATFORMS[id], st = stats[id];
            return (
              <div key={id} className="plat-card">
                <div className="top">
                  <PlatformBadge id={id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{p.short}</div>
                    <div className="conn" style={{ color: "var(--ok)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ok)" }} />เชื่อมต่อแล้ว
                    </div>
                  </div>
                </div>
                <div className="plat-stats">
                  <div className="ps"><div className="n" style={{ color: "var(--ok)" }}>{st.published}</div><div className="t">สำเร็จ</div></div>
                  <div className="ps"><div className="n" style={{ color: "var(--info)" }}>{st.scheduled}</div><div className="t">ตั้งเวลา</div></div>
                  <div className="ps"><div className="n" style={{ color: st.failed ? "var(--err)" : "var(--text-mute)" }}>{st.failed}</div><div className="t">ล้มเหลว</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* two columns */}
      <div className="dash-cols">
        {/* upcoming */}
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <h2 className="section-title">คิวที่จะโพสต์ถัดไป</h2>
            <Btn size="sm" variant="ghost" iconR="chevR" style={{ marginLeft: "auto" }} onClick={() => go("calendar")}>ดูปฏิทิน</Btn>
          </div>
          {upcoming.slice(0, 6).map(p => {
            const ids = Object.keys(p.platforms);
            const ps = postStatus(p);
            return (
              <div key={p.id} className="upcoming-item" style={{ cursor: "pointer" }} onClick={() => openPost(p)}>
                <div className="thumb"><VideoThumb vid={p.vid || { dur: p.video_duration || 0, cover: p.video_cover }} showPlay={false} /></div>
                <div className="meta">
                  <div className="ttl">{p.title}</div>
                  <div className="when">
                    <Icon name="clock" size={13} />{relDay(p.when)} · {fmtTime(p.when)} น.
                  </div>
                </div>
                <PlatformStack ids={ids} />
                <div style={{ width: 92, textAlign: "right" }}>
                  {ps === "publishing"
                    ? <span className="badge warn"><span className="dot" style={{ animation: "pulse 1s infinite" }} />กำลังโพสต์</span>
                    : <StatusBadge status={ps} />}
                </div>
              </div>
            );
          })}
          <Btn variant="ghost" icon="plus" style={{ width: "100%", marginTop: 12, borderStyle: "dashed" }} onClick={openCreate}>
            สร้างโพสต์ใหม่
          </Btn>
        </div>

        {/* right column */}
        <div className="grid" style={{ gap: 18 }}>
          {/* storage status */}
          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <div className="ico" style={{ width: 30, height: 30, borderRadius: 9, background: "var(--warn-bg)", color: "var(--warn)", display: "grid", placeItems: "center" }}>
                <Icon name={ds.icon} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{ds.name}</div>
                <div className="mono muted" style={{ fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ds.folder}</div>
              </div>
              {primarySource && <span className="badge ok" style={{ marginLeft: "auto" }}><span className="dot" />เชื่อมต่อ</span>}
            </div>
            <div className="grid" style={{ gap: 13 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  <span className="muted">พื้นที่</span><span className="mono">{ds.totalGB > 0 ? `${ds.usedGB} / ${ds.totalGB} GB` : "—"}</span>
                </div>
                <Bar value={ds.usedGB} max={ds.totalGB || 1} color="var(--warn)" />
              </div>
              <div style={{ display: "flex", gap: 18, fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)" }}>
                <span>คลัง <b style={{ color: "var(--text)" }}>{ds.folder}</b></span>
                <span style={{ marginLeft: "auto" }}>{ds.account}</span>
              </div>
            </div>
          </div>

          {/* activity */}
          <div className="card card-pad">
            <h2 className="section-title" style={{ marginBottom: 8 }}>กิจกรรมล่าสุด</h2>
            {activity.slice(0, 7).map((a, i) => {
              const conf = a.st === "published" ? { c: "var(--ok)", bg: "var(--ok-bg)", ic: "check", t: "โพสต์สำเร็จ" }
                : a.st === "failed" ? { c: "var(--err)", bg: "var(--err-bg)", ic: "x", t: "อัปโหลดล้มเหลว" }
                : { c: "var(--warn)", bg: "var(--warn-bg)", ic: "upload", t: "กำลังอัปโหลด" };
              return (
                <div key={i} className="activity-item">
                  <div className="adot" style={{ background: conf.bg, color: conf.c }}><Icon name={conf.ic} size={15} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="atxt">
                      <b>{conf.t}</b> · {PLATFORMS[a.plat].short}
                      <div className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.post.title}</div>
                    </div>
                    <div className="atime">{relDay(a.when)} · {fmtTime(a.when)} น.</div>
                  </div>
                  <PlatformBadge id={a.plat} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
