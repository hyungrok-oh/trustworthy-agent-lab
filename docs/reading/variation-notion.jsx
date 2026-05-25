// Variation B — Notion 스타일 주제별 칸반 보드.
// 풀스크린 메인 뷰. 카드 클릭 → 디테일 패널 / 드래그 → 컬럼 간 이동 / 검색 / 새 카드 추가 / localStorage 저장.

const { useState: useStateB, useMemo: useMemoB, useEffect: useEffectB } = React;
const LS_KEY = "reading-canvas:v1";

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch (_) { return null; }
}

function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
}

function NotionCanvas() {
  // papers state — 시드 + localStorage 병합. id가 같으면 덮어쓰기, 추가분도 머지.
  // 카테고리가 현재 CATEGORIES에 없으면 default(첫 카테고리)로 뎨그.
  const [papers, setPapers] = useStateB(() => {
    const validCats = new Set(CATEGORIES.map((c) => c.id));
    const fallbackCat = CATEGORIES[0]?.id || "Architecture";
    const fixCat = (p) => ({ ...p, category: validCats.has(p.category) ? p.category : fallbackCat });
    const saved = loadSaved();
    if (!saved) return window.PAPERS.map((p) => fixCat({ ...p }));
    const seedById = Object.fromEntries(window.PAPERS.map((p) => [p.id, p]));
    const out = [];
    saved.papers?.forEach((p) => out.push(fixCat({ ...seedById[p.id], ...p })));
    window.PAPERS.forEach((p) => { if (!out.find((x) => x.id === p.id)) out.push(fixCat({ ...p })); });
    return out;
  });

  const [open, setOpen] = useStateB(null);
  const [filter, setFilter] = useStateB("all");
  const [query, setQuery] = useStateB("");
  const [drag, setDrag] = useStateB(null);
  const [adding, setAdding] = useStateB(null); // category id when adding
  const [showGraph, setShowGraph] = useStateB(false);

  // persist
  useEffectB(() => {
    saveState({ papers });
  }, [papers]);

  const byId = useMemoB(() => Object.fromEntries(papers.map((p) => [p.id, p])), [papers]);

  const matches = (p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.short.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      (p.note || "").toLowerCase().includes(q) ||
      p.authors.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  };

  const byCat = useMemoB(() => {
    const m = {};
    CATEGORIES.forEach((c) => (m[c.id] = []));
    papers.forEach((p) => { if (m[p.category]) m[p.category].push(p); });
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) => (b.order ?? b.date).toString().localeCompare((a.order ?? a.date).toString()))
    );
    return m;
  }, [papers]);

  const moveTo = (paperId, newCat) => {
    setPapers((cur) => cur.map((p) => (p.id === paperId ? { ...p, category: newCat } : p)));
  };

  const addPaper = (cat, data) => {
    const id = "u" + Math.random().toString(36).slice(2, 8);
    setPapers((cur) => [
      ...cur,
      {
        id,
        title: data.title,
        short: data.short || data.title,
        authors: data.authors || "—",
        venue: data.venue || "—",
        date: data.date || new Date().toISOString().slice(0, 10),
        category: cat,
        tags: (data.tags || "").split(",").map((s) => s.trim()).filter(Boolean),
        summary: data.summary || "",
        note: data.note || "",
        link: data.link || "#",
        rating: parseInt(data.rating || "3", 10),
        status: data.status || "todo",
      },
    ]);
  };

  const removePaper = (id) => {
    setPapers((cur) => cur.filter((p) => p.id !== id));
    if (open?.id === id) setOpen(null);
  };

  const updatePaper = (id, patch) => {
    setPapers((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setOpen((o) => (o && o.id === id ? { ...o, ...patch } : o));
  };

  const totalShowing = papers.filter(matches).length;

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#ffffff", color: "#37352f",
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        padding: "20px 36px 14px",
        borderBottom: "1px solid #ececec",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 11, color: "#9b9a97",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}>
          📚 / Reading log / By topic
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 18, marginTop: 8 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.6 }}>
            LLM · Agent · AI 정리
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBox value={query} onChange={setQuery} />
            <span style={{ fontSize: 11, color: "#9b9a97", fontFamily: "ui-monospace, Menlo, monospace" }}>
              {totalShowing} / {papers.length}
            </span>
            <button onClick={() => setShowGraph(true)} title="의존성 그래프" style={{
              padding: "5px 11px", border: "1px solid #ececec", background: "#fff",
              borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#37352f",
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <span>🕸</span> 그래프
            </button>
            <ExportAll papers={papers} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>All · {papers.length}</Pill>
          {CATEGORIES.map((c) => (
            <Pill key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} dot={c.color}>
              {c.label} · {byCat[c.id].length}
            </Pill>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9b9a97", fontFamily: "ui-monospace, Menlo, monospace" }}>
            drag · click · ＋ add
          </span>
        </div>
      </div>

      {/* Board */}
      <div style={{
        flex: 1, overflowX: "auto", overflowY: "hidden",
        padding: "20px 36px 28px",
      }}>
        <div style={{ display: "flex", gap: 18, height: "100%", minWidth: "min-content" }}>
          {CATEGORIES.filter((c) => filter === "all" || filter === c.id).map((c) => {
            const items = byCat[c.id].filter(matches);
            return (
              <Column key={c.id}
                cat={c}
                items={items}
                drag={drag}
                setDrag={setDrag}
                onDropCard={(paperId) => moveTo(paperId, c.id)}
                onOpen={setOpen}
                onAddClick={() => setAdding(c.id)}
              />
            );
          })}
        </div>
      </div>

      {open && (
        <DetailPanel
          paper={open}
          onClose={() => setOpen(null)}
          accent="#37352f"
          onUpdate={(patch) => updatePaper(open.id, patch)}
          onDelete={() => removePaper(open.id)}
        />
      )}

      {adding && (
        <AddDialog
          cat={CAT_BY_ID[adding]}
          onCancel={() => setAdding(null)}
          onSubmit={(data) => { addPaper(adding, data); setAdding(null); }}
        />
      )}

      {showGraph && window.DependencyGraph && (
        <window.DependencyGraph
          papers={papers}
          onOpenPaper={(p) => { setShowGraph(false); setOpen(p); }}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "#f7f6f3", borderRadius: 6,
      padding: "5px 10px", border: "1px solid #ececec",
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#9b9a97" strokeWidth="2"/>
        <path d="m20 20-3-3" stroke="#9b9a97" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="검색 (제목, 메모, 태그…)"
        style={{
          border: "none", outline: "none", background: "transparent",
          fontSize: 12.5, color: "#37352f", width: 220,
          fontFamily: "inherit",
        }}
      />
      {value && (
        <span onClick={() => onChange("")} style={{ cursor: "pointer", color: "#9b9a97", fontSize: 14 }}>×</span>
      )}
    </div>
  );
}

function Column({ cat, items, drag, setDrag, onDropCard, onOpen, onAddClick }) {
  const [over, setOver] = useStateB(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); if (drag) onDropCard(drag.id); setDrag(null); }}
      style={{
        width: 272, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: over ? "#f7f6f3" : "transparent",
        borderRadius: 8, padding: "0 4px",
        transition: "background .15s",
      }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 10, marginBottom: 8, paddingTop: 6,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: cat.color }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
          <span style={{ fontSize: 12, color: "#9b9a97" }}>{items.length}</span>
        </div>
        <button
          onClick={onAddClick}
          title="새 카드"
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 16, color: "#9b9a97", padding: "0 4px", lineHeight: 1,
          }}>＋</button>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8,
        paddingRight: 2,
      }}>
        {items.map((p) => (
          <Card key={p.id} p={p}
            isDragging={drag?.id === p.id}
            dimmed={drag && drag.id !== p.id}
            onDragStart={() => setDrag(p)}
            onDragEnd={() => setDrag(null)}
            onClick={() => onOpen(p)}
          />
        ))}
        {items.length === 0 && (
          <div style={{
            border: "1px dashed #ececec", borderRadius: 6, padding: "16px 12px",
            fontSize: 11, color: "#c7c6c2", textAlign: "center",
          }}>여기로 끌어다 놓기</div>
        )}
      </div>
    </div>
  );
}

function Card({ p, isDragging, dimmed, onDragStart, onDragEnd, onClick }) {
  const [, force] = useStateB(0);
  useEffectB(() => window.SpecStore?.subscribe(() => force((x) => x + 1)), []);
  const hasSpec = window.SpecStore?.hasSpec(p.id) ?? !!window.SPECS?.[p.id];
  return (
    <div
      draggable
      onDragStart={(e) => { onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #ececec",
        borderRadius: 6,
        padding: "10px 12px 11px",
        cursor: "pointer",
        boxShadow: isDragging
          ? "0 10px 30px -10px rgba(0,0,0,.25)"
          : "0 1px 0 rgba(0,0,0,.02)",
        opacity: dimmed ? 0.55 : 1,
        transition: "all .15s",
        position: "relative",
      }}>
      {hasSpec && (
        <span title="Claude Code SKILL.md 준비됨"
          style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 9, color: "#2f6b53", background: "#eaf5ef",
            border: "1px solid #c8dccf", borderRadius: 99,
            padding: "1px 6px", fontFamily: "ui-monospace, Menlo, monospace",
            letterSpacing: 0.4,
          }}>SKILL</span>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingRight: hasSpec ? 44 : 0 }}>
        <span style={{
          fontSize: 10.5, color: "#9b9a97",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}>{fmtDate(p.date)}</span>
        {!hasSpec && <Stars value={p.rating} size={10} color="#37352f" />}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, color: "#37352f" }}>
        {p.short}
      </div>
      <div style={{ fontSize: 11.5, color: "#787774", lineHeight: 1.45, marginBottom: 8 }}>
        {p.summary && p.summary.length > 92 ? p.summary.slice(0, 90) + "…" : p.summary}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10.5, color: "#9b9a97" }}>
          {(p.authors || "—").split(",")[0]}
        </span>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {hasSpec && <Stars value={p.rating} size={10} color="#37352f" />}
          <StatusDot status={p.status} />
        </div>
      </div>
    </div>
  );
}

function ExportAll({ papers }) {
  const [open, setOpen] = useStateB(false);
  const [copied, setCopied] = useStateB(false);
  const md = useMemoB(() => window.buildAllSkills(papers), [papers]);

  const download = () => {
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "skills-bundle.md";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(md); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = md; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        padding: "5px 11px", border: "1px solid #ececec", background: "#fff",
        borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#37352f",
        fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <span>⬇</span> Export all
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 21,
            background: "#fff", border: "1px solid #ececec", borderRadius: 6,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,.2)", padding: 6, minWidth: 220,
          }}>
            <MenuRow onClick={() => { copy(); }}>{copied ? "✓ 복사됨" : "📋 클립보드로 복사"}</MenuRow>
            <MenuRow onClick={() => { download(); setOpen(false); }}>⬇ skills-bundle.md 받기</MenuRow>
            <div style={{ borderTop: "1px solid #ececec", margin: "4px 0" }} />
            <div style={{
              padding: "4px 10px 6px", fontSize: 10.5, color: "#9b9a97",
              fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.4,
            }}>
              {papers.length} cards · {papers.filter((p) => window.SpecStore?.hasSpec(p.id) ?? !!window.SPECS?.[p.id]).length} with spec
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuRow({ children, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "7px 10px", fontSize: 12.5, cursor: "pointer", borderRadius: 4,
      color: "#37352f",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f6f3")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{children}</div>
  );
}

function Pill({ active, onClick, children, dot }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", border: "none", cursor: "pointer",
      background: active ? "#37352f" : "#f1f1ef",
      color: active ? "#fff" : "#37352f",
      borderRadius: 99, fontSize: 11.5, fontWeight: 500,
      transition: "all .15s",
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: dot }} />}
      {children}
    </button>
  );
}

function AddDialog({ cat, onCancel, onSubmit }) {
  const [form, setForm] = useStateB({
    title: "", authors: "", venue: "", date: new Date().toISOString().slice(0, 10),
    summary: "", note: "", link: "", tags: "", rating: 3, status: "todo",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const lbl = { fontSize: 10.5, color: "#9b9a97", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "ui-monospace, Menlo, monospace", marginBottom: 4 };
  const inp = {
    width: "100%", boxSizing: "border-box", border: "1px solid #ececec", borderRadius: 5,
    padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: "#37352f", background: "#fff",
    outline: "none",
  };

  return (
    <div onClick={onCancel} style={{
      position: "absolute", inset: 0, background: "rgba(20,18,15,0.32)", zIndex: 20,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn .12s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 8, width: 440, maxHeight: "85vh", overflowY: "auto",
        padding: 24, boxShadow: "0 20px 60px -20px rgba(0,0,0,.4)",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: cat.color }} />
          <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "#9b9a97", fontFamily: "ui-monospace, Menlo, monospace" }}>
            {cat.label}에 새 자료
          </span>
        </div>
        <h2 style={{ margin: "4px 0 18px", fontSize: 18, fontWeight: 700 }}>새 카드 추가</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field span={2} label="제목 *" value={form.title} onChange={(v) => set("title", v)} inp={inp} lbl={lbl} placeholder="논문/포스트 제목" />
          <Field label="저자" value={form.authors} onChange={(v) => set("authors", v)} inp={inp} lbl={lbl} placeholder="Vaswani et al." />
          <Field label="출처" value={form.venue} onChange={(v) => set("venue", v)} inp={inp} lbl={lbl} placeholder="arXiv / NeurIPS / blog" />
          <Field label="날짜" value={form.date} onChange={(v) => set("date", v)} inp={inp} lbl={lbl} placeholder="YYYY-MM-DD" />
          <Field label="태그" value={form.tags} onChange={(v) => set("tags", v)} inp={inp} lbl={lbl} placeholder="agent, rag, …" />
          <Field span={2} label="한 줄 요약" value={form.summary} onChange={(v) => set("summary", v)} inp={inp} lbl={lbl} placeholder="핵심 한 줄" />
          <Field span={2} label="메모" value={form.note} onChange={(v) => set("note", v)} inp={inp} lbl={lbl} placeholder="내가 적은 takeaway" textarea />
          <Field span={2} label="원문 링크" value={form.link} onChange={(v) => set("link", v)} inp={inp} lbl={lbl} placeholder="https://…" />
          <div>
            <div style={lbl}>중요도</div>
            <select value={form.rating} onChange={(e) => set("rating", e.target.value)} style={inp}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{"★".repeat(n) + "☆".repeat(5-n)}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>상태</div>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inp}>
              <option value="todo">To-read</option>
              <option value="reading">Reading</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
          <button onClick={onCancel} style={{
            padding: "7px 14px", border: "1px solid #ececec", background: "#fff",
            borderRadius: 5, cursor: "pointer", fontSize: 13, color: "#37352f", fontFamily: "inherit",
          }}>취소</button>
          <button
            onClick={() => form.title.trim() && onSubmit(form)}
            disabled={!form.title.trim()}
            style={{
              padding: "7px 16px", border: "none",
              background: form.title.trim() ? "#37352f" : "#c7c6c2",
              color: "#fff", borderRadius: 5,
              cursor: form.title.trim() ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            }}>추가</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inp, lbl, span, textarea }) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / -1" : "auto" }}>
      <div style={lbl}>{label}</div>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...inp, resize: "vertical", minHeight: 60 }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={inp} />
      )}
    </div>
  );
}

window.NotionCanvas = NotionCanvas;
