import { useState, useEffect, useRef, useMemo } from "react";

const PRESET = ["석공", "비계", "코킹", "트러스"];
const QUICK = ["양중", "철거", "미장", "도장", "배관", "전기"];
const TODAY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const UID = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const STORAGE_KEY = "site_diary_v1";
const HISTORY_KEY = "site_diary_history_v1";
const SITES_KEY = "site_diary_sites_v1";
const MANAGER_KEY = "site_diary_last_manager";
const ROSTER_KEY = "site_diary_roster_v1";
const ROSTER_META_KEY = "site_diary_roster_meta_v1";
const ROSTER_PAD = 20;
const TEAMS_KEY = "site_diary_teams_v1";

const DEFAULT_SITES = ["롯데건설 오산 양산동 공동주택공사"];
const lastManager = () => localStorage.getItem(MANAGER_KEY) || "이상준";
const loadSites = () => { try { return JSON.parse(localStorage.getItem(SITES_KEY) || "null") || DEFAULT_SITES; } catch { return DEFAULT_SITES; } };
const saveSites = s => { try { localStorage.setItem(SITES_KEY, JSON.stringify(s)); } catch {} };
const load = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = s => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
const saveHistory = l => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(l)); } catch {} };
const loadRoster = () => { try { return JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]"); } catch { return []; } };
const saveRoster = l => { try { localStorage.setItem(ROSTER_KEY, JSON.stringify(l)); } catch {} };
const loadRosterMeta = () => { try { return JSON.parse(localStorage.getItem(ROSTER_META_KEY) || "null") || { company:"은진산업 주식회사", workType:"석공", siteName:"오산 롯데 지역주택조합" }; } catch { return { company:"은진산업 주식회사", workType:"석공", siteName:"오산 롯데 지역주택조합" }; } };
const saveRosterMeta = m => { try { localStorage.setItem(ROSTER_META_KEY, JSON.stringify(m)); } catch {} };

// ── 팀 마스터: 반장(카톡 보낸사람) → 팀명·직종 매핑 ──
const DEFAULT_TEAMS = [
  { id: "t1", leader: "엄최림", alias: "최림", team: "석공2팀", job: "석공",
    members: ["김철","김철주","엄최림","김만주","김철기","김철군","김철홍"] },
  { id: "t2", leader: "정연학", alias: "郑然学", team: "석공1팀", job: "석공",
    members: ["최은주","김대현","이상규","권춘우","권춘산","정연학","김지남","이성근","박동환"] },
  { id: "t3", leader: "배현호", alias: "배팀장", team: "비계팀", job: "비계",
    members: ["배현호","김영호","강성구","김기홍","윤한영","남갑일","문철환","서우석","이환기","하태욱"] },
  { id: "t4", leader: "유정민", alias: "", team: "코킹팀", job: "코킹",
    members: ["김춘산"] },
];
// 명단 텍스트(줄바꿈·쉼표 혼용) ↔ 배열 변환
const membersToText = m => (m || []).join(". ");
// 모바일에서 줄바꿈이 잘 안 되므로 마침표를 기본 구분자로 사용. 쉼표·줄바꿈·공백도 함께 인정
const textToMembers = t => {
  const out = [];
  String(t || "").split(/[\n\r,，、·．.\/|;:\s]+/).forEach(x => {
    const v = x.trim();
    if (v && !out.includes(v)) out.push(v);
  });
  return out;
};
const loadTeams = () => { try { const t = JSON.parse(localStorage.getItem(TEAMS_KEY) || "null"); return (t && t.length) ? t : DEFAULT_TEAMS; } catch { return DEFAULT_TEAMS; } };
const saveTeams = t => { try { localStorage.setItem(TEAMS_KEY, JSON.stringify(t)); } catch {} };
const defaultTeamRow = () => ({ id: UID(), leader: "", alias: "", team: "", job: "", members: [] });

// 카톡 등에서 복사한 텍스트 → 사람 이름만 추출
// 규칙 1) 숫자가 들어간 줄은 통째로 제외 (예: "8월3일 출력 7명", "시스템비계10명", "101동설치및112동해체")
// 규칙 2) 나머지 줄을 쉼표·마침표·가운데점·공백 등으로 쪼개 한글 2~4자만 이름으로 인정
// 규칙 3) 직종·사무용어 같은 비이름 단어는 제외
// 카톡 화면에 섞여 들어오는 시스템 문구·안내문 줄은 통째로 제외
const LINE_SKIP = /메시지|삭제되었|이모티콘|사진을|동영상|보이스톡|페이스톡|입장하|나갔습니다|초대하|읽지\s*않음|송금|선물하기|채팅방|공지로|답장|전달됨|님이/;
const NAME_STOP = new Set(["출력","인원","명단","오전","오후","야간","주간","작업","내용","해체","설치","양중","비계","석공","코킹","트러스","미장","도장","배관","전기","철거","금일","오늘","내일","현장","공지","확인","팀장","반장","사장","소장","안녕","수고","시스템","메시지","사진","이모티콘","삭제","전체","합계","총원","기타","오전반","오후반","오산","롯데","시공","건설","산업","주식","회사","본사","현장","공사","소개","사장","백사장","부장","과장","차장","대리","이사","회장","단톡","카톡","방장","조장","기사","기공","조공","보통","특별","단가","일당"]);
const parseNames = (text) => {
  const out = [];
  (text || "").split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    if (/[0-9０-９]/.test(line)) return;
    if (LINE_SKIP.test(line)) return;
    line.split(/[\s,.\/·、|\\:;~\-—+()\[\]{}<>"'“”]+/).forEach(tok => {
      const t = tok.trim();
      if (!/^[가-힣]{2,4}$/.test(t)) return;
      if (NAME_STOP.has(t)) return;
      if (!out.includes(t)) out.push(t);
    });
  });
  return out;
};
const defaultTaskRow = () => ({ id: UID(), work: "", count: "" });

// 결과물(이미지 PNG / PDF) 보관 — 용량 큰 바이너리는 localStorage(약 5MB) 대신 IndexedDB에 Blob으로 저장
const IDB_NAME = "site_diary_files_v1";
const IDB_STORE = "artifacts";
const idbOpen = () => new Promise((res, rej) => { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(IDB_STORE)) r.result.createObjectStore(IDB_STORE); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbPut = async (key, val) => { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, "readwrite"); tx.objectStore(IDB_STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };
const idbGet = async key => { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, "readonly"); const rq = tx.objectStore(IDB_STORE).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); };
const idbDel = async key => { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, "readwrite"); tx.objectStore(IDB_STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };
const blobToDataURL = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
const downloadBlob = (blob, filename) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); };

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
const defaultRosterRow = () => ({ id: UID(), no:"", job:"", team:"", name:"", am:"1", pm:"1", night:"", work:"", note:"" });
// 출력시간점검은 체크 방식. 값이 있으면 체크된 것으로 본다(기존에 저장된 "1"·"0.5" 데이터도 그대로 체크로 인식)
const isOn = v => { const t = String(v == null ? "" : v).trim(); return t !== "" && t !== "0"; };
const CHK = "V";

// 미리보기용 핀치 줌/팬/더블탭 이미지 — 모바일 터치 기준 (touch-action:none)
function ZoomableImage({ src }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const st = useRef({ scale:1, tx:0, ty:0, mode:null, startDist:0, startScale:1, midX:0, midY:0, baseTx:0, baseTy:0, lastX:0, lastY:0, tapX:0, tapY:0, tapAt:0, lastTap:0 });

  const apply = () => { const i = imgRef.current; if (i) i.style.transform = `translate(${st.current.tx}px, ${st.current.ty}px) scale(${st.current.scale})`; };
  const clamp = () => {
    const w = wrapRef.current, i = imgRef.current; if (!w || !i) return;
    const cw = w.clientWidth, ch = w.clientHeight, iw = i.offsetWidth * st.current.scale, ih = i.offsetHeight * st.current.scale;
    let minX, maxX, minY, maxY;
    if (iw <= cw) { minX = maxX = (cw - iw) / 2; } else { minX = cw - iw; maxX = 0; }
    if (ih <= ch) { minY = maxY = (ch - ih) / 2; } else { minY = ch - ih; maxY = 0; }
    st.current.tx = Math.min(maxX, Math.max(minX, st.current.tx));
    st.current.ty = Math.min(maxY, Math.max(minY, st.current.ty));
  };
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const rel = (x, y) => { const r = wrapRef.current.getBoundingClientRect(); return [x - r.left, y - r.top]; };
  const zoomTo = (ns, fx, fy) => {
    ns = Math.min(6, Math.max(1, ns));
    st.current.tx = fx - (fx - st.current.tx) * (ns / st.current.scale);
    st.current.ty = fy - (fy - st.current.ty) * (ns / st.current.scale);
    st.current.scale = ns; clamp(); apply();
  };

  const onStart = e => {
    const t = e.touches;
    if (t.length === 2) {
      st.current.mode = "pinch"; st.current.startDist = dist(t); st.current.startScale = st.current.scale;
      const [mx, my] = rel((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      st.current.midX = mx; st.current.midY = my; st.current.baseTx = st.current.tx; st.current.baseTy = st.current.ty;
    } else if (t.length === 1) {
      st.current.mode = "pan"; st.current.lastX = t[0].clientX; st.current.lastY = t[0].clientY;
      st.current.tapX = t[0].clientX; st.current.tapY = t[0].clientY; st.current.tapAt = Date.now();
    }
  };
  const onMove = e => {
    const t = e.touches;
    if (st.current.mode === "pinch" && t.length === 2) {
      const ns = Math.min(6, Math.max(1, st.current.startScale * (dist(t) / (st.current.startDist || 1))));
      const k = ns / st.current.startScale;
      st.current.tx = st.current.midX - (st.current.midX - st.current.baseTx) * k;
      st.current.ty = st.current.midY - (st.current.midY - st.current.baseTy) * k;
      st.current.scale = ns; clamp(); apply();
    } else if (st.current.mode === "pan" && t.length === 1) {
      st.current.tx += t[0].clientX - st.current.lastX; st.current.ty += t[0].clientY - st.current.lastY;
      st.current.lastX = t[0].clientX; st.current.lastY = t[0].clientY; clamp(); apply();
    }
  };
  const onEnd = e => {
    if (e.touches.length > 0) return;
    const ct = e.changedTouches[0], now = Date.now();
    const moved = ct ? Math.hypot(ct.clientX - st.current.tapX, ct.clientY - st.current.tapY) : 99;
    const wasTap = st.current.mode === "pan" && moved < 10 && now - st.current.tapAt < 300;
    if (wasTap && now - st.current.lastTap < 300) {
      if (st.current.scale > 1.05) { st.current.scale = 1; st.current.tx = 0; st.current.ty = 0; clamp(); apply(); }
      else { const [fx, fy] = rel(ct.clientX, ct.clientY); zoomTo(2.5, fx, fy); }
      st.current.lastTap = 0;
    } else if (wasTap) { st.current.lastTap = now; } else { st.current.lastTap = 0; }
    st.current.mode = null;
  };

  return (
    <div ref={wrapRef} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      style={{ overflow:"hidden", flex:1, border:"1px solid #eee", borderRadius:8, background:"#fafafa", touchAction:"none", position:"relative" }}>
      <img ref={imgRef} src={src} draggable={false} alt="미리보기"
        style={{ width:"100%", display:"block", transformOrigin:"0 0", willChange:"transform", userSelect:"none", WebkitUserSelect:"none" }} />
    </div>
  );
}

export default function App() {
  // 앱을 열면(작성 시작) 항상 오늘 날짜가 보이도록 — 작성 중이던 다른 내용은 그대로 유지
  const [state, setState] = useState(() => { const s = load(); return s ? { ...s, date: TODAY() } : defaultState(); });
  const [tab, setTab] = useState("write");
  const [history, setHistory] = useState(() => loadHistory());
  const [sites, setSites] = useState(() => loadSites());
  const [newSite, setNewSite] = useState("");
  const [histFilter, setHistFilter] = useState("전체");
  const [copied, setCopied] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [showTBM, setShowTBM] = useState(false);
  const [openRoster, setOpenRoster] = useState(true);
  const [openTbm, setOpenTbm] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [tbm, setTbm] = useState({ subject:"", s1_1:"", s1_2:"", s1_3:"", s2_1:"", s2_2:"", s2_3:"", s3_1:"", s3_2:"", s3_3:"" });
  const photoRef = useRef();
  const [roster, setRoster] = useState(() => { const r = loadRoster(); return r.length ? r : [defaultRosterRow()]; });
  const [rosterMeta, setRosterMeta] = useState(() => loadRosterMeta());
  const [showRoster, setShowRoster] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [shareView, setShareView] = useState(null);
  const [exportMonthSel, setExportMonthSel] = useState("");
  const [teams, setTeams] = useState(() => loadTeams());
  const [bulk, setBulk] = useState(null); // 명단 일괄 입력 모달 상태
  const [statMonth, setStatMonth] = useState("");
  const [statOpen, setStatOpen] = useState("");
  const [memberEdit, setMemberEdit] = useState({}); // 소속 인원 입력 중 원문 유지
  const [statQuery, setStatQuery] = useState("");
  const [statAll, setStatAll] = useState(false);
  const [teamOpen, setTeamOpen] = useState({}); // 출역집계 팀별 펼침
  const rosterPrintRef = useRef();
  const tbmPrintRef = useRef();

  const set = (f, v) => setState(prev => ({ ...prev, [f]: v }));
  const setT = (f, v) => setTbm(prev => ({ ...prev, [f]: v }));
  const updateRow = (id, f, v) => setState(prev => ({ ...prev, rows: prev.rows.map(r => r.id===id ? { ...r, [f]:v } : r) }));
  const addRow = (name="") => setState(prev => ({ ...prev, rows: [...prev.rows, { id:UID(), name, workers:"", work:"", note:"" }] }));
  const removeRow = id => setState(prev => ({ ...prev, rows: prev.rows.filter(r => r.id!==id) }));

  const setRM = (f, v) => setRosterMeta(prev => ({ ...prev, [f]: v }));
  const updateRosterRow = (id, f, v) => setRoster(prev => prev.map(r => r.id===id ? { ...r, [f]:v } : r));
  const addRosterRow = () => setRoster(prev => [...prev, defaultRosterRow()]);
  const removeRosterRow = id => setRoster(prev => prev.filter(r => r.id!==id));
  const importFromProcess = () => {
    const active = state.rows.filter(r => r.name && parseInt(r.workers) > 0);
    if (!active.length) { alert("공정별 출력인원에 입력된 내용이 없습니다."); return; }
    const rows = [];
    active.forEach(r => { const cnt = parseInt(r.workers)||0; for (let i=0;i<cnt;i++) rows.push({ id:UID(), no:"", job:r.name, team:"", name:"", am:"1", pm:"1", night:"", work:r.work||"", note:"" }); });
    setRoster(rows);
  };
  const clearRoster = () => { if (window.confirm("출력명부를 모두 지울까요?")) setRoster([defaultRosterRow()]); };

  // ── 출역집계: 보관함에 저장된 일지를 공정 → 사람 순으로 집계 ──
  const statMonths = useMemo(() => {
    const set = new Set();
    history.forEach(h => { const ym = String(h.date||"").slice(0,7); if (ym) set.add(ym); });
    return [...set].sort().reverse();
  }, [history]);

  const stats = useMemo(() => {
    const ym = statMonth || statMonths[0] || "";
    const entries = history.filter(h => String(h.date||"").startsWith(ym));
    // 공정(직종) → 팀 → 사람 3단계로 집계. 같은 석공이라도 1팀·2팀은 따로 나온다.
    const jobs = new Map();
    entries.forEach(h => (h.roster||[]).forEach(r => {
      const name = String(r.name||"").trim();
      if (!name) return;
      const job = String(r.job||"").trim() || "직종 미지정";
      const team = String(r.team||"").trim() || "팀 미지정";
      if (!jobs.has(job)) jobs.set(job, new Map());
      const tm = jobs.get(job);
      if (!tm.has(team)) tm.set(team, new Map());
      const nm = tm.get(team);
      if (!nm.has(name)) nm.set(name, { name, team, days: new Set(), gongsu: 0, night: 0, recs: [] });
      const e = nm.get(name);
      e.days.add(h.date);
      e.gongsu += (isOn(r.am) ? 0.5 : 0) + (isOn(r.pm) ? 0.5 : 0);
      if (isOn(r.night)) e.night += 1;
      e.recs.push({ date: h.date, am: isOn(r.am), pm: isOn(r.pm), night: isOn(r.night), work: String(r.work||"") });
    }));
    const sum = (arr, f) => arr.reduce((a,x) => a + f(x), 0);
    const out = [];
    for (const [job, tm] of jobs) {
      const tlist = [];
      for (const [team, nm] of tm) {
        const people = [...nm.values()]
          .map(e => ({ ...e, days: e.days.size, recs: e.recs.sort((a,b) => String(a.date).localeCompare(String(b.date))) }))
          .sort((a,b) => b.days - a.days || a.name.localeCompare(b.name));
        tlist.push({
          team, people,
          days: sum(people, x => x.days),
          gongsu: sum(people, x => x.gongsu),
          night: sum(people, x => x.night),
        });
      }
      tlist.sort((a,b) => a.team === "팀 미지정" ? 1 : b.team === "팀 미지정" ? -1 : a.team.localeCompare(b.team));
      out.push({
        job, teams: tlist,
        people: sum(tlist, t => t.people.length),
        days: sum(tlist, t => t.days),
        gongsu: sum(tlist, t => t.gongsu),
        night: sum(tlist, t => t.night),
      });
    }
    out.sort((a,b) => b.gongsu - a.gongsu);
    return { ym, entries: entries.length, jobs: out };
  }, [history, statMonth, statMonths]);

  // 이름 검색 — 같은 이름이면 팀이 달라도 한 사람으로 합치고, 팀별 내역을 따로 보여준다
  const personHits = useMemo(() => {
    const q = statQuery.trim();
    if (!q) return [];
    const ym = statMonth || statMonths[0] || "";
    const src = statAll ? history : history.filter(h => String(h.date||"").startsWith(ym));
    const map = new Map();
    src.forEach(h => (h.roster||[]).forEach(r => {
      const name = String(r.name||"").trim();
      if (!name || !name.includes(q)) return;
      if (!map.has(name)) map.set(name, { name, jobs: new Set(), teams: new Map(), days: new Set(), gongsu: 0, night: 0, recs: [] });
      const e = map.get(name);
      const job = String(r.job||"").trim() || "직종 미지정";
      const team = String(r.team||"").trim() || "팀 미지정";
      const g = (isOn(r.am) ? 0.5 : 0) + (isOn(r.pm) ? 0.5 : 0);
      e.jobs.add(job);
      if (!e.teams.has(team)) e.teams.set(team, { team, days: new Set(), gongsu: 0, night: 0 });
      const tv = e.teams.get(team);
      tv.days.add(h.date); tv.gongsu += g; if (isOn(r.night)) tv.night += 1;
      e.days.add(h.date); e.gongsu += g; if (isOn(r.night)) e.night += 1;
      e.recs.push({ date: h.date, team, job, am: isOn(r.am), pm: isOn(r.pm), night: isOn(r.night), work: String(r.work||""), site: String(h.site||"") });
    }));
    return [...map.values()].map(e => ({
      ...e,
      jobs: [...e.jobs],
      teams: [...e.teams.values()].map(t => ({ ...t, days: t.days.size })).sort((a,b) => b.gongsu - a.gongsu),
      days: e.days.size,
      recs: e.recs.sort((a,b) => String(b.date).localeCompare(String(a.date))),
    })).sort((a,b) => b.days - a.days || a.name.localeCompare(b.name));
  }, [statQuery, statAll, statMonth, statMonths, history]);

  const fmtNum = n => Number.isInteger(n) ? String(n) : n.toFixed(1);

  // ── 팀 마스터 관리 ──
  const updateTeam = (id, f, v) => setTeams(prev => prev.map(t => t.id===id ? { ...t, [f]:v } : t));
  const addTeam = () => setTeams(prev => [...prev, defaultTeamRow()]);
  const removeTeam = id => setTeams(prev => prev.filter(t => t.id!==id));

  // 과거 출력명부에 등장한 적 있는 이름 = 기존 인력. 처음 보는 이름은 검수 화면에서 '신규'로 표시
  const knownNames = useMemo(() => {
    const set = new Set();
    teams.forEach(t => (t.members||[]).forEach(n => { const v=String(n||"").trim(); if(v) set.add(v); }));
    history.forEach(h => (h.roster||[]).forEach(r => { const n=(r.name||"").trim(); if(n) set.add(n); }));
    roster.forEach(r => { const n=(r.name||"").trim(); if(n) set.add(n); });
    return set;
  }, [teams, history, roster]);

  // ── 명단 일괄 입력 (붙여넣기 / 캡쳐 이미지) ──
  const emptyGroup = (teamId="", sender="") => ({ id: UID(), teamId, sender, names: [], manual: "", tasks: [defaultTaskRow()], am:true, pm:true, night:false });
  const openBulk = () => setBulk({ mode:"paste", text:"", groups:[], parsed:false, teamToNote:false, busy:false, err:"", raw:"", pickTeam: teams[0]?.id || "", picked: [] });
  const teamById = id => teams.find(t => t.id === id) || null;

  // 반장 이름/별칭 → 팀 id 매핑표
  const senderMap = () => {
    const m = new Map();
    teams.forEach(t => {
      [t.leader, ...String(t.alias||"").split(/[,，、]/)]
        .map(x => String(x||"").replace(/\s+/g,"").trim())
        .filter(Boolean)
        .forEach(a => { if (!m.has(a)) m.set(a, t.id); });
    });
    return m;
  };

  // 텍스트 전체를 '보낸사람 → 그 사람이 올린 명단' 묶음으로 분리
  // 규칙: 한 줄이 통째로 등록된 반장 이름/별칭이고 그 팀이 아직 안 열렸으면 → 새 묶음 시작
  //       이미 열린 팀의 이름이면 그 사람도 작업자이므로 이름으로 취급 (예: 최림이 올린 명단 속 '엄최림')
  // 말풍선 폭 때문에 이름 중간에서 줄이 잘린 경우 되붙임
  // (예: "...권춘산.정연" / "학.김지남..." → 다음 줄 첫 글자가 1글자면 이어붙임)
  const glueWrapped = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      let cur = arr[i];
      const nxt = arr[i+1];
      if (nxt && !/[0-9０-９]/.test(nxt) && !LINE_SKIP.test(nxt)) {
        const head = nxt.split(/[\s,.\/·、|]+/).filter(Boolean)[0] || "";
        if (/^[가-힣]$/.test(head)) { cur = cur + nxt.trim(); i++; }
      }
      out.push(cur);
    }
    return out;
  };

  const parseGroups = (text) => {
    const map = senderMap();
    // 긴 별칭부터 검사 (예: '엄최림'이 '최림'보다 먼저)
    const keys = [...map.keys()].filter(k => k.length >= 2).sort((a,b) => b.length - a.length);
    const groups = []; const opened = new Set();
    let cur = null;
    const raw = String(text||"").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    glueWrapped(raw).forEach(line => {
      if (LINE_SKIP.test(line)) return;
      const compact = line.replace(/\s+/g, "");
      const found = parseNames(line);
      // 보낸사람 줄 판정: 등록된 반장 이름/별칭이 줄 안에 들어 있고(닉네임에 회사·직함이 붙어도 인식),
      // 그 줄에서 뽑히는 이름이 1개 이하일 때만. 이름이 여럿이면 명단 줄로 보고 이름을 살린다.
      if (found.length <= 1) {
        const hit = keys.find(k => compact.includes(k.replace(/\s+/g, "")) && !opened.has(map.get(k)));
        if (hit) {
          const tid = map.get(hit);
          opened.add(tid);
          cur = emptyGroup(tid, line);
          groups.push(cur);
          return;
        }
      }
      if (/[0-9０-９]/.test(line)) return;
      if (!found.length) return;
      if (!cur) { cur = emptyGroup("", "팀 미지정"); groups.push(cur); }
      found.forEach(n => { if (!cur.names.includes(n)) cur.names.push(n); });
    });
    return groups.filter(g => g.names.length);
  };

  // 설정에 등록된 팀 명단에서 직접 골라 묶음 만들기
  const togglePick = n => setBulk(b => ({ ...b, picked: b.picked.includes(n) ? b.picked.filter(x => x!==n) : [...b.picked, n] }));
  const pickAll = (all) => setBulk(b => ({ ...b, picked: all }));
  const applyPick = () => {
    if (!bulk.picked.length) { alert("고른 사람이 없습니다."); return; }
    const t = teamById(bulk.pickTeam);
    const g = emptyGroup(bulk.pickTeam, `${t?.team || "등록 명단"} (직접 선택)`);
    g.names = [...bulk.picked];
    setBulk(b => ({ ...b, groups: [...(b.groups||[]), g], parsed: true, picked: [], raw: "" }));
  };

  const doParse = (text) => {
    const src = text != null ? text : bulk.text;
    const gs = parseGroups(src);
    if (!gs.length) { alert("이름을 찾지 못했습니다.\n캡쳐가 흐리거나 명단이 없는 화면일 수 있습니다."); return; }
    setBulk(b => ({ ...b, groups: gs, parsed: true, raw: src, err: "" }));
  };

  // 캡쳐 이미지 → 축소 → 서버(OCR) → 묶음 분리
  const handleBulkImage = async (file) => {
    if (!file) return;
    setBulk(b => ({ ...b, busy:true, err:"" }));
    try {
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); });
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
      const MAX = 1800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const b64 = cv.toDataURL("image/jpeg", 0.92);
      const resp = await fetch("/api/ocr", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ image: b64 }) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `판독 서버 오류 (${resp.status})`);
      const text = data.text || "";
      if (!text.trim()) throw new Error("이미지에서 글자를 찾지 못했습니다. 더 선명한 캡쳐로 다시 시도해 주세요.");
      const gs = parseGroups(text);
      if (!gs.length) throw new Error("글자는 읽었지만 이름을 찾지 못했습니다. 아래 '직접 붙여넣기'로 확인해 주세요.");
      setBulk(b => ({ ...b, groups: gs, parsed: true, raw: text, busy:false, err:"" }));
    } catch (e) {
      setBulk(b => ({ ...b, busy:false, err: String((e && e.message) || e) }));
    }
  };

  // 묶음 단위 편집
  const updGroup = (gid, f, v) => setBulk(b => ({ ...b, groups: b.groups.map(g => g.id===gid ? { ...g, [f]:v } : g) }));
  const removeGroup = gid => setBulk(b => ({ ...b, groups: b.groups.filter(g => g.id!==gid) }));
  const removeGroupName = (gid, n) => setBulk(b => ({ ...b, groups: b.groups.map(g => g.id===gid ? { ...g, names: g.names.filter(x => x!==n) } : g) }));
  const addGroupName = gid => setBulk(b => ({ ...b, groups: b.groups.map(g => {
    if (g.id !== gid) return g;
    const n = String(g.manual||"").trim();
    if (!n || g.names.includes(n)) return { ...g, manual:"" };
    return { ...g, names:[...g.names, n], manual:"" };
  }) }));
  const updGroupTask = (gid, tid, f, v) => setBulk(b => ({ ...b, groups: b.groups.map(g => g.id===gid ? { ...g, tasks: g.tasks.map(t => t.id===tid ? { ...t, [f]:v } : t) } : g) }));
  const addGroupTask = gid => setBulk(b => ({ ...b, groups: b.groups.map(g => g.id===gid ? { ...g, tasks:[...g.tasks, defaultTaskRow()] } : g) }));
  const removeGroupTask = (gid, tid) => setBulk(b => ({ ...b, groups: b.groups.map(g => g.id===gid ? { ...g, tasks: g.tasks.filter(t => t.id!==tid) } : g) }));

  // 작업내용을 인원수만큼 순서대로 배분. 남은 인원은 마지막 작업내용을 따름
  const assignOf = (g) => {
    const res = []; let i = 0;
    (g.tasks||[]).forEach(t => { const n = parseInt(t.count)||0; for (let k=0; k<n && i<g.names.length; k++, i++) res.push(t.work||""); });
    const last = (g.tasks||[]).length ? (g.tasks[g.tasks.length-1].work||"") : "";
    while (res.length < g.names.length) res.push(last);
    return res;
  };

  const applyBulk = (mode) => {
    const gs = (bulk.groups||[]).filter(g => g.names.length);
    if (!gs.length) { alert("추가할 이름이 없습니다."); return; }
    const noTeam = gs.filter(g => !g.teamId);
    if (noTeam.length && !window.confirm(`팀을 고르지 않은 묶음이 ${noTeam.length}개 있습니다.\n직종·팀 없이 이름만 들어갑니다. 계속할까요?`)) return;
    const rows = [];
    gs.forEach(g => {
      const t = teamById(g.teamId);
      const assign = assignOf(g);
      g.names.forEach((nm, i) => rows.push({
        id: UID(), no:"", job: (t?.job||"").trim(), team: (t?.team||"").trim(), name: nm,
        am: g.am ? "1" : "", pm: g.pm ? "1" : "", night: g.night ? "1" : "",
        work: assign[i] || "",
        note: bulk.teamToNote ? (t?.team||"") : "",
      }));
    });
    if (mode === "replace") {
      if (!window.confirm("기존 출력명부를 지우고 이 명단으로 교체할까요?")) return;
      setRoster(rows);
    } else {
      setRoster(prev => {
        const base = prev.filter(r => (r.name||"").trim() || (r.job||"").trim() || (r.work||"").trim());
        return [...base, ...rows];
      });
    }
    // 마스터에 없던 새 이름은 해당 팀 소속 인원으로 자동 등록 (직접 지우기 전까지 계속 누적)
    const added = [];
    setTeams(prev => prev.map(t => {
      const g = gs.find(x => x.teamId === t.id);
      if (!g) return t;
      const cur = t.members || [];
      const news = g.names.filter(n => !cur.includes(n));
      if (!news.length) return t;
      news.forEach(n => added.push(`${t.team || t.leader}: ${n}`));
      return { ...t, members: [...cur, ...news] };
    }));
    setBulk(null);
    setSavedMsg(added.length ? `${rows.length}명 입력 · 신규 ${added.length}명 명단 등록됨!` : `${rows.length}명 출력명부에 입력됨!`);
    setTimeout(() => setSavedMsg(""), 2600);
  };


  useEffect(() => { save(state); if (state.manager) localStorage.setItem(MANAGER_KEY, state.manager); }, [state]);
  useEffect(() => { saveRoster(roster); }, [roster]);
  useEffect(() => { saveRosterMeta(rosterMeta); }, [rosterMeta]);
  useEffect(() => { saveTeams(teams); }, [teams]);

  // 출력명부(직종·인원)를 자동 집계해 '공정별 출력인원'을 채움 — 출력명부가 기준
  const aggregateRows = rs => {
    const map = new Map();
    rs.forEach(r => {
      const job = (r.job||"").trim();
      if (!job) return;
      if (!(r.name && r.name.trim()) && !isOn(r.am) && !isOn(r.pm) && !isOn(r.night)) return;
      if (!map.has(job)) map.set(job, { id:UID(), name:job, workers:0, work:r.work||"", note:"" });
      const e = map.get(job); e.workers += 1; if (!e.work && r.work) e.work = r.work;
    });
    return [...map.values()].map(e => ({ ...e, workers:String(e.workers) }));
  };
  useEffect(() => { const agg = aggregateRows(roster); if (agg.length) setState(prev => ({ ...prev, rows: agg })); }, [roster]);

  const addSite = () => { if (!newSite.trim()) return; const u = [...sites, newSite.trim()]; setSites(u); saveSites(u); setNewSite(""); };
  const removeSite = name => { const u = sites.filter(s => s!==name); setSites(u); saveSites(u); };

  const totalWorkers = state.rows.reduce((s, r) => s + (parseInt(r.workers)||0), 0);
  const months = [...new Set(history.map(h => (h.date||"").slice(0,7)).filter(Boolean))].sort().reverse();

  const generateTBM = () => {
    const active = state.rows.filter(r => r.name && parseInt(r.workers) > 0);
    if (!active.length) { alert("인원이 입력된 공정이 없습니다."); return; }
    const names = active.map(r => r.name);
    const tpls = names.map(n => TEMPLATES[n]).filter(Boolean);
    setTbm({
      subject: names.join(", ") + " 작업",
      s1_1: `자재 야적 시 신호수 배치 후 ${names.join(", ")} 시공작업 부위 확인`,
      s1_2: [...new Set(roster.map(r => (r.work||"").trim()).filter(Boolean))].join(", "),
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

  // 안전교육일지(TBM)는 화면에 항상 렌더된 .print-only 영역을 그대로 인쇄.
  // (body 클래스 토글 없이 단순 print() — 모바일 'PDF로 저장'에서 가장 안정적)
  const handlePrint = () => window.print();
  const handleCopy = () => { navigator.clipboard.writeText(outputText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  // 노드 1개를 PNG+PDF로 캡처(같은 캔버스 재사용)
  const captureNode = async node => {
    if (!node) return null;
    const { default: html2canvas } = await import("html2canvas");
    const prev = node.style.display; node.style.display = "block";
    try {
      const canvas = await html2canvas(node, { scale:2, backgroundColor:"#ffffff", useCORS:true });
      const png = await new Promise(r => canvas.toBlob(r, "image/png"));
      const dataUrl = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit:"px", format:[canvas.width, canvas.height], orientation: canvas.width >= canvas.height ? "l" : "p" });
      pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
      return { png, pdf: pdf.output("blob") };
    } finally { node.style.display = prev; }
  };
  // 저장 시 결과물(출력일보/안전교육일지 PNG+PDF)을 IndexedDB에 보관, 보유 플래그 반환
  const saveArtifacts = async id => {
    const hasRoster = roster.some(r => `${r.job||""}${r.name||""}${r.am||""}${r.pm||""}${r.night||""}${r.work||""}`.trim());
    const hasTbm = !!(tbm.subject && tbm.subject.trim());
    const files = { rosterPng:false, rosterPdf:false, tbmPng:false, tbmPdf:false };
    try {
      const rec = {};
      if (hasRoster) { const a = await captureNode(rosterPrintRef.current); if (a) { rec.rosterPng = a.png; rec.rosterPdf = a.pdf; files.rosterPng = !!a.png; files.rosterPdf = !!a.pdf; } }
      if (hasTbm) { const a = await captureNode(tbmPrintRef.current); if (a) { rec.tbmPng = a.png; rec.tbmPdf = a.pdf; files.tbmPng = !!a.png; files.tbmPdf = !!a.pdf; } }
      if (Object.keys(rec).length) await idbPut(id, rec); else await idbDel(id).catch(() => {});
    } catch (e) {
      alert("결과물(이미지/PDF) 보관 중 오류가 발생했습니다. 일지 본문은 정상 저장됩니다.");
      return { rosterPng:false, rosterPdf:false, tbmPng:false, tbmPdf:false };
    }
    return files;
  };
  // 저장목록에서 보관된 이미지 열기 → 미리보기 모달(이미지) + PDF/저장
  const openArtifact = async (id, pngKey, pdfKey, baseName) => {
    try {
      const rec = await idbGet(id);
      const blob = rec && rec[pngKey];
      if (!blob) { alert("보관된 이미지가 없습니다."); return; }
      const url = await blobToDataURL(blob);
      setPreview({ url, filename: `${baseName}.png`, allowPdf: !!(rec && rec[pdfKey]), artifact: { id, pdfKey, pdfName: `${baseName}.pdf` } });
    } catch (e) { alert("이미지를 불러오지 못했습니다."); }
  };
  // 미리보기 → 보관된 PDF 다운로드
  const handlePdfFromPreview = async () => {
    if (!preview || !preview.artifact) return;
    try {
      const rec = await idbGet(preview.artifact.id);
      const blob = rec && rec[preview.artifact.pdfKey];
      if (!blob) { alert("보관된 PDF가 없습니다."); return; }
      downloadBlob(blob, preview.artifact.pdfName);
    } catch (e) { alert("PDF를 불러오지 못했습니다."); }
  };
  // 내보내기: 데이터(json) + 이미지(png) + PDF를 ZIP 한 파일로
  const buildZip = async entries => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("data.json", JSON.stringify(entries, null, 2));
    for (const e of entries) {
      let rec = null; try { rec = await idbGet(e.id); } catch (err) { rec = null; }
      const folder = `${e.date}_${(e.site||"현장").replace(/[\\/:*?"<>|]/g,"_")}`;
      if (rec && rec.rosterPng) zip.file(`${folder}/출력일보.png`, rec.rosterPng);
      if (rec && rec.rosterPdf) zip.file(`${folder}/출력일보.pdf`, rec.rosterPdf);
      if (rec && rec.tbmPng) zip.file(`${folder}/안전교육일지.png`, rec.tbmPng);
      if (rec && rec.tbmPdf) zip.file(`${folder}/안전교육일지.pdf`, rec.tbmPdf);
    }
    return await zip.generateAsync({ type:"blob" });
  };
  const exportEntries = async (entries, name) => {
    if (!entries.length) { alert("내보낼 항목이 없습니다."); return; }
    setSavedMsg("내보내기 생성 중...");
    try { const blob = await buildZip(entries); downloadBlob(blob, name); setSavedMsg("내보내기 완료"); }
    catch (e) { alert("내보내기 중 오류가 발생했습니다."); setSavedMsg(""); return; }
    setTimeout(() => setSavedMsg(""), 2000);
  };
  const exportMonth = ym => { if (!ym) { alert("월을 선택해 주세요."); return; } exportEntries(history.filter(h => (h.date||"").startsWith(ym)), `site-diary_${ym}.zip`); };
  const exportDay = e => exportEntries([e], `site-diary_${e.date}.zip`);
  const deleteMonth = ym => {
    if (!ym) { alert("월을 선택해 주세요."); return; }
    const targets = history.filter(h => (h.date||"").startsWith(ym));
    if (!targets.length) { alert("해당 월의 저장 항목이 없습니다."); return; }
    if (!window.confirm(`${ym} 의 저장 항목 ${targets.length}건을 모두 삭제할까요?\n(되돌릴 수 없습니다)`)) return;
    setHistory(history.filter(h => !(h.date||"").startsWith(ym)));
    saveHistory(history.filter(h => !(h.date||"").startsWith(ym)));
    targets.forEach(t => idbDel(t.id).catch(() => {}));
  };

  const handleSave = async () => {
    // 같은 현장·같은 날짜의 일지가 이미 있으면 덮어쓰기 확인
    const dup = history.find(h => h.date === state.date && (h.site||"") === (state.site||""));
    if (dup) {
      const ok = window.confirm(`⚠️ ${state.date} 같은 날짜의 일지가 이미 저장되어 있습니다.\n\n기존 일지를 덮어쓸까요?\n(취소하면 저장하지 않습니다.)`);
      if (!ok) return;
    }
    const id = dup ? dup.id : UID();
    setSavedMsg("저장 중...");
    const files = await saveArtifacts(id);
    const e = { ...state, roster, rosterMeta, files, savedAt: new Date().toISOString(), id };
    const u = dup ? history.map(h => h.id === id ? e : h) : [e, ...history];
    setHistory(u); saveHistory(u);
    // 저장 후: 작성 화면 비움(데이터는 저장목록에 보관) → 안내 → 저장목록으로 이동
    setState(defaultState(state.site));
    setRoster([defaultRosterRow()]);
    setShowOutput(false); setShowTBM(false); setPhotos([]);
    setSavedMsg("저장되었습니다"); setTimeout(() => setSavedMsg(""), 2000);
    setTab("history");
  };
  // 전일(가장 최근 저장본) 작업 내용을 현재 작성 폼으로 복사 — 날짜는 오늘로 유지
  const handleCopyPrev = () => {
    if (!history.length) { alert("저장된 일지가 없습니다. 먼저 일지를 저장해 주세요."); return; }
    const prev = [...history].sort((a,b) => (b.savedAt||"").localeCompare(a.savedAt||""))[0];
    if (!window.confirm(`'${prev.date}' 일지의 작업 내용을 불러올까요?\n(날짜는 오늘 ${TODAY()}로 설정됩니다)`)) return;
    setState({
      date: TODAY(),
      site: prev.site || state.site,
      manager: prev.manager || state.manager,
      weather: prev.weather || "",
      mainWork: prev.mainWork || "",
      special: prev.special || "",
      rows: (prev.rows && prev.rows.length ? prev.rows : defaultRows()).map(r => ({ ...r, id: UID() })),
    });
    // 전일 출력일지(출력명부)도 그대로 함께 복사
    if (prev.roster && prev.roster.length) setRoster(prev.roster.map(r => ({ ...r, id: UID() })));
    if (prev.rosterMeta) setRosterMeta(prev.rosterMeta);
    setSavedMsg("전일 작업·출력일지 복사됨!"); setTimeout(() => setSavedMsg(""), 2000);
  };
  const handleNewDay = () => { if (window.confirm("새 날짜로 초기화할까요? (출력명부는 유지됩니다)")) { setState({ ...defaultState(state.site), date: TODAY() }); setShowOutput(false); setShowTBM(false); setPhotos([]); } };
  const loadEntry = e => {
    setState(e);
    // 저장 당시의 출력명부(명단)도 함께 복원
    if (e.roster && e.roster.length) setRoster(e.roster.map(r => ({ ...r, id: UID() })));
    else setRoster([defaultRosterRow()]);
    if (e.rosterMeta) setRosterMeta(e.rosterMeta);
    setTab("write"); setShowOutput(false); setShowTBM(false);
  };
  const deleteEntry = id => { const u = history.filter(h => h.id!==id); setHistory(u); saveHistory(u); idbDel(id).catch(() => {}); };

  // PNG: 캡처 → 미리보기 모달 (안전교육일지/출력명부 공통)
  const captureToPreview = async (node, filename) => {
    if (!node) return;
    setImgBusy(true);
    const prevDisplay = node.style.display;
    node.style.display = "block";
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, { scale:2, backgroundColor:"#ffffff", useCORS:true });
      setPreview({ url: canvas.toDataURL("image/png"), filename });
    } catch (err) {
      alert("이미지 생성 중 오류가 발생했습니다.");
    } finally {
      node.style.display = prevDisplay;
      setImgBusy(false);
    }
  };
  // 미리보기 '저장': 안드로이드 등은 Web Share(파일)로 갤러리 저장, 미지원 시 다운로드 폴백
  const handleSavePreview = async () => {
    if (!preview) return;
    try {
      const blob = await (await fetch(preview.url)).blob();
      const file = new File([blob], preview.filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: preview.filename });
        setPreview(null);
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // 사용자가 공유 취소 → 미리보기 유지
      // 그 외 오류는 아래 다운로드로 폴백
    }
    const link = document.createElement("a");
    link.download = preview.filename;
    link.href = preview.url;
    link.click();
    setPreview(null);
  };
  const handleDownloadRosterImage = () => captureToPreview(rosterPrintRef.current, `출력명부_${state.date}.png`);

  // 안전교육일지 PNG 저장 — 출력명부와 동일한 미리보기+갤러리저장 흐름(서식·기존 PDF 미변경)
  const handleDownloadTbmImage = () => captureToPreview(tbmPrintRef.current, `안전교육일지_${state.date}.png`);

  // 출력명부를 팀(없으면 직종) → 동별로 집계. 작업내용·비고에서 'N동'을 자동 추출
  const teamStats = (rosterArr) => {
    const groups = new Map(); // 팀명 → { job, dongs: Map(동 → {cnt, works:Set}) }
    (rosterArr || []).forEach(r => {
      const job = (r.job || "").trim();
      const team = (r.team || "").trim() || job;
      if (!team) return;
      const m = `${r.work||""} ${r.note||""}`.match(/(\d+)\s*동/);
      const dong = m ? `${m[1]}동` : "동미상";
      if (!groups.has(team)) groups.set(team, { job, dongs: new Map() });
      const g = groups.get(team);
      if (!g.dongs.has(dong)) g.dongs.set(dong, { cnt: 0, works: new Set() });
      const d = g.dongs.get(dong);
      d.cnt += 1;
      // 작업내용 앞의 'N동'은 이미 동 이름으로 표시되므로 중복 제거 (예: "104동 외벽 석재 설치" → "외벽 석재 설치")
      const w = (r.work || "").trim().replace(/^\s*\d+\s*동\s*/, "").trim();
      if (w) d.works.add(w);
    });
    const sortDong = (a, b) => a[0]==="동미상" ? 1 : b[0]==="동미상" ? -1 : parseInt(a[0]) - parseInt(b[0]);
    const out = [];
    for (const [team, g] of groups) {
      const ents = [...g.dongs.entries()].sort(sortDong);
      const sum = ents.reduce((s, [,d]) => s + d.cnt, 0);
      out.push({ team, job: g.job, total: sum, dongs: ents.map(([dong, d]) => ({ dong, cnt: d.cnt, works: [...d.works] })) });
    }
    return out;
  };

  // 밴드/카톡 공유용 — 팀별 총원 + 동별 분배
  const dongLines = (rosterArr) => {
    const stats = teamStats(rosterArr);
    const lines = []; let total = 0;
    stats.forEach(st => {
      lines.push(`▪ ${st.team} 총 ${st.total}명`);
      st.dongs.forEach(d => { lines.push(`   ㆍ${d.dong} ${d.cnt}명${d.works.length ? ` (${d.works.join(", ")})` : ""}`); });
      total += st.total;
    });
    return { lines, total };
  };

  // 주요 업무란 자동 작성 — 팀별 한 줄 요약
  const buildMainWork = (rosterArr) => teamStats(rosterArr).map(st => {
    const parts = st.dongs.map(d => `${d.dong} ${d.cnt}명${d.works.length ? `(${d.works.join(" / ")})` : ""}`);
    return `${st.team} ${st.total}명 · ${parts.join(" · ")}`;
  }).join("\n");

  const fillMainWork = () => {
    const txt = buildMainWork(roster);
    if (!txt) { alert("출력명부에 입력된 인원이 없습니다."); return; }
    if (state.mainWork.trim() && !window.confirm("주요 업무란의 기존 내용을 지우고 새로 작성할까요?")) return;
    set("mainWork", txt);
    setSavedMsg("주요 업무 자동 작성됨!"); setTimeout(() => setSavedMsg(""), 2000);
  };
  const shareTextFrom = (e) => {
    const { lines, total } = dongLines(e.roster);
    const body = lines.length
      ? [`【 팀·동별 출력인원 】`, ...lines, `▶ 합계: 총 ${total}명`]
      : [`【 공정별 출력인원 】`, ...(e.rows||[]).filter(r => r.name).map(r => `▪ ${r.name}: ${r.workers||0}명${r.work?` / ${r.work}`:""}${r.note?` (${r.note})`:""}`), `▶ 합계: 총 ${(e.rows||[]).reduce((s,r)=>s+(parseInt(r.workers)||0),0)}명`];
    return [
      `📋 일일 현장업무일지`, `━━━━━━━━━━━━━━━━━━━━━━`,
      `📅 날짜: ${e.date}`, `🏗️ 현장: ${e.site}`, `👷 현장소장: ${e.manager}`,
      e.weather ? `🌤️ 날씨: ${e.weather}` : null, ``,
      ...body,
      e.mainWork ? `\n【 주요 업무 】\n${e.mainWork}` : null,
      e.special ? `\n【 특이사항/지시사항 】\n${e.special}` : null,
    ].filter(Boolean).join("\n");
  };
  const outputText = () => shareTextFrom({ date: state.date, site: state.site, manager: state.manager, weather: state.weather, roster, rows: state.rows, mainWork: state.mainWork, special: state.special });

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
          <button style={c.tab(tab==="write")} onClick={() => setTab("write")}>✍️ 작성</button>
          <button style={c.tab(tab==="history")} onClick={() => setTab("history")}>📁 보관함({history.length})</button>
          <button style={c.tab(tab==="stats")} onClick={() => setTab("stats")}>📊 출역집계</button>
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

              <div style={{ ...c.card, border:"1px solid #6f42c1", background:"#f8f5ff", marginTop:4 }}>
                <div onClick={() => setOpenRoster(v=>!v)} style={{ ...c.ct, color:"#6f42c1", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:openRoster?12:0 }}><span>🧾 출력점검 및 노무비 일계표 - 출력명부</span><span style={{ fontSize:13 }}>{openRoster?"▾":"▸"}</span></div>
                {openRoster && (<>
                <div style={c.g2}>
                  <div><label style={c.lbl}>업체명</label><input style={c.ti} value={rosterMeta.company} onChange={e => setRM("company", e.target.value)} /></div>
                  <div><label style={c.lbl}>공종명</label><input style={c.ti} value={rosterMeta.workType} onChange={e => setRM("workType", e.target.value)} /></div>
                </div>
                <label style={c.lbl}>현장명</label>
                <input style={c.ti} value={rosterMeta.siteName} onChange={e => setRM("siteName", e.target.value)} />

                <button style={{ ...c.btn("#e6f4ea","#137333", 12), border:"1px solid #137333" }} onClick={openBulk}>📷 카톡 캡쳐본/명단 → 일괄 입력</button>

                {roster.map((r, idx) => (
                  <div key={r.id} style={c.rw}>
                    <div style={c.rt}>
                      <span style={{ fontSize:12, color:"#888", width:18 }}>{idx+1}</span>
                      <input value={r.job} onChange={e => updateRosterRow(r.id,"job",e.target.value)} placeholder="직종" style={{ flex:1, minWidth:0 }} />
                      <select value={r.team || ""} onChange={e => updateRosterRow(r.id,"team",e.target.value)} style={{ width:92, flexShrink:0, padding:"8px 4px", fontSize:12, border:"1px solid #ddd", borderRadius:6, background:"#fff" }}>
                        <option value="">팀 없음</option>
                        {teams.map(t => t.team ? <option key={t.id} value={t.team}>{t.team}</option> : null)}
                        {r.team && !teams.some(t => t.team === r.team) && <option value={r.team}>{r.team}</option>}
                      </select>
                      <input value={r.name} onChange={e => updateRosterRow(r.id,"name",e.target.value)} placeholder="성명" style={{ flex:1, minWidth:0 }} />
                      <button onClick={() => removeRosterRow(r.id)} style={c.del}>✕</button>
                    </div>
                    <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                      {[["am","오전"],["pm","오후"],["night","야간"]].map(([f,lb]) => (
                        <label key={f} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 0", fontSize:13,
                          border:`1px solid ${isOn(r[f]) ? "#6f42c1" : "#ddd"}`, borderRadius:6, cursor:"pointer", whiteSpace:"nowrap", minWidth:0,
                          background: isOn(r[f]) ? "#f3efff" : "#fff", color: isOn(r[f]) ? "#6f42c1" : "#888", fontWeight: isOn(r[f]) ? 600 : 400 }}>
                          <input type="checkbox" checked={isOn(r[f])} onChange={e => updateRosterRow(r.id, f, e.target.checked ? "1" : "")} style={{ margin:0, width:15, height:15, flexShrink:0 }} />
                          {lb}
                        </label>
                      ))}
                    </div>
                    <input value={r.work} onChange={e => updateRosterRow(r.id,"work",e.target.value)} placeholder="작업내용" style={{ marginBottom:6 }} />
                    <input value={r.note} onChange={e => updateRosterRow(r.id,"note",e.target.value)} placeholder="비고" />
                  </div>
                ))}

                <div style={c.sr}>
                  <button style={c.sb("#f0f4ff","#6f42c1")} onClick={addRosterRow}>+ 인원 추가</button>
                  <button style={c.sb("none","#ea4335")} onClick={clearRoster}>전체 지우기</button>
                </div>

                <button style={c.btn("#6f42c1","#fff")} onClick={handleDownloadRosterImage} disabled={imgBusy}>{imgBusy?"이미지 생성 중...":"🖼️ 출력명부 사진(이미지)으로 저장"}</button>
                </>)}
              </div>


            <div style={c.card}>
              <div style={c.ct}>📌 주요 업무</div>
              <button style={{ ...c.btn("#e6f4ea","#137333", 8), border:"1px solid #137333" }} onClick={fillMainWork}>🔄 출력명부에서 자동 작성 (팀·동별)</button>
              <textarea value={state.mainWork} onChange={e => set("mainWork", e.target.value)} placeholder="오늘의 주요 업무 내용" rows={5} />
            </div>

            <div style={c.card}>
              <div style={c.ct}>⚠️ 특이사항 / 지시사항</div>
              <textarea value={state.special} onChange={e => set("special", e.target.value)} placeholder="공정 이슈, 자재 입고 예정, 원청 지시사항 등" rows={3} />
            </div>

            <div style={c.sr}>
              <button style={c.sb("#34a853","#fff")} onClick={handleSave}>💾 저장</button>
              <button style={c.sb("none","#ea4335")} onClick={handleNewDay}>🔄 새 날짜</button>
            </div>
            <button style={c.btn("#f0f4ff","#1a73e8")} onClick={handleCopyPrev}>📄 전일 작업 내용 복사하기</button>

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
                <div onClick={() => setOpenTbm(v=>!v)} style={{ ...c.ct, color:"#34a853", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:openTbm?12:0 }}><span>📋 안전교육일지 입력</span><span style={{ fontSize:13 }}>{openTbm?"▾":"▸"}</span></div>
                {openTbm && (<>
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
                <button style={c.btn("#6f42c1","#fff")} onClick={handleDownloadTbmImage} disabled={imgBusy}>{imgBusy?"이미지 생성 중...":"🖼️ 안전교육일지 사진(이미지)으로 저장"}</button>
                <button style={c.btn("#ff6d00","#fff")} onClick={handlePrint}>🖨️ PDF 출력</button>
                </>)}
              </div>
            )}

          </>}

          {tab==="history" && <>
            <div style={{ marginBottom:12, paddingBottom:10, borderBottom:"2px solid #e8e8e8" }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#1a73e8" }}>📁 완료 기록 보관함</div>
              <div style={{ fontSize:12, color:"#888", marginTop:3, lineHeight:1.5 }}>작성·저장이 끝난 일지와 결과물(이미지·PDF)을 모아둔 곳이에요. 불러오기 · 내보내기(ZIP) · 월별/개별 삭제가 가능합니다.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
              {["전체", ...sites].map(s => (
                <button key={s} onClick={() => setHistFilter(s)} style={{ fontSize:12, padding:"5px 10px", borderRadius:16, border:"1px solid", borderColor:histFilter===s?"#1a73e8":"#ddd", background:histFilter===s?"#e8f0fe":"#fff", color:histFilter===s?"#1a73e8":"#666", cursor:"pointer" }}>{s}</button>
              ))}
            </div>
            {months.length > 0 && (
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:12, padding:"10px 12px", background:"#fff", borderRadius:10, border:"1px solid #e8e8e8" }}>
                <span style={{ fontSize:12, color:"#666", whiteSpace:"nowrap" }}>월별 관리</span>
                <select value={exportMonthSel || months[0]} onChange={e => setExportMonthSel(e.target.value)} style={{ flex:1, minWidth:96, padding:"7px 8px", fontSize:13, border:"1px solid #ddd", borderRadius:6 }}>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => exportMonth(exportMonthSel || months[0])} style={{ padding:"7px 10px", fontSize:12, background:"#1a73e8", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", whiteSpace:"nowrap" }}>⬇ ZIP</button>
                <button onClick={() => deleteMonth(exportMonthSel || months[0])} style={{ padding:"7px 10px", fontSize:12, background:"none", color:"#ea4335", border:"1px solid #ea4335", borderRadius:6, cursor:"pointer", whiteSpace:"nowrap" }}>월 삭제</button>
              </div>
            )}
            {history.filter(h => histFilter==="전체" || h.site===histFilter).length===0 && <div style={{ textAlign:"center", color:"#aaa", padding:"40px 0", fontSize:14 }}>저장된 일지가 없습니다</div>}
            {history.filter(h => histFilter==="전체" || h.site===histFilter).map(h => {
              const tot = h.rows?.reduce((s,r) => s+(parseInt(r.workers)||0),0)||0;
              return (
                <div key={h.id} style={c.hc}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1a73e8", marginBottom:4 }}>{h.date}</div>
                  <div style={{ fontSize:12, color:"#888", marginBottom:2 }}>{h.site}</div>
                  <div style={{ fontSize:13, color:"#555", marginBottom:8 }}>총 {tot}명{h.weather?` · ${h.weather}`:""}</div>
                  {h.mainWork && <div style={{ fontSize:12, color:"#888", marginBottom:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.mainWork.slice(0,40)}</div>}
                  {(h.files?.rosterPng || h.files?.tbmPng) && (
                    <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                      {h.files?.rosterPng && <button style={{ flex:1, minWidth:120, padding:"6px 0", fontSize:12, background:"#f5f0ff", color:"#6f42c1", border:"none", borderRadius:6, cursor:"pointer" }} onClick={() => openArtifact(h.id, "rosterPng", "rosterPdf", `출력일보_${h.date}`)}>🖼️ 출력일보</button>}
                      {h.files?.tbmPng && <button style={{ flex:1, minWidth:120, padding:"6px 0", fontSize:12, background:"#f0fff4", color:"#34a853", border:"none", borderRadius:6, cursor:"pointer" }} onClick={() => openArtifact(h.id, "tbmPng", "tbmPdf", `안전교육일지_${h.date}`)}>🖼️ 안전교육일지</button>}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                    <button style={{ flex:1, minWidth:120, padding:"6px 0", fontSize:12, background:"#e8f0fe", color:"#1a73e8", border:"none", borderRadius:6, cursor:"pointer" }} onClick={() => setShareView(shareTextFrom(h))}>📤 밴드/카톡 공유</button>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ flex:1, padding:"7px 0", fontSize:13, background:"#f0f4ff", color:"#1a73e8", border:"none", borderRadius:6, cursor:"pointer" }} onClick={() => loadEntry(h)}>불러오기</button>
                    <button style={{ padding:"7px 10px", fontSize:13, background:"#eef7ee", color:"#188038", border:"none", borderRadius:6, cursor:"pointer" }} title="이 날짜 ZIP 내보내기" onClick={() => exportDay(h)}>⬇</button>
                    <button style={{ padding:"7px 12px", fontSize:13, background:"none", color:"#ea4335", border:"1px solid #ea4335", borderRadius:6, cursor:"pointer" }} onClick={() => deleteEntry(h.id)}>삭제</button>
                  </div>
                </div>
              );
            })}
          </>}

          {tab==="stats" && <>
            <div style={c.card}>
              <div style={c.ct}>📊 출역집계 — 공정별 · 사람별</div>
              {statMonths.length ? (<>
                <label style={c.lbl}>집계 월</label>
                <select style={{ ...c.ti, marginBottom:4 }} value={stats.ym} onChange={e => { setStatMonth(e.target.value); setStatOpen(""); }}>
                  {statMonths.map(m => <option key={m} value={m}>{m.replace("-", "년 ")}월</option>)}
                </select>
                <div style={{ fontSize:12, color:"#888", marginBottom:12 }}>
                  저장된 일지 {stats.entries}일 기준 · 오전+오후 = 1공수, 한쪽만 체크 = 0.5공수
                </div>

                <label style={c.lbl}>이름으로 찾기</label>
                <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                  <input value={statQuery} onChange={e => setStatQuery(e.target.value)} placeholder="예) 김철" style={{ flex:1, minWidth:0 }} />
                  {statQuery && <button onClick={() => setStatQuery("")} style={{ padding:"8px 14px", background:"#f1f3f4", color:"#555", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>지우기</button>}
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#555", cursor:"pointer" }}>
                  <input type="checkbox" checked={statAll} onChange={e => setStatAll(e.target.checked)} style={{ width:15, height:15, margin:0 }} />
                  전체 기간에서 찾기 (선택한 달 무시)
                </label>
              </>) : (
                <div style={{ fontSize:13, color:"#888", lineHeight:1.6 }}>
                  아직 저장된 일지가 없습니다. 작성 탭에서 일지를 저장하면 이곳에 사람별 출역일수가 쌓입니다.
                </div>
              )}
            </div>

            {statQuery.trim() ? (
              personHits.length ? personHits.map(pp => (
                <div key={pp.name} style={c.card}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8, paddingBottom:8, borderBottom:"2px solid #1a73e8" }}>
                    <span style={{ fontSize:17, fontWeight:700 }}>{pp.name}</span>
                    <span style={{ fontSize:12, color:"#888" }}>{pp.jobs.join(", ")}</span>
                    <span style={{ marginLeft:"auto", fontSize:14, fontWeight:700, color:"#1a73e8" }}>
                      {pp.days}일 · {fmtNum(pp.gongsu)}공수{pp.night ? ` · 야간 ${pp.night}` : ""}
                    </span>
                  </div>

                  {/* 같은 이름이 여러 팀에 걸쳐 있으면 팀별로 나눠 표시 */}
                  <div style={{ margin:"10px 0" }}>
                    {pp.teams.map(tv => (
                      <div key={tv.team} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background:"#f3efff", borderRadius:6, marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"#6f42c1" }}>{tv.team}</span>
                        <span style={{ marginLeft:"auto", fontSize:12, fontWeight:600, color:"#6f42c1" }}>
                          {tv.days}일 · {fmtNum(tv.gongsu)}공수{tv.night ? ` · 야간 ${tv.night}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>날짜별 내역 ({pp.recs.length}건)</div>
                  <div style={{ background:"#fafbff", borderRadius:6, padding:"6px 8px", maxHeight:280, overflowY:"auto" }}>
                    {pp.recs.map((rc, i) => (
                      <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#555", padding:"5px 0", borderBottom: i < pp.recs.length-1 ? "1px solid #eef0f7" : "none" }}>
                        <span style={{ width:74, color:"#888", flexShrink:0 }}>{String(rc.date).slice(2)}</span>
                        <span style={{ width:56, color:"#6f42c1", flexShrink:0, fontSize:11 }}>{[rc.am&&"오전",rc.pm&&"오후",rc.night&&"야간"].filter(Boolean).join("·") || "-"}</span>
                        <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rc.work || "-"}</span>
                      </div>
                    ))}
                  </div>

                  <button style={{ ...c.btn("#1a73e8","#fff", 0), marginTop:10 }} onClick={() => {
                    const L = [`📋 ${pp.name} 출역내역 ${statAll ? "(전체 기간)" : `(${stats.ym})`}`, "━━━━━━━━━━━━━━━━━━━━━━",
                      `총 ${pp.days}일 · ${fmtNum(pp.gongsu)}공수${pp.night?` · 야간 ${pp.night}`:""}`];
                    if (pp.teams.length > 1) pp.teams.forEach(tv => L.push(` ▪ ${tv.team} ${tv.days}일 · ${fmtNum(tv.gongsu)}공수`));
                    L.push("");
                    pp.recs.forEach(rc => L.push(`${rc.date} ${[rc.am&&"오전",rc.pm&&"오후",rc.night&&"야간"].filter(Boolean).join("·")||"-"} ${rc.work||""}`.trim()));
                    navigator.clipboard.writeText(L.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
                  }}>📋 {pp.name} 내역 복사</button>
                </div>
              )) : (
                <div style={c.card}>
                  <div style={{ fontSize:13, color:"#888", lineHeight:1.6 }}>
                    '{statQuery}' 에 해당하는 사람이 {statAll ? "저장된 일지" : `${stats.ym}`}에 없습니다.
                    {!statAll && " 아래 '전체 기간에서 찾기'를 켜고 다시 찾아보세요."}
                  </div>
                </div>
              )
            ) : stats.jobs.map(j => (
              <div key={j.job} style={c.card}>
                <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4, paddingBottom:8, borderBottom:"2px solid #1a73e8" }}>
                  <span style={{ fontSize:15, fontWeight:700, color:"#1a73e8" }}>{j.job}</span>
                  <span style={{ fontSize:12, color:"#888" }}>{j.teams.length}개 팀 · {j.people}명</span>
                  <span style={{ marginLeft:"auto", fontSize:13, fontWeight:600, color:"#333" }}>
                    총 {fmtNum(j.gongsu)}공수{j.night ? ` · 야간 ${j.night}` : ""}
                  </span>
                </div>
                {j.teams.map(tg => { const tkey = `${j.job}|${tg.team}`; const topen = !!teamOpen[tkey]; return (<div key={tg.team}>
                <div onClick={() => setTeamOpen(prev => ({ ...prev, [tkey]: !prev[tkey] }))}
                  style={{ display:"flex", alignItems:"center", gap:6, margin:"12px 0 2px", padding:"9px 10px", background: topen ? "#ebe4ff" : "#f3efff", borderRadius:6, cursor:"pointer" }}>
                  <span style={{ fontSize:14, fontWeight:700, color:"#6f42c1" }}>{tg.team}</span>
                  <span style={{ fontSize:11, color:"#9b8bbd" }}>{tg.people.length}명</span>
                  <span style={{ marginLeft:"auto", fontSize:14, fontWeight:700, color:"#6f42c1" }}>
                    {fmtNum(tg.gongsu)}공수{tg.night ? ` · 야간 ${tg.night}` : ""}
                  </span>
                  <span style={{ fontSize:11, color:"#6f42c1", border:"1px solid #c7b6f5", borderRadius:10, padding:"2px 8px", whiteSpace:"nowrap" }}>
                    {topen ? "접기 ▾" : "자세히 ▸"}
                  </span>
                </div>
                {topen && tg.people.map(pp => {
                  const key = `${j.job}|${tg.team}|${pp.name}`;
                  const open = statOpen === key;
                  return (
                    <div key={key} style={{ borderBottom:"1px solid #f0f0f0" }}>
                      <div onClick={() => setStatOpen(open ? "" : key)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 2px", cursor:"pointer" }}>
                        <span style={{ fontSize:14, fontWeight:600 }}>{pp.name}</span>
                        <span style={{ marginLeft:"auto", fontSize:13, color:"#333" }}>
                          <b style={{ color:"#1a73e8" }}>{pp.days}</b>일 · {fmtNum(pp.gongsu)}공수{pp.night ? ` · 야${pp.night}` : ""}
                        </span>
                        <span style={{ fontSize:11, color:"#bbb" }}>{open ? "▾" : "▸"}</span>
                      </div>
                      {open && (
                        <div style={{ background:"#fafbff", borderRadius:6, padding:"6px 8px", marginBottom:8 }}>
                          {pp.recs.map((rc, i) => (
                            <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#555", padding:"3px 0", borderBottom: i < pp.recs.length-1 ? "1px solid #eef0f7" : "none" }}>
                              <span style={{ width:76, color:"#888" }}>{String(rc.date).slice(5)}</span>
                              <span style={{ width:60, color:"#6f42c1" }}>{[rc.am&&"오전",rc.pm&&"오후",rc.night&&"야간"].filter(Boolean).join("·") || "-"}</span>
                              <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rc.work || "-"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>); })}
              </div>
            ))}

            {!statQuery.trim() && statMonths.length > 0 && stats.jobs.length > 0 && (
              <button style={c.btn("#1a73e8","#fff")} onClick={() => {
                const lines = [`📊 ${stats.ym} 출역집계 (일지 ${stats.entries}일)`, "━━━━━━━━━━━━━━━━━━━━━━"];
                stats.jobs.forEach(j => {
                  lines.push(`【 ${j.job} 】 ${j.people}명 · 총 ${fmtNum(j.gongsu)}공수${j.night?` · 야간 ${j.night}`:""}`);
                  j.teams.forEach(tg => {
                    lines.push(` ▪ ${tg.team} ${tg.people.length}명 · ${fmtNum(tg.gongsu)}공수${tg.night?` · 야간 ${tg.night}`:""}`);
                    tg.people.forEach(pp => lines.push(`    ${pp.name} ${pp.days}일 / ${fmtNum(pp.gongsu)}공수${pp.night?` / 야간 ${pp.night}`:""}`));
                  });
                });
                navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}>📋 집계 결과 복사하기</button>
            )}
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
              <div style={c.ct}>👥 팀 관리 (반장 → 팀명·직종)</div>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:10 }}>
                카톡에서 명단을 올리는 반장 이름과 그 팀의 직종을 등록해 두면, 명단을 붙여넣을 때 직종이 자동으로 채워집니다.
                카톡 닉네임이 실명과 다르면 <b>별칭</b> 칸에 닉네임 중 <b>고유한 부분만</b> 적어 두세요. 예를 들어 닉네임이 "오산 롯데 비계 배팀장"이면 별칭에 <b>배팀장</b>만 넣으면 됩니다. (여러 개는 쉼표로 구분)
              </div>
              {teams.map(t => (
                <div key={t.id} style={c.rw}>
                  <div style={c.rt}>
                    <input value={t.leader} onChange={e => updateTeam(t.id,"leader",e.target.value)} placeholder="반장 이름" style={{ flex:1 }} />
                    <input value={t.team} onChange={e => updateTeam(t.id,"team",e.target.value)} placeholder="팀명 (예: 석공2팀)" style={{ flex:1 }} />
                    <button onClick={() => removeTeam(t.id)} style={c.del}>✕</button>
                  </div>
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    <input value={t.job} onChange={e => updateTeam(t.id,"job",e.target.value)} placeholder="직종 (예: 석공)" style={{ flex:1, minWidth:0 }} />
                    <input value={t.alias} onChange={e => updateTeam(t.id,"alias",e.target.value)} placeholder="카톡 별칭 (선택)" style={{ flex:1, minWidth:0 }} />
                  </div>
                  <label style={{ ...c.lbl, display:"flex", justifyContent:"space-between" }}>
                    <span>소속 인원 — 마침표(.)로 구분</span>
                    <span style={{ color:"#6f42c1", fontWeight:600 }}>{(t.members||[]).length}명</span>
                  </label>
                  <textarea
                    value={memberEdit[t.id] !== undefined ? memberEdit[t.id] : membersToText(t.members)}
                    onChange={e => {
                      const v = e.target.value;
                      setMemberEdit(prev => ({ ...prev, [t.id]: v }));
                      updateTeam(t.id, "members", textToMembers(v));
                    }}
                    onBlur={() => setMemberEdit(prev => { const n = { ...prev }; delete n[t.id]; return n; })}
                    placeholder={"김철. 김철주. 엄최림. 김만주"}
                    rows={3}
                    style={{ width:"100%", padding:"8px 10px", fontSize:13, lineHeight:1.6, border:"1px solid #ddd", borderRadius:6, fontFamily:"inherit", boxSizing:"border-box" }}
                  />
                  {(t.members||[]).length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                      {(t.members||[]).map(n => (
                        <span key={n} style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 7px", borderRadius:12, fontSize:12, background:"#f0f4ff", color:"#1a3a8a", border:"1px solid #c9d6ff" }}>
                          {n}
                          <button onClick={() => updateTeam(t.id, "members", (t.members||[]).filter(x => x!==n))}
                            style={{ background:"none", border:"none", color:"#999", fontSize:13, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button style={c.sb("#f0f4ff","#6f42c1")} onClick={addTeam}>+ 팀 추가</button>
            </div>

            <div style={c.card}>
              <div style={c.ct}>👷 기본 설정</div>
              <label style={c.lbl}>현장소장 이름</label>
              <input value={state.manager} onChange={e => set("manager", e.target.value)} placeholder="현장소장 이름" />
            </div>
          </>}
        </div>

        {/* ── 명단 일괄 입력 모달 (붙여넣기 / 캡쳐 이미지) ── */}
        {bulk && (
          <div onClick={() => setBulk(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:210, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
            <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:460, maxHeight:"92vh", overflowY:"auto", padding:16, boxSizing:"border-box" }}>
              <div style={{ ...c.ct, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>📥 명단 일괄 입력</span>
                <button onClick={() => setBulk(null)} style={c.del}>✕</button>
              </div>

              {!bulk.parsed && (<>
                <div style={{ display:"flex", gap:5, marginBottom:12 }}>
                  <button onClick={() => setBulk(b => ({ ...b, mode:"pick" }))} style={{ ...c.sb(bulk.mode==="pick"?"#1a73e8":"#f1f3f4", bulk.mode==="pick"?"#fff":"#555"), padding:10, fontSize:12 }}>📋 등록 명단</button>
                  <button onClick={() => setBulk(b => ({ ...b, mode:"paste" }))} style={{ ...c.sb(bulk.mode==="paste"?"#1a73e8":"#f1f3f4", bulk.mode==="paste"?"#fff":"#555"), padding:10, fontSize:12 }}>📝 붙여넣기</button>
                  <button onClick={() => setBulk(b => ({ ...b, mode:"image" }))} style={{ ...c.sb(bulk.mode==="image"?"#1a73e8":"#f1f3f4", bulk.mode==="image"?"#fff":"#555"), padding:10, fontSize:12 }}>📷 캡쳐본</button>
                </div>

                {bulk.mode === "pick" ? (() => {
                  const pt = teamById(bulk.pickTeam);
                  const list = (pt?.members || []);
                  return (<>
                    <div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:8 }}>
                      설정 탭에 등록해 둔 팀 명단에서 오늘 나온 사람만 눌러서 고르세요. 카톡을 안 봐도 됩니다.
                    </div>
                    <select style={{ ...c.ti, marginBottom:8 }} value={bulk.pickTeam} onChange={e => setBulk(b => ({ ...b, pickTeam:e.target.value, picked:[] }))}>
                      {teams.map(x => <option key={x.id} value={x.id}>{x.team || x.leader || "(이름 없음)"} · {x.job || "직종 미입력"} · {(x.members||[]).length}명</option>)}
                    </select>
                    {list.length ? (<>
                      <div style={c.sr}>
                        <button style={{ ...c.sb("#f0f4ff","#6f42c1"), padding:8, fontSize:12 }} onClick={() => pickAll(list)}>전원 선택</button>
                        <button style={{ ...c.sb("none","#888"), padding:8, fontSize:12 }} onClick={() => pickAll([])}>선택 해제</button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {list.map(n => {
                          const on = bulk.picked.includes(n);
                          return (
                            <button key={n} onClick={() => togglePick(n)} style={{ padding:"7px 12px", fontSize:13, borderRadius:16, cursor:"pointer",
                              border:`1px solid ${on ? "#137333" : "#ddd"}`, background: on ? "#e6f4ea" : "#fff", color: on ? "#137333" : "#666", fontWeight: on ? 600 : 400 }}>
                              {on ? "✓ " : ""}{n}
                            </button>
                          );
                        })}
                      </div>
                      <button style={c.btn("#1a73e8","#fff", 8)} onClick={applyPick}>선택한 {bulk.picked.length}명 담기</button>
                    </>) : (
                      <div style={{ fontSize:13, color:"#b26a00", background:"#fff4e5", border:"1px solid #ffb74d", borderRadius:8, padding:"10px 12px" }}>
                        이 팀에 등록된 인원이 없습니다. 설정 탭 → 팀 관리에서 소속 인원을 먼저 적어 주세요.
                      </div>
                    )}
                  </>);
                })() : bulk.mode === "image" ? (<>
                  <div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:10 }}>
                    카톡 화면을 캡쳐한 사진을 그대로 올리세요. 글자를 읽어서 <b>보낸사람 이름으로 팀을 자동 구분</b>합니다.
                    여러 팀이 한 장에 같이 찍혀 있어도 됩니다. 설정 탭의 팀 관리에 등록된 반장 이름·별칭이 기준입니다.
                  </div>
                  <label style={{ ...c.btn(bulk.busy?"#9aa0a6":"#1a73e8","#fff",8), display:"block", textAlign:"center", cursor: bulk.busy?"default":"pointer", boxSizing:"border-box" }}>
                    {bulk.busy ? "판독 중... (몇 초 걸립니다)" : "📷 캡쳐 사진 선택"}
                    <input type="file" accept="image/*" disabled={bulk.busy} style={{ display:"none" }}
                      onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; handleBulkImage(f); }} />
                  </label>
                </>) : (<>
                  <div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:8 }}>
                    카톡 메시지를 길게 눌러 '복사' 후 붙여넣으세요. 보낸사람 이름이 같이 복사되면 팀도 자동 구분됩니다.
                  </div>
                  <textarea
                    value={bulk.text}
                    onChange={e => setBulk(b => ({ ...b, text:e.target.value }))}
                    placeholder={"예)\n최림\n8월3일 출력 7명\n김철\n김철주\n엄최림"}
                    style={{ width:"100%", minHeight:120, padding:10, fontSize:13, border:"1px solid #ddd", borderRadius:8, fontFamily:"inherit", boxSizing:"border-box", marginBottom:8 }}
                  />
                  <button style={c.btn("#1a73e8","#fff", 8)} onClick={() => doParse()}>🔍 이름 뽑아내기</button>
                </>)}

                {bulk.err && <div style={{ fontSize:12, color:"#c5221f", background:"#fce8e6", border:"1px solid #f5c6c2", borderRadius:8, padding:"8px 10px", marginTop:8, lineHeight:1.5 }}>{bulk.err}</div>}
              </>)}

              {bulk.parsed && (<>
                <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>
                  읽어들인 명단입니다. 팀과 이름을 확인·수정한 뒤 작업내용을 배분해 주세요.
                </div>

                {bulk.groups.map((g, gi) => {
                  const t = teamById(g.teamId);
                  const assign = assignOf(g);
                  const planned = (g.tasks||[]).reduce((a,x) => a + (parseInt(x.count)||0), 0);
                  const rest = Math.max(0, g.names.length - planned);
                  return (
                    <div key={g.id} style={{ border:"1px solid #d7e3ff", background:"#fbfcff", borderRadius:10, padding:12, marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                        <span style={{ fontSize:12, color:"#888", flexShrink:0 }}>보낸사람</span>
                        <span style={{ fontSize:13, fontWeight:600, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.sender}</span>
                        <button onClick={() => removeGroup(g.id)} style={c.del}>✕</button>
                      </div>
                      <select value={g.teamId} onChange={e => updGroup(g.id, "teamId", e.target.value)} style={{ ...c.ti, marginBottom:6, background: g.teamId ? "#fff" : "#fff4e5" }}>
                        <option value="">⚠️ 팀을 골라 주세요</option>
                        {teams.map(x => <option key={x.id} value={x.id}>{x.team || x.leader || "(이름 없음)"} · {x.job || "직종 미입력"}</option>)}
                      </select>
                      <div style={{ fontSize:12, color:"#666", marginBottom:8 }}>→ 직종 <b>{t?.job || "-"}</b> · {g.names.length}명</div>

                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                        {g.names.map(n => {
                          const isNew = knownNames.size > 0 && !knownNames.has(n);
                          return (
                            <span key={n} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 8px", borderRadius:16, fontSize:13,
                              background: isNew ? "#fff4e5" : "#f0f4ff", color: isNew ? "#b26a00" : "#1a3a8a", border: `1px solid ${isNew ? "#ffb74d" : "#c9d6ff"}` }}>
                              {isNew && "✨"}{n}
                              <button onClick={() => removeGroupName(g.id, n)} style={{ background:"none", border:"none", color:"#999", fontSize:14, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
                            </span>
                          );
                        })}
                      </div>
                      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                        <input value={g.manual} onChange={e => updGroup(g.id, "manual", e.target.value)} onKeyDown={e => e.key==="Enter" && addGroupName(g.id)} placeholder="빠진 이름 직접 추가" style={{ flex:1, minWidth:0 }} />
                        <button onClick={() => addGroupName(g.id)} style={{ padding:"8px 14px", background:"#1a73e8", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>추가</button>
                      </div>

                      <div style={{ fontSize:12, color:"#888", marginBottom:6 }}>출력시간점검</div>
                      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                        {[["am","오전"],["pm","오후"],["night","야간"]].map(([f,lb]) => (
                          <label key={f} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 0", fontSize:13,
                            border:`1px solid ${g[f] ? "#6f42c1" : "#ddd"}`, borderRadius:6, cursor:"pointer", whiteSpace:"nowrap", minWidth:0,
                            background: g[f] ? "#f3efff" : "#fff", color: g[f] ? "#6f42c1" : "#888", fontWeight: g[f] ? 600 : 400 }}>
                            <input type="checkbox" checked={!!g[f]} onChange={e => updGroup(g.id, f, e.target.checked)} style={{ margin:0, width:15, height:15, flexShrink:0 }} />
                            {lb}
                          </label>
                        ))}
                      </div>

                      <div style={{ fontSize:12, color:"#888", marginBottom:6 }}>작업내용 배분 (위에서부터 순서대로)</div>
                      {(g.tasks||[]).map((tk, i) => (
                        <div key={tk.id} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                          <input value={tk.work} onChange={e => updGroupTask(g.id, tk.id, "work", e.target.value)} placeholder={`작업내용 ${i+1} (예: 104동 외벽 석재 설치)`} style={{ flex:1, minWidth:0 }} />
                          <input value={tk.count} onChange={e => updGroupTask(g.id, tk.id, "count", e.target.value.replace(/[^0-9]/g,""))} placeholder="인원" inputMode="numeric" style={{ width:52, flexShrink:0, textAlign:"center" }} />
                          <button onClick={() => removeGroupTask(g.id, tk.id)} style={c.del}>✕</button>
                        </div>
                      ))}
                      <button style={{ ...c.sb("#f0f4ff","#6f42c1"), padding:8, fontSize:13 }} onClick={() => addGroupTask(g.id)}>+ 작업 추가</button>
                      <div style={{ fontSize:12, color: rest ? "#b26a00" : "#137333", marginTop:8 }}>
                        {g.names.length}명 중 {Math.min(planned, g.names.length)}명 배분{rest ? ` · 남은 ${rest}명은 마지막 작업내용` : " · 전원 배분 완료"}
                      </div>

                      <div style={{ border:"1px solid #e8e8e8", background:"#fff", borderRadius:8, maxHeight:130, overflowY:"auto", marginTop:8 }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                          <tbody>
                            {g.names.map((n, i) => (
                              <tr key={n} style={{ borderBottom:"1px solid #f2f2f2" }}>
                                <td style={{ padding:"5px 8px", color:"#999", width:22 }}>{i+1}</td>
                                <td style={{ padding:"5px 8px", width:52 }}>{t?.job || "-"}</td>
                                <td style={{ padding:"5px 8px", fontWeight:600, width:64 }}>{n}</td>
                                <td style={{ padding:"5px 8px", color:"#6f42c1", width:58, fontSize:11 }}>{[g.am&&"오전",g.pm&&"오후",g.night&&"야간"].filter(Boolean).join("·") || "-"}</td>
                                <td style={{ padding:"5px 8px", color:"#555" }}>{assign[i] || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {knownNames.size > 0 && <div style={{ fontSize:11, color:"#b26a00", marginBottom:8 }}>✨ = 이전 명부에 없던 새 이름입니다. 오타가 아닌지 확인해 주세요.</div>}

                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#555", marginBottom:10, cursor:"pointer" }}>
                  <input type="checkbox" checked={bulk.teamToNote} onChange={e => setBulk(b => ({ ...b, teamToNote:e.target.checked }))} />
                  비고란에 팀명 표시
                </label>

                <div style={{ fontSize:12, color:"#137333", fontWeight:600, marginBottom:8 }}>
                  합계 {bulk.groups.reduce((a,g) => a + g.names.length, 0)}명 · {bulk.groups.length}개 팀
                </div>

                <div style={c.sr}>
                  <button style={c.sb("#137333","#fff")} onClick={() => applyBulk("append")}>출력명부에 추가</button>
                  <button style={c.sb("none","#ea4335")} onClick={() => applyBulk("replace")}>전체 교체</button>
                </div>
                <button style={{ ...c.sb("none","#888"), width:"100%", marginTop:8 }} onClick={() => setBulk(b => ({ ...b, parsed:false, groups:[], err:"", picked:[] }))}>← 처음으로</button>

                {bulk.raw && (
                  <details style={{ marginTop:10 }}>
                    <summary style={{ fontSize:12, color:"#888", cursor:"pointer" }}>판독된 원문 보기 (오인식 확인용)</summary>
                    <pre style={{ fontSize:11, color:"#555", background:"#f8f9fa", padding:8, borderRadius:6, whiteSpace:"pre-wrap", marginTop:6 }}>{bulk.raw}</pre>
                  </details>
                )}
              </>)}
            </div>
          </div>
        )}

        {(savedMsg||copied) && <div style={c.msg}>{savedMsg||"복사됨!"}</div>}

        {preview && (
          <div onClick={() => setPreview(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:12, padding:12, width:"100%", maxWidth:440, maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
              <div style={{ fontSize:13, color:"#666", margin:"2px 0 8px", textAlign:"center" }}>미리보기 · 두 손가락으로 확대/축소, 더블탭 확대, 끌어서 이동 · '이미지 저장'은 갤러리에 저장</div>
              <ZoomableImage key={preview.url} src={preview.url} />
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button style={c.sb("none","#666")} onClick={() => setPreview(null)}>닫기</button>
                {preview.allowPdf && <button style={c.sb("none","#ff6d00")} onClick={handlePdfFromPreview}>PDF 저장</button>}
                <button style={c.sb("#6f42c1","#fff")} onClick={handleSavePreview}>이미지 저장</button>
              </div>
            </div>
          </div>
        )}

        {shareView && (
          <div onClick={() => setShareView(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:12, padding:14, width:"100%", maxWidth:440, maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#1a73e8", marginBottom:8 }}>📤 밴드/카톡 공유용</div>
              <div style={{ ...c.ob, overflow:"auto", flex:1 }}>{shareView}</div>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button style={c.sb("none","#666")} onClick={() => setShareView(null)}>닫기</button>
                <button style={c.sb("#1a73e8","#fff")} onClick={() => { navigator.clipboard.writeText(shareView).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>{copied?"✓ 복사됨!":"📋 클립보드 복사"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 인쇄 전용 A4 ── */}
      <div className="print-only print-tbm" ref={tbmPrintRef} style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", fontSize:11, padding:"15mm 18mm", background:"#fff", minHeight:"297mm", width:"210mm" }}>
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

      {/* ── 출력명부 이미지 다운로드 전용 A4 (인쇄 안 함, html2canvas 전용) ── */}
      <div className="roster-capture" ref={rosterPrintRef} style={{ display:"none", fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", fontSize:11, padding:"15mm 12mm", background:"#fff", minHeight:"297mm", width:"210mm" }}>
        <div style={{ textAlign:"center", fontSize:18, fontWeight:700, letterSpacing:4, marginBottom:"5mm" }}>출력점검 및 노무비 일계표</div>
        <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"3mm" }}>
          <tbody>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm", width:"16mm" }}>날짜</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center", width:"30mm" }}>{fmtDate(state.date)}</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm", width:"16mm" }}>업체명</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>{rosterMeta.company}</td>
            </tr>
            <tr>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>공종명</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>{rosterMeta.workType}</td>
              <td style={{ border:"1px solid #000", background:"#f0f0f0", fontWeight:700, textAlign:"center", padding:"2mm 3mm" }}>현장명</td>
              <td style={{ border:"1px solid #000", padding:"2mm 3mm", textAlign:"center" }}>{rosterMeta.siteName}</td>
            </tr>
          </tbody>
        </table>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f0f0f0" }}>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm", width:"8mm" }}>번호</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm", width:"16mm" }}>고유번호</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm", width:"16mm" }}>직종</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm", width:"18mm" }}>성명</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1mm" }} colSpan={3}>출력시간점검</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm" }}>작업내용</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontWeight:700, padding:"1.5mm", width:"14mm" }}>비고</td>
            </tr>
            <tr style={{ background:"#f0f0f0" }}>
              <td style={{ border:"1px solid #000" }}></td>
              <td style={{ border:"1px solid #000" }}></td>
              <td style={{ border:"1px solid #000" }}></td>
              <td style={{ border:"1px solid #000" }}></td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontSize:9, width:"9mm" }}>오전</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontSize:9, width:"9mm" }}>오후</td>
              <td style={{ border:"1px solid #000", textAlign:"center", fontSize:9, width:"9mm" }}>야간</td>
              <td style={{ border:"1px solid #000" }}></td>
              <td style={{ border:"1px solid #000" }}></td>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(roster.length, ROSTER_PAD) }).map((_, i) => {
              const r = roster[i];
              return (
                <tr key={i}>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm", height:"6mm" }}>{r ? i+1 : ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r?.no || ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r?.job || ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r?.name || ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r && isOn(r.am) ? CHK : ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r && isOn(r.pm) ? CHK : ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r && isOn(r.night) ? CHK : ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r?.work || ""}</td>
                  <td style={{ border:"1px solid #000", textAlign:"center", padding:"1.5mm" }}>{r?.note || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
