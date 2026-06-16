import { useMemo, useRef, ReactElement } from "react";
import {
  FREQUENCIES,
  HearingRecord,
  Frequency,
  EarSide,
  ConductionType,
  THRESHOLD_MIN,
  THRESHOLD_MAX
} from "./hearing.types";

interface Props {
  record: HearingRecord;
  width?: number;
}

const PAD = { top: 40, right: 36, bottom: 56, left: 64 };
const Y_MIN = -10;
const Y_MAX = 130;
const Y_STEP = 10;
const NORMAL_TOP = -10;
const NORMAL_BOTTOM = 25;

const COLOR = {
  left: "#2563eb",
  right: "#dc2626",
  grid: "#cbd5e1",
  gridStrong: "#94a3b8",
  areaNormal: "rgba(34, 197, 94, 0.08)",
  areaBorderNormal: "rgba(34, 197, 94, 0.4)",
  invalid: "#f59e0b"
};

export default function AudiogramChart({ record, width = 720 }: Props) {
  const height = Math.max(420, Math.round(width * 0.62));
  const viewW = width;
  const viewH = height;
  const plotW = viewW - PAD.left - PAD.right;
  const plotH = viewH - PAD.top - PAD.bottom;

  const yToPx = (val: number) =>
    PAD.top + ((val - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

  const xToPx = (idx: number) =>
    PAD.left + (idx / (FREQUENCIES.length - 1)) * plotW;

  const yTicks = useMemo(() => {
    const arr: number[] = [];
    for (let v = Y_MIN; v <= Y_MAX; v += Y_STEP) arr.push(v);
    return arr;
  }, []);

  const normalRectY = yToPx(NORMAL_BOTTOM);
  const normalRectH = yToPx(NORMAL_TOP) - yToPx(NORMAL_BOTTOM);

  const wrapRef = useRef<HTMLDivElement>(null);

  const drawSeries = (
    side: EarSide,
    cond: ConductionType
  ): {
    line: ReactElement | null;
    symbols: ReactElement[];
  } => {
    const points = record[side][cond];
    const validPoints = points
      .map((p, i) => ({ ...p, idx: i }))
      .filter(p => p.value !== null && p.valid);

    if (validPoints.length === 0) return { line: null, symbols: [] };

    let pathD = "";
    const segments: { d: string; dashed: boolean }[] = [];
    for (let i = 0; i < validPoints.length - 1; i++) {
      const a = validPoints[i];
      const b = validPoints[i + 1];
      const x1 = xToPx(a.idx);
      const y1 = yToPx(a.value as number);
      const x2 = xToPx(b.idx);
      const y2 = yToPx(b.value as number);
      const dashed = b.idx - a.idx > 1;
      segments.push({
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        dashed
      });
    }
    pathD = segments.map(s => s.d).join(" ");

    const color = COLOR[side];
    const lineEl = (
      <g key={`line-${side}-${cond}`}>
        {segments.map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke={color}
            strokeWidth={cond === "air" ? 2.2 : 1.8}
            fill="none"
            strokeDasharray={s.dashed ? "6 4" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={cond === "bone" ? 0.85 : 1}
          />
        ))}
      </g>
    );

    const symbols: ReactElement[] = validPoints.map(p => {
      const cx = xToPx(p.idx);
      const cy = yToPx(p.value as number);
      const size = cond === "air" ? 9 : 8;
      const key = `sym-${side}-${cond}-${p.frequency}`;
      if (side === "left" && cond === "air") {
        return (
          <g key={key}>
            <line
              x1={cx - size}
              y1={cy - size}
              x2={cx + size}
              y2={cy + size}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={cx - size}
              y1={cy + size}
              x2={cx + size}
              y2={cy - size}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      }
      if (side === "right" && cond === "air") {
        return (
          <circle
            key={key}
            cx={cx}
            cy={cy}
            r={size}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        );
      }
      if (side === "left" && cond === "bone") {
        return (
          <g key={key}>
            <line
              x1={cx - size * 0.6}
              y1={cy - size * 0.8}
              x2={cx - size * 0.6}
              y2={cy + size * 0.8}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={cx - size * 0.6}
              y1={cy - size * 0.8}
              x2={cx + size * 0.2}
              y2={cy - size * 0.4}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={cx - size * 0.6}
              y1={cy + size * 0.8}
              x2={cx + size * 0.2}
              y2={cy + size * 0.4}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      }
      return (
        <g key={key}>
          <line
            x1={cx + size * 0.6}
            y1={cy - size * 0.8}
            x2={cx + size * 0.6}
            y2={cy + size * 0.8}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={cx + size * 0.6}
            y1={cy - size * 0.8}
            x2={cx - size * 0.2}
            y2={cy - size * 0.4}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={cx + size * 0.6}
            y1={cy + size * 0.8}
            x2={cx - size * 0.2}
            y2={cy + size * 0.4}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );
    });

    return { line: lineEl, symbols };
  };

  const leftAir = drawSeries("left", "air");
  const leftBone = drawSeries("left", "bone");
  const rightAir = drawSeries("right", "air");
  const rightBone = drawSeries("right", "bone");

  const invalidMarks: ReactElement[] = [];
  (["left", "right"] as EarSide[]).forEach(side => {
    (["air", "bone"] as ConductionType[]).forEach(cond => {
      record[side][cond].forEach((p, i) => {
        if (!p.valid && p.value !== null) {
          const cx = xToPx(i);
          const cy = yToPx(
            Math.min(Y_MAX - 5, Math.max(Y_MIN + 10, p.value as number))
          );
          invalidMarks.push(
            <g key={`inv-${side}-${cond}-${p.frequency}`}>
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill="none"
                stroke={COLOR.invalid}
                strokeWidth={1.8}
                strokeDasharray="3 3"
              />
              <text
                x={cx}
                y={cy - 18}
                textAnchor="middle"
                fontSize={10}
                fill={COLOR.invalid}
                fontWeight={600}
              >
                ⚠
              </text>
            </g>
          );
        }
      });
    });
  });

  const xLabelFor = (f: Frequency) =>
    f >= 1000 ? `${f / 1000}k` : String(f);

  return (
    <div className="audiogram-wrap" ref={wrapRef}>
      <div className="audiogram-scroll">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          width="100%"
          style={{ minWidth: 640 }}
          className="audiogram-svg"
          role="img"
          aria-label="听力图"
        >
          <defs>
            <pattern
              id="audiogramNormalArea"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 0 8 L 8 0"
                stroke={COLOR.areaBorderNormal}
                strokeWidth="0.6"
              />
            </pattern>
          </defs>

          <rect
            x={PAD.left}
            y={normalRectY}
            width={plotW}
            height={normalRectH}
            fill={COLOR.areaNormal}
          />
          <rect
            x={PAD.left}
            y={normalRectY}
            width={plotW}
            height={normalRectH}
            fill="url(#audiogramNormalArea)"
            opacity={0.4}
          />

          {yTicks.map(v => {
            const y = yToPx(v);
            const strong = v % 20 === 0;
            return (
              <g key={`yt-${v}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + plotW}
                  y2={y}
                  stroke={strong ? COLOR.gridStrong : COLOR.grid}
                  strokeWidth={strong ? 0.9 : 0.5}
                  strokeDasharray={v === NORMAL_TOP ? undefined : "2 3"}
                />
                <text
                  x={PAD.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={v <= NORMAL_BOTTOM ? "#15803d" : "#475569"}
                  fontWeight={v <= NORMAL_BOTTOM ? 600 : 400}
                >
                  {v}
                </text>
              </g>
            );
          })}

          {FREQUENCIES.map((f, i) => {
            const x = xToPx(i);
            const strong = f === 1000;
            return (
              <g key={`xt-${f}`}>
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + plotH}
                  stroke={strong ? COLOR.gridStrong : COLOR.grid}
                  strokeWidth={strong ? 0.9 : 0.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={x}
                  y={PAD.top + plotH + 22}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={strong ? 700 : 500}
                  fill="#172033"
                >
                  {xLabelFor(f)}
                </text>
                <text
                  x={x}
                  y={PAD.top + plotH + 38}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="#64748b"
                >
                  Hz
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={PAD.top + plotH}
            stroke="#334155"
            strokeWidth={1.2}
          />
          <line
            x1={PAD.left}
            y1={PAD.top + plotH}
            x2={PAD.left + plotW}
            y2={PAD.top + plotH}
            stroke="#334155"
            strokeWidth={1.2}
          />

          <text
            x={PAD.left - 48}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            fontSize={12}
            fill="#334155"
            fontWeight={600}
            transform={`rotate(-90, ${PAD.left - 48}, ${PAD.top + plotH / 2})`}
          >
            听力级 (dB HL)
          </text>
          <text
            x={PAD.left + plotW / 2}
            y={viewH - 6}
            textAnchor="middle"
            fontSize={12}
            fill="#334155"
            fontWeight={600}
          >
            频率 (Hz)
          </text>

          <text
            x={PAD.left + plotW + 8}
            y={yToPx(NORMAL_BOTTOM) + 4}
            fontSize={10}
            fill="#15803d"
            fontWeight={600}
          >
            正常区
          </text>

          {leftBone.line}
          {rightBone.line}
          {leftAir.line}
          {rightAir.line}

          {leftBone.symbols}
          {rightBone.symbols}
          {leftAir.symbols}
          {rightAir.symbols}

          {invalidMarks}

          <g>
            <rect
              x={PAD.left + 8}
              y={PAD.top + 6}
              width={156}
              height={22}
              rx={4}
              fill="rgba(255,255,255,0.85)"
              stroke={COLOR.grid}
            />
            <text
              x={PAD.left + 18}
              y={PAD.top + 22}
              fontSize={11}
              fill="#172033"
              fontWeight={600}
            >
              基线: {THRESHOLD_MIN} ~ {THRESHOLD_MAX} dB HL
            </text>
          </g>
        </svg>
      </div>
      <div className="audiogram-tip" aria-hidden>
        提示：图表可横向滚动查看完整坐标
      </div>
    </div>
  );
}
