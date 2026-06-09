/* ============================================================
   VideoUp — Products screen (จัดการสินค้า + เนื้อหาต่อแพลตฟอร์ม)
   เลือกตอนสร้างโพสต์ → เติมเนื้อหาอัตโนมัติ (แก้ไขต่อได้)
   ============================================================ */
const PROD_FIELDS = {
  youtube:  { title: true,  caption: "คำอธิบาย", hashtags: true,  link: true },
  tiktok:   { caption: "แคปชั่น", hashtags: true,  link: true },
  facebook: { caption: "แคปชั่น", hashtags: true,  link: true },
  shopee:   { caption: "คำบรรยายสินค้า", hashtags: false, link: true },
  lazada:   { caption: "คำบรรยายสินค้า", hashtags: false, link: true },
};
const blankContent = () => {
  const c = {};
  PLATFORM_LIST.forEach(k => c[k] = { title: "", caption: "", hashtags: "", link: "" });
  return c;
};

// mock สำหรับ demo mode
const MOCK_PRODUCTS = [
  { id: "p1", name: "เครื่องตัดแต่งพุ่มไม้ไร้สาย", affiliate_link: "https://s.shopee.co.th/demo1",
    content: { ...blankContent(),
      youtube: { title: "รีวิวเครื่องตัดแต่งพุ่มไม้ไร้สาย ใช้ดีไหม?", caption: "ตัวช่วยแต่งสวนให้สวย", hashtags: "#Shorts #รีวิว #ของน่าซื้อ", link: "" },
      tiktok:  { title: "", caption: "ของดีบอกต่อ ตัดแต่งพุ่มง่ายมาก 🔥", hashtags: "#รีวิวของดี #ของมันต้องมี", link: "" } } },
];

function ProductsScreen({ onToast }) {
  const live = window.API && window.API.isLive();
  const [rows, setRows] = useState(live ? [] : MOCK_PRODUCTS);
  const [editing, setEditing] = useState(null); // product object หรือ {} (ใหม่)
  const [loading, setLoading] = useState(live);

  const load = async () => {
    if (!live) return;
    setLoading(true);
    try { setRows(await window.API.listProducts() || []); }
    catch (e) { onToast?.({ kind: "scheduled", title: "โหลดสินค้าไม่สำเร็จ", desc: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing({ name: "", affiliate_link: "", content: blankContent() });
  const startEdit = (p) => setEditing({ ...p, content: { ...blankContent(), ...(p.content || {}) } });

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

  if (editing) return <ProductEditor initial={editing} onSave={save} onCancel={() => setEditing(null)} />;

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="section-title">สินค้าของฉัน</h2>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>เก็บเนื้อหาแต่ละแพลตฟอร์มไว้ใช้ซ้ำตอนสร้างโพสต์</div>
        </div>
        <Btn variant="primary" icon="plus" style={{ marginLeft: "auto" }} onClick={startNew}>เพิ่มสินค้า</Btn>
      </div>

      {loading ? (
        <div className="muted" style={{ padding: 40, textAlign: "center", fontWeight: 600 }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="card card-pad" style={{ padding: 40, textAlign: "center" }}>
          <Icon name="cart" size={30} style={{ opacity: .4, marginBottom: 10 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>ยังไม่มีสินค้า</div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>เพิ่มสินค้าแล้วเขียนเนื้อหาแต่ละแพลตฟอร์มไว้ล่วงหน้า</div>
          <Btn variant="primary" icon="plus" onClick={startNew}>เพิ่มสินค้าชิ้นแรก</Btn>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {rows.map(p => {
            const filled = PLATFORM_LIST.filter(k => p.content?.[k] && (p.content[k].caption || p.content[k].title || p.content[k].hashtags));
            return (
              <div key={p.id} className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center", flex: "none" }}>
                  <Icon name="cart" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    {filled.length > 0
                      ? <><span>เนื้อหา:</span><PlatformStack ids={filled} /></>
                      : <span>ยังไม่มีเนื้อหา</span>}
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

function ProductEditor({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || "");
  const [link, setLink] = useState(initial.affiliate_link || "");
  const [content, setContent] = useState(initial.content || blankContent());
  const [tab, setTab] = useState("youtube");
  const cur = content[tab] || { title: "", caption: "", hashtags: "", link: "" };
  const F = PROD_FIELDS[tab];
  const setField = (f, val) => setContent(c => ({ ...c, [tab]: { ...c[tab], [f]: val } }));

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Btn variant="ghost" icon="chevL" onClick={onCancel}>กลับ</Btn>
        <h2 className="section-title" style={{ marginLeft: 4 }}>{initial.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="field">
          <label><Icon name="cart" size={14} />ชื่อสินค้า <span className="opt" style={{ color: "var(--err)" }}>* จำเป็น</span></label>
          <input className="input" value={name} placeholder="เช่น เครื่องตัดแต่งพุ่มไม้ไร้สาย" onChange={e => setName(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label><Icon name="link" size={14} />ลิงก์ Affiliate หลัก <span className="opt">(ใช้เป็นค่าเริ่มต้นทุกแพลตฟอร์ม)</span></label>
          <input className="input link" value={link} placeholder="https://s.shopee.co.th/xxxx" onChange={e => setLink(e.target.value)} />
        </div>
      </div>

      <div className="card card-pad">
        <div className="nav-label" style={{ padding: "0 0 10px" }}>เนื้อหาแต่ละแพลตฟอร์ม</div>
        <div className="plat-tabs" style={{ marginBottom: 14 }}>
          {PLATFORM_LIST.map(id => (
            <button key={id} className={`plat-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}
              style={tab === id ? { borderBottomColor: PLATFORMS[id].color } : {}}>
              <PlatformBadge id={id} size="sm" />{PLATFORMS[id].short}
            </button>
          ))}
        </div>

        {F.title && (
          <div className="field">
            <label><Icon name="edit" size={14} />ชื่อวิดีโอ (Title) <span className="opt">({PLATFORMS[tab].short})</span></label>
            <input className="input" value={cur.title} maxLength={100} placeholder="ชื่อวิดีโอบน YouTube..." onChange={e => setField("title", e.target.value)} />
          </div>
        )}
        <div className="field">
          <label><Icon name="edit" size={14} />{F.caption}</label>
          <textarea className="textarea" rows={3} value={cur.caption} placeholder={`${F.caption}สำหรับ ${PLATFORMS[tab].short}...`} onChange={e => setField("caption", e.target.value)} />
        </div>
        {F.hashtags && (
          <div className="field">
            <label><Icon name="hash" size={14} />แฮชแท็ก</label>
            <input className="input" value={cur.hashtags} placeholder="#รีวิว #ของดี" onChange={e => setField("hashtags", e.target.value)} />
          </div>
        )}
        {F.link && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label><Icon name="link" size={14} />ลิงก์เฉพาะแพลตฟอร์มนี้ <span className="opt">(เว้นว่าง = ใช้ลิงก์หลัก)</span></label>
            <input className="input link" value={cur.link} placeholder={link || "https://..."} onChange={e => setField("link", e.target.value)} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>ยกเลิก</Btn>
        <Btn variant="primary" icon="check" onClick={() => onSave({ ...initial, name, affiliate_link: link, content })}>บันทึกสินค้า</Btn>
      </div>
    </div>
  );
}

window.ProductsScreen = ProductsScreen;
