// Auto-draft SKILL fields from raw paper/blog text using window.claude.complete.
// 결과는 SpecEditor가 바로 먹을 수 있는 모양으로 normalize.

const DRAFT_SYSTEM_HINT = `당신은 LLM/AI 논문·블로그를 읽고 Claude Code용 SKILL.md 초안을 만드는 보조자입니다.

목표: 사용자가 붙여넣은 자료(논문 abstract, 블로그 본문 등)에서 핵심을 추출해
실제 구현에 도움이 되는 구조화된 spec을 JSON으로 출력합니다.

규칙:
- 입력에 명시되지 않은 사실은 만들지 말 것. 모르면 빈 배열/빈 문자열로.
- bullet은 짧고 actionable하게. 영어/한국어 섞여도 됨.
- core: 핵심 아이디어 3-5개
- algorithm: 구현 단계 3-7개 (순서대로)
- hyperparams: 'name: 추천값/범위 + 의미' 포맷
- pitfalls: 실제 부닥치는 failure mode
- verify: 어떻게 평가/검증하는지

출력은 반드시 valid JSON. 코드펜스 없이 raw JSON만.
스키마:
{
  "name": "kebab-case-slug",
  "description": "한 줄 요약 (SKILL.md frontmatter용)",
  "when_to_use": "이 스킬을 언제 꺼내야 하는지",
  "core": ["…", "…"],
  "algorithm": ["…", "…"],
  "inputs": "…",
  "outputs": "…",
  "hyperparams": ["…", "…"],
  "pitfalls": ["…", "…"],
  "verify": ["…", "…"],
  "depends_on": [],
  "code_refs": []
}`;

async function draftSpec({ title, source, text }) {
  if (!window.claude?.complete) {
    throw new Error("Claude API helper가 로드되지 않았어요.");
  }

  const userMsg = [
    `# 자료 제목`,
    title || "(제목 없음)",
    source ? `\n# 출처\n${source}` : "",
    `\n# 본문\n${text}`,
    `\n위 자료를 SKILL.md 초안 JSON으로 정리해주세요.`,
  ].join("\n");

  const raw = await window.claude.complete({
    messages: [
      { role: "user", content: `${DRAFT_SYSTEM_HINT}\n\n---\n\n${userMsg}` },
    ],
  });

  return parseDraftJSON(raw);
}

function parseDraftJSON(raw) {
  if (!raw) throw new Error("응답이 비어 있어요.");
  // 코드펜스 제거
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  // 첫 { ~ 마지막 } 사이만 추출 (앞뒤 잡음 흡수)
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);

  let obj;
  try { obj = JSON.parse(s); }
  catch (err) { throw new Error("JSON 파싱 실패: " + err.message + "\n\n원본:\n" + raw.slice(0, 400)); }

  // normalize
  const arr = (v) => Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : [];
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  return {
    name: str(obj.name),
    description: str(obj.description),
    when_to_use: str(obj.when_to_use),
    core: arr(obj.core),
    algorithm: arr(obj.algorithm),
    inputs: str(obj.inputs),
    outputs: str(obj.outputs),
    hyperparams: arr(obj.hyperparams),
    pitfalls: arr(obj.pitfalls),
    verify: arr(obj.verify),
    depends_on: arr(obj.depends_on),
    code_refs: arr(obj.code_refs),
  };
}

// Modal UI for drafting. SpecEditor 안에서 호출.
function DraftDialog({ paper, onCancel, onApply, accent }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const run = async () => {
    if (!text.trim()) { setError("자료 본문을 붙여넣어 주세요."); return; }
    setBusy(true); setError("");
    try {
      const draft = await draftSpec({
        title: paper.title,
        source: paper.link,
        text: text.trim().slice(0, 14000),
      });
      onApply(draft);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(20,18,15,0.4)", zIndex: 40,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn .12s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 8, width: 560, maxHeight: "85vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px -20px rgba(0,0,0,.4)",
      }}>
        <div style={{ padding: "20px 24px 12px" }}>
          <div style={{
            fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase",
            color: "#9b9a97", fontFamily: "ui-monospace, Menlo, monospace",
          }}>Auto-draft for</div>
          <h2 style={{ margin: "4px 0 4px", fontSize: 17, fontWeight: 600, color: "#1d1b18", lineHeight: 1.3 }}>
            {paper.title}
          </h2>
          <div style={{ fontSize: 12, color: "#787774", lineHeight: 1.5 }}>
            논문 abstract, 블로그 본문, intro 단락 등을 붙여넣으면 Claude가 SKILL 필드 초안을 만듭니다.
            결과는 에디터에 그대로 채워지고, 저장 전에 자유롭게 다듬을 수 있어요.
          </div>
        </div>

        <div style={{ padding: "0 24px 16px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="여기에 자료 본문을 붙여넣기 (Abstract + Intro 정도가 가장 잘 동작해요. 너무 길면 앞 14k자만 사용)"
            style={{
              flex: 1, minHeight: 220, width: "100%", boxSizing: "border-box",
              border: "1px solid #e8e1cf", borderRadius: 6, padding: "10px 12px",
              fontSize: 12.5, lineHeight: 1.55, color: "#2a2722",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              outline: "none", resize: "vertical", background: "#fdfcf9",
            }}
            disabled={busy}
          />
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 10.5, color: "#9c978d", marginTop: 6,
            fontFamily: "ui-monospace, Menlo, monospace",
          }}>
            <span>{text.length.toLocaleString()} chars</span>
            <span>{text.length > 14000 ? `↑ 14k chars로 잘림` : ""}</span>
          </div>

          {error && (
            <div style={{
              marginTop: 10, padding: "9px 11px",
              background: "#fdecec", border: "1px solid #f3c9c5",
              borderRadius: 5, fontSize: 11.5, color: "#a23a33",
              fontFamily: "ui-monospace, Menlo, monospace",
              whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto",
            }}>{error}</div>
          )}
        </div>

        <div style={{
          padding: "12px 24px 18px",
          borderTop: "1px solid #ece6d7",
          display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center",
        }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: "7px 14px", border: "1px solid #e2dccf",
            background: "#fff", color: "#37352f", borderRadius: 5,
            cursor: busy ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit",
          }}>취소</button>
          <button onClick={run} disabled={busy || !text.trim()} style={{
            padding: "7px 16px", border: "none",
            background: !text.trim() ? "#c7c6c2" : (busy ? "#787774" : (accent || "#37352f")),
            color: "#fff", borderRadius: 5, fontSize: 13, fontWeight: 500,
            cursor: (busy || !text.trim()) ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            {busy ? (
              <>
                <Spinner /> 초안 생성 중…
              </>
            ) : (
              <>✨ Claude로 초안 생성</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12,
      border: "2px solid rgba(255,255,255,0.4)",
      borderTopColor: "#fff", borderRadius: 99,
      animation: "spin .8s linear infinite",
    }} />
  );
}

// Inject keyframes once.
if (typeof document !== "undefined" && !document.getElementById("draft-spinner-css")) {
  const s = document.createElement("style");
  s.id = "draft-spinner-css";
  s.textContent = "@keyframes spin { to { transform: rotate(360deg) } }";
  document.head.appendChild(s);
}

Object.assign(window, { draftSpec, DraftDialog });
