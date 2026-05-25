// Spec editor — in-app SKILL.md 필드 편집기.
// 텍스트 필드 + 리스트 필드. 저장 시 SpecStore에 persist.

function SpecEditor({ paper, accent, onDone }) {
  const seed = (window.SPECS && window.SPECS[paper.id]) || null;
  const user = window.SpecStore.getUserSpec(paper.id) || null;

  // 초기값 = user override가 있으면 그걸로, 없으면 seed의 복제
  const init = React.useMemo(() => {
    const base = user || seed || {};
    return {
      name: base.name || "",
      description: base.description || "",
      when_to_use: base.when_to_use || "",
      core: Array.isArray(base.core) ? [...base.core] : [],
      algorithm: Array.isArray(base.algorithm) ? [...base.algorithm] : [],
      inputs: base.inputs || "",
      outputs: base.outputs || "",
      hyperparams: Array.isArray(base.hyperparams) ? [...base.hyperparams] : [],
      pitfalls: Array.isArray(base.pitfalls) ? [...base.pitfalls] : [],
      verify: Array.isArray(base.verify) ? [...base.verify] : [],
      depends_on: Array.isArray(base.depends_on) ? [...base.depends_on] : [],
      code_refs: Array.isArray(base.code_refs) ? [...base.code_refs] : [],
    };
  }, [paper.id]);

  const [form, setForm] = React.useState(init);
  const [drafting, setDrafting] = React.useState(false);
  React.useEffect(() => { setForm(init); }, [paper.id, init]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (k, i, v) => setForm((f) => {
    const arr = [...f[k]]; arr[i] = v; return { ...f, [k]: arr };
  });
  const addItem = (k) => setForm((f) => ({ ...f, [k]: [...f[k], ""] }));
  const removeItem = (k, i) => setForm((f) => {
    const arr = f[k].filter((_, idx) => idx !== i); return { ...f, [k]: arr };
  });
  const moveItem = (k, i, dir) => setForm((f) => {
    const arr = [...f[k]];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return f;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...f, [k]: arr };
  });

  const applyDraft = (draft) => {
    setForm((f) => ({
      name: draft.name || f.name,
      description: draft.description || f.description,
      when_to_use: draft.when_to_use || f.when_to_use,
      inputs: draft.inputs || f.inputs,
      outputs: draft.outputs || f.outputs,
      core: draft.core.length ? draft.core : f.core,
      algorithm: draft.algorithm.length ? draft.algorithm : f.algorithm,
      hyperparams: draft.hyperparams.length ? draft.hyperparams : f.hyperparams,
      pitfalls: draft.pitfalls.length ? draft.pitfalls : f.pitfalls,
      verify: draft.verify.length ? draft.verify : f.verify,
      depends_on: draft.depends_on.length ? draft.depends_on : f.depends_on,
      code_refs: draft.code_refs.length ? draft.code_refs : f.code_refs,
    }));
    setDrafting(false);
  };

  const save = () => {
    // 빈 항목 정리
    const clean = (arr) => arr.map((s) => s.trim()).filter(Boolean);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      when_to_use: form.when_to_use.trim(),
      inputs: form.inputs.trim(),
      outputs: form.outputs.trim(),
      core: clean(form.core),
      algorithm: clean(form.algorithm),
      hyperparams: clean(form.hyperparams),
      pitfalls: clean(form.pitfalls),
      verify: clean(form.verify),
      depends_on: clean(form.depends_on),
      code_refs: clean(form.code_refs),
    };
    window.SpecStore.saveSpec(paper.id, payload);
    onDone?.();
  };

  const reset = () => {
    if (!confirm("이 카드의 사용자 수정본을 모두 지우고 시드 값으로 되돌릴까요?")) return;
    window.SpecStore.clearSpec(paper.id);
    onDone?.();
  };

  const slug = paper.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Draft banner */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#f4f0fb", border: "1px solid #ddd0f0", borderRadius: 6,
        padding: "9px 11px", gap: 10,
      }}>
        <div style={{ fontSize: 11.5, color: "#5b4a8c", lineHeight: 1.5 }}>
          자료 본문을 붙여넣으면 Claude가 이 카드의 SKILL 필드를 초안으로 채워줘요.
        </div>
        <button onClick={() => setDrafting(true)} style={{
          flexShrink: 0, padding: "5px 11px", border: "none",
          background: "#6a4ec0", color: "#fff", borderRadius: 4,
          fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
          fontWeight: 500,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>✨ 자동 초안</button>
      </div>

      <FieldText
        label="name (slug)"
        hint="Claude Code skill 파일명 베이스 — 영문 소문자/하이픈"
        placeholder={`예: ${slug}-skill`}
        value={form.name} onChange={(v) => set("name", v)}
      />
      <FieldText
        label="description"
        hint="이 스킬이 뭘 하는지 한 줄. SKILL.md frontmatter로 들어감."
        value={form.description} onChange={(v) => set("description", v)}
        multiline
      />
      <FieldText
        label="when_to_use"
        hint="이 스킬을 언제 꺼내야 하는지. Claude가 디스패치 결정할 때 봄."
        value={form.when_to_use} onChange={(v) => set("when_to_use", v)}
        multiline
      />

      <FieldList
        label="Core idea"
        hint="핵심 아이디어 bullet — 3-5개 권장"
        items={form.core}
        onChange={(i, v) => setItem("core", i, v)}
        onAdd={() => addItem("core")}
        onRemove={(i) => removeItem("core", i)}
        onMove={(i, d) => moveItem("core", i, d)}
        accent={accent}
      />

      <FieldList
        label="Algorithm"
        hint="구현 단계 (자동으로 번호 매김)"
        items={form.algorithm}
        onChange={(i, v) => setItem("algorithm", i, v)}
        onAdd={() => addItem("algorithm")}
        onRemove={(i) => removeItem("algorithm", i)}
        onMove={(i, d) => moveItem("algorithm", i, d)}
        accent={accent}
        numbered
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FieldText
          label="Input"
          value={form.inputs} onChange={(v) => set("inputs", v)}
          multiline
        />
        <FieldText
          label="Output"
          value={form.outputs} onChange={(v) => set("outputs", v)}
          multiline
        />
      </div>

      <FieldList
        label="Hyperparameters"
        items={form.hyperparams}
        onChange={(i, v) => setItem("hyperparams", i, v)}
        onAdd={() => addItem("hyperparams")}
        onRemove={(i) => removeItem("hyperparams", i)}
        onMove={(i, d) => moveItem("hyperparams", i, d)}
        accent={accent}
      />

      <FieldList
        label="Pitfalls / failure modes"
        items={form.pitfalls}
        onChange={(i, v) => setItem("pitfalls", i, v)}
        onAdd={() => addItem("pitfalls")}
        onRemove={(i) => removeItem("pitfalls", i)}
        onMove={(i, d) => moveItem("pitfalls", i, d)}
        accent={accent}
      />

      <FieldList
        label="How to verify"
        items={form.verify}
        onChange={(i, v) => setItem("verify", i, v)}
        onAdd={() => addItem("verify")}
        onRemove={(i) => removeItem("verify", i)}
        onMove={(i, d) => moveItem("verify", i, d)}
        accent={accent}
      />

      <FieldList
        label="Depends on"
        hint="다른 카드의 id (예: react, rag)"
        items={form.depends_on}
        onChange={(i, v) => setItem("depends_on", i, v)}
        onAdd={() => addItem("depends_on")}
        onRemove={(i) => removeItem("depends_on", i)}
        onMove={(i, d) => moveItem("depends_on", i, d)}
        accent={accent}
        compact
      />

      <FieldList
        label="Code references"
        hint="github / 데모 / 페이지"
        items={form.code_refs}
        onChange={(i, v) => setItem("code_refs", i, v)}
        onAdd={() => addItem("code_refs")}
        onRemove={(i) => removeItem("code_refs", i)}
        onMove={(i, d) => moveItem("code_refs", i, d)}
        accent={accent}
      />

      {/* Sticky bottom bar */}
      <div style={{
        position: "sticky", bottom: -30, marginTop: 4,
        marginLeft: -30, marginRight: -30, padding: "12px 30px",
        background: "linear-gradient(to top, #fdfcf9 70%, rgba(253,252,249,0))",
        borderTop: "1px solid #ece6d7",
        display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{
            padding: "7px 16px", border: "none",
            background: accent, color: "#fff", borderRadius: 5,
            cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500,
          }}>저장</button>
          <button onClick={onDone} style={{
            padding: "7px 14px", border: "1px solid #e2dccf",
            background: "#fff", color: "#37352f", borderRadius: 5,
            cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          }}>취소</button>
        </div>
        {(seed || window.SpecStore.getUserSpec(paper.id)) && (
          <button onClick={reset} style={{
            padding: "6px 10px", border: "none", background: "transparent",
            color: "#9c978d", cursor: "pointer", fontSize: 11.5,
            fontFamily: "ui-monospace, Menlo, monospace",
          }}>초기화</button>
        )}
      </div>

      {drafting && window.DraftDialog && (
        <window.DraftDialog
          paper={paper}
          accent={accent}
          onCancel={() => setDrafting(false)}
          onApply={applyDraft}
        />
      )}
    </div>
  );
}

function FieldLabel({ label, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase",
        color: "#5b574d", fontFamily: "ui-monospace, Menlo, monospace",
        fontWeight: 600,
      }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 11, color: "#9c978d", marginTop: 2, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function FieldText({ label, hint, value, onChange, placeholder, multiline }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 2 : undefined}
        style={{
          width: "100%", boxSizing: "border-box",
          border: "1px solid #e8e1cf", borderRadius: 5,
          padding: "7px 10px", fontSize: 13, color: "#2a2722",
          background: "#fff", fontFamily: "inherit", outline: "none",
          resize: multiline ? "vertical" : "none",
          minHeight: multiline ? 44 : "auto",
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function FieldList({ label, hint, items, onChange, onAdd, onRemove, onMove, accent, numbered, compact }) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            {numbered && (
              <span style={{
                paddingTop: 6, width: 18, textAlign: "right",
                fontSize: 11, color: "#9c978d",
                fontFamily: "ui-monospace, Menlo, monospace",
              }}>{i + 1}.</span>
            )}
            {compact ? (
              <input
                value={v}
                onChange={(e) => onChange(i, e.target.value)}
                style={{
                  flex: 1, border: "1px solid #e8e1cf", borderRadius: 5,
                  padding: "5px 9px", fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace",
                  background: "#fff", outline: "none",
                }}
              />
            ) : (
              <textarea
                value={v}
                onChange={(e) => onChange(i, e.target.value)}
                rows={1}
                style={{
                  flex: 1, border: "1px solid #e8e1cf", borderRadius: 5,
                  padding: "6px 10px", fontSize: 12.5, color: "#2a2722",
                  background: "#fff", fontFamily: "inherit", outline: "none",
                  resize: "vertical", minHeight: 32, lineHeight: 1.45,
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 1 }}>
              <IconBtn onClick={() => onMove(i, -1)} disabled={i === 0} title="위로">↑</IconBtn>
              <IconBtn onClick={() => onMove(i, +1)} disabled={i === items.length - 1} title="아래로">↓</IconBtn>
            </div>
            <IconBtn onClick={() => onRemove(i)} title="삭제" danger>×</IconBtn>
          </div>
        ))}
      </div>
      <button onClick={onAdd} style={{
        marginTop: items.length ? 6 : 0,
        border: "1px dashed #d8d1bf", background: "transparent",
        color: "#8c887e", borderRadius: 5, padding: "5px 10px",
        fontSize: 11.5, cursor: "pointer", fontFamily: "ui-monospace, Menlo, monospace",
      }}>＋ 항목 추가</button>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        border: "none", background: "transparent", cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#d6d3ce" : (danger ? "#b5544e" : "#8c887e"),
        width: 18, height: 14, padding: 0, fontSize: 12, lineHeight: 1,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}>{children}</button>
  );
}

window.SpecEditor = SpecEditor;
