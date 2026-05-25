// SKILL.md / Claude Code skill 형식 렌더링 + 클립보드 복사 + 전체 export.
// 사람도 읽기 좋고, 클로드 코드한테 그대로 던질 수 있는 markdown 형태.

function getEffectiveSpec(paper) {
  if (window.SpecStore) return window.SpecStore.getSpec(paper.id);
  return window.SPECS?.[paper.id] || null;
}

function buildSkillMd(paper, spec) {
  const slug = (spec && spec.name) || (paper.id || paper.short).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const desc = (spec && spec.description) || paper.summary || "";
  const when = (spec && spec.when_to_use) || "";
  const lines = [];

  // Frontmatter
  lines.push("---");
  lines.push(`name: ${slug}`);
  if (desc) lines.push(`description: ${JSON.stringify(desc)}`);
  if (when) lines.push(`when_to_use: ${JSON.stringify(when)}`);
  lines.push(`category: ${paper.category}`);
  lines.push(`source: ${paper.link || "—"}`);
  lines.push(`authors: ${paper.authors}`);
  lines.push(`date: ${paper.date}`);
  lines.push(`tags: [${paper.tags.map((t) => JSON.stringify(t)).join(", ")}]`);
  lines.push(`rating: ${paper.rating}`);
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${paper.short}`);
  lines.push("");
  if (paper.title && paper.title !== paper.short) {
    lines.push(`> ${paper.title}`);
    lines.push("");
  }

  // TL;DR
  if (paper.summary) {
    lines.push("## TL;DR");
    lines.push(paper.summary);
    lines.push("");
  }

  // Core idea
  if (spec?.core?.length) {
    lines.push("## Core idea");
    spec.core.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  }

  // Algorithm
  if (spec?.algorithm?.length) {
    lines.push("## Algorithm");
    spec.algorithm.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push("");
  }

  // I/O
  if (spec?.inputs || spec?.outputs) {
    lines.push("## I/O");
    if (spec.inputs) lines.push(`**Input** — ${spec.inputs}`);
    if (spec.outputs) lines.push(`**Output** — ${spec.outputs}`);
    lines.push("");
  }

  // Hyperparams
  if (spec?.hyperparams?.length) {
    lines.push("## Hyperparameters");
    spec.hyperparams.forEach((h) => lines.push(`- ${h}`));
    lines.push("");
  }

  // Pitfalls
  if (spec?.pitfalls?.length) {
    lines.push("## Pitfalls / failure modes");
    spec.pitfalls.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }

  // Verify
  if (spec?.verify?.length) {
    lines.push("## How to verify");
    spec.verify.forEach((v) => lines.push(`- ${v}`));
    lines.push("");
  }

  // Personal note
  if (paper.note) {
    lines.push("## Notes");
    lines.push(paper.note);
    lines.push("");
  }

  // Dependencies + refs
  if (spec?.depends_on?.length) {
    lines.push("## Depends on");
    spec.depends_on.forEach((id) => lines.push(`- ${id}`));
    lines.push("");
  }
  if (spec?.code_refs?.length || paper.link) {
    lines.push("## References");
    if (paper.link) lines.push(`- Paper: ${paper.link}`);
    (spec?.code_refs || []).forEach((r) => lines.push(`- Code: ${r}`));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function buildAllSkills(papers) {
  return papers.map((p) => buildSkillMd(p, getEffectiveSpec(p))).join("\n\n---\n\n");
}

// React component that renders the SKILL.md preview inside the detail panel.
function SkillView({ paper, accent, onEdit }) {
  // SpecStore 변경 구독
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.SpecStore?.subscribe(force), []);
  const spec = getEffectiveSpec(paper);
  const md = buildSkillMd(paper, spec);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
    } catch (_) {
      // Fallback for non-clipboard contexts
      const ta = document.createElement("textarea");
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const download = () => {
    const slug = (spec && spec.name) || (paper.id || paper.short).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const rich = spec && (
    spec.core?.length || spec.algorithm?.length || spec.inputs ||
    spec.hyperparams?.length || spec.pitfalls?.length || spec.verify?.length
  );

  return (
    <div>
      {!rich && (
        <div style={{
          fontSize: 12, color: "#8c7a3a", background: "#fff7e0", border: "1px solid #f0e1a8",
          padding: "10px 12px", borderRadius: 5, marginBottom: 14, lineHeight: 1.5,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <span>아직 spec 필드가 비어 있어요. SKILL.md는 frontmatter + 요약만 포함돼요.</span>
          {onEdit && (
            <button onClick={onEdit} style={{
              flexShrink: 0, padding: "5px 10px", border: "none",
              background: "#8c7a3a", color: "#fff", borderRadius: 4,
              fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
            }}>spec 채우기 →</button>
          )}
        </div>
      )}

      <pre style={{
        margin: 0, padding: "14px 16px",
        background: "#fafaf7", border: "1px solid #ececec", borderRadius: 6,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11.5, lineHeight: 1.55, color: "#2a2722",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 460, overflowY: "auto",
      }}>{md}</pre>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={copy} style={{
          padding: "6px 12px", border: "none", background: accent || "#37352f",
          color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span>📋</span>
          {copied ? "복사됨" : "Copy SKILL.md"}
        </button>
        <button onClick={download} style={{
          padding: "6px 12px", border: "1px solid #ececec", background: "#fff",
          color: "#37352f", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
        }}>
          ⬇ .md 다운로드
        </button>
        {onEdit && rich && (
          <button onClick={onEdit} style={{
            marginLeft: "auto", padding: "6px 10px", border: "none", background: "transparent",
            color: accent || "#37352f", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          }}>
            ✏️ 편집
          </button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { buildSkillMd, buildAllSkills, SkillView });
