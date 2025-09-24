import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------------- SignaturePad (no external libs) ---------------- */
function SignaturePad({ height = 120, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    // crisp line
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // scale for HiDPI
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = cvs.clientWidth * ratio;
    const h = cvs.clientHeight * ratio;
    cvs.width = w; cvs.height = h;
    ctx.scale(ratio, ratio);
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches?.length) e = e.touches[0];
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => { drawing.current = true; const {x,y}=pos(e); const ctx=canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(x,y); setEmpty(false); };
  const move  = (e) => { if(!drawing.current) return; const {x,y}=pos(e); const ctx=canvasRef.current.getContext("2d"); ctx.lineTo(x,y); ctx.stroke(); e.preventDefault(); };
  const end   = () => { drawing.current = false; if(onChange){ onChange(canvasRef.current.toDataURL("image/png")); } };

  const clear = () => {
    const cvs = canvasRef.current, ctx = cvs.getContext("2d");
    ctx.clearRect(0,0,cvs.width, cvs.height);
    setEmpty(true);
    onChange && onChange(null);
  };

  return (
    <div className="sig-wrap">
      <canvas
        ref={canvasRef}
        className="sig-canvas"
        style={{ height: `${height}px`, width: "100%" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="sig-tools no-print">
        <button type="button" className="btn ghost" onClick={clear} disabled={empty}>Clear</button>
        <span className="sig-hint">ลงนาม / Sign here</span>
      </div>
    </div>
  );
}

/** ---------------- Main form ---------------- */
export default function CleanRoomFullForm() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const [sn, setSn] = useState("");

  useEffect(() => setSn(qs.get("SN") || qs.get("sn") || ""), [qs]);

  // photo
  const [photoUrl, setPhotoUrl] = useState("");
  const photoRef = useRef(null);
  const onPickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return setPhotoUrl("");
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
  };
  const clearPhoto = () => { setPhotoUrl(""); if (photoRef.current) photoRef.current.value = ""; };

  // radios
  const [hasMSDS, setHasMSDS] = useState(null);
  const [needInform, setNeedInform] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [qaMgrApprove, setQaMgrApprove] = useState(null);

  // related sections
  const relatedList = ["MFG1","MFG2","ENG1","ENG2","QA","QE","QEV","MCA","POS"];
  const [related, setRelated] = useState(Object.fromEntries(relatedList.map(k=>[k,false])));

  return (
    <div className="page">
      <style>{css}</style>

      <div className="company-line">NBK Spring (Thailand) Co.,Ltd : DDS Division</div>

      <table className="form">
        <colgroup>
          <col style={{width:"22%"}}/><col style={{width:"28%"}}/>
          <col style={{width:"22%"}}/><col style={{width:"28%"}}/>
        </colgroup>
        <tbody>
          {/* Title */}
          <tr><td className="title" colSpan={4}>Import part to Clean room Notification</td></tr>

          {/* Issue date / DocNo */}
          <tr>
            <td className="label">วันที่ (Issue date):</td>
            <td><input className="inp" type="date"/></td>
            <td className="label">Document No. :</td>
            <td><input className="inp" type="text"/></td>
          </tr>

          {/* Part + Photo block */}
          <tr>
            <td className="label">ชื่อชิ้นงาน (Part name):</td>
            <td><input className="inp" type="text"/></td>
            <td className="label">รูปถ่ายประกอบ (Photo):</td>
            <td rowSpan={3} className="photoBox">
              <div className="photo-area">
                {photoUrl ? <img alt="photo" src={photoUrl}/> : <div className="photo-hint">Insert here</div>}
              </div>
              <div className="no-print photo-tools">
                <input ref={photoRef} type="file" accept="image/*" onChange={onPickPhoto}/>
                {photoUrl && <button type="button" className="btn ghost" onClick={clearPhoto}>Clear</button>}
              </div>
            </td>
          </tr>
          <tr>
            <td className="label">รายละเอียดของชิ้นส่วน/ชิ้นงาน (Part details):</td>
            <td colSpan={2}><textarea className="ta"/></td>
          </tr>
          <tr>
            <td className="label">เหตุผลที่ต้องใช้ (Reason details):</td>
            <td colSpan={2}><textarea className="ta"/></td>
          </tr>

          <tr>
            <td className="label">ระบุพื้นที่ใช้งานใน Clean room (Location details):</td>
            <td colSpan={3}><input className="inp" type="text"/></td>
          </tr>

          {/* Import date + MSDS + Need inform */}
          <tr>
            <td className="label">ระบุวันที่นำเข้า (Import date):</td>
            <td><input className="inp" type="date"/></td>
            <td className="label center">แนบเอกสารผลทดสอบ (MSDS/LAB)</td>
            <td className="noPad">
              <div className="rowInline">
                <label className="ck"><input type="radio" name="msds" checked={hasMSDS===true} onChange={()=>setHasMSDS(true)}/> ใช่ (Yes)</label>
                <label className="ck"><input type="radio" name="msds" checked={hasMSDS===false} onChange={()=>setHasMSDS(false)}/> ไม่ใช่ (No)</label>
                <div className="needInformLabel">Need to inform customer for approval</div>
                <label className="ck"><input type="radio" name="inform" checked={needInform===true} onChange={()=>setNeedInform(true)}/> ใช่</label>
                <label className="ck"><input type="radio" name="inform" checked={needInform===false} onChange={()=>setNeedInform(false)}/> ไม่ใช่</label>
              </div>
            </td>
          </tr>

          {/* Request Section */}
          <tr><td className="sectionTitle" colSpan={4}>สภาพที่ร้องขอ (Request Section)</td></tr>
          <tr>
            <td className="headCell center">Requester</td>
            <td className="headCell center">Chief</td>
            <td className="headCell center">MGR</td>
            <td className="headCell rightPad">Comment :</td>
          </tr>
          <tr>
            <td className="signCell"><SignaturePad onChange={()=>{}}/></td>
            <td className="signCell"><SignaturePad onChange={()=>{}}/></td>
            <td className="signCell"><SignaturePad onChange={()=>{}}/></td>
            <td className="signCell"><textarea className="ta" style={{height:118}}/></td>
          </tr>

          {/* Related section */}
          <tr><td className="sectionTitle" colSpan={4}>เฉพาะแผนกที่เกี่ยวข้องร่วมพิจารณา (For related section by identify.)</td></tr>
          <tr>
            <td colSpan={4} className="relWrap">
              {relatedList.map(k=>(
                <label key={k} className="relItem">
                  <input type="checkbox" checked={related[k]} onChange={()=>setRelated(s=>({...s,[k]:!s[k]}))}/> <span>{k}</span>
                </label>
              ))}
            </td>
          </tr>
          <tr>
            <td className="label">Section MGR</td>
            <td colSpan={3} className="signCell"><SignaturePad onChange={()=>{}}/></td>
          </tr>

          {/* QA Section */}
          <tr><td className="sectionTitle" colSpan={4}>สำหรับแผนกประกันคุณภาพ (For QA Section)</td></tr>
          <tr>
            <td className="label">ประเมินผลการตรวจสอบ (Evaluation result)</td>
            <td className="center">
              <div className="evalBox">
                <label className="ck"><input type="radio" name="eval" checked={evalResult==='pass'} onChange={()=>setEvalResult('pass')}/> ผ่าน (Pass)</label>
                <label className="ck"><input type="radio" name="eval" checked={evalResult==='notpass'} onChange={()=>setEvalResult('notpass')}/> ไม่ผ่าน (Not Pass)</label>
              </div>
            </td>
            <td className="label center">วันที่รับเอกสาร (Received date)</td>
            <td><input className="inp" type="date"/></td>
          </tr>
          <tr>
            <td className="label center">QA Staff</td>
            <td className="signCell"><SignaturePad onChange={()=>{}}/></td>
            <td className="label center">QA Chief</td>
            <td className="signCell"><SignaturePad onChange={()=>{}}/></td>
          </tr>
          <tr>
            <td className="label">หมายเหตุ (Remark)</td>
            <td colSpan={3}><textarea className="ta tall"/></td>
          </tr>

          {/* QA MGR Approval */}
          <tr><td className="sectionTitle" colSpan={4}>การอนุมัติเพื่อนำของเข้า Clean room</td></tr>
          <tr>
            <td className="label">QA MGR</td>
            <td>
              <label className="ck"><input type="radio" name="qaMgr" checked={qaMgrApprove===true} onChange={()=>setQaMgrApprove(true)}/> อนุมัติ (Approved)</label>
              <label className="ck"><input type="radio" name="qaMgr" checked={qaMgrApprove===false} onChange={()=>setQaMgrApprove(false)}/> ไม่อนุมัติ (Unapproved)</label>
            </td>
            <td className="label">Comment :</td>
            <td><input className="inp" type="text"/></td>
          </tr>
          <tr>
            <td className="label">Approval sign</td>
            <td colSpan={3} className="signCell"><SignaturePad height={140} onChange={()=>{}}/></td>
          </tr>

          {/* Footer */}
          <tr><td colSpan={4} className="footer">SN: {sn || "-"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- CSS (print-friendly; A4; table precise) ---------------- */
const css = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; font-family: "Segoe UI","TH Sarabun New", Arial, sans-serif; }
.page { background:#f5f6f8; min-height:100vh; padding:18px; }
.company-line { font-size:12px; margin:0 auto 6px; width:210mm; }
.form { width:210mm; margin:0 auto; border-collapse:collapse; table-layout:fixed; background:#fff; border:1px solid #000; }
.form td { border:1px solid #000; padding:6px; font-size:13px; vertical-align:top; }
.title { text-align:center; font-weight:800; font-size:16px; padding:8px 6px; }
.label { font-weight:700; background:#f8f8f8; }
.center { text-align:center; }
.rightPad { padding-right:10px; }
.noPad { padding:4px 6px; }

.inp { width:100%; border:1px solid #000; padding:4px 6px; height:28px; }
.ta { width:100%; min-height:68px; border:1px solid #000; padding:6px; resize:vertical; }
.ta.tall { min-height:110px; }

.photoBox { vertical-align:top; padding:6px; }
.photo-area { width:100%; height:88mm; border:1px dashed #000; display:flex; align-items:center; justify-content:center; background:#fbfbfb; }
.photo-area img { max-width:100%; max-height:100%; object-fit:contain; }
.photo-hint { color:#6a6a6a; font-style:italic; }
.photo-tools { margin-top:6px; display:flex; gap:8px; align-items:center; }

.sectionTitle { background:#eee; font-weight:800; text-align:left; padding:6px 8px; }
.headCell { font-weight:700; background:#fafafa; text-align:center; }
.signCell { padding:0 6px; }
.sig-wrap { border:1px solid #000; height:120px; position:relative; background:#fff; }
.sig-canvas { display:block; width:100%; height:100%; cursor: crosshair; }
.sig-tools { display:flex; gap:8px; align-items:center; padding:4px 0; }
.sig-hint { color:#666; font-size:12px; }
.btn { appearance:none; padding:6px 10px; border:1px solid #cbd2da; border-radius:6px; background:#fff; cursor:pointer; font-weight:600; }
.btn:hover { background:#f3f5f7; }
.btn.ghost { background:transparent; }
.evalBox { display:flex; gap:16px; justify-content:center; }
.ck { display:inline-flex; align-items:center; gap:6px; margin-right:10px; }

.relWrap { padding:8px 10px; }
.relItem { margin-right:18px; font-weight:700; display:inline-flex; gap:6px; align-items:center; }

.needInformLabel { margin-left:18px; margin-right:6px; }

.footer { font-size:11px; text-align:right; padding:4px 8px; }

@media print {
  body { background:#fff; }
  .page { padding:0; }
  .company-line { width:auto; margin:0 0 2mm 10mm; }
  .form { width:auto; margin:0 10mm; border:1px solid #000; }
  .no-print { display:none !important; }
}
`;
