/* ============================================================
   VideoUp — Create / compose post screen
   ============================================================ */
const CONTENT_TPL = {
  tiktok:   { caption: "", hashtags: "#รีวิวของดี #ของมันต้องมี #ติ๊กต๊อกพาช้อป #affiliate", link: "" },
  youtube:  { caption: "", hashtags: "#Shorts #รีวิว #ของน่าซื้อ", link: "" },
  facebook: { caption: "", hashtags: "#Reels #รีวิว #ของน่าซื้อ #ช้อปออนไลน์", link: "" },
  shopee:   { caption: "", hashtags: "#ShopeeหาดของถูกบนShopee #รีวิวShopee", link: "" },
  lazada:   { caption: "", hashtags: "#LazadaTH #ดีลเด็ด", link: "" },
};
const LINK_PH = {
  tiktok:   "https://vt.tiktok.com/aff/xxxx",
  youtube:  "https://s.shopee.co.th/xxxx (ลิงก์ในคำอธิบาย)",
  facebook: "https://s.lazada.co.th/xxxx (ลิงก์ในโพสต์)",
  shopee:   "https://shp.ee/xxxx",
  lazada:   "https://s.lazada.co.th/s.xxxx",
};

// ข้อกำหนด field ของแต่ละแพลตฟอร์ม (required / max / มี title ไหม)
const PLATFORM_FIELDS = {
  youtube:  { title: { required: true, max: 100 },  caption: { label: "คำอธิบาย (Description)", required: false, max: 5000 }, hashtags: true,  link: true },
  tiktok:   { caption: { label: "แคปชั่น", required: true,  max: 2200 }, hashtags: true,  link: true },
  facebook: { caption: { label: "แคปชั่น", required: true,  max: 2200 }, hashtags: true,  link: true },
  shopee:   { caption: { label: "คำบรรยายสินค้า", required: true, max: 2000 }, hashtags: false, link: true },
  lazada:   { caption: { label: "คำบรรยายสินค้า", required: true, max: 2000 }, hashtags: false, link: true },
};

function CreatePost({ initialVid, initialDate, videos: propVideos, sources: propSources, connectedPlatforms, products, onToast, onReload, onPublish, onCancel }) {
  // ใช้ videos จริงจาก Supabase ถ้ามี (live mode) ไม่งั้น fallback mock
  const allVideos = (propVideos && propVideos.length >= 0) ? propVideos : VIDEOS;
  const findVid = (id) => allVideos.find(v => v.id === id) || VID(id);
  const live = window.API && window.API.isLive();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // source/platform ที่ใช้ได้จริง (เฉพาะที่เชื่อมต่อแล้ว)
  const connectedSourceTypes = new Set((propSources || []).map(s => s.type));
  const availSources = SOURCE_LIST.filter(id => id === "url" || connectedSourceTypes.has(id));
  const availPlatforms = (connectedPlatforms && connectedPlatforms.length >= 0) ? connectedPlatforms : PLATFORM_LIST;

  // รวมข้อมูล source จริง (account/path/storage) กับ mock (สี/ไอคอน/ชื่อ)
  const srcRow = (type) => (propSources || []).find(s => s.type === type);
  const srcInfo = (type) => {
    const base = SRC(type) || {};
    const row = srcRow(type);
    if (!row) return base;
    return { ...base, account: row.account || base.account, path: row.path || base.path,
             used: row.used_gb ?? base.used, total: row.total_gb ?? base.total };
  };

  // อัปโหลดไฟล์เข้า source ปัจจุบัน
  const doUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!live) { onToast?.({ kind: "publishing", title: "อัปโหลดแล้ว (demo)", desc: file.name }); return; }
    const row = srcRow(activeSource);
    if (!row) { onToast?.({ kind: "scheduled", title: "ยังไม่ได้เชื่อมต่อ source นี้", desc: "เชื่อมต่อก่อนในหน้าตั้งค่า" }); return; }
    setUploading(true);
    try {
      await window.API.uploadToSource(row.id, file);
      onToast?.({ kind: "publishing", title: "อัปโหลดสำเร็จ ✓", desc: file.name });
      await onReload?.();
    } catch (err) {
      onToast?.({ kind: "scheduled", title: "อัปโหลดไม่สำเร็จ", desc: err.message });
    } finally { setUploading(false); }
  };
  const [vid, setVid] = useState(initialVid || null);
  // source filter — default = source ของคลิปที่เลือก หรือ source แรกที่เชื่อมต่อ
  const [activeSource, setActiveSource] = useState(() =>
    (initialVid && findVid(initialVid)?.source) || availSources.find(s => s !== "url") || availSources[0] || "url");
  // platform — เปิดเฉพาะที่เชื่อมต่อแล้ว (default เปิดทั้งหมดที่ใช้ได้)
  const [plats, setPlats] = useState(() => {
    const init = {};
    availPlatforms.forEach(k => { init[k] = true; });
    return init;
  });
  const [content, setContent] = useState(() => {
    const c = {};
    PLATFORM_LIST.forEach(k => c[k] = { title: "", ...CONTENT_TPL[k] });
    return c;
  });
  const [tab, setTab] = useState(availPlatforms[0] || "youtube");
  const [mode, setMode] = useState("later"); // now | later
  const [date, setDate] = useState(() => {
    const d = initialDate || new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [time, setTime] = useState("19:00");
  // post-publish cleanup
  const [cleanup, setCleanup] = useState(false);
  const [cleanupDelay, setCleanupDelay] = useState("immediate"); // immediate | 24h | 7d

  const selectedPlats = PLATFORM_LIST.filter(k => plats[k]);
  // keep active tab valid
  useEffect(() => { if (!plats[tab] && selectedPlats.length) setTab(selectedPlats[0]); }, [plats]); // eslint-disable-line

  const setField = (plat, field, val) => setContent(c => ({ ...c, [plat]: { ...c[plat], [field]: val } }));

  // เลือกสินค้า → เติมเนื้อหาหลัก (เหมือนกันทุกแพลตฟอร์ม) + ลิงก์แยกตามแพลตฟอร์ม
  const [productId, setProductId] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const applyProduct = (id) => {
    setProductId(id);
    if (!id) return;
    const prod = (products || []).find(p => p.id === id);
    if (!prod) return;
    const m = prod.content || {};
    setContent(c => {
      const n = { ...c };
      PLATFORM_LIST.forEach(k => {
        n[k] = {
          title:    m.title || n[k]?.title || "",
          caption:  m.caption ?? n[k]?.caption ?? "",
          hashtags: m.hashtags ?? n[k]?.hashtags ?? "",
          link:     m.links?.[k] || prod.affiliate_link || "",
        };
      });
      return n;
    });
    onToast?.({ kind: "publishing", title: "เติมเนื้อหาจากสินค้าแล้ว ✓", desc: prod.name });
  };
  const filteredProducts = (products || []).filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()));
  const selectedProduct = (products || []).find(p => p.id === productId);
  const applyToAll = () => {
    const src = content[tab];
    setContent(c => {
      const n = { ...c };
      selectedPlats.forEach(k => { if (k !== tab) n[k] = { ...n[k], caption: src.caption }; });
      return n;
    });
  };

  const v = vid ? findVid(vid) : null;
  const cur = content[tab] || { title: "", ...CONTENT_TPL[tab] };
  const FIELDS = PLATFORM_FIELDS[tab] || PLATFORM_FIELDS.tiktok;
  const filtered = allVideos.filter(x => x.source === activeSource);
  const src = srcInfo(activeSource);

  // ตรวจ field ที่จำเป็นของแต่ละแพลตฟอร์มที่เลือก
  const missingRequired = selectedPlats.filter(pl => {
    const f = PLATFORM_FIELDS[pl] || {};
    const c = content[pl] || {};
    if (f.title?.required && !(c.title || "").trim() && !(v?.title)) return true;
    if (f.caption?.required && !(c.caption || "").trim()) return true;
    return false;
  });
  const canPublish = vid && selectedPlats.length > 0 && missingRequired.length === 0;

  const [publishing, setPublishing] = useState(false);
  const doPublish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    try {
      await onPublish({
        vid, platforms: selectedPlats, mode,
        when: mode === "now" ? "ทันที" : `${date} ${time}`,
        scheduledISO: `${date}T${time}:00`,
        title: v.title,
        content,            // เนื้อหาต่อแพลตฟอร์ม (caption/hashtags/link)
        cleanup, cleanupDelay,
        source: v.source,
      });
    } finally { setPublishing(false); }
  };

  return (
    <div className="create-wrap">
      <div className="steps">
        {/* STEP 1 — choose video + source */}
        <div className="step-card">
          <div className="shead">
            <span className="step-num">1</span>
            <span className="stitle">เลือกวิดีโอ</span>
            {v && <span className="badge ok" style={{ marginLeft: "auto" }}><Icon name="check" size={12} />เลือกแล้ว</span>}
          </div>

          {/* SOURCE TABS */}
          <div className="src-tabs">
            {availSources.map(id => {
              const s = SOURCES[id], on = activeSource === id;
              return (
                <button key={id} className={`src-tab ${on ? "on" : ""}`}
                  style={on ? { borderColor: s.color, color: s.color, background: `color-mix(in oklab, ${s.color} 9%, var(--surface))` } : {}}
                  onClick={() => setActiveSource(id)}>
                  <span className="src-dot" style={{ background: s.color }}>
                    <Icon name={s.icon} size={11} />
                  </span>
                  {s.name}
                </button>
              );
            })}
            <button className="src-tab add" onClick={() => alert("เปิดหน้าตั้งค่าเชื่อม source ใหม่")}>
              <Icon name="plus" size={14} />เพิ่ม source
            </button>
          </div>

          {/* SOURCE INFO STRIP */}
          <div className="drive-strip" style={{ borderColor: `color-mix(in oklab, ${src.color} 25%, var(--border-2))` }}>
            <div className="ico" style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in oklab, ${src.color} 16%, var(--surface))`, color: src.color, display: "grid", placeItems: "center" }}>
              <Icon name={src.icon} size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {src.name}
                <span className="muted" style={{ fontWeight: 600, fontSize: 12, marginLeft: 8 }}>{src.account}</span>
              </div>
              <div className="mono muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{src.path}</div>
            </div>
            {src.total > 0 && (
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{src.used}/{src.total} GB</div>
                <div style={{ width: 90, marginTop: 4 }}><Bar value={src.used} max={src.total} color={src.color} height={4} /></div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={doUpload} />
            <Btn size="sm" variant="ghost" icon="upload" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
            </Btn>
          </div>

          {/* VIDEO GRID */}
          {filtered.length === 0 ? (
            <div className="muted" style={{ padding: 32, textAlign: "center", fontWeight: 600, border: "1px dashed var(--border-2)", borderRadius: 12 }}>
              <Icon name="film" size={26} style={{ opacity: .4, marginBottom: 8 }} />
              <div>ยังไม่มีคลิปใน {src.name}</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 4 }}>อัปโหลดไฟล์ใหม่ หรือเลือก source อื่น</div>
            </div>
          ) : (
            <div className="vid-grid">
              {filtered.map(x => {
                const isUrl = typeof x.cover === "string" && /^https?:\/\//.test(x.cover);
                const coverStyle = isUrl
                  ? { backgroundImage: `url(${x.cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: x.cover };
                return (
                <div key={x.id} className={`vid-pick ${vid === x.id ? "on" : ""}`} onClick={() => setVid(x.id)} style={coverStyle}>
                  <div className="chk"><Icon name="check" size={13} /></div>
                  <span className="src-flag" title={SRC(x.source).name} style={{ background: "#fff" }}>
                    <Icon name={SRC(x.source).icon} size={11} />
                  </span>
                  <span className="dur" style={{ position: "absolute", right: 6, top: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 5, fontFamily: "var(--font-mono)" }}>
                    {x.dur}s
                  </span>
                  <span className="vname">{x.title}</span>
                </div>
                );
              })}
            </div>
          )}

          {/* PRODUCT PICKER — เลือก/ค้นหาสินค้าเพื่อเติมเนื้อหา */}
          {vid && products && products.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Icon name="cart" size={15} style={{ color: "var(--brand)" }} />
                <span style={{ fontWeight: 800, fontSize: 13.5 }}>เลือกสินค้า</span>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>เติมเนื้อหา + ลิงก์อัตโนมัติ (แก้ต่อได้)</span>
                {selectedProduct && <Btn size="sm" variant="ghost" icon="x" style={{ marginLeft: "auto" }} onClick={() => applyProduct("")}>ล้าง</Btn>}
              </div>
              <input className="input" value={prodSearch} placeholder="🔍 ค้นหาสินค้า..."
                style={{ marginBottom: 10 }} onChange={e => setProdSearch(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {filteredProducts.length === 0
                  ? <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>ไม่พบสินค้า</span>
                  : filteredProducts.map(p => (
                    <button key={p.id} className={`chip ${productId === p.id ? "on" : ""}`}
                      style={productId === p.id ? { background: "var(--brand)" } : {}}
                      onClick={() => applyProduct(p.id)}>
                      <Icon name="cart" size={13} />{p.name}
                      {productId === p.id && <Icon name="check" size={14} />}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {vid && (!products || products.length === 0) && (
            <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600 }} className="muted">
              💡 เพิ่มสินค้าในเมนู "สินค้า" เพื่อเลือกมาเติมเนื้อหาได้อัตโนมัติ
            </div>
          )}
        </div>

        {/* STEP 2 — platforms */}
        <div className="step-card">
          <div className="shead">
            <span className="step-num">2</span>
            <span className="stitle">เลือกแพลตฟอร์ม</span>
            <span className="sopt" style={{ marginLeft: "auto" }}>{selectedPlats.length} แพลตฟอร์ม</span>
          </div>
          {availPlatforms.length === 0 ? (
            <div className="muted" style={{ padding: "16px 0", fontWeight: 600, fontSize: 13 }}>
              ยังไม่ได้เชื่อมต่อแพลตฟอร์มใดเลย — ไปที่ <b>ตั้งค่า → แพลตฟอร์ม</b> เพื่อเชื่อมต่อก่อน
            </div>
          ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {availPlatforms.map(id => {
              const p = PLATFORMS[id], on = plats[id];
              return (
                <button key={id} className={`chip ${on ? "on" : ""}`}
                  style={on ? { background: p.color } : {}}
                  onClick={() => setPlats(s => ({ ...s, [id]: !s[id] }))}>
                  <span className="pbadge sm" style={{ background: on ? "rgba(255,255,255,.22)" : p.color, width: 20, height: 20, borderRadius: 6, fontSize: 11 }}>
                    <span style={{ color: "#fff" }}>{p.mono}</span>
                  </span>
                  {p.name}
                  {on && <Icon name="check" size={15} />}
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* STEP 3 — per-platform content */}
        <div className="step-card">
          <div className="shead">
            <span className="step-num">3</span>
            <span className="stitle">เนื้อหาแต่ละแพลตฟอร์ม</span>
            <span className="sopt" style={{ marginLeft: "auto" }}>caption · แฮชแท็ก · ลิงก์ affiliate</span>
          </div>
          {selectedPlats.length === 0 ? (
            <div className="muted" style={{ padding: "24px 0", textAlign: "center", fontWeight: 600 }}>เลือกแพลตฟอร์มอย่างน้อย 1 อันก่อน</div>
          ) : (
            <>
              <div className="plat-tabs">
                {selectedPlats.map(id => (
                  <button key={id} className={`plat-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}
                    style={tab === id ? { borderBottomColor: PLATFORMS[id].color } : {}}>
                    <PlatformBadge id={id} size="sm" />
                    {PLATFORMS[id].short}
                  </button>
                ))}
              </div>

              {/* Title (เฉพาะแพลตฟอร์มที่ต้องมี เช่น YouTube) */}
              {FIELDS.title && (
                <div className="field">
                  <label><Icon name="edit" size={14} />ชื่อวิดีโอ (Title)
                    {FIELDS.title.required && <span className="opt" style={{ color: "var(--err)" }}>* จำเป็น</span>}
                    <span className="cnt">{(cur.title || "").length}/{FIELDS.title.max}</span>
                  </label>
                  <input className="input" value={cur.title || ""} maxLength={FIELDS.title.max}
                    placeholder={v ? v.title : `ชื่อวิดีโอบน ${PLATFORMS[tab].short}...`}
                    onChange={e => setField(tab, "title", e.target.value)} />
                </div>
              )}

              <div className="field">
                <label><Icon name="edit" size={14} />{FIELDS.caption.label}
                  {FIELDS.caption.required
                    ? <span className="opt" style={{ color: "var(--err)" }}>* จำเป็น</span>
                    : <span className="opt">(ไม่บังคับ)</span>}
                  <span className="cnt">{cur.caption.length}/{FIELDS.caption.max}</span>
                </label>
                <textarea className="textarea" rows={3} value={cur.caption} maxLength={FIELDS.caption.max}
                  placeholder={`เขียน${FIELDS.caption.label}สำหรับ ${PLATFORMS[tab].short}...`}
                  onChange={e => setField(tab, "caption", e.target.value)} />
                {selectedPlats.length > 1 && (
                  <button className="apply-all" onClick={applyToAll}>
                    <Icon name="copy" size={14} />ใช้แคปชั่นนี้กับทุกแพลตฟอร์ม
                  </button>
                )}
              </div>

              {FIELDS.hashtags && (
                <div className="field">
                  <label><Icon name="hash" size={14} />แฮชแท็ก <span className="opt">(เว้นวรรคหรือ #)</span></label>
                  <input className="input" value={cur.hashtags}
                    placeholder="#รีวิว #ของดี"
                    onChange={e => setField(tab, "hashtags", e.target.value)} />
                </div>
              )}

              {FIELDS.link && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label><Icon name="link" size={14} />ลิงก์ Affiliate <span className="opt">({PLATFORMS[tab].name})</span></label>
                  <input className="input link" value={cur.link}
                    placeholder={LINK_PH[tab]}
                    onChange={e => setField(tab, "link", e.target.value)} />
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
                    <Icon name="cart" size={14} style={{ color: PLATFORMS[tab].accent }} />
                    ลิงก์จะถูกแนบใน{tab === "youtube" ? "คำอธิบายวิดีโอ" : tab === "facebook" ? "โพสต์" : "โพสต์/bio"} อัตโนมัติตอนโพสต์
                  </div>
                </div>
              )}

              {missingRequired.length > 0 && (
                <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: "var(--err)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="alert" size={14} />
                  ยังกรอกข้อมูลที่จำเป็นไม่ครบ: {missingRequired.map(p => PLATFORMS[p].short).join(", ")}
                </div>
              )}
            </>
          )}
        </div>

        {/* STEP 4 — schedule */}
        <div className="step-card">
          <div className="shead">
            <span className="step-num">4</span>
            <span className="stitle">ตั้งเวลาโพสต์</span>
          </div>
          <div className="sched-opts">
            <div className={`radio-card ${mode === "now" ? "on" : ""}`} onClick={() => setMode("now")}>
              <span className="rc-ico"><Icon name="bolt" size={19} /></span>
              <div><div className="rc-t">โพสต์ทันที</div><div className="rc-d">อัปโหลดทันทีเดียวนี้</div></div>
            </div>
            <div className={`radio-card ${mode === "later" ? "on" : ""}`} onClick={() => setMode("later")}>
              <span className="rc-ico"><Icon name="clock" size={19} /></span>
              <div><div className="rc-t">ตั้งเวลา</div><div className="rc-d">เลือกวันและเวลา</div></div>
            </div>
          </div>
          {mode === "later" && (
            <div className="dt-row">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>วันที่</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>เวลา</label>
                <input type="time" className="input" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12.5, color: "var(--text-dim)", fontWeight: 600 }}>
            <Icon name="upload" size={14} />ระบบจะดึงไฟล์จาก {v ? SRC(v.source).name : "source"} แล้วอัปโหลดตามเวลาที่ตั้ง
          </div>
        </div>

        {/* STEP 5 — post-publish cleanup */}
        <div className="step-card">
          <div className="shead">
            <span className="step-num">5</span>
            <span className="stitle">หลังโพสต์เสร็จ</span>
            <span className="sopt" style={{ marginLeft: "auto" }}>ประหยัดพื้นที่ source</span>
          </div>
          <div className={`cleanup-card ${cleanup ? "on" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div className="cleanup-ico">
                <Icon name="trash" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>ลบไฟล์ออกจาก source หลังโพสต์สำเร็จ</div>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3, lineHeight: 1.5 }}>
                  เมื่อทุกแพลตฟอร์มอัปขึ้นเรียบร้อย ระบบจะลบไฟล์ใน
                  {v ? <b style={{ color: "var(--text)" }}> {SRC(v.source).name}</b> : " source"} อัตโนมัติ
                  เพื่อประหยัดพื้นที่
                </div>
              </div>
              <button className="toggle" data-on={cleanup} onClick={() => setCleanup(!cleanup)} aria-label="ลบหลังโพสต์">
                <span className="toggle-knob" />
              </button>
            </div>

            {cleanup && (
              <>
                <div className="cleanup-when">
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-dim)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 8 }}>ลบเมื่อไหร่</div>
                  <div className="seg" style={{ width: "100%" }}>
                    <button className={cleanupDelay === "immediate" ? "on" : ""} onClick={() => setCleanupDelay("immediate")} style={{ flex: 1 }}>ทันทีหลังโพสต์</button>
                    <button className={cleanupDelay === "24h" ? "on" : ""} onClick={() => setCleanupDelay("24h")} style={{ flex: 1 }}>หลัง 24 ชม.</button>
                    <button className={cleanupDelay === "7d" ? "on" : ""} onClick={() => setCleanupDelay("7d")} style={{ flex: 1 }}>หลัง 7 วัน</button>
                  </div>
                </div>
                <div className="cleanup-warn">
                  <Icon name="alert" size={14} />
                  <span>หากแพลตฟอร์มใดล้มเหลว ระบบจะเก็บไฟล์ไว้จนกว่าจะ retry สำเร็จ</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="preview-col">
        <div className="phone">
          <div className="phone-screen">
            <div className="phone-video" style={
              v
                ? (/^https?:\/\//.test(v.cover)
                    ? { backgroundImage: `url(${v.cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: v.cover })
                : { background: "linear-gradient(135deg,#2a2a33,#15151b)" }
            } />
            {!v && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)", textAlign: "center", padding: 20 }}>
                <div><Icon name="film" size={30} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>เลือกวิดีโอเพื่อดูตัวอย่าง</div></div>
              </div>
            )}
            {v && (
              <>
                {/* แถบเวลา + แพลตฟอร์ม (ของจริง ไม่ใส่ตัวเลขปลอม) */}
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6, fontFamily: "var(--font-mono)" }}>{v.dur}s</span>
                  {tab === "youtube" && <span style={{ background: PLATFORMS.youtube.color, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6 }}>Shorts</span>}
                </div>
                <div className="phone-rail">
                  <div className="r"><span className="rc"><Icon name="heart" size={19} /></span></div>
                  <div className="r"><span className="rc"><Icon name="send" size={18} /></span></div>
                  {(tab === "shopee" || tab === "lazada") && <div className="r"><span className="rc" style={{ background: PLATFORMS[tab].accent }}><Icon name="cart" size={18} /></span>ซื้อ</div>}
                </div>
                <div className="phone-overlay">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: PLATFORMS[tab].color, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 13, border: "1.5px solid rgba(255,255,255,.6)" }}>
                      {PLATFORMS[tab].mono}
                    </div>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>{PLATFORMS[tab].handle}</span>
                  </div>
                  {/* YouTube มี title — แสดงเป็นหัวข้อ */}
                  {FIELDS.title && (
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 13.5, marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {cur.title || v.title}
                    </div>
                  )}
                  <div className="pcap">{cur.caption || <span style={{ opacity: .6 }}>{FIELDS.caption.label}จะแสดงที่นี่...</span>}</div>
                  {cur.hashtags && <div className="ptags">{cur.hashtags}</div>}
                  {cur.link && <span className="plink"><Icon name="cart" size={13} />ช้อปเลย · affiliate</span>}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="preview-platlabel">
          <Icon name="eye" size={15} />ตัวอย่างบน <PlatformBadge id={tab} size="sm" /> {PLATFORMS[tab].name}
        </div>
        {v && (
          <div className="preview-meta">
            <div className="pm-row">
              <Icon name={SRC(v.source).icon} size={13} style={{ color: SRC(v.source).color }} />
              <span>{SRC(v.source).name}</span>
              <span className="muted mono" style={{ marginLeft: "auto", fontSize: 11 }}>{v.size} MB</span>
            </div>
            {cleanup && (
              <div className="pm-row" style={{ color: "var(--err)" }}>
                <Icon name="trash" size={13} />
                <span>ลบไฟล์{cleanupDelay === "immediate" ? "ทันที" : cleanupDelay === "24h" ? "หลัง 24 ชม." : "หลัง 7 วัน"}เมื่อโพสต์สำเร็จ</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUMMARY BAR */}
      <div className="summary-bar">
        <div className="sinfo">
          {v ? <><b>{v.title}</b> · <b>{selectedPlats.length}</b> แพลตฟอร์ม · {mode === "now" ? "โพสต์ทันที" : <>ตั้งเวลา <b>{date} {time} น.</b></>}{cleanup ? <> · <span style={{ color: "var(--err)" }}>ลบหลังโพสต์</span></> : null}</>
            : "เลือกวิดีโอเพื่อเริ่ม"}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onCancel}>ยกเลิก</Btn>
          <Btn variant="primary" icon={mode === "now" ? "rocket" : "calendar"} disabled={!canPublish || publishing} onClick={doPublish}>
            {publishing ? (mode === "now" ? "กำลังโพสต์..." : "กำลังบันทึก...") : (mode === "now" ? "โพสต์เลย" : "ยืนยันตั้งเวลา")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CreatePost });
