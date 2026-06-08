/* ============================================================
   VideoUp — Billing / subscription management screen
   ============================================================ */
function Billing({ currentPlan, onChangePlan, onToast }) {
  const plan = PLAN(currentPlan);
  const [autoRenew, setAutoRenew] = useState(SUBSCRIPTION.autoRenew);

  const meters = [
    { icon: "film", label: "คลิปอัปโหลดเดือนนี้", used: USAGE.clipsUsed, max: plan.limits.clips, unit: "คลิป", color: "var(--brand)" },
    { icon: "link", label: "แพลตฟอร์มที่เชื่อม", used: USAGE.platformsConnected, max: plan.limits.platforms, unit: "", color: "var(--info)" },
    { icon: "drive", label: "พื้นที่ Drive (รวมในแพ็กเกจ)", used: USAGE.storeUsedGB, max: plan.limits.store, unit: "GB", color: "var(--warn)" },
    { icon: "grid", label: "ผู้ใช้ในทีม", used: USAGE.seatsUsed, max: plan.limits.seats, unit: "คน", color: "var(--brand-2)" },
  ];

  return (
    <div className="grid" style={{ gap: 22, maxWidth: 1120 }}>
      <div className="bill-grid">
        {/* left: current plan + usage */}
        <div className="grid" style={{ gap: 18 }}>
          <div className="plan-banner">
            <div style={{ display: "flex", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .9, letterSpacing: ".04em", textTransform: "uppercase" }}>แพ็กเกจปัจจุบัน</div>
                <div className="pb-name">{plan.name}</div>
                <div className="pb-price">{plan.price === 0 ? "ฟรีตลอดชีพ" : `฿${plan.price.toLocaleString()} / เดือน · ต่ออายุ ${SUBSCRIPTION.renewAt}`}</div>
              </div>
              <span className="badge" style={{ marginLeft: "auto", background: "rgba(255,255,255,.2)", color: "#fff" }}>
                <span className="dot" style={{ background: "#fff" }} />ใช้งานอยู่
              </span>
            </div>
            <div className="pb-meta">
              <div className="m"><div className="v">{plan.limits.clips}</div><div className="k">คลิป/เดือน</div></div>
              <div className="m"><div className="v">{plan.limits.platforms}</div><div className="k">แพลตฟอร์ม</div></div>
              <div className="m"><div className="v">{plan.limits.schedule}</div><div className="k">ตั้งเวลา</div></div>
              <div className="m"><div className="v">{plan.limits.seats}</div><div className="k">ผู้ใช้</div></div>
            </div>
          </div>

          {/* usage */}
          <div className="usage-card">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <h2 className="section-title">การใช้งานรอบบิลนี้</h2>
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600 }}>รีเซ็ต {SUBSCRIPTION.renewAt}</span>
            </div>
            {meters.map((m, i) => {
              const unlimited = typeof m.max !== "number";
              const pct = unlimited ? 18 : Math.min(100, (m.used / m.max) * 100);
              const near = !unlimited && pct >= 80;
              return (
                <div key={i} className="usage-row">
                  <div className="ut">
                    <Icon name={m.icon} size={15} style={{ color: m.color }} />{m.label}
                    <span className="uv">{m.used}{unlimited ? "" : ` / ${m.max}`} {m.unit}{unlimited ? " · ไม่จำกัด" : ""}</span>
                  </div>
                  <Bar value={pct} max={100} color={near ? "var(--err)" : m.color} />
                  {near && <div style={{ fontSize: 12, color: "var(--err)", fontWeight: 600, marginTop: 5 }}>ใกล้เต็มโควต้า — อัปเกรดเพื่อเพิ่ม</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* right: payment + actions */}
        <div className="grid" style={{ gap: 18 }}>
          <div className="card card-pad">
            <h2 className="section-title" style={{ marginBottom: 14 }}>วิธีชำระเงิน</h2>
            <div className="pay-card">
              <div className="pc-logo">VISA</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>•••• •••• •••• {SUBSCRIPTION.card.last4}</div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>หมดอายุ {SUBSCRIPTION.card.exp}</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => onToast({ kind: "scheduled", title: "เปลี่ยนบัตร", desc: "เปิดฟอร์มแก้ไขวิธีชำระเงิน" })}>เปลี่ยน</Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 0 4px", borderTop: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>ต่ออายุอัตโนมัติ</div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{autoRenew ? `ต่อรอบถัดไป ${SUBSCRIPTION.renewAt}` : "จะหยุดเมื่อจบรอบบิล"}</div>
              </div>
              <button onClick={() => { setAutoRenew(!autoRenew); onToast({ kind: "scheduled", title: autoRenew ? "ปิดต่ออายุอัตโนมัติ" : "เปิดต่ออายุอัตโนมัติ", desc: plan.name }); }}
                style={{ width: 46, height: 27, borderRadius: 99, border: "none", padding: 3, background: autoRenew ? "var(--brand)" : "var(--border-2)", transition: "background .2s", cursor: "pointer" }}>
                <span style={{ display: "block", width: 21, height: 21, borderRadius: 99, background: "#fff", transform: autoRenew ? "translateX(19px)" : "none", transition: "transform .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div className="ico" style={{ width: 36, height: 36, borderRadius: 11, background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center" }}>
                <Icon name="rocket" size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>อยากปลดล็อกเพิ่ม?</div>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>เลื่อนดูและสลับแพ็กเกจด้านล่าง</div>
              </div>
            </div>
            {currentPlan !== "business" && (
              <Btn variant="primary" icon="trend" style={{ width: "100%", marginTop: 14, justifyContent: "center" }}
                onClick={() => onChangePlan(currentPlan === "free" ? "pro" : "business")}>
                อัปเกรดเป็น {currentPlan === "free" ? "Pro" : "Business"}
              </Btn>
            )}
            <button className="btn ghost sm" style={{ width: "100%", marginTop: 8, justifyContent: "center", color: "var(--text-mute)" }}
              onClick={() => onToast({ kind: "scheduled", title: "ยกเลิกแพ็กเกจ", desc: "ใช้งานได้ถึงสิ้นรอบบิลปัจจุบัน" })}>
              ยกเลิกแพ็กเกจ
            </button>
          </div>
        </div>
      </div>

      {/* plan switcher */}
      <div>
        <h2 className="section-title" style={{ marginBottom: 14 }}>เปลี่ยนแพ็กเกจ</h2>
        <div className="price-grid">
          {PLANS.map(p => {
            const isCurrent = p.id === currentPlan;
            const order = { free: 0, pro: 1, business: 2 };
            const isUpgrade = order[p.id] > order[currentPlan];
            return (
              <div key={p.id} className={`price-card ${p.popular ? "pop" : ""}`}>
                {p.popular && <span className="ptag">⭐ ยอดนิยม</span>}
                <div className="pname" style={{ color: p.accent }}>{p.name}</div>
                <div className="ptagline">{p.tagline}</div>
                <div className="price-amt">
                  {p.price === 0 ? <span className="n">ฟรี</span>
                    : <><span className="cur">฿</span><span className="n">{p.price.toLocaleString()}</span><span className="per">/เดือน</span></>}
                </div>
                <ul className="price-feats">
                  {p.features.slice(0, 5).map((f, i) => (
                    <li key={i} className="yes"><span className="fi"><Icon name="check" size={12} /></span>{f}</li>
                  ))}
                </ul>
                <Btn variant={isCurrent ? "subtle" : isUpgrade ? "primary" : "ghost"} disabled={isCurrent}
                  onClick={() => onChangePlan(p.id)} style={{ width: "100%", justifyContent: "center" }}>
                  {isCurrent ? "แพ็กเกจปัจจุบัน" : isUpgrade ? "อัปเกรด" : "ดาวน์เกรด"}
                </Btn>
              </div>
            );
          })}
        </div>
      </div>

      {/* invoices */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "18px 18px 12px" }}>
          <h2 className="section-title">ประวัติการชำระเงิน</h2>
          <Btn size="sm" variant="ghost" icon="upload" style={{ marginLeft: "auto" }}
            onClick={() => onToast({ kind: "scheduled", title: "ดาวน์โหลดใบเสร็จ", desc: "ส่งออกทั้งหมดเป็น PDF" })}>ส่งออก</Btn>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="inv-table">
            <thead>
              <tr>
                <th>เลขที่</th><th>วันที่</th><th className="hide-sm">แพ็กเกจ</th><th>ยอด</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map(inv => (
                <tr key={inv.id}>
                  <td className="inv-id">{inv.id}</td>
                  <td>{inv.date}</td>
                  <td className="hide-sm muted">{inv.plan}</td>
                  <td style={{ fontWeight: 700 }}>฿{inv.amount.toLocaleString()}</td>
                  <td><span className="badge ok"><Icon name="check" size={11} />ชำระแล้ว</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn icon ghost" onClick={() => onToast({ kind: "scheduled", title: "ใบเสร็จ " + inv.id, desc: `฿${inv.amount} · ${inv.date}` })}>
                      <Icon name="upload" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Billing });
