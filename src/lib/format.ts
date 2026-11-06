import type { Discipline } from "@/engine";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parts = (d: string) =>
  d.split("-").map(Number) as [number, number, number];

/** "Nov 2" */
export function shortDate(d: string): string {
  const [, m, day] = parts(d);
  return `${MONTHS[m - 1]} ${day}`;
}

/** "Nov 2 – 8" or "Oct 26 – Nov 1" */
export function weekRange(start: string, end: string): string {
  const [, m1, d1] = parts(start);
  const [, m2, d2] = parts(end);
  return m1 === m2
    ? `${MONTHS[m1 - 1]} ${d1} – ${d2}`
    : `${shortDate(start)} – ${shortDate(end)}`;
}

/** "Thu, Nov 5" */
export function dayLabel(d: string): string {
  const [y, m, day] = parts(d);
  return `${DAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}, ${MONTHS[m - 1]} ${day}`;
}

/** 4.4 -> "4.4 h" */
export const hours = (seconds: number): string =>
  `${(seconds / 3600).toFixed(1)} h`;

/** 3861 -> "1:04:21", 1246 -> "20:46" */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export const km = (m: number): string =>
  `${(m / 1000).toFixed(m >= 10_000 ? 1 : 2)} km`;

export const SPORT: Record<Discipline, { label: string; chip: string }> = {
  swim: { label: "Swim", chip: "bg-[#e3f0fe] text-[#0a4aa8]" },
  bike: { label: "Bike", chip: "bg-[#fdf0d5] text-[#7a4a00]" },
  run: { label: "Run", chip: "bg-[#e6f4ea] text-[#166534]" },
  strength: { label: "Strength", chip: "bg-[#ece8fb] text-[#4c3bb0]" },
  row: { label: "Row", chip: "bg-[#fde8e4] text-[#9a2f1c]" },
  other: { label: "Other", chip: "bg-[#eceef2] text-[#4b5260]" },
};
