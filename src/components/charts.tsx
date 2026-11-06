// Small server-rendered SVG charts (no client JS). Values are plain numbers; labels are strings.

const BLUE = "#0b6ef5";
const LIGHT = "#9cc4fb";

export function BarChart({
  values,
  labels,
  highlightLast = true,
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  highlightLast?: boolean;
  ariaLabel: string;
}) {
  const W = 440;
  const H = 190;
  const base = 160;
  const max = Math.max(1, ...values);
  const slot = W / values.length;
  const bw = Math.min(34, slot * 0.6);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className="mt-3 block"
    >
      <line x1="0" y1={base} x2={W} y2={base} stroke="#e6e8ec" />
      {values.map((v, i) => {
        const h = Math.round((v / max) * 130);
        const x = i * slot + (slot - bw) / 2;
        const last = i === values.length - 1;
        return (
          <g key={labels[i]}>
            <rect
              x={x}
              y={base - h}
              width={bw}
              height={Math.max(h, v > 0 ? 2 : 0)}
              rx="5"
              fill={last && highlightLast ? BLUE : LIGHT}
            />
            <text
              x={x + bw / 2}
              y={base - h - 6}
              textAnchor="middle"
              fontSize="11"
              fill="#14171f"
            >
              {v > 0 ? v : ""}
            </text>
            <text
              x={x + bw / 2}
              y="180"
              textAnchor="middle"
              fontSize="11"
              fill="#5f6673"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface LineSeries {
  name: string;
  color: string;
  points: number[];
  width?: number;
}

export function LineChart({
  series,
  xLabels,
  ariaLabel,
}: {
  series: LineSeries[];
  xLabels: { index: number; text: string }[];
  ariaLabel: string;
}) {
  const W = 440;
  const H = 190;
  const top = 14;
  const base = 160;
  const all = series.flatMap((s) => s.points);
  const max = Math.max(1, ...all);
  const n = Math.max(...series.map((s) => s.points.length));
  const x = (i: number) => 8 + (i / Math.max(1, n - 1)) * (W - 16);
  const y = (v: number) => base - (v / max) * (base - top);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className="mt-3 block"
    >
      {[0.33, 0.66, 1].map((f) => (
        <line
          key={f}
          x1="0"
          y1={y(max * f)}
          x2={W}
          y2={y(max * f)}
          stroke="#eceef2"
        />
      ))}
      <line x1="0" y1={base} x2={W} y2={base} stroke="#e6e8ec" />
      {series.map((s) => (
        <polyline
          key={s.name}
          points={s.points
            .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {xLabels.map((l, k) => (
        <text
          key={l.text}
          x={x(l.index)}
          y="180"
          textAnchor={
            k === 0 ? "start" : k === xLabels.length - 1 ? "end" : "middle"
          }
          fontSize="11"
          fill="#5f6673"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

export function Legend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-[#5f6673]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <b
            className="inline-block size-2.5 rounded-[3px]"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const ZONE_COLORS = ["#cfe1fb", "#7db2f7", "#2f7de8", "#0a4aa8", "#072f6b"];

/** Horizontal bar of time in zones 1–5. Estimated (no-HR) zones are striped. */
export function ZoneBar({
  zones,
  estimated = false,
  className = "",
}: {
  zones: readonly number[] | null;
  estimated?: boolean;
  className?: string;
}) {
  const total = zones?.reduce((s, x) => s + x, 0) ?? 0;
  if (!zones || total === 0)
    return (
      <div
        className={`h-2.5 rounded-full bg-[#eceef2] ${className}`}
        role="img"
        aria-label="No zone data"
      />
    );
  const label = zones
    .map((s, i) =>
      s > 0 ? `zone ${i + 1} ${Math.round((s / total) * 100)}%` : null,
    )
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className={`flex h-2.5 overflow-hidden rounded-full ${className}`}
      role="img"
      aria-label={`${estimated ? "Estimated: " : ""}${label}`}
    >
      {zones.map((s, i) =>
        s > 0 ? (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: zones are a fixed 5-slot array
            key={i}
            style={{
              flexGrow: s,
              background: estimated
                ? `repeating-linear-gradient(45deg, ${ZONE_COLORS[i]}, ${ZONE_COLORS[i]} 4px, #e8f1fe 4px, #e8f1fe 8px)`
                : ZONE_COLORS[i],
            }}
          />
        ) : null,
      )}
    </div>
  );
}

export const ZONE_LEGEND = ZONE_COLORS.map((color, i) => ({
  color,
  label: `Z${i + 1}`,
}));
