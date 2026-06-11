/* ============================================================
   VideoUp — Landing + Pricing screen
   ============================================================ */
function Landing({ currentPlan, onSelectPlan, onGetStarted }) {
  const [cycle, setCycle] = useState("monthly"); // monthly | yearly
  const [openFaq, setOpenFaq] = useState(0);
  const yearly = cycle === "yearly";
  const priceOf = (p) => yearly ? Math.round(p.price * 10) : p.price; // 2 เดือนฟรี

  return (
    <div className="landing">
      {/* HERO */}
      <div className="land-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="land-eyebrow"><Icon name="bolt" size={14} />อัปคลิปเดียว ขึ้นครบทุกแพลตฟอร์ม</span>
          <h1 className="land-h1">ปล่อยคลิปขาย<br /><span className="hl">ทุกแพลตฟอร์ม</span> ในคลิกเดียว</h1>
          <p className="land-lead">
            VideoUp ช่วยนักขายและสาย affiliate อัปวิดีโอสั้นขึ้น TikTok, YouTube Shorts, Shopee และ Lazada
            พร้อมแคปชั่นและลิงก์ขายแยกแต่ละแพลตฟอร์ม ตั้งเวลาล่วงหน้าได้ ระบบโพสต์ให้อัตโนมัติบนคลาวด์
          </p>
          <div className="land-cta-row">
            <Btn variant="primary" icon="rocket" onClick={onGetStarted}>เริ่มใช้ฟรี</Btn>
            <Btn variant="ghost" icon="eye" onClick={() => document.querySelector(".price-grid")?.scrollIntoView({ behavior: "smooth", block: "center" })}>ดูแพ็กเกจ</Btn>
          </div>
          <div className="land-trust">
            <div className="av">
              {COVERS.slice(0, 4).map((c, i) => <span key={i} style={{ background: c }} />)}
            </div>
            นักขายกว่า <b style={{ color: "var(--text)" }}>2,400+</b> ร้านใช้งานอยู่
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div className="thumb" style={{ width: 40, height: 52, borderRadius: 9, overflow: "hidden" }}><VideoThumb vid="v1" showPlay={false} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>รีวิวหูฟัง TWS เบสแน่น</div>
                <div className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>ตั้งเวลา · วันนี้ 19:00 น.</div>
              </div>
              <PlatformStack ids={PLATFORM_LIST} />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--ok)" }}>
                <Icon name="check" size={14} />โพสต์สำเร็จ 4/4 แพลตฟอร์ม
              </div>
            </div>
            <div className="hero-mini-stat">
              <div className="hero-mini"><div className="n">38</div><div className="l">คลิปเดือนนี้</div></div>
              <div className="hero-mini"><div className="n" style={{ color: "var(--brand)" }}>11</div><div className="l">คิวรอโพสต์</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div className="land-section">
        <div className="land-sec-head">
          <h2>ทุกอย่างที่นักขายคลิปต้องใช้</h2>
          <p>เลิกอัปทีละแพลตฟอร์ม เลิกก๊อปลิงก์วางทีละอัน รวมงานทั้งหมดไว้ในที่เดียว</p>
        </div>
        <div className="feat-grid">
          {LANDING_FEATURES.map((f, i) => (
            <div key={i} className="feat">
              <div className="fico"><Icon name={f.icon} size={21} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="land-section">
        <div className="land-sec-head">
          <h2>เริ่มได้ใน 3 ขั้นตอน</h2>
          <p>ไม่ต้องเขียนโค้ด ไม่ต้องเฝ้าหน้าจอ</p>
        </div>
        <div className="steps-row">
          {LANDING_STEPS.map((s) => (
            <div key={s.n} className="lstep">
              <div className="sb">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div className="land-section" id="pricing">
        <div className="land-sec-head">
          <h2>แพ็กเกจที่คุ้มกับยอดขาย</h2>
          <p>เริ่มฟรี อัปเกรดเมื่อพร้อม ยกเลิกได้ทุกเมื่อ</p>
        </div>
        <div className="bill-toggle">
          <div className="seg">
            <button className={!yearly ? "on" : ""} onClick={() => setCycle("monthly")}>รายเดือน</button>
            <button className={yearly ? "on" : ""} onClick={() => setCycle("yearly")}>รายปี</button>
          </div>
          <span className="badge ok"><span className="dot" />ประหยัด 2 เดือน</span>
        </div>
        <div className="price-grid">
          {PLANS.map(p => {
            const isCurrent = p.id === currentPlan;
            return (
              <div key={p.id} className={`price-card ${p.popular ? "pop" : ""}`}>
                {p.popular && <span className="ptag">⭐ ยอดนิยม</span>}
                <div className="pname" style={{ color: p.accent }}>{p.name}</div>
                <div className="ptagline">{p.tagline}</div>
                <div className="price-amt">
                  {p.price === 0
                    ? <span className="n">ฟรี</span>
                    : <><span className="cur">฿</span><span className="n">{priceOf(p).toLocaleString()}</span><span className="per">/{yearly ? "ปี" : "เดือน"}</span></>}
                </div>
                {p.price > 0 && <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{yearly ? `เฉลี่ย ฿${Math.round(priceOf(p) / 12).toLocaleString()}/เดือน` : "ยกเลิกได้ทุกเมื่อ"}</div>}
                <ul className="price-feats">
                  {p.features.map((f, i) => (
                    <li key={i} className="yes"><span className="fi"><Icon name="check" size={12} /></span>{f}</li>
                  ))}
                  {p.notIncluded.map((f, i) => (
                    <li key={"n" + i} className="no"><span className="fi"><Icon name="x" size={11} /></span>{f}</li>
                  ))}
                </ul>
                <Btn variant={p.popular ? "primary" : "ghost"} disabled={isCurrent}
                  onClick={() => onSelectPlan(p.id)} style={{ width: "100%", justifyContent: "center" }}>
                  {isCurrent ? "แพ็กเกจปัจจุบัน" : p.cta}
                </Btn>
                {isCurrent && <div className="price-current"><Icon name="check" size={12} style={{ verticalAlign: "-2px" }} /> กำลังใช้อยู่</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="land-section">
        <div className="land-sec-head"><h2>คำถามที่พบบ่อย</h2></div>
        <div className="faq-list">
          {FAQ.map((f, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                {f.q}<span className="fq-ico"><Icon name="plus" size={18} /></span>
              </button>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="land-final">
        <h2>พร้อมปล่อยคลิปให้ขายเองหรือยัง?</h2>
        <p>เริ่มฟรีวันนี้ ไม่ต้องใช้บัตรเครดิต</p>
        <Btn variant="primary" icon="rocket" onClick={onGetStarted}>เริ่มใช้ VideoUp ฟรี</Btn>
      </div>
      <div className="land-footer">VideoUp · ระบบจัดการอัปโหลดวิดีโอหลายแพลตฟอร์ม · รองรับ Google Drive · Dropbox · OneDrive</div>
    </div>
  );
}

Object.assign(window, { Landing });
