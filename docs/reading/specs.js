// Trustworthy Agent Lab — SKILL.md spec seeds.
// 본인의 Principle ↔ 카드 매핑이 자연스럽게 드러나도록 written.

window.SPECS = {
  // ── HTC ────────────────────────────────────────────────────────────
  htc: {
    name: "holistic-trajectory-calibration",
    description: "Last-step confidence가 아니라 전체 trajectory를 4개 diagnostic feature category로 보정하는 calibration 기법",
    when_to_use: "Agent의 final-answer confidence가 신뢰 가능한지 판단해야 할 때. 'high-score illusion'을 방지하고, 3-tier confidence response(Confident/Hedged/Uncertain)의 임계값을 결정할 때.",
    core: [
      "Last-step probability는 신뢰할 수 없다 — 0.973이어도 trajectory-level 0.052인 사례",
      "Trajectory 전체에서 4개 diagnostic feature category를 추출해 calibrated score 산출",
      "Categories: factual grounding, reasoning consistency, tool-use plausibility, retrieval support",
      "Final calibrated confidence로 confident / hedged / uncertain 3-tier 결정",
    ],
    algorithm: [
      "Agent 실행 trajectory를 StepTrace 시퀀스로 수집",
      "각 step에서 4개 feature 시그널 추출 (logprob, citation match, tool argument sanity 등)",
      "Trajectory-level aggregator (weighted sum or learned model)로 단일 calibrated score 계산",
      "Threshold 매핑: ≥0.80 confident / ≥0.50 hedged / <0.50 stop+explain",
    ],
    inputs: "StepTrace[] — 한 conversation turn의 실행 trace",
    outputs: "Calibrated confidence ∈ [0,1] + tier label",
    hyperparams: [
      "Tier thresholds: 0.80 / 0.50 (도메인별 튜닝 필요)",
      "Feature weights: 4 categories의 상대 비중",
      "Aggregation window: turn 단위 vs session 단위",
    ],
    pitfalls: [
      "Threshold가 너무 보수적이면 hedged/uncertain 응답이 과도해져 UX 저하",
      "Feature 시그널 자체가 LLM 호출이면 비용 가중",
      "Domain shift 시 calibration이 깨짐 — periodic recalibration 필수",
    ],
    verify: [
      "ECE (Expected Calibration Error) / Brier score on held-out set",
      "Tier별 정답률이 임계값 의미와 일치하는지 (confident tier에서 0.80↑)",
      "Confident-but-wrong 케이스 비율 — 가장 critical metric",
    ],
    depends_on: ["conf-calib"],
    code_refs: ["https://arxiv.org/abs/2601.55555"],
  },

  // ── AgentHallu ─────────────────────────────────────────────────────
  agenthallu: {
    name: "agent-hallucination-attribution",
    description: "Agent hallucination을 5개 카테고리(Planning, Retrieval, Reasoning, Tool-Use, Human-Interaction)로 귀속하는 분류 체계",
    when_to_use: "Agent 실패의 root cause를 step 단위로 식별할 때. Eval 서버의 step-category 라벨링, StepTrace의 diagnostic signal 설계.",
    core: [
      "Hallucination을 발생 단계로 귀속 → 한 모델의 답을 5개 차원으로 분해 가능",
      "Tool-Use hallucination이 가장 잡기 어려움 — GPT-5조차 11.6% accuracy",
      "잘못된 tool 선택은 후속 모든 step을 오염시킴 (cascade)",
      "Category 라벨이 있으면 eval pipeline이 'which step broke' 답을 줄 수 있음",
    ],
    algorithm: [
      "각 StepTrace에 step_type 부여 (5 categories)",
      "Step output이 ground truth와 충돌하면 그 step의 category로 hallucination 귀속",
      "Cascade detection: tool-use 실패 → downstream reasoning 오염 자동 표시",
      "Aggregate: turn당 hallucination distribution 리포트",
    ],
    inputs: "StepTrace[] + (선택) ground truth references",
    outputs: "Step별 hallucination flag + category",
    hyperparams: [
      "Confidence threshold for flagging",
      "Tool selection rationale 요구 여부",
    ],
    pitfalls: [
      "Tool-Use hallucination은 detector 자체가 어려움 — 별도 LLM-as-judge 필요",
      "Reasoning hallucination은 retrieval과 entangle — 분리 라벨링이 비현실적일 수 있음",
      "Ground truth 없는 production 환경에선 unsupervised detector 필요",
    ],
    verify: [
      "Category-별 detection precision/recall on labeled benchmark",
      "Inter-annotator agreement on category assignment",
    ],
    depends_on: [],
    code_refs: ["https://arxiv.org/abs/2601.11111"],
  },

  // ── TrajAD ─────────────────────────────────────────────────────────
  trajad: {
    name: "trajectory-anomaly-detection",
    description: "Agent 실행 trajectory의 이상 패턴(context contamination, loop, premature finalization 등)을 감지",
    when_to_use: "Production 환경에서 final-answer가 나오기 전에 trajectory 자체의 위험 신호를 잡고 싶을 때. Context boundary 설계 검증.",
    core: [
      "Context contamination은 silent — final answer까지 드러나지 않음",
      "Goal-blind execution: agent가 process rationality를 무시하고 목표만 추구",
      "Trajectory shape의 anomaly가 final quality의 leading indicator",
      "Context slot 분리(system/session/turn/history)로 contamination origin 추적 가능",
    ],
    algorithm: [
      "Step sequence를 fixed-length embedding으로 변환 (token-level + structural features)",
      "Normal trajectory 분포 학습 (autoencoder or contrastive)",
      "Reconstruction error / distance > threshold → anomaly flag",
      "Anomaly가 어느 context slot에서 시작됐는지 backtrace",
    ],
    inputs: "Live StepTrace stream",
    outputs: "Anomaly score + suspected slot",
    hyperparams: [
      "Anomaly threshold (precision-recall trade-off)",
      "Embedding dim",
      "Detection window (몇 step 누적 시 판단)",
    ],
    pitfalls: [
      "False positive가 많으면 production 운영 비용 폭증",
      "Long-tail anomaly는 학습 데이터로 못 잡음 — semi-supervised 보완 필요",
      "Slot 분리가 안 된 context에선 backtrace 불가",
    ],
    verify: [
      "Anomaly detection F1 on labeled trajectories",
      "Lead time: anomaly 감지 → 실제 실패 발생 사이의 step 수",
      "Production false-positive rate",
    ],
    depends_on: ["htc"],
    code_refs: ["https://arxiv.org/abs/2602.33333"],
  },

  // ── TRACE ──────────────────────────────────────────────────────────
  trace: {
    name: "step-level-trace-eval",
    description: "Final-output에 의존하지 않고 step 단위로 agent를 평가. 'High-score illusion' 방지.",
    when_to_use: "Output-level eval 점수가 높은데도 deploy하면 fail하는 패턴이 보일 때. Eval 서버의 핵심 메트릭 셋 설계.",
    core: [
      "Correct final answer ≠ correct reasoning",
      "Step별 독립 평가 가능해야 모델 개선의 방향이 보임",
      "StepTrace = (input, output, confidence, reasoning, diagnostic signals)",
      "No LLM call without a trace — observability를 design-time 제약으로",
    ],
    algorithm: [
      "각 LLM 호출 직후 StepTrace emit (TraceEmitter)",
      "Eval 서버가 trace stream을 수신해 step-level metric 계산",
      "Step-type별 metric 정의: Retrieval은 grounding, Tool-Use는 argument sanity, etc.",
      "Aggregate를 turn / session 단위로 rollup",
    ],
    inputs: "StepTrace event stream",
    outputs: "Step / Flow / Output 3-tier 메트릭",
    hyperparams: [
      "Trace sampling rate (production cost-control)",
      "Step-type별 metric weight",
    ],
    pitfalls: [
      "Trace 저장 비용 (MongoDB 용량) — retention policy 필수",
      "Step boundary 정의가 모호하면 metric도 모호",
      "TraceEmitter가 sync면 latency 추가 — async + best-effort 권장",
    ],
    verify: [
      "Step-level metric이 downstream final-output 품질과 상관관계가 있는가",
      "High-score illusion 케이스가 step-level에서 잡히는가",
      "Eval 서버 ingestion latency p99",
    ],
    depends_on: ["agenthallu", "htc"],
    code_refs: ["https://arxiv.org/abs/2602.44444"],
  },

  // ── DeepHalluBench ────────────────────────────────────────────────
  deephallu: {
    name: "deep-research-hallu-taxonomy",
    description: "Deep research agent의 전 trajectory를 PIES(Planning/Retrieval/etc.) taxonomy로 분류해 retrieval-gate 설계의 근거 제공",
    when_to_use: "RAG/Research agent가 hallucinate할 때 어느 단계 실패인지 빠르게 진단하고 싶을 때.",
    core: [
      "Retrieval과 Planning hallucination이 전체 실패의 과반",
      "Retrieval 품질이 무너지면 downstream planning까지 동반 붕괴",
      "Generation 전에 retrieval relevance score gate가 필수",
      "PIES taxonomy로 trajectory에 라벨 → eval 시 step별 비교 가능",
    ],
    algorithm: [
      "Retrieval step에 relevance score 계산 (LLM-as-judge or embedding)",
      "Threshold 미만이면 'no relevant info' 응답 + 생성 중단",
      "Trajectory를 PIES 카테고리로 라벨링 (offline 또는 online)",
      "Failure mode dashboard에 PIES 분포 표시",
    ],
    inputs: "Retrieval results + query + (선택) ground truth corpus",
    outputs: "Gate 결정 (proceed / stop) + 실패 카테고리",
    hyperparams: [
      "Relevance threshold (도메인별 calibration)",
      "Top-k retrieval",
    ],
    pitfalls: [
      "Threshold이 너무 보수적이면 '모르겠다' 응답 과다",
      "Relevance score 자체가 LLM 호출이면 비용/지연",
      "Multi-hop retrieval에선 한 hop의 fail이 chain 전체 무효화",
    ],
    verify: [
      "Gate 정확도: false-stop vs missed-hallu",
      "PIES distribution이 시간에 따라 어떻게 변화하는지",
    ],
    depends_on: ["agenthallu"],
    code_refs: ["https://arxiv.org/abs/2601.22222"],
  },

  // ── KDD survey ─────────────────────────────────────────────────────
  "kdd-survey": {
    name: "agent-eval-taxonomy",
    description: "Enterprise 환경에서 LLM agent를 평가하기 위한 2차원 taxonomy (capability × dimension)",
    when_to_use: "본인 eval 서버의 metric set이 충분히 wide한지 점검할 때. 새 메트릭 도입의 타당성 근거.",
    core: [
      "Axis 1: capability (planning, tool-use, memory, reasoning, …)",
      "Axis 2: dimension (correctness, efficiency, safety, robustness, …)",
      "각 셀이 'X capability를 Y dimension에서 평가'하는 메트릭에 매핑",
      "Enterprise는 cell coverage가 spotty할수록 deploy risk가 큼",
    ],
    algorithm: [],
    inputs: "기존 eval metric 리스트",
    outputs: "2D coverage heatmap",
    hyperparams: [],
    pitfalls: [
      "Cell이 너무 많으면 운영 비용 폭증 — 가중치 prioritization 필요",
      "단일 메트릭이 여러 cell에 겹치면 ownership 불명확",
    ],
    verify: [
      "Coverage 매트릭스의 빈 셀이 실제 deploy risk와 일치하는지 retro",
    ],
    depends_on: [],
    code_refs: ["https://arxiv.org/abs/2507.99999"],
  },

  // ── Anthropic Effective Agents ────────────────────────────────────
  "anthropic-agents": {
    name: "effective-agent-patterns",
    description: "Workflow와 Agent의 구분, 그리고 점진적 진화 경로 (Augmented LLM → Chaining → Routing → Parallelization → Orchestrator → Autonomous)",
    when_to_use: "새 agent 기능을 어느 패턴으로 구현할지 결정할 때. 'Simple, predictable structures' 신념 검증.",
    core: [
      "Workflow = 미리 정의된 코드 경로, Agent = LLM이 흐름을 동적으로 결정",
      "단계적 진화: 가장 단순한 패턴부터, 필요할 때만 다음 단계로",
      "Augmented LLM = retrieval + tool + memory 1회 호출",
      "Prompt chaining → routing → parallelization → orchestrator → autonomous",
      "복잡도가 높을수록 traceability/debuggability 비용 폭증",
    ],
    algorithm: [
      "Use case를 가장 단순한 패턴으로 먼저 구현",
      "실패 모드를 보고 다음 패턴이 정말 필요한지 검증",
      "패턴 업그레이드 시 StepTrace 구조와 eval 메트릭도 함께 진화",
    ],
    inputs: "Use case 정의",
    outputs: "Recommended pattern + StepTrace 구조",
    hyperparams: [],
    pitfalls: [
      "처음부터 autonomous를 시도하면 디버깅 지옥",
      "Framework 추상화 위에 쌓으면 trace 가시성 손실",
    ],
    verify: [
      "각 패턴이 step-eval에서 step 경계가 명확히 보이는가",
      "패턴 업그레이드 후 fail mode가 새로 발생하지 않는가",
    ],
    depends_on: ["react"],
    code_refs: ["https://www.anthropic.com/research/building-effective-agents"],
  },

  // ── ReAct ──────────────────────────────────────────────────────────
  react: {
    name: "react-agent-loop",
    description: "Thought → Action → Observation 인터리브 루프. 가장 단순한 동적 agent.",
    when_to_use: "Tool 호출이 1-N step 필요한 task. ReAct trace를 그대로 StepTrace 시퀀스로 매핑할 수 있음.",
    core: [
      "각 step에서 (Thought, Action) 쌍 출력",
      "Action을 환경에 적용 → Observation 수신 → trace에 누적",
      "Action=Finish 또는 max_steps에서 종료",
      "Trace 자체가 reasoning chain — 그대로 step-level eval 가능",
    ],
    algorithm: [
      "Prompt = system + few-shot ReAct demos + task + 현재 trace",
      "LLM 호출, 출력 파싱 (Thought N / Action N: tool[arg])",
      "Tool 실행 → Observation N: ... 추가",
      "Finish 또는 max_steps까지 반복",
    ],
    inputs: "Task description, tool set, max_steps",
    outputs: "Final answer + 전체 trace",
    hyperparams: [
      "max_steps (5–10)",
      "Few-shot demo 수 (2–6)",
      "Temperature (0~0.3)",
    ],
    pitfalls: [
      "Tool observation이 길면 context overflow — 요약/잘라내기 필요",
      "Same-thought loop — Reflexion-style critique 추가 고려",
      "Parser fragile — structured tool-calling으로 대체 가능",
    ],
    verify: [
      "Step-level: tool selection accuracy, redundancy",
      "Trajectory-level: TrajAD anomaly score",
      "Output-level: task EM/F1",
    ],
    depends_on: [],
    code_refs: ["https://github.com/ysymyth/ReAct"],
  },

  // ── MCP ────────────────────────────────────────────────────────────
  mcp: {
    name: "model-context-protocol",
    description: "Tool integration의 open standard. server/client 분리 + capability negotiation + transport 추상화.",
    when_to_use: "Tool 생태계를 여러 client(Claude, IDE 등)에 동시 노출하고 싶을 때. Tool catalog 표준화.",
    core: [
      "Server는 tool을 노출, client는 capability를 협상해 사용",
      "Transport(stdio, sse, ws) 추상 — 같은 server를 여러 환경에 재사용",
      "JSON-RPC 기반 → 디버깅 용이",
      "Resource / Prompt / Tool의 3 primitives",
    ],
    algorithm: [
      "Server 구현: tools/list, tools/call, resources/list 등 표준 endpoint",
      "Capability negotiation: client가 protocol version + features 교환",
      "Tool 호출: JSON-RPC request → server 실행 → response",
    ],
    inputs: "Tool spec (name, params schema, description)",
    outputs: "Tool execution result",
    hyperparams: [],
    pitfalls: [
      "Tool spec이 모호하면 selection hallucination 증가 (AgentHallu)",
      "Stateless 가정이 강해 long-running task에는 별도 설계 필요",
      "Authn/authz는 transport-level이라 client마다 처리 다름",
    ],
    verify: [
      "Tool selection accuracy (MCP server 추가 후 변화 측정)",
      "Tool-use hallucination rate (AgentHallu category)",
    ],
    depends_on: ["agenthallu"],
    code_refs: ["https://modelcontextprotocol.io"],
  },

  // ── .md context design ───────────────────────────────────────────
  "claude-md": {
    name: "md-context-design",
    description: "프로젝트 루트의 CLAUDE.md / AGENTS.md로 agent에게 컨벤션/규칙을 주입하는 패턴",
    when_to_use: "Codebase에 agent(claude code 등)를 일관되게 작업시키고 싶을 때. 매번 같은 컨텍스트를 prompt하지 않으려고.",
    core: [
      "프로젝트 루트의 CLAUDE.md를 자동으로 system context에 주입",
      "코드 컨벤션, 파일 구조, 테스트 명령, '하지 말 것' 리스트를 한 곳에",
      "Iterative 개선 가능 — 매 실수마다 한 줄씩 추가",
      "Repository-as-knowledge: agent의 memory가 git에 버전 관리됨",
    ],
    algorithm: [
      "프로젝트 루트에 CLAUDE.md 생성",
      "섹션 분리: Tech stack / Conventions / Commands / Avoid",
      "Agent 작업 중 실수 발견 시 그 자리에서 CLAUDE.md에 한 줄 추가",
      "Periodic review로 stale 룰 제거",
    ],
    inputs: "프로젝트 컨벤션 + 자주 발생하는 agent 실수",
    outputs: "지속적으로 진화하는 CLAUDE.md",
    hyperparams: [],
    pitfalls: [
      "너무 길어지면 attention 분산 — 핵심만 유지",
      "Stale 룰이 새 룰과 충돌하면 agent 혼란",
    ],
    verify: [
      "동일 작업 반복 시 agent 실수율 감소 추이",
    ],
    depends_on: [],
    code_refs: ["https://docs.claude.com/en/docs/claude-code/memory"],
  },
};
