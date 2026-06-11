/* ============================================================
   VideoUp — Products screen (จัดการสินค้า)
   เนื้อหาหลัก 1 ชุด (title/caption/hashtags) + ลิงก์ affiliate แยกตามแพลตฟอร์ม
   content = { title, caption, hashtags, links: { tiktok, youtube, ... } }
   ============================================================ */
const emptyProductContent = () => ({
  title: "", caption: "", hashtags: "",
  links: PLATFORM_LIST.reduce((o, k) => (o[k] = "", o), {}),
});

const MOCK_PRODUCTS = [
  { id: "p1", name: "เครื่องตัดแต่งพุ่มไม้ไร้สาย", affiliate_link: "https://s.shopee.co.th/demo1",
    content: { title: "รีวิวเครื่องตัดแต่งพุ่มไม้ไร้สาย ใช้ดีไหม?",
      caption: "ตัวช่วยแต่งสวนให้สวย ตัดง่ายไม่ต้องใช้แรง 🔥",
      hashtags: "#รีวิว #ของน่าซื้อ #ของมันต้องมี",
      links: { tiktok: "https://vt.tiktok.com/demo", youtube: "", facebook: "", shopee: "https://s.shopee.co.th/demo1", lazada: "" } } },
];

function ProductsScreen({ onToast }) {
  const live = window.API && window.API.isLive();
  const [rows, setRows] = useState(live ? [] : MOCK_PRODUCTS);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(live);

  const load = async () => {
    if (!live) return;
    setLoading(true);
    try { setRows(await window.API.listProducts() || []); }
    catch (e) { onToast?.({ kind: "scheduled", title: "โหลดสินค้าไม่สำเร็จ", desc: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing({ name: "", affiliate_link: "", content: emptyProductContent() });
  const startEdit = (p) => setEditing({ ...p, content: { ...emptyProductContent(), ...(p.content || {}), links: { ...emptyProductContent().links, ...(p.content?.links || {}) } } });

  const remove = async (p) => {
    if (live) { try { await window.API.deleteProduct(p.id); } catch (e) {} }
    setRows(r => r.filter(x => x.id !== p.id));
    onToast?.({ kind: "scheduled", title: "ลบสินค้าแล้ว", desc: p.name });
  };

  const save = async (prod) => {
    if (!prod.name.trim()) { onToast?.({ kind: "scheduled", title: "ต้องใส่ชื่อสินค้า" }); return; }
    if (live) {
      try {
        if (prod.id) { const u = await window.API.updateProduct(prod.id, { name: prod.name, affiliate_link: prod.affiliate_link, content: prod.content }); setRows(r => r.map(x => x.id === u.id ? u : x)); }
        else { const c = await window.API.createProduct(prod); setRows(r => [c, ...r]); }
      } catch (e) { onToast?.({ kind: "scheduled", title: "บันทึกไม่สำเร็จ", desc: e.message }); return; }
    } else {
      if (prod.id) setRows(r => r.map(x => x.id === prod.id ? prod : x));
      else setRows(r => [{ ...prod, id: "p" + Date.now() }, ...r]);
    }
    onToast?.({ kind: "publishing", title: "บันทึกสินค้าแล้ว ✓", desc: prod.name });
    setEditing(null);
  };

  if (editing) return <ProductEditor initial={editing} onSave={save} onCancel={() => setEditing(null)} onToast={onToast} />;

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="section-title">สินค้าของฉัน</h2>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>เก็บเนื้อหาและลิงก์ไว้ใช้ซ้ำตอนสร้างโพสต์</div>
        </div>
        <Btn variant="primary" icon="plus" style={{ marginLeft: "auto" }} onClick={startNew}>เพิ่มสินค้า</Btn>
      </div>

      {loading ? (
        <div className="muted" style={{ padding: 40, textAlign: "center", fontWeight: 600 }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="card card-pad" style={{ padding: 40, textAlign: "center" }}>
          <Icon name="cart" size={30} style={{ opacity: .4, marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>ยังไม่มีสินค้า</div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>เพิ่มสินค้าแล้วเขียนเนื้อหา + ลิงก์ไว้ล่วงหน้า</div>
          <Btn variant="primary" icon="plus" onClick={startNew}>เพิ่มสินค้าชิ้นแรก</Btn>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {rows.map(p => {
            const linkPlats = PLATFORM_LIST.filter(k => p.content?.links?.[k]);
            return (
              <div key={p.id} className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center", flex: "none" }}>
                  <Icon name="cart" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    {p.content?.caption ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{p.content.caption}</span> : <span>ยังไม่มีเนื้อหา</span>}
                    {linkPlats.length > 0 && <><span className="muted">·</span><PlatformStack ids={linkPlats} /></>}
                  </div>
                </div>
                <Btn size="sm" variant="ghost" icon="edit" onClick={() => startEdit(p)}>แก้ไข</Btn>
                <Btn size="sm" variant="ghost" icon="trash" onClick={() => remove(p)}>ลบ</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductEditor({ initial, onSave, onCancel, onToast }) {
  const [name, setName] = useState(initial.name || "");
  const [c, setC] = useState(initial.content || emptyProductContent());
  const [generating, setGenerating] = useState(false);
  const setF = (f, val) => setC(x => ({ ...x, [f]: val }));
  const setLink = (plat, val) => setC(x => ({ ...x, links: { ...x.links, [plat]: val } }));

  const generate = async () => {
    if (!name.trim()) { onToast?.({ kind: "scheduled", title: "ใส่ชื่อสินค้าก่อน" }); return; }
    setGenerating(true);
    try {
      const r = window.API && window.API.isLive()
        ? await window.API.generateContent(name.trim())
        : { title: `รีวิว${name.trim()} ใช้ดีไหม?`, caption: `ตัวช่วยดีๆ ที่คุณอาจไม่เคยรู้จัก ลองดูคลิปนี้เลย 🔥`, hashtags: "#รีวิว #ของน่าซื้อ #ของมันต้องมี" };
      setC(x => ({ ...x, title: r.title || x.title, caption: r.caption || x.caption, hashtags: r.hashtags || x.hashtags }));
      onToast?.({ kind: "publishing", title: "สร้างเนื้อหาด้วย AI แล้ว ✓" });
    } catch (e) { onToast?.({ kind: "scheduled", title: "สร้างเนื้อหาไม่สำเร็จ", desc: e.message }); }
    finally { setGenerating(false); }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Btn variant="ghost" icon="chevL" onClick={onCancel}>กลับ</Btn>
        <h2 className="section-title" style={{ marginLeft: 4 }}>{initial.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
      </div>

      {/* เนื้อหาหลัก (ใช้ทุกแพลตฟอร์ม) */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 10px", gap: 10 }}>
          <div className="nav-label" style={{ padding: 0 }}>ข้อมูลสินค้า + เนื้อหาหลัก</div>
          <Btn size="sm" variant="ghost" icon="bolt" disabled={generating} onClick={generate}>
            {generating ? "กำลังสร้าง..." : "สร้างด้วย AI"}
          </Btn>
        </div>
        <div className="field">
          <label><Icon name="cart" size={14} />ชื่อสินค้า <span className="opt" style={{ color: "var(--err)" }}>* จำเป็น</span></label>
          <input className="input" value={name} placeholder="เช่น เครื่องตัดแต่งพุ่มไม้ไร้สาย" onChange={e => setName(e.target.value)} />
          <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>ใช้ชื่อสินค้านี้เป็น keyword หลักในการสร้างชื่อวิดีโอ/แคปชั่น/แฮชแท็ก</div>
        </div>
        <div className="field">
          <label><Icon name="edit" size={14} />ชื่อวิดีโอ / Title <span className="opt">(ใช้กับ YouTube)</span></label>
          <input className="input" value={c.title} maxLength={100} placeholder="ชื่อหัวข้อวิดีโอ..." onChange={e => setF("title", e.target.value)} />
        </div>
        <div className="field">
          <label><Icon name="edit" size={14} />แคปชั่น / คำบรรยาย</label>
          <textarea className="textarea" rows={3} value={c.caption} placeholder="เขียนแคปชั่นหลักของสินค้า..." onChange={e => setF("caption", e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label><Icon name="hash" size={14} />แฮชแท็ก</label>
          <input className="input" value={c.hashtags} placeholder="#รีวิว #ของดี" onChange={e => setF("hashtags", e.target.value)} />
        </div>
      </div>

      {/* ลิงก์ affiliate แยกตามแพลตฟอร์ม */}
      <div className="card card-pad">
        <div className="nav-label" style={{ padding: "0 0 10px" }}>ลิงก์ Affiliate (แยกแต่ละแพลตฟอร์ม)</div>
        <div className="grid" style={{ gap: 10 }}>
          {PLATFORM_LIST.map(id => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PlatformBadge id={id} size="sm" />
              <span style={{ fontWeight: 700, fontSize: 13, width: 70, flex: "none" }}>{PLATFORMS[id].short}</span>
              <input className="input link" style={{ flex: 1 }} value={c.links?.[id] || ""}
                placeholder={`ลิงก์สำหรับ ${PLATFORMS[id].short}...`}
                onChange={e => setLink(id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>ยกเลิก</Btn>
        <Btn variant="primary" icon="check" onClick={() => onSave({ ...initial, name, affiliate_link: c.links?.shopee || c.links?.tiktok || "", content: c })}>บันทึกสินค้า</Btn>
      </div>
    </div>
  );
}

window.ProductsScreen = ProductsScreen;
