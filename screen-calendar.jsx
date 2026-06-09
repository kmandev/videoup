/* ============================================================
   VideoUp — Calendar / schedule screen
   ============================================================ */
function Calendar({ openCreate, openPost, posts: propPosts }) {
  const [view, setView] = useState("month"); // month | list
  const allPosts = propPosts || POSTS;
  const [month, setMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));

  const postsByDay = useMemo(() => {
    const m = {};
    allPosts.forEach(p => {
      const k = p.when.toDateString();
      (m[k] = m[k] || []).push(p);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.when - b.when));
    return m;
  }, [allPosts]);

  // build month grid (Sunday-first)
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startDow = first.getDay();
    const start = new Date(first); start.setDate(1 - startDow);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const shiftMonth = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  // list view: upcoming grouped by day
  const listDays = useMemo(() => {
    const start = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    const days = Object.keys(postsByDay)
      .map(k => new Date(k))
      .filter(d => d >= start)
      .sort((a, b) => a - b);
    return days;
  }, [postsByDay]);

  return (
    <div>
      <div className="cal-toolbar">
        <div className="seg">
          <button className={view === "month" ? "on" : ""} onClick={() => setView("month")}>เดือน</button>
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>รายการ</button>
        </div>
        {view === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Btn variant="ghost" size="sm" icon="chevL" onClick={() => shiftMonth(-1)} style={{ padding: "7px 9px" }} />
            <div style={{ fontWeight: 800, fontSize: 16, minWidth: 118, textAlign: "center" }}>
              {TH_MON[month.getMonth()].replace(/\./g, "")} {month.getFullYear() + 543}
            </div>
            <Btn variant="ghost" size="sm" icon="chevR" onClick={() => shiftMonth(1)} style={{ padding: "7px 9px" }} />
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 9, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }} className="legend">
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--info)" }} />ตั้งเวลา</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--ok)" }} />สำเร็จ</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--err)" }} />ล้มเหลว</span>
          </div>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => openCreate()}>สร้างโพสต์</Btn>
        </div>
      </div>

      {view === "month" ? (
        <div className="card card-pad">
          <div className="cal-grid" style={{ marginBottom: 8 }}>
            {TH_DOW.map(d => <div key={d} className="cal-head">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, TODAY);
              const dayPosts = postsByDay[d.toDateString()] || [];
              return (
                <div key={i} className={`cal-cell ${inMonth ? "" : "dim"} ${isToday ? "today" : ""}`}
                  onClick={() => openCreate(d)}>
                  <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <span className="dnum">{d.getDate()}</span>
                    <span className="add"><Icon name="plus" size={15} /></span>
                  </div>
                  {dayPosts.slice(0, 3).map(p => {
                    const ps = postStatus(p);
                    const col = ps === "published" ? "var(--ok)" : ps === "failed" || ps === "partial" ? "var(--err)"
                      : ps === "draft" ? "var(--text-mute)" : ps === "publishing" ? "var(--warn)" : "var(--info)";
                    return (
                      <div key={p.id} className="cal-chip" style={{ borderLeftColor: col }}
                        onClick={(e) => { e.stopPropagation(); openPost(p); }}>
                        <span className="cm">{fmtTime(p.when)}</span>
                        <span className="ct">{p.title}</span>
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 700, paddingLeft: 4 }}>+{dayPosts.length - 3} อื่นๆ</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {listDays.length === 0 && <div className="muted" style={{ padding: 40, textAlign: "center" }}>ยังไม่มีคิวที่ตั้งเวลาไว้</div>}
          {listDays.map(d => (
            <div key={d.toDateString()} className="list-day">
              <div className="lhead">
                <span className="ld">{sameDay(d, TODAY) ? "วันนี้" : relDay(d)}</span>
                <span className="lw">{fmtDateFull(d)}</span>
                <span style={{ marginLeft: "auto" }} className="badge mute">{(postsByDay[d.toDateString()] || []).length} คลิป</span>
              </div>
              {(postsByDay[d.toDateString()] || []).map(p => {
                const ids = Object.keys(p.platforms);
                return (
                  <div key={p.id} className="list-row" onClick={() => openPost(p)}>
                    <span className="ltime">{fmtTime(p.when)}</span>
                    <div className="thumb" style={{ width: 42, height: 54, borderRadius: 9, overflow: "hidden", flex: "none" }}>
                      <VideoThumb vid={p.vid || { dur: p.video_duration || 0, cover: p.video_cover }} showPlay={false} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                      <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{(VID(p.vid)?.dur ?? p.video_duration ?? 0)} วินาที · {ids.length} แพลตฟอร์ม</div>
                    </div>
                    <PlatformStack ids={ids} />
                    <StatusBadge status={postStatus(p)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Calendar });
