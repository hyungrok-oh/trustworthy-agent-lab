// Dependency graph overlay.
// SpecStore의 depends_on 필드를 따라 prereq → dependent 화살표.
// 카테고리별 클러스터 중심으로 약하게 끌어당기는 mini 포스 시뮬레이션 + 드래그.

const { useState: useStateG, useEffect: useEffectG, useMemo: useMemoG, useRef: useRefG } = React;

function DependencyGraph({ papers, onOpenPaper, onClose }) {
  const W = 1280, H = 800;

  // SpecStore가 바뀔 때 그래프 재계산
  const [tick, setTick] = useStateG(0);
  useEffectG(() => window.SpecStore?.subscribe(() => setTick((x) => x + 1)), []);

  const { nodes, edges, byId } = useMemoG(() => {
    const byId = Object.fromEntries(papers.map((p) => [p.id, p]));
    const nodes = papers.map((p) => {
      const spec = window.SpecStore?.getSpec(p.id) || window.SPECS?.[p.id] || {};
      const cat = CAT_BY_ID[p.category] ? p.category : (CATEGORIES[0]?.id || "_unknown");
      return {
        id: p.id,
        label: p.short || p.title,
        cat,
        rating: p.rating || 3,
        depends_on: spec.depends_on || [],
        paper: p,
      };
    });
    const edges = [];
    nodes.forEach((n) => {
      n.depends_on.forEach((depId) => {
        if (byId[depId]) edges.push({ source: depId, target: n.id });
      });
    });
    return { nodes, edges, byId };
    // eslint-disable-next-line
  }, [papers, tick]);

  // Category cluster anchors
  const clusters = useMemoG(() => {
    const cats = CATEGORIES;
    const out = {};
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.32;
    cats.forEach((c, i) => {
      const a = (i / cats.length) * Math.PI * 2 - Math.PI / 2;
      out[c.id] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
    return out;
  }, []);

  // Simulation state
  const stateRef = useRefG(null);
  if (!stateRef.current || stateRef.current.papersKey !== papers.map((p) => p.id).join(",")) {
    // init positions
    const positions = {};
    nodes.forEach((n, i) => {
      const c = clusters[n.cat] || { x: W / 2, y: H / 2 };
      const ang = (i * 137.508) * (Math.PI / 180); // golden-angle
      positions[n.id] = {
        x: c.x + Math.cos(ang) * 30,
        y: c.y + Math.sin(ang) * 30,
        vx: 0, vy: 0,
      };
    });
    stateRef.current = { positions, papersKey: papers.map((p) => p.id).join(",") };
  }
  const [, force] = useStateG(0);
  const [drag, setDrag] = useStateG(null);
  const [hover, setHover] = useStateG(null);
  const svgRef = useRefG(null);

  // Run simulation for ~250 ticks on mount / when graph topology changes
  useEffectG(() => {
    const positions = stateRef.current.positions;
    let cancelled = false;
    let count = 0;
    const TICKS = 320;
    const step = () => {
      if (cancelled) return;
      simStep(nodes, edges, clusters, positions);
      count++;
      if (count % 6 === 0) force((x) => x + 1); // batch re-render
      if (count < TICKS) requestAnimationFrame(step);
      else force((x) => x + 1);
    };
    requestAnimationFrame(step);
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [tick, nodes.length, edges.length]);

  const positions = stateRef.current.positions;

  // SVG coords ↔ screen coords via viewBox; drag converts client → svg.
  const clientToSvg = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const y = ((clientY - r.top) / r.height) * H;
    return { x, y };
  };

  const onMouseDown = (e, id) => {
    e.stopPropagation();
    setDrag(id);
  };
  useEffectG(() => {
    if (!drag) return;
    const move = (e) => {
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      const p = positions[drag];
      if (p) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; force((x) => x + 1); }
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line
  }, [drag]);

  // Highlight neighborhood of hover
  const highlight = useMemoG(() => {
    if (!hover) return null;
    const ups = new Set(), downs = new Set();
    edges.forEach((e) => {
      if (e.target === hover) ups.add(e.source);
      if (e.source === hover) downs.add(e.target);
    });
    return { ups, downs };
  }, [hover, edges]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15, 14, 12, 0.55)",
      zIndex: 30, animation: "fadeIn .15s ease",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(1320px, 100%)", maxHeight: "100%",
        background: "#fdfcf9", borderRadius: 10, overflow: "hidden",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,.45)",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid #ece6d7",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase",
              color: "#9c978d", fontFamily: "ui-monospace, Menlo, monospace",
            }}>Dependency graph</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#1d1b18", marginTop: 2 }}>
              prerequisite → follow-up
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 11.5, color: "#787774" }}>
              {nodes.length} nodes · {edges.length} edges · 카드 클릭으로 상세 보기
            </span>
            <button onClick={onClose} style={{
              border: "none", background: "transparent", cursor: "pointer",
              fontSize: 20, color: "#9c978d", lineHeight: 1, padding: "0 4px",
            }}>×</button>
          </div>
        </div>

        {/* SVG */}
        <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#fbfaf6" }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
              {CATEGORIES.map((c) => (
                <marker key={c.id} id={`arrow-${c.id}`} viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c.color} />
                </marker>
              ))}
              <marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#c8c2b1" />
              </marker>
            </defs>

            {/* Dot grid bg */}
            <rect width={W} height={H} fill="url(#dots)" />
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#ebe5d6" />
              </pattern>
            </defs>

            {/* Cluster labels */}
            {Object.entries(clusters).map(([cat, c]) => {
              const C = CAT_BY_ID[cat] || { color: "#bbb", label: cat };
              return (
                <text key={cat} x={c.x} y={c.y - 60} textAnchor="middle"
                  style={{
                    fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fill: C.color, opacity: 0.55,
                  }}>
                  ◦ {C.label}
                </text>
              );
            })}

            {/* Edges */}
            {edges.map((e, i) => {
              const a = positions[e.source], b = positions[e.target];
              if (!a || !b) return null;
              const sourceNode = nodes.find((n) => n.id === e.source);
              const targetNode = nodes.find((n) => n.id === e.target);
              const tCat = targetNode ? (CAT_BY_ID[targetNode.cat] || { color: "#bbb" }) : { color: "#bbb" };
              const isHL = hover && (e.source === hover || e.target === hover);
              const dim = hover && !isHL;
              const stroke = dim ? "#dcd6c5" : tCat.color;
              const opacity = dim ? 0.35 : 0.75;

              // arrow ends slightly before target circle
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const rA = nodeRadius(sourceNode), rB = nodeRadius(targetNode);
              const sx = a.x + (dx / dist) * rA;
              const sy = a.y + (dy / dist) * rA;
              const tx = b.x - (dx / dist) * (rB + 4);
              const ty = b.y - (dy / dist) * (rB + 4);

              return (
                <line key={i} x1={sx} y1={sy} x2={tx} y2={ty}
                  stroke={stroke} strokeWidth={isHL ? 1.8 : 1}
                  opacity={opacity}
                  markerEnd={dim ? "url(#arrow-dim)" : `url(#arrow-${targetNode?.cat})`}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const p = positions[n.id];
              if (!p) return null;
              const cat = CAT_BY_ID[n.cat] || { color: "#bbb", label: n.cat };
              const r = nodeRadius(n);
              const isHover = hover === n.id;
              const isNeigh = highlight && (highlight.ups.has(n.id) || highlight.downs.has(n.id));
              const dim = hover && !isHover && !isNeigh;
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: drag === n.id ? "grabbing" : "grab", opacity: dim ? 0.35 : 1 }}
                  onMouseDown={(e) => onMouseDown(e, n.id)}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover((h) => h === n.id ? null : h)}
                  onClick={(e) => { e.stopPropagation(); if (drag !== n.id) onOpenPaper(n.paper); }}
                >
                  <circle r={r + 4} fill="#fff" opacity={isHover ? 1 : 0} />
                  <circle r={r}
                    fill={cat.color}
                    stroke="#fff" strokeWidth="2"
                    style={{ filter: isHover ? "drop-shadow(0 4px 10px rgba(0,0,0,.25))" : "none" }}
                  />
                  <text textAnchor="middle" y={r + 14}
                    style={{
                      fontSize: 11, fill: "#2a2722",
                      fontWeight: isHover || isNeigh ? 600 : 500,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      pointerEvents: "none",
                    }}>
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer legend */}
        <div style={{
          padding: "10px 22px", borderTop: "1px solid #ece6d7",
          display: "flex", gap: 16, flexWrap: "wrap", background: "#fdfcf9",
          alignItems: "center",
        }}>
          {CATEGORIES.map((c) => (
            <span key={c.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "#5b574d",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: c.color }} />
              {c.label}
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#9c978d", fontFamily: "ui-monospace, Menlo, monospace" }}>
            depends_on 필드는 ✏️ Edit spec 탭에서 추가 가능
          </span>
        </div>
      </div>
    </div>
  );
}

function nodeRadius(n) {
  if (!n) return 8;
  return 6 + (n.rating || 3) * 1.4 + (n.depends_on?.length || 0) * 0.6;
}

// 한 step 시뮬레이션: repulsion + spring + cluster pull + damping.
function simStep(nodes, edges, clusters, pos) {
  const W = 1280, H = 800;
  const PAD = 60;
  const REP = 4200;       // repulsion strength
  const SPRING = 0.018;   // edge spring
  const SPRING_REST = 130;
  const CLUSTER = 0.012;  // cluster pull
  const DAMP = 0.78;
  const MAX_V = 22;

  // repulsion
  for (let i = 0; i < nodes.length; i++) {
    const a = pos[nodes[i].id];
    if (!a) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = pos[nodes[j].id];
      if (!b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy + 0.1;
      const d = Math.sqrt(d2);
      const f = REP / d2;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }

  // springs (edges)
  edges.forEach((e) => {
    const a = pos[e.source], b = pos[e.target];
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = (d - SPRING_REST) * SPRING;
    a.vx += (dx / d) * f; a.vy += (dy / d) * f;
    b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
  });

  // cluster pull
  nodes.forEach((n) => {
    const a = pos[n.id]; if (!a) return;
    const c = clusters[n.cat]; if (!c) return;
    a.vx += (c.x - a.x) * CLUSTER;
    a.vy += (c.y - a.y) * CLUSTER;
  });

  // integrate
  nodes.forEach((n) => {
    const a = pos[n.id]; if (!a) return;
    a.vx = Math.max(-MAX_V, Math.min(MAX_V, a.vx * DAMP));
    a.vy = Math.max(-MAX_V, Math.min(MAX_V, a.vy * DAMP));
    a.x += a.vx;
    a.y += a.vy;
    // boundary
    a.x = Math.max(PAD, Math.min(W - PAD, a.x));
    a.y = Math.max(PAD, Math.min(H - PAD, a.y));
  });
}

window.DependencyGraph = DependencyGraph;
