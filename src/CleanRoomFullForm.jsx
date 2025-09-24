import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, ensureAnonSignIn } from "./firebaseClient";
import {
  doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "firebase/firestore";

/* ========== Utils ========== */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
async function fileToDataURLResized(file, maxSize = 1600, quality = 0.9) {
  const dataURL = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataURL;
  });
  const w = img.width, h = img.height, scale = Math.min(1, maxSize / Math.max(w, h));
  if (scale >= 1) return dataURL;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
function throttle(fn, ms) {
  let t, last = 0;
  return (...a) => { const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
    else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...a); }, ms - (now - last)); }
  };
}

/* ========== Signature Pad (no libs) ========== */
function SignaturePad({ height = 120, onChange, value }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = cvs.clientWidth * ratio, h = cvs.clientHeight * ratio;
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext("2d");
    ctx.scale(ratio, ratio); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img,0,0,cvs.clientWidth,cvs.clientHeight); img.src = value; }
  }, [value]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const start = (e) => { drawing.current = true; const {x,y}=pos(e); const ctx = canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(x,y); e.preventDefault(); };
  const move  = (e) => { if (!drawing.current) return; const {x,y}=pos(e); const ctx = canvasRef.current.getContext("2d"); ctx.lineTo(x,y); ctx.stroke(); e.preventDefault(); };
  const end   = () => { if (!drawing.current) return; drawing.current = false; onChange?.(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const cvs = canvasRef.current, ctx = cvs.getContext("2d"); ctx.clearRect(0,0,cvs.width,cvs.height); onChange?.(null); };

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
        <button type="button" className="btn ghost" onClick={clear}>Clear</button>
        <span className="sig-hint">ลงนาม / Sign here</span>
      </div>
    </div>
  );
}

/* ========== Firestore helpers ========== */
async function getNextDocNoCloud(issueDateISO) {
  await ensureAnonSignIn();
  const ymd = (issueDateISO || todayISO()).replace(/-/g, "");
  const counterRef = doc(db, "docCounters", ymd);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const cur = snap.exists() ? (snap.data().seq || 0) : 0;
    const next = cur + 1;
    tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  return `CL-${ymd}-${String(seq).padStart(4, "0")}`;
}
async function loadById(id) {
  await ensureAnonSignIn();
  const ref = doc(db, "cleanroom", id);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
async function saveById(id, payload) {
  await ensureAnonSignIn();
  const ref = doc(db, "cleanroom", id);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

/* ========== Autosave (per keyId) ========== */
function useFormDraft(keyId, state, restore) {
  const key = keyId ? `cleanroom:draft:${keyId}` : null;

  useEffect(() => {
    if (!key) return;
    try { const raw = localStorage.getItem(key); if (raw) restore(JSON.parse(raw)); } catch {}
  }, [key, restore]);

  const save = React.useMemo(() => throttle((data) => {
    if (!key) return; try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }, 600), [key]);

  useEffect(() => { if (key) save(state); }, [state, key, save]);

  const clear = React.useCallback(() => { if (key) localStorage.removeItem(key); }, [key]);
  return { clear };
}

/* ========== Main ========== */
export default function CleanRoomFullForm() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const [pi, setPi] = useState("");
  const [sn, setSn] = useState("");
  useEffect(() => {
    setPi(qs.get("PI") || qs.get("pi") || "");
    setSn(qs.get("SN") || qs.get("sn") || "");
  }, [qs]);

  // ใช้ PI เป็นหลัก; ถ้าไม่มี PI (เช่นทดสอบลิ้งค์เอง) ค่อย fallback ไป SN
  const keyId = pi ? `PI_${pi}` : sn;

  const [issueDate, setIssueDate] = useState(() => todayISO());
  const [docNo, setDocNo]       = useState("");

  const [partName, setPartName]             = useState("");
  const [partDetails, setPartDetails]       = useState("");
  const [reasonDetails, setReasonDetails]   = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [importDate, setImportDate]         = useState("");
  const [hasMSDS, setHasMSDS]               = useState(null);
  const [needInform, setNeedInform]         = useState(null);
  const [evalResult, setEvalResult]         = useState(null);
  const [qaMgrApprove, setQaMgrApprove]     = useState(null);

  const relatedList = ["MFG1","MFG2","ENG1","ENG2","QA","QE","QEV","MCA","POS"];
  const [related, setRelated] = useState(Object.fromEntries(relatedList.map(k=>[k,false])));

  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const photoInputRef = useRef(null);
  const onPickPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) { setPhotoDataUrl(null); return; }
    const dataUrl = await fileToDataURLResized(f, 1600, 0.9); setPhotoDataUrl(dataUrl);
  };
  const clearPhoto = () => { setPhotoDataUrl(null); if (photoInputRef.current) photoInputRef.current.value = ""; };

  const [sigRequester, setSigRequester]   = useState(null);
  const [sigChief, setSigChief]           = useState(null);
  const [sigMgr, setSigMgr]               = useState(null);
  const [sigSectionMgr, setSigSectionMgr] = useState(null);
  const [sigQAStaff, setSigQAStaff]       = useState(null);
  const [sigQAChief, setSigQAChief]       = useState(null);
  const [sigQAMgr, setSigQAMgr]           = useState(null);

  const formState = {
    issueDate, docNo, partName, partDetails, reasonDetails, locationDetails, importDate,
    hasMSDS, needInform, evalResult, qaMgrApprove, related, photoDataUrl,
    sigRequester, sigChief, sigMgr, sigSectionMgr, sigQAStaff, sigQAChief, sigQAMgr,
  };

  const restore = React.useCallback((d) => {
    if (!d) return;
    setIssueDate(d.issueDate ?? todayISO()); setDocNo(d.docNo ?? "");
    setPartName(d.partName ?? ""); setPartDetails(d.partDetails ?? "");
    setReasonDetails(d.reasonDetails ?? ""); setLocationDetails(d.locationDetails ?? "");
    setImportDate(d.importDate ?? "");
    setHasMSDS(d.hasMSDS ?? null); setNeedInform(d.needInform ?? null);
    setEvalResult(d.evalResult ?? null); setQaMgrApprove(d.qaMgrApprove ?? null);
    setRelated(d.related ?? Object.fromEntries(relatedList.map(k=>[k,false])));
    setPhotoDataUrl(d.photoDataUrl ?? null);
    setSigRequester(d.sigRequester ?? null); setSigChief(d.sigChief ?? null);
    setSigMgr(d.sigMgr ?? null); setSigSectionMgr(d.sigSectionMgr ?? null);
    setSigQAStaff(d.sigQAStaff ?? null); setSigQAChief(d.sigQAChief ?? null);
    setSigQAMgr(d.sigQAMgr ?? null);
  }, []);
  useFormDraft(keyId, formState, restore);

  // initial load + migration SN -> PI (ถ้าจำเป็น)
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!keyId) return;
      await ensureAnonSignIn();

      // 1) พยายามโหลดด้วยคีย์หลัก (PI_<PI> หรือ SN)
      let data = await loadById(keyId);
      if (cancelled) return;

      // 2) ถ้าเปิดด้วย PI แล้วยังไม่เจอข้อมูล ให้ลองโหลดจาก SN แล้วคัดลอกมาเก็บใต้ PI
      if (!data && pi && sn) {
        const snData = await loadById(sn);
        if (snData) {
          await saveById(`PI_${pi}`, { ...snData, keyId: `PI_${pi}`, PI: pi, SN: sn });
          data = await loadById(`PI_${pi}`);
        }
      }

      if (data) {
        restore(data);
      } else {
        const newDoc = await getNextDocNoCloud(issueDate || todayISO());
        if (!cancelled) setDocNo(newDoc);
      }
    }
    boot();
    return () => { cancelled = true; };
  }, [keyId, issueDate, restore, pi, sn]);

  async function handleSave() {
    if (!keyId) { alert("ไม่พบ PI/SN ใน URL"); return; }
    await ensureAnonSignIn();
    let finalDocNo = docNo;
    if (!finalDocNo) { finalDocNo = await getNextDocNoCloud(issueDate || todayISO()); setDocNo(finalDocNo); }
    const payload = {
      keyId, PI: pi || null, SN: sn || null,
      issueDate, docNo: finalDocNo, partName, partDetails, reasonDetails, locationDetails, importDate,
      hasMSDS, needInform, evalResult, qaMgrApprove, related,
      photoDataUrl,
      sigRequester, sigChief, sigMgr, sigSectionMgr, sigQAStaff, sigQAChief, sigQAMgr,
      savedAt: new Date().toISOString(),
    };
    try { await saveById(keyId, payload); alert("บันทึกขึ้น Cloud (Firestore) สำเร็จ ✅"); }
    catch (e) { console.error(e); alert("บันทึกไม่สำเร็จ: " + (e.message || e)); }
  }

  const photoInput = (
    <div className="no-print photo-tools">
      <input ref={photoInputRef} type="file" accept="image/*" onChange={onPickPhoto}/>
      {photoDataUrl && <button type="button" className="btn ghost" onClick={clearPhoto}>Clear</button>}
    </div>
  );

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
          <tr><td className="title" colSpan={4}>Import part to Clean room Notification</td></tr>

          <tr>
            <td className="label">วันที่ (Issue date):</td>
            <td><input className="inp" type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></td>
            <td className="label">Document No. :</td>
            <td><input className="inp" type="text" value={docNo} onChange={e=>setDocNo(e.target.value)} placeholder="auto from cloud..."/></td>
          </tr>

          <tr>
            <td className="label">ชื่อชิ้นงาน (Part name):</td>
            <td><input className="inp" type="text" value={partName} onChange={e=>setPartName(e.target.value)}/></td>
            <td className="label">รูปถ่ายประกอบ (Photo):</td>
            <td rowSpan={3} className="photoBox">
              <div className="photo-area">
                {photoDataUrl ? <img src={photoDataUrl} alt="photo"/> : <div className="photo-hint">Insert here</div>}
              </div>
              {photoInput}
            </td>
          </tr>
          <tr>
            <td className="label">รายละเอียดของชิ้นส่วน/ชิ้นงาน (Part details):</td>
            <td colSpan={2}><textarea className="ta" value={partDetails} onChange={e=>setPartDetails(e.target.value)} /></td>
          </tr>
          <tr>
            <td className="label">เหตุผลที่ต้องใช้ (Reason details):</td>
            <td colSpan={2}><textarea className="ta" value={reasonDetails} onChange={e=>setReasonDetails(e.target.value)} /></td>
          </tr>

          <tr>
            <td className="label">ระบุพื้นที่ใช้งานใน Clean room (Location details):</td>
            <td colSpan={3}><input className="inp" type="text" value={locationDetails} onChange={e=>setLocationDetails(e.target.value)}/></td>
          </tr>

          <tr>
            <td className="label">ระบุวันที่นำเข้า (Import date):</td>
            <td><input className="inp" type="date" value={importDate} onChange={e=>setImportDate(e.target.value)} /></td>
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
            <td className="signCell"><SignaturePad value={sigRequester} onChange={setSigRequester} /></td>
            <td className="signCell"><SignaturePad value={sigChief} onChange={setSigChief} /></td>
            <td className="signCell"><SignaturePad value={sigMgr} onChange={setSigMgr} /></td>
            <td className="signCell"><textarea className="ta" style={{height:118}} /></td>
          </tr>

          {/* Related */}
          <tr><td className="sectionTitle" colSpan={4}>เฉพาะแผนกที่เกี่ยวข้องร่วมพิจารณา (For related section by identify.)</td></tr>
          <tr>
            <td colSpan={4} className="relWrap">
              {relatedList.map(k=>(
                <label key={k} className="relItem">
                  <input type="checkbox" checked={!!related[k]} onChange={()=>setRelated(s=>({...s,[k]:!s[k]}))}/> <span>{k}</span>
                </label>
              ))}
            </td>
          </tr>
          <tr>
            <td className="label">Section MGR</td>
            <td colSpan={3} className="signCell"><SignaturePad value={sigSectionMgr} onChange={setSigSectionMgr} /></td>
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
            <td className="signCell"><SignaturePad value={sigQAStaff} onChange={setSigQAStaff} /></td>
            <td className="label center">QA Chief</td>
            <td className="signCell"><SignaturePad value={sigQAChief} onChange={setSigQAChief} /></td>
          </tr>
          <tr>
            <td className="label">หมายเหตุ (Remark)</td>
            <td colSpan={3}><textarea className="ta tall" /></td>
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
            <td><input className="inp" type="text" /></td>
          </tr>
          <tr>
            <td className="label">Approval sign</td>
            <td colSpan={3} className="signCell"><SignaturePad height={140} value={sigQAMgr} onChange={setSigQAMgr} /></td>
          </tr>

          <tr><td colSpan={4} className="footer">PI: {pi || "-"} | SN: {sn || "-"}</td></tr>
        </tbody>
      </table>

      <div className="no-print" style={{width:"210mm", margin:"10px auto 0", display:"flex", gap:8, justifyContent:"flex-end"}}>
        <button type="button" className="btn primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}

/* ========== CSS ========== */
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
.btn { appearance:none; padding:8px 12px; border:1px solid #cbd2da; border-radius:6px; background:#fff; cursor:pointer; font-weight:600; }
.btn:hover { background:#f3f5f7; }
.btn.primary { background:#0d6efd; color:#fff; border-color:#0d6efd; }
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
