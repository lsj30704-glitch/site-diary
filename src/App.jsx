import { useState, useEffect } from "react";

const PRESET = ["석공", "비계", "코킹", "트러스"];
const QUICK = ["양중", "철거", "미장", "도장", "배관", "전기"];
const TODAY = () => new Date().toISOString().slice(0, 10);
const UID = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const STORAGE_KEY = "site_diary_v1";
const SITE_KEY = "site_diary_last_site";
const MANAGER_KEY = "site_diary_last_manager";

const lastSite = () => localStorage.getItem(SITE_KEY) || "롯데캐슬 위너스포레 (오산 양산동)";
const lastManager = () => localStorage.getItem(MANAGER_KEY) || "이상준";

const defaultRows = () =>
  PRESET.map(name => ({ id: UID(), name, workers: "", work: "", note: "" }));

const defaultState = () => ({
  date: TODAY(),
  site: lastSite(),
  manager: lastManager(),
  weather: "",
  mainWork: "",
  special: "",
  rows: defaultRows(),
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// 저장된 일지 목록 관리
const HISTORY_KEY = "site_diary_history_v1";
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
}

export default function App() {
  const [state, setState] = useState(() => load() || defaultState());
  const [tab, setTab] = useState("write"); // write | history
  const [history, setHistory] = useState(() => loadHistory());
  const [copied, setCopied] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const set = (field, val) => setState(prev => ({ ...prev, [field]: val }));

  const updateRow = (id, field, val) =>
    setState(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === id ? { ...r, [field]: val } : r)
    }));

  const addRow = (name = "") =>
    setState(prev => ({
      ...prev,
      rows: [...prev.rows, { id: UID(), name, workers: "", work: "", note: "" }]
    }));

  const removeRow = (id) =>
    setState(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }));

  // 자동저장 + 현장명/소장명 별도 기억
  useEffect(() => {
    save(state);
    if (state.site) localStorage.setItem(SITE_KEY, state.site);
    if (state.manager) localStorage.setItem(MANAGER_KEY, state.manager);
  }, [state]);

  const totalWorkers = state.rows.reduce((s, r) => s + (parseInt(r.workers) || 0), 0);

  const outputText = () => {
    const lines = [
      `📋 일일 현장업무일지`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📅 날짜: ${state.date}`,
      `🏗️ 현장: ${state.site}`,
      `👷 현장소장: ${state.manager}`,
      state.weather ? `🌤️ 날씨: ${state.weather}` : null,
      ``,
      `【 공정별 출력인원 】`,
      ...state.rows.filter(r => r.name).map(r =>
        `▪ ${r.name}: ${r.workers || 0}명${r.work ? ` / ${r.work}` : ""}${r.note ? ` (${r.note})` : ""}`
      ),
      `▶ 합계: 총 ${totalWorkers}명`,
      ``,
      state.mainWork ? `【 주요 업무 】\n${state.mainWork}\n` : null,
      state.special ? `【 특이사항/지시사항 】\n${state.special}` : null,
    ].filter(l => l !== null).join("\n");
    return lines;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    const entry = { ...state, savedAt: new Date().toISOString(), id: UID() };
    const updated = [entry, ...history].slice(0, 30);
    setHistory(updated);
    saveHistory(updated);
    setSavedMsg("저장됨!");
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const handleNewDay = () => {
    if (window.confirm("새 날짜로 초기화할까요? (현재 내용은 저장 후 진행하세요)")) {
      setState({ ...defaultState(), date: TODAY(), site: lastSite(), manager: lastManager() });
      setShowOutput(false);
    }
  };

  const loadEntry = (entry) => {
    setState(entry);
    setTab("write");
    setShowOutput(false);
  };

  const deleteEntry = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  // ── styles ──
  const c = {
    wrap: { maxWidth: 480, margin: "0 auto", paddingBottom: 80 },
    header: {
      background: "#1a73e8", color: "#fff", padding: "14px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 10
    },
    hTitle: { fontSize: 17, fontWeight: 600 },
    hSub: { fontSize: 12, opacity: 0.85, marginTop: 2 },
    tabs: {
      display: "flex", background: "#fff",
      borderBottom: "1px solid #e0e0e0", position: "sticky", top: 56, zIndex: 9
    },
    tab: (active) => ({
      flex: 1, padding: "12px 0", fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? "#1a73e8" : "#666", background: "none", border: "none",
      borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
      cursor: "pointer"
    }),
    body: { padding: "12px 16px" },
    card: {
      background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8",
      padding: "14px 14px", marginBottom: 12
    },
    cardTitle: { fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 },
    label: { fontSize: 12, color: "#888", marginBottom: 4, display: "block" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    rowWrap: { borderBottom: "1px solid #f0f0f0", paddingBottom: 10, marginBottom: 10 },
    rowTop: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 },
    nameInput: { flex: 1, fontSize: 15 },
    numInput: { width: 56, textAlign: "center", fontSize: 15 },
    unit: { fontSize: 13, color: "#888", whiteSpace: "nowrap" },
    delBtn: { background: "none", border: "none", fontSize: 18, color: "#bbb", padding: "0 4px", lineHeight: 1 },
    quickWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 },
    quickBtn: {
      fontSize: 12, padding: "5px 10px", border: "1px dashed #ccc",
      borderRadius: 6, background: "none", color: "#666"
    },
    total: { textAlign: "right", fontSize: 15, fontWeight: 600, color: "#1a73e8", marginTop: 4 },
    outBtn: {
      width: "100%", padding: 13, fontSize: 15, fontWeight: 600,
      background: "#1a73e8", color: "#fff", border: "none", borderRadius: 10, marginBottom: 8
    },
    secBtn: {
      width: "100%", padding: 11, fontSize: 14,
      background: "none", color: "#1a73e8", border: "1px solid #1a73e8",
      borderRadius: 10, marginBottom: 8
    },
    copyBtn: {
      width: "100%", padding: 11, fontSize: 14,
      background: "#f0f4ff", color: "#1a73e8", border: "none",
      borderRadius: 8, marginTop: 8
    },
    outBox: {
      whiteSpace: "pre-wrap", fontSize: 13, background: "#f8f9fa",
      border: "1px solid #e0e0e0", borderRadius: 8, padding: 12,
      lineHeight: 1.75, color: "#222"
    },
    saveRow: { display: "flex", gap: 8, marginBottom: 8 },
    saveBtn: {
      flex: 1, padding: 11, fontSize: 14, fontWeight: 600,
      background: "#34a853", color: "#fff", border: "none", borderRadius: 10
    },
    newBtn: {
      flex: 1, padding: 11, fontSize: 14,
      background: "none", color: "#ea4335", border: "1px solid #ea4335", borderRadius: 10
    },
    histCard: {
      background: "#fff", borderRadius: 10, border: "1px solid #e8e8e8",
      padding: "12px 14px", marginBottom: 10
    },
    histDate: { fontSize: 13, fontWeight: 600, color: "#1a73e8", marginBottom: 4 },
    histInfo: { fontSize: 13, color: "#555", marginBottom: 8 },
    histBtns: { display: "flex", gap: 6 },
    histLoad: { flex: 1, padding: "7px 0", fontSize: 13, background: "#f0f4ff", color: "#1a73e8", border: "none", borderRadius: 6 },
    histDel: { padding: "7px 12px", fontSize: 13, background: "none", color: "#ea4335", border: "1px solid #ea4335", borderRadius: 6 },
    msgBadge: {
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#333", color: "#fff", padding: "8px 20px",
      borderRadius: 20, fontSize: 14, zIndex: 99
    }
  };

  return (
    <div style={c.wrap}>
      {/* 헤더 */}
      <div style={c.header}>
        <div>
          <div style={c.hTitle}>현장 일일 업무일지</div>
          <div style={c.hSub}>이안석건 · {state.date}</div>
        </div>
        <div style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 10px" }}>
          총 {totalWorkers}명
        </div>
      </div>

      {/* 탭 */}
      <div style={c.tabs}>
        <button style={c.tab(tab === "write")} onClick={() => setTab("write")}>작성</button>
        <button style={c.tab(tab === "history")} onClick={() => setTab("history")}>
          저장 목록 ({history.length})
        </button>
      </div>

      <div style={c.body}>
        {tab === "write" && (
          <>
            {/* 기본 정보 */}
            <div style={c.card}>
              <div style={c.cardTitle}>📋 기본 정보</div>
              <label style={c.label}>날짜</label>
              <input type="date" value={state.date} onChange={e => set("date", e.target.value)} style={{ marginBottom: 10 }} />
              <label style={c.label}>현장명</label>
              <input value={state.site} onChange={e => set("site", e.target.value)} style={{ marginBottom: 10 }} />
              <div style={c.grid2}>
                <div>
                  <label style={c.label}>현장소장</label>
                  <input value={state.manager} onChange={e => set("manager", e.target.value)} />
                </div>
                <div>
                  <label style={c.label}>날씨</label>
                  <input value={state.weather} onChange={e => set("weather", e.target.value)} placeholder="맑음/흐림/비" />
                </div>
              </div>
            </div>

            {/* 공정별 출력인원 */}
            <div style={c.card}>
              <div style={c.cardTitle}>👷 공정별 출력인원</div>
              {state.rows.map(r => (
                <div key={r.id} style={c.rowWrap}>
                  <div style={c.rowTop}>
                    <input value={r.name} onChange={e => updateRow(r.id, "name", e.target.value)}
                      placeholder="공정명" style={{ ...c.nameInput }} />
                    <input type="number" min="0" value={r.workers}
                      onChange={e => updateRow(r.id, "workers", e.target.value)}
                      placeholder="0" style={c.numInput} />
                    <span style={c.unit}>명</span>
                    <button onClick={() => removeRow(r.id)} style={c.delBtn}>✕</button>
                  </div>
                  <input value={r.work} onChange={e => updateRow(r.id, "work", e.target.value)}
                    placeholder="작업 내용" style={{ marginBottom: 6 }} />
                  <input value={r.note} onChange={e => updateRow(r.id, "note", e.target.value)}
                    placeholder="비고" />
                </div>
              ))}
              <div style={c.quickWrap}>
                {QUICK.map(n => (
                  <button key={n} style={c.quickBtn} onClick={() => addRow(n)}>{n}</button>
                ))}
                <button style={{ ...c.quickBtn, borderStyle: "solid", color: "#1a73e8", borderColor: "#1a73e8" }}
                  onClick={() => addRow("")}>+ 직접입력</button>
              </div>
              <div style={c.total}>합계 <span style={{ fontSize: 20 }}>{totalWorkers}</span> 명</div>
            </div>

            {/* 주요 업무 */}
            <div style={c.card}>
              <div style={c.cardTitle}>📌 주요 업무</div>
              <textarea value={state.mainWork} onChange={e => set("mainWork", e.target.value)}
                placeholder="오늘의 주요 업무 내용&#10;예) 101동 외벽 석재 붙임 작업, 비계 설치 완료 확인…"
                rows={4} />
            </div>

            {/* 특이사항 */}
            <div style={c.card}>
              <div style={c.cardTitle}>⚠️ 특이사항 / 지시사항</div>
              <textarea value={state.special} onChange={e => set("special", e.target.value)}
                placeholder="공정 이슈, 자재 입고 예정, 원청 지시사항 등"
                rows={3} />
            </div>

            {/* 버튼 영역 */}
            <div style={c.saveRow}>
              <button style={c.saveBtn} onClick={handleSave}>💾 저장</button>
              <button style={c.newBtn} onClick={handleNewDay}>🔄 새 날짜</button>
            </div>

            <button style={c.outBtn} onClick={() => setShowOutput(v => !v)}>
              {showOutput ? "출력 닫기" : "📤 밴드/카톡 공유용 출력"}
            </button>

            {showOutput && (
              <div style={c.card}>
                <div style={c.outBox}>{outputText()}</div>
                <button style={c.copyBtn} onClick={handleCopy}>
                  {copied ? "✓ 복사됨!" : "📋 클립보드 복사"}
                </button>
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 && (
              <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0", fontSize: 14 }}>
                저장된 일지가 없습니다
              </div>
            )}
            {history.map(h => {
              const total = h.rows?.reduce((s, r) => s + (parseInt(r.workers) || 0), 0) || 0;
              return (
                <div key={h.id} style={c.histCard}>
                  <div style={c.histDate}>{h.date}</div>
                  <div style={c.histInfo}>
                    {h.site} · 총 {total}명{h.weather ? ` · ${h.weather}` : ""}
                  </div>
                  {h.mainWork && (
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {h.mainWork.slice(0, 40)}
                    </div>
                  )}
                  <div style={c.histBtns}>
                    <button style={c.histLoad} onClick={() => loadEntry(h)}>불러오기</button>
                    <button style={c.histDel} onClick={() => deleteEntry(h.id)}>삭제</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {(savedMsg || copied) && (
        <div style={c.msgBadge}>{savedMsg || "복사됨!"}</div>
      )}
    </div>
  );
}
