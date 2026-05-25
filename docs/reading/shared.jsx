// Shared helpers used by every variation.
// 글로벌에 등록 — Babel scripts는 scope를 공유하지 않으므로.

const STATUS_LABEL = window.STATUS_LABEL;
const CATEGORIES = window.CATEGORIES;
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function Stars({ value, size = 11, color = "#222" }) {
  return (
    <span style={{ letterSpacing: 1, color, fontSize: size, lineHeight: 1 }}>
      {"★★★★★".slice(0, value)}
      <span style={{ color: "#d6d3ce" }}>{"★★★★★".slice(value)}</span>
    </span>
  );
}

function StatusDot({ status }) {
  const map = {
    todo: { c: "#cfcac1", t: "To-read" },
    reading: { c: "#e09a2a", t: "Reading" },
    done: { c: "#3a8559", t: "Done" },
  };
  const s = map[status] || map.todo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b6760", fontFamily: "ui-monospace, Menlo, monospace" }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.c }} />
      {s.t}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase",
        color: "#8c887e", marginBottom: 8,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}>{title}</div>
      {children}
    </div>
  );
}

// Right-side slide-in detail panel. Note / Spec 두 탭.
function DetailPanel({ paper, onClose, accent = "#222", onUpdate, onDelete }) {
  if (!paper) return null;
  const cat = CAT_BY_ID[paper.category] || { color: "#444", label: paper.category };
  const editable = !!onUpdate;
  const [tab, setTab] = React.useState("note");
  const [noteDraft, setNoteDraft] = React.useState(paper.note || "");
  const [editing, setEditing] = React.useState(false);
  // SpecStore 변경 시 강제 리렌더
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.SpecStore?.subscribe(force), []);
  React.useEffect(() => { setNoteDraft(paper.note || ""); setEditing(false); setTab("note"); }, [paper.id]);

  const hasSpec = window.SpecStore?.hasSpec(paper.id) ?? !!window.SPECS?.[paper.id];

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, background: "rgba(20,18,15,0.18)",
        zIndex: 10, animation: "fadeIn .15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "min(560px, 70%)", background: "#fdfcf9",
          borderLeft: "1px solid #e8e3d8",
          overflowY: "auto", boxShadow: "-20px 0 40px -25px rgba(0,0,0,.2)",
          animation: "slideIn .22s cubic-bezier(.2,.7,.2,1)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "26px 30px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: cat.color }} />
              <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b6760", fontFamily: "ui-monospace, Menlo, monospace" }}>
                {cat.label}
              </span>
              {hasSpec && (
                <span style={{
                  fontSize: 9.5, padding: "2px 7px", border: "1px solid #c8dccf",
                  borderRadius: 99, color: "#2f6b53", background: "#eaf5ef",
                  fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}>spec ready</span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#9c978d", lineHeight: 1 }}
              aria-label="Close"
            >×</button>
          </div>

          <h2 style={{
            fontFamily: "'Iowan Old Style', 'Georgia', serif",
            fontSize: 22, lineHeight: 1.25, marginTop: 14, marginBottom: 8, color: "#1d1b18",
            textWrap: "pretty",
          }}>
            {paper.title}
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#6b6760", marginBottom: 16 }}>
            <span>{paper.authors}</span>
            <span>·</span>
            <span>{paper.venue}</span>
            <span>·</span>
            <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtDate(paper.date)}</span>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
            <Stars value={paper.rating} size={13} color={accent} />
            <StatusDot status={paper.status} />
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #ece6d7" }}>
            <TabButton active={tab === "note"} onClick={() => setTab("note")} accent={accent}>
              📝 Note
            </TabButton>
            <TabButton active={tab === "spec"} onClick={() => setTab("spec")} accent={accent}>
              🛠 SKILL.md
            </TabButton>
            <TabButton active={tab === "edit"} onClick={() => setTab("edit")} accent={accent}>
              ✏️ Edit spec
            </TabButton>
          </div>
        </div>

        {/* Tab body */}
        <div style={{ padding: "20px 30px 30px", flex: 1 }}>
          {tab === "note" && (
            <NoteTab
              paper={paper} accent={accent} editable={editable}
              editing={editing} setEditing={setEditing}
              noteDraft={noteDraft} setNoteDraft={setNoteDraft}
              onSave={(v) => onUpdate({ note: v })}
              onDelete={onDelete}
            />
          )}
          {tab === "spec" && (
            window.SkillView
              ? <window.SkillView paper={paper} accent={accent} onEdit={() => setTab("edit")} />
              : <div style={{ color: "#9c978d" }}>spec-view 미로드</div>
          )}
          {tab === "edit" && (
            window.SpecEditor
              ? <window.SpecEditor paper={paper} accent={accent} onDone={() => setTab("spec")} />
              : <div style={{ color: "#9c978d" }}>spec-editor 미로드</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, accent, children }) {
  return (
    <button onClick={onClick} style={{
      border: "none", background: "transparent", cursor: "pointer",
      padding: "10px 14px", fontSize: 12.5, color: active ? accent : "#8c887e",
      borderBottom: `2px solid ${active ? accent : "transparent"}`,
      marginBottom: -1, fontWeight: active ? 600 : 500, fontFamily: "inherit",
      letterSpacing: 0.2,
    }}>{children}</button>
  );
}

function NoteTab({ paper, accent, editable, editing, setEditing, noteDraft, setNoteDraft, onSave, onDelete }) {
  return (
    <>
      <Section title="한 줄 요약">
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#2a2722" }}>{paper.summary}</p>
      </Section>

      <Section title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          내 메모
          {editable && !editing && (
            <span onClick={() => setEditing(true)}
              style={{ cursor: "pointer", color: accent, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
              edit
            </span>
          )}
        </span>
      }>
        {editing ? (
          <div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={5}
              style={{
                width: "100%", boxSizing: "border-box",
                fontSize: 13.5, lineHeight: 1.6, color: "#3a352c",
                background: "#fbf6e8", border: "1px solid #f0e7c8",
                padding: "10px 12px", borderRadius: 6,
                fontFamily: "'Iowan Old Style', Georgia, serif",
                outline: "none", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
              <button onClick={() => { setNoteDraft(paper.note || ""); setEditing(false); }} style={{
                padding: "4px 10px", fontSize: 11, border: "1px solid #e2dccf",
                background: "#fff", borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              }}>취소</button>
              <button onClick={() => { onSave(noteDraft); setEditing(false); }} style={{
                padding: "4px 12px", fontSize: 11, border: "none",
                background: accent, color: "#fff", borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              }}>저장</button>
            </div>
          </div>
        ) : (
          <p style={{
            margin: 0, fontSize: 13.5, lineHeight: 1.65,
            background: "#fbf6e8", border: "1px solid #f0e7c8",
            padding: "12px 14px", borderRadius: 6,
            fontFamily: "'Iowan Old Style', Georgia, serif",
            whiteSpace: "pre-wrap",
            color: paper.note ? "#3a352c" : "#a8a294",
          }}>
            {paper.note || "메모 없음"}
          </p>
        )}
      </Section>

      <Section title="태그">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {paper.tags.map((t) => (
            <span key={t} style={{
              fontSize: 11, padding: "3px 8px", border: "1px solid #e2dccf",
              borderRadius: 99, color: "#5b574d", background: "#fbfaf6",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}>#{t}</span>
          ))}
        </div>
      </Section>

      <div style={{
        marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        {paper.link && paper.link !== "#" ? (
          <a href={paper.link} target="_blank" rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: accent,
              borderBottom: `1px solid ${accent}`, paddingBottom: 1,
              fontFamily: "ui-monospace, Menlo, monospace", textDecoration: "none",
            }}>
            원문 열기 ↗
          </a>
        ) : <span />}
        {onDelete && (
          <button onClick={() => { if (confirm("이 카드를 삭제할까요?")) onDelete(); }} style={{
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 11, color: "#b5544e", fontFamily: "ui-monospace, Menlo, monospace",
          }}>삭제</button>
        )}
      </div>
    </>
  );
}

Object.assign(window, { Stars, StatusDot, DetailPanel, Section, fmtDate, CAT_BY_ID });
