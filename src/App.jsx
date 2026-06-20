import { useState, useEffect, useRef } from "react";

const PRESET = ["석공", "비계", "코킹", "트러스"];
const QUICK = ["양중", "철거", "미장", "도장", "배관", "전기"];
const TODAY = () => new Date().toISOString().slice(0, 10);
const UID = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const STORAGE_KEY = "site_diary_v1";
const HISTORY_KEY = "site_diary_history_v1";
const SITES_KEY = "site_diary_sites_v1";
const MANAGER_KEY = "site_diary_last_manager";

const DEFAULT_SITES = ["롯데건설 오산 양산동 공동주택공사"];
const lastManager = () => localStorage.getItem(MANAGER_KEY) || "이상준";
const loadSites = () => { try { return JSON.parse(localStorage.getItem(SITES_KEY) || "null") || DEFAULT_SITES; } catch { return DEFAULT_SITES; } };
const saveSites = s => { try { localStorage.setItem(SITES_KEY, JSON.stringify(s)); } catch {} };
const load = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = s => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
const saveHistory = l => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(l)); } catch {} };

const TEMPLATES = {
  석공: { s2_1:"설계도 전달 및 줄눈 간격 검토", s2_2:"앵글 브라켓 위치 먹매김 후 석재 가조립", s2_3:"앵글 고정→석재 붙임→에폭시 충전→최종 고정 상호확인", s3_1:"석재 인양 시 와이어로프 체결 상태 확인", s3_2:"고소작업 안전대 착용 및 낙하물 방지망 점검", s3_3:"줄눈 간격 불일치 시 즉시 작업중지 후 상호 확인" },
  비계: { s2_1:"시스템 비계 설치 도면 전달", s2_2:"벽체 앙카 위치 먹매김 및 작업 계획 전달", s2_3:"수직재→수평재→가새 순서 시공순서도 교육 상호확인", s3_1:"비계 설치도 확인 후 작업", s3_2:"비계공사 안전대 걸이 중요성 설명 (월타이 간격 준수)", s3_3:"작업발판 틈새·강풍 시 작업중지 상호 확인" },
  코킹: { s2_1:"줄눈 청소 및 백업재 삽입 설계도 전달", s2_2:"마스킹 테이프 부착 후 코킹재 충전 작업계획 전달", s2_3:"헤라 마감→테이프 제거 시공순서도 교육 상호확인", s3_1:"코킹재 유효기간 및 기온 5도 이하 작업 금지", s3_2:"밀폐공간 환기 철저 시공방법 설명", s3_3:"마감면 오염 방지 양생 확인 상호 확인" },
  트러스: { s2_1:"트러스 부재 규격 도면 대조 전달", s2_2:"앙카 볼트 고정 위치 작업계획 전달", s2_3:"트러스 거치→수평 확인→볼트 체결 시공순서도 상호확인", s3_1:"트러스 인양 시 2점 이상 결속 확인", s3_2:"고소작업 안전대 부착설비 사전 확인 설명", s3_3:"볼트 미체결 상태 발판 사용 금지 상호 확인" },
  양중: { s2_1:"양중 장비 일일 점검 도면 전달", s2_2:"인양 하중·줄걸이 방법 작업계획 전달", s2_3:"신호수 배치 및 신호 방법 시공순서도 상호확인", s3_1:"와이어로프 마모·꼬임 상태 점검", s3_2:"정격하중 초과 인양 절대 금지 설명", s3_3:"인양물 아래 출입통제 상호 확인" },
  철거: { s2_1:"철거 대상 범위 도면 전달", s2_2:"가설 지지대 설치 후 작업계획 전달", s2_3:"마감재→설비→구조체 순 철거 시공순서도 상호확인", s3_1:"분진 발생 시 방진마스크 착용", s3_2:"전기·가스 차단 여부 사전 확인 설명", s3_3:"낙하물 방지 및 붕괴 위험 상시 확인 상호 확인" },
};

const defaultRows = () => PRESET.map(name => ({ id: UID(), name, workers:"", work:"", note:"" }));
const defaultState = (site="") => ({ date: TODAY(), site, manager: lastManager(), weather:"", mainWork:"", special:"", rows: defaultRows() });

const fmtDate = d => { const dt = new Date(d); return `${dt.getFullYear()} 년 ${String(dt.getMonth()+1).padStart(2,'0')} 월 ${String(dt.getDate()).padStart(2,'0')} 일`; };

export default function App() {
  const [state, setState] = useState(() => { const s = load(); return s || defaultState(); });
  const [tab, setTab] = useState("write");
  const [history, setHistory] = useState(() => loadHistory());
  const [sites, setSites] = useState(() => loadSites());
  const [newSite, setNewSite] = useState("");
  const [histFilter, setHistFilter] = useState("전체");
  const [copied, setCopied] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [showTBM, setShowTBM] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [tbm, setTbm] = useState({ subject:"", s1_1:"", s1_2:"", s1_3:"", s2_1:"", s2_2:"", s2_3:"", s3_1:"", s3_2:"", s3_3:"" });
  const photoRef = useRef();

  const set = (f, v) => setState(prev => ({ ...prev, [f]: v }));
  const setT = (f, v) => setTbm(prev => ({ ...prev, [f]: v }));
  const updateRow = (id, f, v) => setState(prev => ({ ...prev, rows: prev.rows.map(r => r.id===id ? { ...r, [f]:v } : r) }));
  const addRow = (name="") => setState(prev => ({ ...prev, rows: [...prev.rows, { id:UID(), name, workers:"", work:"", note:"" }] }));
  const removeRow = id => setState(prev => ({ ...prev, rows: prev.rows.filter(r => r.id!==id) }));

  useEffect(() => { save(state); if (state.manager) localStorage.setItem(MANAGER_KEY, state.manager); }, [state]);

  const addSite = () => { if (!newSite.trim()) return; const u = [...sites, newSite.trim()]; setSites(u); saveSites(u); setNewSite(""); };
  const removeSite = name => { const u = sites.filter(s => s!==name); setSites(u); saveSites(u); };

  const totalWorkers = state.rows.reduce((s, r) => s + (parseInt(r.workers)||0), 0);

  const generateTBM = () => {
    const active = state.rows.filter(r => r.name && parseInt(r.workers) > 0);
    if (!active.length) { alert("인원이 입력된 공정이 없습니다."); return; }
    const names = active.map(r => r.name);
    const tpls = names.map(n => TEMPLATES[n]).filter(Boolean);
    setTbm({
      subject: names.join(", ") + " 작업",
      s1_1: `자재 야적 시 신호수 배치 후 ${names.join(", ")} 시공작업 부위 확인`,
      s1_2: state.mainWork || `${names.join(", ")} 작업`,
      s1_3: active.map(r => `${r.name} ${r.workers}명`).join(", "),
      s2_1: tpls.map(t => t.s2_1).join("\n"),
      s2_2: tpls.map(t => t.s2_2).join("\n"),
      s2_3: tpls.map(t => t.s2_3).join("\n"),
      s3_1: tpls.map(t => t.s3_1).join("\n"),
      s3_2: tpls.map(t => t.s3_2).join("\n"),
      s3_3: tpls.map(t => t.s3_3).join("\n"),
    });
    setShowTBM(true);
  };

  const handlePhoto = e => { Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = ev => setPhotos(prev => [...prev, ev.target.result]); r.readAsDataURL(f); }); };
  const handlePrint = () => window.print();
  const handleCopy = () => { navigator.clipboard.writeText(outputText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const handleSave = () => { const e = { ...state, savedAt: new Date().toISOString(), id: UID() }; const u = [e, ...history].slice(0,30); setHistory(u); saveHistory(u); setSavedMsg("저장됨!"); setTimeout(() => setSavedMsg(""), 2000); };
  const handleNewDay = () => { if (window.confirm("새 날짜로 초기화할까요?")) { setState({ ...defaultState(state.site), date: TODAY() }); setShowOutput(false); setShowTBM(false); setPhotos([]); } };
  const loadEntry = e => { setState(e); setTab("write"); setShowOutput(false); setShowTBM(false); };
  const deleteEntry = id => { const u = history.filter(h => h.id!==id); setHistory(u); saveHistory(u); };

  const outputText = () => [
    `📋 일일 현장업무일지`, `━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 날짜: ${state.date}`, `🏗️ 현장: ${state.site}`, `👷 현장소장: ${state.manager}`,
    state.weather ? `🌤️ 날씨: ${state.weather}` : null, ``,
    `【 공정별 출력인원 】`,
    ...state.rows.filter(r => r.name).map(r => `▪ ${r.name}: ${r.workers||0}명${r.work?` / ${r.work}`:""}${r.note?` (${r.note})`:""}`),
    `▶ 합계: 총 ${totalWorkers}명`,
    state.mainWork ? `\n【 주요 업무 】\n${state.mainWork}` : null,
    state.special ? `\n【 특이사항/지시사항 】\n${state.special}` : null,
  ].filter(Boolean).join("\n");

  const c = {
    wrap: { maxWidth:480, margin:"0 auto", paddingBottom:80, fontFamily:"-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif", color:"#1a1a1a" },
    hdr: { background:"#1a73e8", color:"#fff", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 },
    tabs: { display:"flex", background:"#fff", borderBottom:"1px solid #e0e0e0", position:"sticky", top:56, zIndex:9 },
    tab: a => ({ flex:1, padding:"11px 0", fontSize:12, fontWeight:a?600:400, color:a?"#1a73e8":"#666", background:"none", border:"none", borderBottom:a?"2px solid #1a73e8":"2px solid transparent", cursor:"pointer" }),
    body: { padding:"12px 16px" },
    card: { background:"#fff", borderRadius:12, border:"1px solid #e8e8e8", padding:14, marginBottom:12 },
    ct: { fontSize:14, fontWeight:600, color:"#333", marginBottom:12 },
    lbl: { fontSize:12, color:"#888", marginBottom:4, display:"block" },
    g2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
    rw: { borderBottom:"1px solid #f0f0f0", paddingBottom:10, marginBottom:10 },
    rt: { display:"flex", gap:6, alignItems:"center", marginBottom:6 },
    del: { background:"none", border:"none", fontSize:18, color:"#bbb", padding:"0 4px", cursor:"pointer" },
    qw: { display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 },
    qb: { fontSize:12, padding:"5px 10px", border:"1px dashed #ccc", borderRadius:6, background:"none", color:"#666", cursor:"pointer" },
    tot: { textAlign:"right", fontSize:15, fontWeight:600, color:"#1a73e8", marginTop:4 },
    btn: (bg, cl, mb=8) => ({ width:"100%", padding:13, fontSize:15, fontWeight:600, background:bg, color:cl, border:bg==="none"?`1px solid ${cl}`:"none", borderRadius:10, marginBottom:mb, cursor:"pointer" }),
    sr: { display:"flex", gap:8, marginBottom:8 },
    sb: (bg, cl) => ({ flex:1, padding:11, fontSize:14, fontWeight:600, background:bg, color:cl, border:bg==="none"?`1px solid ${cl}`:"none", borderRadius:10, cursor:"pointer" }),
    ob: { whiteSpace:"pre-wrap", fontSize:13, background:"#f8f9fa", border:"1px solid #e0e0e0", borderRadius:8, padding:12, lineHeight:1.75 },
    hc: { background:"#fff", borderRadius:10, border:"1px solid #e8e8e8", padding:"12px 14px", marginBottom:10 },
    msg: { position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#333", color:"#fff", padding:"8px 20px", borderRadius:20, fontSize:14, zIndex:99 },
    ti: { width:"100%", padding:"8px 10px", fontSize:13, border:"1px solid #ddd", borderRadius:6, marginBottom:8, fontFamily:"inherit", boxSizing:"border-box" },
    ta: { width:"100%", padding:"8px 10px", fontSize:13, border:"1px solid #ddd", borderRadius:6, marginBottom:8, fontFamily:"inherit", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" },
    sel: { width:"100%", padding:"10px 12px", fontSize:15, border:"1px solid #ddd", borderRadius:8, background:"#fff", marginBottom:10, fontFamily:"inherit" },
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .print-only { display:block !important; }
          @page { margin:10mm; size:A4; }
        }
        .print-only { display:none; }
        input, textarea, select { font-family:inherit; font-size:15px; width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; background:#fff; color:#1a1a1a; outline:none; box-sizing:border-box; }
        input:focus, textarea:focus, select:focus { border-color:#1a73e8; }
        textarea { resize:vertical; line-height:1.6; }
        * { box-sizing:border-box; }
        body { background:#f4f6f9; -webkit-tap-highlight-color:transparent; margin:0; }
      `}</style>

      {/* ── 앱 UI ── */}
      <div style={c.wrap} className="no-print">
        <div style={c.hdr}>
          <div>
            <div style={{ fontSize:17, fontWeight:600 }}>현장 일일 업무일지</div>
            <div style={{ fontSize:12, opacity:.85, marginTop:2 }}>01045166010 · {state.date}</div>
            <div style={{ fontSize:10, opacity:.6, marginTop:1 }}>by 폭풍간지 이상준 ⚡</div>
          </div>
          <div style={{ fontSize:12, background:"rgba(255,255,255,.2)", borderRadius:6, padding:"4px 10px" }}>총 {totalWorkers}명</div>
        </div>

        <div style={c.tabs}>
          <button style={c.tab(tab==="write")} onClick={() => setTab("write")}>작성</button>
          <button style={c.tab(tab==="history")} onClick={() => setTab("history")}>저장목록({history.length})</button>
          <button style={c.tab(tab==="settings")} onClick={() => setTab("settings")}>⚙️설정</button>
        </div>

        <div style={c.body}>
          {tab==="write" && <>
            <div style={c.card}>
              <div style={c.ct}>📋 기본 정보</div>
              <label style={c.lbl}>날짜</label>
              <input type="date" value={state.date} onChange={e => set("date", e.target.value)} style={{ marginBottom:10 }} />
              <label style={c.lbl}>현장명</label>
              <select value={state.site} onChange={e => set("site", e.target.value)} style={c.sel}>
                <option value="">현장 선택</option>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={c.g2}>
                <div><label style={c.lbl}>현장소장</label><input value={state.manager} onChange={e => set("manager", e.target.value)} /></div>
                <div><label style={c.lbl}>날씨</label><input value={state.weather} onChange={e => set("weather", e.target.value)} placeholder="맑음/흐림/비" /></div>
              </div>
            </div>

            <div style={c.card}>
              <div style={c.ct}>👷 공정별 출력인원</div>
              {state.rows.map(r => (
                <div key={r.id} style={c.rw}>
                  <div style={c.rt}>
                    <input value={r.name} onChange={e => updateRow(r.id,"name",e.target.value)} placeholder="공정명" style={{ flex:1 }} />
                    <input type="number" min="0" value={r.workers} onChange={e => updateRow(r.id,"workers",e.target.value)} placeholder="0" style={{ width:52, textAlign:"center" }} />
                    <span style={{ fontSize:13, color:"#888", whiteSpace:"nowrap" }}>명</span>
                    <button onClick={() => removeRow(r.id)} style={c.del}>✕</button>
                  </div>
                  <input value={r.work} onChange={e => updateRow(r.id,"work",e.target.value)} placeholder="작업 내용" style={{ marginBottom:6 }} />
                  <input value={r.note} onChange={e => updateRow(r.id,"note",e.target.value)} placeholder="비고" />
                </div>
              ))}
              <div style={c.qw}>
                {QUICK.map(n => <button key={n} style={c.qb} onClick={() => addRow(n)}>{n}</button>)}
                <button style={{ ...c.qb, borderStyle:"solid", color:"#1a73e8", borderColor:"#1a73e8" }} onClick={() => addRow("")}>+ 직접입력</button>
              </div>
              <div style={c.tot}>합계 <span style={{ fontSize:20 }}>{totalWorkers}</span> 명</div>
            </div>

            <div style={c.card}>
              <div style={c.ct}>📌 주요 업무</div>
              <textarea value={state.mainWork} onChange={e => set("mainWork", e.target.value)} placeholder="오늘의 주요 업무 내용" rows={4} />
            </div>

            <div style={c.card}>
              <div style={c.ct}>⚠️ 특이사항 / 지시사항</div>
              <textarea value={state.special} onChange={e => set("special", e.target.value)} placeholder="공정 이슈, 자재 입고 예정, 원청 지시사항 등" rows={3} />
            </div>

            <div style={c.sr}>
              <button style={c.sb("#34a853","#fff")} onClick={handleSave}>💾 저장</button>
              <button style={c.sb("none","#ea4335")} onClick={handleNewDay}>🔄 새 날짜</button>
            </div>

            <button style={c.btn("#34a853","#fff")} onClick={generateTBM}>📋 안전교육일지 자동생성</button>
            <button style={c.btn("#1a73e8","#fff")} onClick={() => setShowOutput(v=>!v)}>{showOutput?"출력 닫기":"📤 밴드/카톡 공유용 출력"}</button>

            {showOutput && (
              <div style={c.card}>
                <div style={c.ob}>{outputText()}</div>
                <button style={{ ...c.btn("#f0f4ff","#1a73e8",0), marginTop:8 }} onClick={handleCopy}>{copied?"✓ 복사됨!":"📋 클립보드 복사"}</button>
              </div>
            )}

            {showTBM && (
              <div style={{ ...c.card, border:"1px solid #34a853", background:"#f0fff4", marginTop:4 }}>
                <div style={{ ...c.ct, color:"#34a853" }}>📋 안전교육일지 입력</div>
                <label style={c.lbl}>교육주제</label>
                <input style={c.ti} value={tbm.subject} onChange={e => setT("subject",e.target.value)} />
                <div style={{ fontWeight:600, fontSize:13, color:"#333", margin:"8px 0 6px" }}>1. 당일작업의 공법이해</div>
                <label style={c.lbl}>- 작업개요</label>
                <input style={c.ti} value={tbm.s1_1} onChange={e => setT("s1_1",e.target.value)} />
                <label style={c.lbl}>- 작업내용</label>
                <input style={c.ti} value={tbm.s1_2} onChange={e => setT("s1_2",e.target.value)} />
                <label style={c.lbl}>- 인원투입 등</label>
                <input style={c.ti} value={tbm.s1_3} onChange={e => setT("s1_3",e.target.value)} />
                <div style={{ fontWeight:600, fontSize:13, color:"#333", margin:"8px 0 6px" }}>2. 시공 상세도면에 따른 세부 시공순서</div>
                <label style={c.lbl}>- 설계도면</label>
                <textarea style={c.ta} rows={2} value={tbm.s2_1} onChange={e => setT("s2_1",e.target.value)} />
                <label style={c.lbl}>- 작업계획</label>
                <textarea style={c.ta} rows={2} value={tbm.s2_2} onChange={e => setT("s2_2",e.target.value)} />
                <label style={c.lbl}>- 시공순서도 등에 의한 교육</label>
                <textarea style={c.ta} rows={2} value={tbm.s2_3} onChange={e => setT("s2_3",e.target.value)} />
                <div style={{ fontWeight:600, fontSize:13, color:"#333", margin:"8px 0 6px" }}>3. 시공기술상의 주의사항</div>
                <label style={c.lbl}>- 특이사항(공법 등)</label>
                <textarea style={c.ta} rows={2} value={tbm.s3_1} onChange={e => setT("s3_1",e.target.value)} />
                <label style={c.lbl}>- 작업지휘자의 시공방법 설명</label>
                <textarea style={c.ta} rows={2} value={tbm.s3_2} onChange={e => setT("s3_2",e.target.value)} />
                <label style={c.lbl}>- 시공순서도 등에 의한 상호 협의</label>
                <textarea style={c.ta} rows={2} value={tbm.s3_3} onChange={e => setT("s3_3",e.target.value)} />
                <label style={c.lbl}>현장 사진</label>
                <input type="file" accept="image/*" multiple ref={photoRef} style={{ display:"none" }} onChange={handlePhoto} />
                <button style={c.btn("#fff","#34a853")} onClick={() => photoRef.current.click()}>📷 사진 추가</button>
                {photos.length > 0 && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    {photos.map((src,i) => (
                      <div key={i} style={{ position:"relative" }}>
                        <img src={src} style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", borderRadius:6, border:"1px solid #ddd" }} alt="" />
                        <button onClick={() => setPhotos(prev => prev.filter((_,j)=>j!==i))} style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.5)", color:"#fff", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:12 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button style={c.btn("#ff6d00","#fff")} onClick={handlePrint}>🖨️ PDF 출력</button>
              </div>
            )}
          </>}

          {tab==="history" && <>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
              {["전체", ...sites].map(s => (
                <button key={s} onClick={() => setHistFilter(s)} style={{ fontSize:12, padding:"5px 10px", borderRadius:16, border:"1px solid", borderColor:histFilter===s?"#1a73e8":"#ddd", background:histFilter===s?"#e8f0fe":"#fff", color:histFilter===s?"#1a73e8":"#666", cursor:"pointer" }}>{s}</button>
              ))}
            </div>
            {history.filter(h => histFilter==="전체" || h.site===histFilter).length===0 && <div style={{ textAlign:"center", color:"#aaa", padding:"40px 0", fontSize:14 }}>저장된 일지가 없습니다</div>}
            {history.filter(h => histFilter==="전체" || h.site===histFilter).map(h => {
              const tot = h.rows?.reduce((s,r) => s+(parseInt(r.workers)||0),0)||0;
              return (
                <div key={h.id} style={c.hc}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1a73e8", marginBottom:4 }}>{h.date}</div>
                  <div style={{ fontSize:12, color:"#888", marginBottom:2 }}>{h.site}</div>
                  <div style={{ fontSize:13, color:"#555", marginBottom:8 }}>총 {tot}명{h.weather?` · ${h.weather}`:""}</div>
                  {h.mainWork && <div style={{ fontSize:12, color:"#888", marginBottom:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.mainWork.slice(0,40)}</div>}
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ flex:1, padding:"7px 0", fontSize:13, background:"#f0f4ff", color:"#1a73e8", border:"none", borderRadius:6, cursor:"pointer" }} onClick={() => loadEntry(h)}>불러오기</button>
                    <button style={{ padding:"7px 12px", fontSize:13, background:"none", color:"#ea4335", border:"1px solid #ea4335", borderRadius:6, cursor:"pointer" }} onClick={() => deleteEntry(h.id)}>삭제</button>
                  </div>
                </div>
              );
            })}
          </>}

          {tab==="settings" && <>
            <div style={c.card}>
              <div style={c.ct}>🏗️ 현장 관리</div>
              {sites.map(s => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"10px 12px", background:"#f8f9fa", borderRadius:8, border:"1px solid #e8e8e8" }}>
                  <span style={{ flex:1, fontSize:14 }}>{s}</span>
                  <button onClick={() => removeSite(s)} style={{ background:"none", border:"none", color:"#ea4335", fontSize:18, cursor:"pointer", padding:"0 4px" }}>✕</button>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <input value={newSite} onChange={e => setNewSite(e.target.value)} placeholder="새 현장명 입력" onKeyDown={e => e.key==="Enter" && addSite()} style={{ flex:1, padding:"10px 12px", fontSize:14, border:"1px solid #ddd", borderRadius:8 }} />
                <button onClick={addSite} style={{ padding:"10px 16px", background:"#1a73e8", color:"#fff", border:"none", borderRadius:8, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" }}>+ 추가</button>
              </div>
            </div>
            <div style={c.card}>
              <div style={c.ct}>👷 기본 설정</div>
              <label style={c.lbl}>현장소장 이름</label>
              <input value={state.manager} onChange={e => set("manager", e.target.value)} placeholder="현장소장 이름" />
            </div>
          </>}
        </div>
        {(savedMsg||copied) && <div style={c.msg}>{savedMsg||"복사됨!"}</div>}
      </div>

      {/* ── 인쇄 전용 A4 ── */}
      <div className="print-only" style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", fontSize:11, padding:"15mm 18mm", background:"#fff", minHeight:"297mm", width:"210mm" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4mm" }}>
          <div style={{ flex:1, textAlign:"center", fontSize:16, fontWeight:700, letterSpacing:4, padding:"6mm 0 4mm", whiteSpace:"nowrap" }}>일상 안전교육일지</div>
          <table style={{ borderCollapse:"collapse" }}>
            <tbody>
              <tr>
                <td rowSpan={2} style={{ border:"1px solid #000", writingMode:"vertical-rl", letterSpacing:3, fontWeight:700, fontSize:10, background:"#f0f0f0", padding:"3mm 2mm", width:"7mm", textAlign:"center" }}>결<br/>재</td>
                <td style={{ border:"1px solid #000", fontSize:8, fontWeight:600, padding:"2mm 3mm", width:"18mm", textAlign:"center", lineHeight:1.4 }}>안전관리<br/>담당자</td>
                <td style={{ border:"1px solid #000", fontSize:8, fontWeight:600, padding:"2mm 3mm", width:"18mm", textAlign:"center", lineHeight:1.4 }}>안전관리<br/>책임자</td>
                <td style={{ border:"1px solid #000", fontSize:8, fontWeight:600, padding:"2mm 3mm", width:"18mm", textAlign:"center", lineHeight:1.4 }}>안전총괄<br/>책임자</td>
              </tr>
              <tr>
                <td style={{ border:"1px solid #000", height:"14mm" }}></td>
                <td style={{ border:"1px solid #000", height:"14mm" }}></td>
                <td style={{ border:"1px solid #000", height:"14mm" }}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:10, marginBottom:"3mm" }}>{fmtDate(state.date)}</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <tbody>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm", width:"18mm", whiteSpace:"nowrap" }}>공사명</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm" }}>{state.site}</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm", width:"13mm", whiteSpace:"nowrap" }}>실시자</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>안전관리책임자 / 안전관리담당자</td>
            </tr>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>교육의종류</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>일일 TBM</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>장소</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>현장내 TBM 장소</td>
            </tr>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>교육인원</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>대상 : {totalWorkers}명 중 참석 : {totalWorkers}명</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>교육시간</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>07:00 ~ 07:30</td>
            </tr>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>교육주제</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>{tbm.subject}</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>교육방법</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>구두전달</td>
            </tr>
          </tbody>
        </table>
        <div style={{ border:"1px solid #000", borderTop:"none", display:"flex" }}>
          <div style={{ writingMode:"vertical-rl", textAlign:"center", fontWeight:700, fontSize:10, background:"#f0f0f0", borderRight:"1px solid #000", width:"7mm", letterSpacing:3, padding:"2mm 1mm", whiteSpace:"nowrap" }}>교&nbsp;&nbsp;육&nbsp;&nbsp;내&nbsp;&nbsp;용</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", borderBottom:"1px solid #000", background:"#f0f0f0" }}>
              <div style={{ width:"44mm", textAlign:"center", fontWeight:700, padding:"2mm", borderRight:"1px solid #000", flexShrink:0 }}>교 육 항 목</div>
              <div style={{ flex:1, textAlign:"center", fontWeight:700, padding:"2mm" }}>교 육 내 용</div>
            </div>
            <div style={{ display:"flex", borderBottom:"1px solid #000" }}>
              <div style={{ width:"44mm", borderRight:"1px solid #000", padding:"3mm", lineHeight:1.7, flexShrink:0, background:"#fafafa" }}>1. 당일작업의 공법이해</div>
              <div style={{ flex:1, padding:"3mm 4mm", lineHeight:1.9 }}>
                <div>- 작업개요</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s1_1}</div>
                <div>- 작업내용</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s1_2}</div>
                <div>- 인원투입 등</div><div style={{ paddingLeft:"4mm" }}>{tbm.s1_3}</div>
              </div>
            </div>
            <div style={{ display:"flex", borderBottom:"1px solid #000" }}>
              <div style={{ width:"44mm", borderRight:"1px solid #000", padding:"3mm", lineHeight:1.7, flexShrink:0, background:"#fafafa" }}>2. 시공 상세도면에 따른 세부 시공순서</div>
              <div style={{ flex:1, padding:"3mm 4mm", lineHeight:1.9 }}>
                <div>- 설계도면</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s2_1}</div>
                <div>- 작업계획</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s2_2}</div>
                <div>- 시공순서도 등에 의한 교육</div><div style={{ paddingLeft:"4mm" }}>{tbm.s2_3}</div>
              </div>
            </div>
            <div style={{ display:"flex" }}>
              <div style={{ width:"44mm", borderRight:"1px solid #000", padding:"3mm", lineHeight:1.7, flexShrink:0, background:"#fafafa" }}>3. 시공기술상의 주의사항</div>
              <div style={{ flex:1, padding:"3mm 4mm", lineHeight:1.9 }}>
                <div>- 특이사항(공법 등)</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s3_1}</div>
                <div>- 작업지휘자의 시공방법 설명</div><div style={{ paddingLeft:"4mm", marginBottom:"2mm" }}>{tbm.s3_2}</div>
                <div>- 시공순서도 등에 의한 상호 협의</div><div style={{ paddingLeft:"4mm" }}>{tbm.s3_3}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ border:"1px solid #000", borderTop:"none", display:"flex", minHeight:"55mm" }}>
          <div style={{ writingMode:"vertical-rl", textAlign:"center", fontWeight:700, fontSize:10, background:"#f0f0f0", borderRight:"1px solid #000", width:"7mm", letterSpacing:5, padding:"2mm 1mm" }}>사&nbsp;&nbsp;&nbsp;&nbsp;진</div>
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4mm", padding:"4mm" }}>
            {photos.length > 0
              ? photos.slice(0,4).map((src,i) => <img key={i} src={src} style={{ width:"100%", height:"45mm", objectFit:"cover", border:"1px solid #ccc" }} alt="" />)
              : [0,1].map(i => <div key={i} style={{ background:"#f5f5f5", border:"1px dashed #ccc", minHeight:"45mm" }} />)
            }
          </div>
        </div>
      </div>
    </>
  );
}
