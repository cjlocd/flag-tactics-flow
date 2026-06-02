import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  CircleDot,
  ClipboardList,
  Flag,
  Layers3,
  Move,
  Pause,
  Play,
  Plus,
  Route,
  Save,
  Shield,
  Sparkles,
  TimerReset,
  Trophy,
  Undo2,
  Users,
  Zap,
  Redo2
} from "lucide-react";
import "./styles.css";

const FIELD = { width: 1200, height: 620 };

const basePlayers = [
  { id: "qb", side: "offense", role: "qb", label: "QB", name: "四分卫", x: 178, y: 310, route: null, color: "#f6c15b" },
  { id: "c", side: "offense", role: "c", label: "C", name: "中锋", x: 250, y: 310, route: null, color: "#f6c15b" },
  { id: "wr1", side: "offense", role: "wr", label: "Z", name: "外接手", x: 250, y: 126, route: null, color: "#f6c15b" },
  { id: "wr2", side: "offense", role: "wr", label: "X", name: "外接手", x: 254, y: 494, route: null, color: "#f6c15b" },
  { id: "rb", side: "offense", role: "rb", label: "RB", name: "跑卫", x: 128, y: 378, route: null, color: "#f6c15b" },
  { id: "d1", side: "defense", label: "CB", name: "角卫", x: 462, y: 126, route: "zone", color: "#7ad7ff" },
  { id: "d2", side: "defense", label: "LB", name: "线卫", x: 430, y: 302, route: "spy", color: "#7ad7ff" },
  { id: "d3", side: "defense", label: "CB", name: "角卫", x: 462, y: 494, route: "zone", color: "#7ad7ff" },
  { id: "d4", side: "defense", label: "FS", name: "游卫", x: 610, y: 310, route: "deep", color: "#7ad7ff" },
  { id: "rush", side: "defense", label: "RU", name: "冲传手", x: 394, y: 382, route: "spy", color: "#7ad7ff" }
];

const routeShapes = {
  go: true,
  slant: true,
  out: true,
  wheel: true,
  read: true,
  curl: true,
  zone: true,
  spy: true,
  deep: true
};

const playbook = [
  { title: "Trips RPO Flag", tag: "腰旗 5v5", tempo: "7 秒出手", score: "高成功率", accent: "#f6c15b" },
  { title: "Mesh Switch", tag: "腰旗 5v5", tempo: "交叉阅读", score: "破人盯人", accent: "#78e2a8" },
  { title: "Flood Wheel", tag: "腰旗 5v5", tempo: "双层拉伸", score: "攻 Flat", accent: "#ff8870" },
  { title: "Cover 2 Robber", tag: "防守 5v5", tempo: "安全卫下切", score: "诱导中路", accent: "#7ad7ff" }
];

const DEMO_DURATION = 3.2;
const MOVEMENT_DELAY_PORTION = 0.22;

const demoPhases = [
  { key: "snap", time: 0, progress: 0, label: "开球", body: "站位确认，QB 接球后先看弱侧安全卫。" },
  { key: "read", time: 1.2, progress: 1.2 / DEMO_DURATION, label: "第一读", body: "路线已经展开，观察第一空窗与防守区域。" },
  { key: "release", time: 2.4, progress: 2.4 / DEMO_DURATION, label: "释放", body: "进攻球员连续跑到出手点，QB 按读秒释放。" },
  { key: "review", time: DEMO_DURATION, progress: 1, label: "复盘", body: "停在终点复盘路线深度、防守空窗和摘旗角度。" }
];

const layers = [
  { key: "routes", label: "路线", icon: Route },
  { key: "defense", label: "防守", icon: Shield },
  { key: "timing", label: "节奏", icon: Activity },
  { key: "notes", label: "口令", icon: ClipboardList }
];

const offenseRoles = [
  { key: "wr", label: "WR", name: "外接手", route: "go" },
  { key: "c", label: "C", name: "中锋", route: "curl" },
  { key: "qb", label: "QB", name: "四分卫", route: "read" },
  { key: "rb", label: "RB", name: "跑卫", route: "wheel" }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pointString(points, start, progress = 1) {
  const scale = start.routeScale || 1;
  const absolutePoints = points.map(([dx, dy]) => ({ x: start.x + dx * scale, y: start.y + dy * scale }));
  return trimPolyline(absolutePoints, progress).map((point) => `${point.x},${point.y}`).join(" ");
}

function presetRoutePoints(player) {
  const inside = player.y < FIELD.height / 2 ? 1 : -1;
  const outside = -inside;
  const routes = {
    go: [[0, 0], [280, 0]],
    slant: [[0, 0], [70, 0], [220, inside * 92]],
    out: [[0, 0], [120, 0], [120, outside * 92], [212, outside * 92]],
    wheel: [[0, 0], [46, outside * 44], [128, outside * 96], [270, outside * 96]],
    read: [[0, 0], [82, 0], [150, inside * 42], [230, inside * 42]],
    curl: [[0, 0], [178, 0], [138, inside * 34]],
    zone: [[0, 0], [66, 38], [132, 0]],
    spy: [[0, 0], [84, 0], [126, -36], [162, 0]],
    deep: [[0, 0], [142, 0], [250, -42]]
  };
  return routes[player.route] || null;
}

function presetRouteToCustomPoints(player, routeKey) {
  const routePlayer = { ...player, route: routeKey, routeScale: 1 };
  const points = presetRoutePoints(routePlayer);
  if (!points) return [];
  return points.slice(1).map(([dx, dy]) => ({
    x: Math.round(player.x + dx),
    y: Math.round(player.y + dy)
  }));
}

function routeLabel(player) {
  if (!player) return "无路线";
  if (player.side === "defense") return player.customRoute?.length ? "移动路线" : "无移动";
  if (player.route && routeShapes[player.route]) return player.route.toUpperCase();
  if (player.customRoute?.length) return "CUSTOM";
  return "无路线";
}

function customPointString(player, progress = 1) {
  const points = [{ x: player.x, y: player.y }, ...(player.customRoute || [])];
  return trimPolyline(points, progress).map((point) => `${point.x},${point.y}`).join(" ");
}

function compactRoutePoints(points, maxPoints = 6) {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (maxPoints - 1));
    return points[sourceIndex];
  });
}

function sameRoster(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function routePointsForPlayer(player) {
  if (player.customRoute?.length) {
    return [{ x: player.x, y: player.y }, ...player.customRoute];
  }
  if (player.side === "defense") return null;
  const route = presetRoutePoints(player);
  if (!route) return null;
  const scale = player.routeScale || 1;
  return route.map(([dx, dy]) => ({ x: player.x + dx * scale, y: player.y + dy * scale }));
}

function trimPolyline(points, progress = 1) {
  if (!points?.length) return [];
  if (points.length === 1) return points;
  const clampedProgress = clamp(progress, 0, 1);
  if (clampedProgress >= 1) return points;
  if (clampedProgress <= 0) return [points[0], points[0]];
  const segments = points.slice(1).map((point, index) => ({
    from: points[index],
    to: point,
    length: Math.hypot(point.x - points[index].x, point.y - points[index].y)
  }));
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!totalLength) return [points[0], points[0]];
  let remaining = totalLength * clampedProgress;
  const visible = [points[0]];
  for (const segment of segments) {
    if (remaining >= segment.length) {
      visible.push(segment.to);
      remaining -= segment.length;
      continue;
    }
    const ratio = segment.length ? remaining / segment.length : 0;
    visible.push({
      x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
      y: segment.from.y + (segment.to.y - segment.from.y) * ratio
    });
    break;
  }
  return visible.length > 1 ? visible : [points[0], points[0]];
}

function interpolatePolyline(points, progress = 0) {
  if (!points?.length) return null;
  if (points.length === 1) return points[0];
  const trimmed = trimPolyline(points, progress);
  return trimmed[trimmed.length - 1];
}

function routeEnd(player, progress) {
  return interpolatePolyline(routePointsForPlayer(player), progress) || { x: player.x, y: player.y };
}

function demoStateFromProgress(progress) {
  const clampedProgress = clamp(progress, 0, 1);
  const phase = demoPhases.reduce((current, item) => (
    clampedProgress >= item.progress ? item : current
  ), demoPhases[0]);
  return {
    phase,
    elapsed: clampedProgress * DEMO_DURATION,
    routeDrawProgress: 1,
    playerMoveProgress: clamp((clampedProgress - MOVEMENT_DELAY_PORTION) / (1 - MOVEMENT_DELAY_PORTION), 0, 1)
  };
}

function FieldCanvas({
  players,
  selectedId,
  setSelectedId,
  activeLayers,
  demoState,
  isDemoActive,
  tool,
  onSetCustomRoute,
  onMoveRoutePoint,
  onMovePlayer,
  onStartDrag,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPresetRoute,
  onAdjustRouteScale,
  onClearRoute,
  onUndoRoutePoint
}) {
  const selected = players.find((p) => p.id === selectedId);
  const selectedHasRoute = Boolean(selected?.customRoute?.length) || (selected?.side === "offense" && Boolean(routeShapes[selected.route]));
  const selectedCanUndoRoute = Boolean(selected?.customRoute?.length);
  const selectedCanScaleRoute = selected?.side === "offense" && Boolean(selected.customRoute?.length);
  const svgRef = useRef(null);
  const actionRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);

  function getSvgPoint(event) {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return {
      x: clamp(point.x, 42, FIELD.width - 42),
      y: clamp(point.y, 42, FIELD.height - 42)
    };
  }

  function finishAction() {
    const action = actionRef.current;
    if (action?.type === "drawRoute" && action.points.length) {
      onSetCustomRoute(action.playerId, compactRoutePoints(action.points));
    }
    actionRef.current = null;
    setActiveDrag(null);
    setRoutePreview(null);
    window.removeEventListener("pointerup", finishAction);
    window.removeEventListener("pointercancel", finishAction);
  }

  function beginWindowAction() {
    window.addEventListener("pointerup", finishAction, { once: true });
    window.addEventListener("pointercancel", finishAction, { once: true });
  }

  function handlePlayerPointerDown(event, player) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(player.id);
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    if (tool === "route") {
      actionRef.current = { type: "drawRoute", playerId: player.id, start: { x: player.x, y: player.y }, points: [] };
      setActiveDrag({ type: "drawRoute", playerId: player.id });
      setRoutePreview(null);
      onStartDrag();
      beginWindowAction();
      return;
    }
    if (tool !== "move") return;
    actionRef.current = {
      type: "movePlayer",
      playerId: player.id,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false
    };
    setActiveDrag({ type: "movePlayer", playerId: player.id });
    beginWindowAction();
  }

  function handleRoutePointPointerDown(event, playerId, pointIndex) {
    event.preventDefault();
    event.stopPropagation();
    if (tool !== "route") return;
    setSelectedId(playerId);
    actionRef.current = { type: "moveRoutePoint", playerId, pointIndex };
    setActiveDrag({ type: "moveRoutePoint", playerId, pointIndex });
    onStartDrag();
    beginWindowAction();
  }

  function handlePointerMove(event) {
    const action = actionRef.current;
    if (!action) return;
    const point = getSvgPoint(event);
    if (!point) return;
    if (action.type === "drawRoute") {
      const nextPoint = { x: Math.round(point.x), y: Math.round(point.y) };
      const lastPoint = action.points[action.points.length - 1];
      if (!lastPoint || Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) >= 18) {
        action.points = [...action.points, nextPoint];
        setRoutePreview({ playerId: action.playerId, start: action.start, points: action.points });
      }
      return;
    }
    if (action.type === "moveRoutePoint") {
      onMoveRoutePoint(action.playerId, action.pointIndex, point);
      return;
    }
    if (action.type === "movePlayer") {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      if (!action.moved) {
        const distance = Math.hypot(event.clientX - action.clientX, event.clientY - action.clientY);
      if (distance < 5) return;
        action.moved = true;
      onStartDrag();
      }
      onMovePlayer(action.playerId, point);
    }
  }

  return (
    <section className="fieldShell">
      <div className="fieldHeader">
        <div>
          <h1>战术 Flow</h1>
          <p>先摆球员，再点路线，最后播放讲解。</p>
        </div>
        <div className="modeBadge">
          <Trophy size={17} />
          5v5 腰旗
        </div>
      </div>
      <div className="workflowHint">
        <span className={tool === "move" || tool === "zone" ? "active" : ""}>1 摆阵</span>
        <span className={tool === "route" ? "active" : ""}>2 画路线</span>
        <span className={tool === "motion" ? "active" : ""}>3 演示</span>
      </div>
      <div className="routeQuickBar">
        <div className="routeQuickMeta">
          <Route size={17} />
          <span>{selected?.side === "offense" ? `给 ${selected.label} 添加路线` : selected?.side === "defense" ? `给 ${selected.label} 画移动` : "先选中球员"}</span>
        </div>
        <div className="routeQuickContent">
          <div className="routeQuickButtons">
            {[
              ["Go", "直跑"],
              ["Slant", "斜切"],
              ["Out", "外切"],
              ["Wheel", "绕跑"],
              ["Read", "阅读"],
              ["Curl", "回切"]
            ].map(([route, label]) => (
              <button key={route} onClick={() => onPresetRoute(route)} disabled={selected?.side !== "offense"}>
                <strong>{label}</strong>
                <small>{route}</small>
              </button>
            ))}
          </div>
          <div className="routeQuickTools">
            <button onClick={() => onAdjustRouteScale(-0.1)} disabled={!selectedCanScaleRoute}>缩短</button>
            <strong>{selectedCanScaleRoute ? `${Math.round((selected.routeScale || 1) * 100)}%` : "长度"}</strong>
            <button onClick={() => onAdjustRouteScale(0.1)} disabled={!selectedCanScaleRoute}>加长</button>
            <button onClick={onUndoRoutePoint} disabled={!selectedCanUndoRoute}>撤回</button>
            <button onClick={onClearRoute} disabled={!selectedHasRoute}>清除</button>
          </div>
        </div>
      </div>
      <div className="canvasFrame">
        <svg
          ref={svgRef}
          className={activeDrag ? "field dragging" : "field"}
          viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
          role="img"
          aria-label="橄榄球战术画布"
          onPointerMove={handlePointerMove}
          onPointerUp={finishAction}
          onPointerCancel={finishAction}
        >
          <defs>
            <linearGradient id="grass" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#214d38" />
              <stop offset="0.52" stopColor="#286347" />
              <stop offset="1" stopColor="#173c32" />
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#06140f" floodOpacity="0.28" />
            </filter>
          </defs>
          <rect width={FIELD.width} height={FIELD.height} rx="22" fill="url(#grass)" />
          {Array.from({ length: 13 }).map((_, i) => (
            <g key={i}>
              <rect x={i * 100} y="0" width="50" height={FIELD.height} fill={i % 2 ? "#ffffff08" : "#00000008"} />
              <line x1={i * 100} x2={i * 100} y1="34" y2={FIELD.height - 34} stroke="#ffffff42" strokeWidth="3" />
            </g>
          ))}
          {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((yard, i) => (
            <text key={`${yard}-${i}`} x={165 + i * 100} y="78" className="yardText">
              {yard}
            </text>
          ))}
          <line x1="250" x2="250" y1="34" y2={FIELD.height - 34} stroke="#f6c15b" strokeWidth="5" strokeDasharray="14 12" />
          <line x1="394" x2="394" y1="34" y2={FIELD.height - 34} stroke="#7ad7ff" strokeWidth="4" strokeDasharray="8 12" opacity="0.85" />
          <text x="264" y="578" className="fieldLabel">LOS</text>
          <text x="408" y="578" className="fieldLabel">FIRST READ</text>

          {activeLayers.defense && (
            <g className="coverageLayer">
              {players.filter((player) => player.side === "defense").map((player) => {
                const moved = isDemoActive ? routeEnd(player, demoState.playerMoveProgress) : player;
                return (
                <circle
                  key={`${player.id}-zone`}
                  data-zone-id={player.id}
                  cx={moved.x}
                  cy={moved.y}
                  r={player.zoneRadius || 112}
                  fill="#7ad7ff16"
                  stroke={selectedId === player.id ? "#b8f1ff" : "#7ad7ff66"}
                  strokeWidth={selectedId === player.id ? 4 : 3}
                  strokeDasharray="12 10"
                />
                );
              })}
            </g>
          )}

          {activeLayers.routes && players.map((player) => {
            const route = presetRoutePoints(player);
            if (player.side === "defense" && !player.customRoute?.length) return null;
            if (player.side === "offense" && !player.customRoute?.length && !route) return null;
            const routeProgress = isDemoActive ? demoState.routeDrawProgress : 1;
            const isDemoRoute = isDemoActive && routeProgress < 1;
            const points = player.customRoute?.length ? customPointString(player, routeProgress) : pointString(route, player, routeProgress);
            return (
              <polyline
                key={`${player.id}-route`}
                data-route-id={player.id}
                className={isDemoRoute || selectedId === player.id ? "routeLine isDemoActive" : "routeLine"}
                points={points}
                fill="none"
                stroke={player.color}
                strokeWidth={player.side === "defense" ? 4 : 6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={player.side === "defense" ? "12 10" : undefined}
              />
            );
          })}

          {activeLayers.routes && routePreview && (
            <polyline
              data-route-preview-id={routePreview.playerId}
              points={[routePreview.start, ...routePreview.points].map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#ffe39a"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="12 10"
            />
          )}

          {activeLayers.routes && !isDemoActive && players.map((player) => {
            if (!player.customRoute?.length) return null;
            return player.customRoute.map((point, index) => (
              <circle
                key={`${player.id}-point-${index}`}
                className="routePoint"
                data-route-point-id={player.id}
                data-route-point-index={index}
                cx={point.x}
                cy={point.y}
                r="9"
                fill={player.side === "defense" ? "#7ad7ff" : "#f6c15b"}
                stroke={selectedId === player.id ? "#fff5cf" : "#251d0b"}
                strokeWidth="3"
                onPointerDown={(event) => handleRoutePointPointerDown(event, player.id, index)}
              />
            ));
          })}

          {activeLayers.timing && (
            <g>
              {demoPhases.slice(0, 3).map((phase) => (
                <circle
                  key={phase.key}
                  cx={178 + phase.progress * 430}
                  cy="310"
                  r={demoState.phase.key === phase.key ? 18 : 11}
                  fill="none"
                  stroke={demoState.phase.key === phase.key ? "#f6c15b" : "#ffffff88"}
                  strokeWidth="3"
                />
              ))}
              <path d="M178 310 C278 244 374 246 508 310" fill="none" stroke="#ffffff80" strokeWidth="3" strokeDasharray="4 12" />
            </g>
          )}

          {players.map((player) => {
            const moved = isDemoActive ? routeEnd(player, demoState.playerMoveProgress) : player;
            const isSelected = selectedId === player.id;
            const isDemoFocus = isDemoActive && demoState.playerMoveProgress > 0 && Boolean(routePointsForPlayer(player));
            return (
              <g
                key={player.id}
                className={[
                  "playerNode",
                  activeDrag?.playerId === player.id ? "isDragging" : "",
                  isDemoFocus ? "isDemoFocus" : ""
                ].filter(Boolean).join(" ")}
                data-player-id={player.id}
                transform={`translate(${moved.x} ${moved.y})`}
                onPointerDown={(event) => handlePlayerPointerDown(event, player)}
                onPointerUp={finishAction}
                onPointerCancel={finishAction}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(player.id);
                }}
              >
                <circle r={isSelected ? 25 : 21} fill={player.side === "offense" ? "#261b06" : "#061923"} stroke={player.color} strokeWidth={isSelected ? 5 : 3} filter="url(#softShadow)" />
                <text textAnchor="middle" dominantBaseline="central" className="playerText">{player.label}</text>
              </g>
            );
          })}

          {activeLayers.notes && (
            <g className="callout">
              <rect x="748" y="56" width="344" height="118" rx="18" fill="#07120fcc" stroke="#ffffff24" />
              <text x="776" y="94">口令：雷电 28，右 Trips，Z Go</text>
              <text x="776" y="128">读秒：0.0 开球 / 1.6 Mesh / 2.4 释放</text>
              <text x="776" y="160">风险：弱侧 Flat 被蹲守时切 Hot</text>
            </g>
          )}
          {tool === "route" && selected && (
            <g className="drawHint">
              <rect x="44" y="44" width="470" height="48" rx="16" />
              <text x="66" y="75">{selected.side === "defense" ? "防守移动" : "路线绘制"}：从 {selected.label} 拖拽画线，拖动节点微调</text>
            </g>
          )}
        </svg>
      </div>
      <div className="selectionBar">
        <div className="selectionMeta">
          <CircleDot size={18} />
          <span>{selected ? `${selected.label} · ${selected.name} · ${routeLabel(selected)}` : "选择球员编辑路线"}</span>
        </div>
        <div className="boardQuickActions">
          <button className="iconTextButton" onClick={onUndo} disabled={!canUndo} title="撤回上一步">
            <Undo2 size={17} />撤回
          </button>
          <button className="iconTextButton" onClick={onRedo} disabled={!canRedo} title="还原上一步">
            <Redo2 size={17} />还原
          </button>
          <button className="ghostButton" onClick={onSave}><Save size={17} />保存战术</button>
        </div>
      </div>
      <div className="phaseStrip">
        {demoPhases.map((phase) => (
          <article key={phase.key} className={demoState.phase.key === phase.key ? "active" : ""}>
            <strong>{phase.key === "review" ? "复盘" : phase.time.toFixed(1)}</strong>
            <span>{phase.label}</span>
            <p>{phase.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoControl({ progress, playing, setProgress, setPlaying, demoState, onActivateDemo }) {
  function jumpToPhase(phaseProgress) {
    onActivateDemo();
    setPlaying(false);
    setProgress(phaseProgress);
  }

  return (
    <>
      <div className="demoStatus">
        <div>
          <span>{demoState.phase.key === "review" ? "复盘" : `${demoState.phase.time.toFixed(1)}s`}</span>
          <strong>{demoState.phase.label}</strong>
        </div>
        <p>{demoState.phase.body}</p>
        <small>{demoState.elapsed.toFixed(1)}s / {DEMO_DURATION.toFixed(1)}s</small>
      </div>
      <div className="playback">
        <button
          className="playDemoButton"
          onClick={() => {
            onActivateDemo();
            if (!playing && progress >= 1) setProgress(0);
            setPlaying((current) => !current);
          }}
        >
          {playing ? <Pause size={22} /> : <Play size={22} />}
          <span>{playing ? "暂停" : "开始演示"}</span>
        </button>
        <div className="timelineControl">
          <input
            aria-label="演示进度"
            type="range"
            min="0"
            max="100"
            value={Math.round(progress * 100)}
            onChange={(event) => {
              onActivateDemo();
              setPlaying(false);
              setProgress(Number(event.target.value) / 100);
            }}
          />
          <div className="timelineTicks">
            {demoPhases.map((phase) => (
              <button
                key={phase.key}
                type="button"
                className={demoState.phase.key === phase.key ? "active" : ""}
                style={{ left: `${phase.progress * 100}%` }}
                onClick={() => jumpToPhase(phase.progress)}
                title={phase.label}
              >
                <span />
                <em>{phase.key === "review" ? "复盘" : phase.time.toFixed(1)}</em>
              </button>
            ))}
          </div>
        </div>
        <button className="iconButton" onClick={() => { setProgress(0); setPlaying(false); }} title="重置">
          <TimerReset size={18} />
        </button>
      </div>
      <div className="phaseButtons" aria-label="演示阶段">
        {demoPhases.map((phase) => (
          <button
            key={phase.key}
            className={demoState.phase.key === phase.key ? "active" : ""}
            onClick={() => jumpToPhase(phase.progress)}
          >
            <strong>{phase.key === "review" ? "复盘" : phase.time.toFixed(1)}</strong>
            <span>{phase.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function App() {
  const [roster, setRoster] = useState(basePlayers);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [tool, setTool] = useState("move");
  const [selectedId, setSelectedId] = useState("wr1");
  const [newOffenseRole, setNewOffenseRole] = useState("wr");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activePlay, setActivePlay] = useState(0);
  const [savedAt, setSavedAt] = useState("");
  const [activeLayers, setActiveLayers] = useState({ routes: true, defense: true, timing: true, notes: true });

  const players = useMemo(() => roster, [roster]);
  const selectedPlayer = players.find((player) => player.id === selectedId);
  const demoState = demoStateFromProgress(progress);
  const isDemoActive = tool === "motion" && (playing || progress > 0);

  function rememberRoster(snapshot = roster) {
    setHistory((current) => {
      const lastSnapshot = current.past[current.past.length - 1];
      if (lastSnapshot && sameRoster(lastSnapshot, snapshot)) return current;
      return { past: [...current.past.slice(-39), snapshot], future: [] };
    });
  }

  function updateRoster(updater, options = {}) {
    if (options.remember !== false) {
      rememberRoster();
    }
    setRoster(updater);
  }

  function undoBoardEdit() {
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    setHistory({
      past: history.past.slice(0, -1),
      future: [roster, ...history.future.slice(0, 39)]
    });
    setRoster(previous);
    setProgress(0);
    setPlaying(false);
  }

  function redoBoardEdit() {
    const next = history.future[0];
    if (!next) return;
    setHistory({
      past: [...history.past.slice(-39), roster],
      future: history.future.slice(1)
    });
    setRoster(next);
    setProgress(0);
    setPlaying(false);
  }

  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(1, value + 0.012);
        if (next >= 1) {
          window.setTimeout(() => setPlaying(false), 0);
        }
        return next;
      });
    }, 42);
    return () => window.clearInterval(timer);
  }, [playing]);

  function selectTool(nextTool) {
    setTool(nextTool);
    if (nextTool !== "motion") {
      setPlaying(false);
      setProgress(0);
    }
  }

  function activateDemo() {
    setTool("motion");
  }

  function toggleLayer(key) {
    setActiveLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateSelectedRoute(route) {
    const routeKey = route.toLowerCase();
    updateRoster((current) => current.map((player) => {
      if (player.id !== selectedId || player.side !== "offense") return player;
      const customRoute = presetRouteToCustomPoints(player, routeKey);
      return customRoute.length
        ? { ...player, route: routeKey, routeScale: 1, customRoute }
        : player;
    }));
    setProgress(0);
  }

  function setCustomRoute(playerId, points) {
    updateRoster((current) => current.map((player) => {
      if (player.id !== playerId) return player;
      const customRoute = points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })).slice(0, 6);
      if (player.side === "defense") {
        return customRoute.length
          ? { ...player, customRoute }
          : { ...player, customRoute: undefined };
      }
      return customRoute.length
        ? { ...player, route: "custom", routeScale: 1, customRoute }
        : { ...player, route: null, routeScale: undefined, customRoute: undefined };
    }), { remember: false });
    setProgress(0);
  }

  function moveRoutePoint(playerId, pointIndex, point) {
    updateRoster((current) => current.map((player) => {
      if (player.id !== playerId || !player.customRoute?.[pointIndex]) return player;
      const customRoute = player.customRoute.map((routePoint, index) => (
        index === pointIndex ? { x: Math.round(point.x), y: Math.round(point.y) } : routePoint
      ));
      if (player.side === "defense") return { ...player, customRoute };
      return { ...player, route: player.route || "custom", routeScale: player.routeScale || 1, customRoute };
    }), { remember: false });
    setProgress(0);
  }

  function clearSelectedRoute() {
    updateRoster((current) => current.map((player) => (
      player.id === selectedId
        ? player.side === "offense"
          ? { ...player, route: null, routeScale: undefined, customRoute: undefined }
          : { ...player, customRoute: undefined }
        : player
    )));
    setProgress(0);
  }

  function undoSelectedRoutePoint() {
    updateRoster((current) => current.map((player) => {
      if (player.id !== selectedId || !player.customRoute?.length) return player;
      const customRoute = player.customRoute.slice(0, -1);
      if (player.side === "defense") {
        return customRoute.length ? { ...player, customRoute } : { ...player, customRoute: undefined };
      }
      return customRoute.length
        ? { ...player, route: player.route || "custom", routeScale: player.routeScale || 1, customRoute }
        : { ...player, route: null, routeScale: undefined, customRoute: undefined };
    }));
    setProgress(0);
  }

  function updateSelectedRouteScale(value) {
    const nextScale = Number(value) / 100;
    updateRoster((current) => current.map((player) => {
      if (player.id !== selectedId || player.side !== "offense" || !player.customRoute?.length) return player;
      const currentScale = player.routeScale || 1;
      const factor = nextScale / currentScale;
      const customRoute = player.customRoute.map((point) => ({
        x: Math.round(player.x + (point.x - player.x) * factor),
        y: Math.round(player.y + (point.y - player.y) * factor)
      }));
      return { ...player, routeScale: nextScale, customRoute };
    }));
    setProgress(0);
  }

  function adjustSelectedRouteScale(delta) {
    updateRoster((current) => current.map((player) => {
      if (player.id !== selectedId || player.side !== "offense" || !player.customRoute?.length) return player;
      const currentScale = player.routeScale || 1;
      const routeScale = clamp(Math.round((currentScale + delta) * 100) / 100, 0.6, 1.6);
      const factor = routeScale / currentScale;
      const customRoute = player.customRoute.map((point) => ({
        x: Math.round(player.x + (point.x - player.x) * factor),
        y: Math.round(player.y + (point.y - player.y) * factor)
      }));
      return { ...player, routeScale, customRoute };
    }));
    setProgress(0);
  }

  function updateSelectedZoneRadius(value) {
    updateRoster((current) => current.map((player) => (
      player.id === selectedId && player.side === "defense"
        ? { ...player, zoneRadius: Number(value) }
        : player
    )));
  }

  function updateSelectedRole(roleKey) {
    const role = offenseRoles.find((item) => item.key === roleKey);
    if (!role || selectedPlayer?.side !== "offense") return;
    updateRoster((current) => current.map((player) => (
      player.id === selectedId
        ? { ...player, role: role.key, label: role.label, name: role.name, route: null, routeScale: undefined, customRoute: undefined }
        : player
    )));
    setNewOffenseRole(role.key);
    setProgress(0);
  }

  function movePlayer(playerId, point) {
    updateRoster((current) => current.map((player) => {
      if (player.id !== playerId) return player;
      const next = { x: Math.round(point.x), y: Math.round(point.y) };
      const dx = next.x - player.x;
      const dy = next.y - player.y;
      const customRoute = player.customRoute?.map((routePoint) => ({
        x: routePoint.x + dx,
        y: routePoint.y + dy
      }));
      return { ...player, ...next, customRoute };
    }), { remember: false });
  }

  function beginPositionEdit() {
    rememberRoster();
    setPlaying(false);
    setProgress(0);
  }

  function addPlayer() {
    const isDefense = tool === "zone";
    const role = offenseRoles.find((item) => item.key === newOffenseRole) || offenseRoles[0];
    const id = `${isDefense ? "d" : "o"}-${Date.now()}`;
    const player = {
      id,
      side: isDefense ? "defense" : "offense",
      role: isDefense ? undefined : role.key,
      label: isDefense ? "DB" : role.label,
      name: isDefense ? "防守后卫" : role.name,
      x: isDefense ? 520 : 230,
      y: isDefense ? 230 + roster.length * 9 : 180 + roster.length * 8,
      route: isDefense ? "zone" : null,
      color: isDefense ? "#7ad7ff" : "#f6c15b"
    };
    updateRoster((current) => [...current, player]);
    setSelectedId(id);
  }

  function savePlay() {
    const payload = { gameType: "flag-5v5", roster, activeLayers, activePlay, savedAt: new Date().toISOString() };
    localStorage.setItem("flag-football-tactics-flow", JSON.stringify(payload));
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  }

  function choosePlay(index) {
    setActivePlay(index);
    setProgress(0);
    setPlaying(false);
  }

  const selectedHasRoute = Boolean(selectedPlayer?.customRoute?.length) || (selectedPlayer?.side === "offense" && Boolean(routeShapes[selectedPlayer.route]));
  const selectedCanUndoRoute = Boolean(selectedPlayer?.customRoute?.length);
  const selectedCanScaleRoute = selectedPlayer?.side === "offense" && Boolean(selectedPlayer.customRoute?.length);

  return (
    <main className="app">
      <aside className="leftRail">
        <div className="brandMark">
          <div className="mark">F</div>
          <div>
            <strong>战术 Flow</strong>
            <span>Coach Board</span>
          </div>
        </div>
        <nav className="toolStack">
          {[
            ["move", Move, "摆阵"],
            ["route", Route, "画路线"],
            ["zone", Shield, "防守"],
            ["motion", Zap, "演示"]
          ].map(([key, Icon, label]) => (
            <button key={key} className={tool === key ? "tool active" : "tool"} onClick={() => selectTool(key)} title={label}>
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="addButton" title="新增球员" onClick={addPlayer}>
          <Plus size={20} />
        </button>
      </aside>

      <section className="sidebar">
        <div className="panelTop">
          <h2>战术包</h2>
          <button><Sparkles size={16} />智能整理</button>
        </div>
        <div className="singleMode">
          <Flag size={15} />
          <span>只显示 5v5 腰旗战术</span>
        </div>
        <div className="formationCard">
          <span>当前阵型</span>
          <strong>5v5 Trips Right</strong>
          <p>进攻可按情况选择外接手、中锋、四分卫、跑卫，强调空间和 7 秒出手。</p>
        </div>
        <div className="playList">
          {playbook.map((play, index) => (
            <button key={play.title} className={index === activePlay ? "playCard active" : "playCard"} onClick={() => choosePlay(index)}>
              <span style={{ background: play.accent }} />
              <div>
                <strong>{play.title}</strong>
                <small>{play.tag} · {play.tempo} · {play.score}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <FieldCanvas
        players={players}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        activeLayers={activeLayers}
        demoState={demoState}
        isDemoActive={isDemoActive}
        tool={tool}
        onSetCustomRoute={setCustomRoute}
        onMoveRoutePoint={moveRoutePoint}
        onMovePlayer={movePlayer}
        onStartDrag={beginPositionEdit}
        onSave={savePlay}
        onUndo={undoBoardEdit}
        onRedo={redoBoardEdit}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onPresetRoute={updateSelectedRoute}
        onAdjustRouteScale={adjustSelectedRouteScale}
        onClearRoute={clearSelectedRoute}
        onUndoRoutePoint={undoSelectedRoutePoint}
      />

      <aside className="inspector">
        <div className="panelTop">
          <h2>当前操作</h2>
          <button onClick={savePlay}><Save size={16} />保存</button>
        </div>
        <div className="selectedCoachPanel">
          <span>当前球员</span>
          <strong>{selectedPlayer ? `${selectedPlayer.label} · ${selectedPlayer.name}` : "未选择"}</strong>
          <p>
            {selectedPlayer?.side === "offense"
              ? `路线：${routeLabel(selectedPlayer)}。点击战术板上方路线按钮即可添加或替换。`
              : selectedPlayer?.side === "defense"
                ? `移动：${routeLabel(selectedPlayer)}。切到“画路线”后从防守球员拖拽即可设置移动。`
                : "点击场上球员开始编辑。"}
          </p>
        </div>
        {selectedPlayer?.side === "offense" && (
          <div className="rolePanel compactPanel">
            <h3><Users size={17} />角色</h3>
            <div className="roleGrid">
              {offenseRoles.map((role) => (
                <button
                  key={role.key}
                  className={selectedPlayer.role === role.key ? "selectedRole" : ""}
                  onClick={() => updateSelectedRole(role.key)}
                >
                  <strong>{role.label}</strong>
                  <span>{role.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedPlayer?.side === "defense" && (
          <div className="zonePanel">
            <h3><Shield size={17} />防守范围</h3>
            <div className="rangeValue">
              <span>{selectedPlayer.label} 覆盖半径</span>
              <strong>{selectedPlayer.zoneRadius || 112}</strong>
            </div>
            <input
              aria-label="防守范围半径"
              type="range"
              min="64"
              max="220"
              value={selectedPlayer.zoneRadius || 112}
              onChange={(event) => updateSelectedZoneRadius(event.target.value)}
            />
          </div>
        )}
        <DemoControl
          progress={progress}
          playing={playing}
          setProgress={setProgress}
          setPlaying={setPlaying}
          demoState={demoState}
          onActivateDemo={activateDemo}
        />
        <details className="advancedPanel">
          <summary>高级设置</summary>
          <div className="layerPanel">
          <h3><Layers3 size={17} />图层</h3>
          {layers.map(({ key, label, icon: Icon }) => (
            <label key={key} className="layerRow">
              <span><Icon size={16} />{label}</span>
              <input type="checkbox" checked={activeLayers[key]} onChange={() => toggleLayer(key)} />
            </label>
          ))}
          </div>
          <div className="rolePanel">
          <h3><Users size={17} />进攻角色</h3>
          <p>{selectedPlayer?.side === "offense" ? "选中进攻球员后切换角色。" : "请选择进攻球员来设置角色。"}</p>
          <div className="roleGrid">
            {offenseRoles.map((role) => (
              <button
                key={role.key}
                className={selectedPlayer?.side === "offense" && selectedPlayer.role === role.key ? "selectedRole" : ""}
                onClick={() => updateSelectedRole(role.key)}
                disabled={selectedPlayer?.side !== "offense"}
              >
                <strong>{role.label}</strong>
                <span>{role.name}</span>
              </button>
            ))}
          </div>
          </div>
          <div className="routePanel">
          <h3><Route size={17} />路线库</h3>
          {["Go", "Slant", "Out", "Wheel", "Read", "Curl"].map((route) => (
            <button key={route} onClick={() => updateSelectedRoute(route)} disabled={selectedPlayer?.side !== "offense"}>{route}<ArrowRight size={15} /></button>
          ))}
          <div className="routeScaleControl">
            <div className="rangeValue">
              <span>路线长度</span>
              <strong>{selectedCanScaleRoute ? `${Math.round((selectedPlayer.routeScale || 1) * 100)}%` : "未启用"}</strong>
            </div>
            <input
              aria-label="路线长度"
              type="range"
              min="60"
              max="160"
              value={selectedCanScaleRoute ? Math.round((selectedPlayer.routeScale || 1) * 100) : 100}
              onChange={(event) => updateSelectedRouteScale(event.target.value)}
              disabled={!selectedCanScaleRoute}
            />
            <div className="routeScaleButtons">
              <button onClick={() => adjustSelectedRouteScale(-0.1)} disabled={!selectedCanScaleRoute}>缩短</button>
              <button onClick={() => adjustSelectedRouteScale(0.1)} disabled={!selectedCanScaleRoute}>加长</button>
            </div>
          </div>
          <button className="wideAction" onClick={undoSelectedRoutePoint} disabled={!selectedCanUndoRoute}>撤回上一节点</button>
          <button className="wideAction" onClick={clearSelectedRoute} disabled={!selectedHasRoute}>去除当前路线</button>
          </div>
          <div className="zonePanel">
          <h3><Shield size={17} />防守范围</h3>
          {selectedPlayer?.side === "defense" ? (
            <>
              <div className="rangeValue">
                <span>{selectedPlayer.label} 覆盖半径</span>
                <strong>{selectedPlayer.zoneRadius || 112}</strong>
              </div>
              <input
                aria-label="防守范围半径"
                type="range"
                min="64"
                max="220"
                value={selectedPlayer.zoneRadius || 112}
                onChange={(event) => updateSelectedZoneRadius(event.target.value)}
              />
            </>
          ) : (
            <p>请选择防守球员来设置区域范围。</p>
          )}
          </div>
          <div className="coachNotes">
          <h3><Users size={17} />训练提示</h3>
          <p>{savedAt ? `已在 ${savedAt} 保存。` : "第一读强侧安全卫，若 Flat 提前下压，QB 保持肩线不转，S 位回切空窗。"}</p>
          </div>
        </details>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
