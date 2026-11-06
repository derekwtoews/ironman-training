import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Legend, ZONE_LEGEND, ZoneBar } from "@/components/charts";
import { Card, CardTitle, Stat } from "@/components/ui/card";
import { getDb } from "@/db";
import { type LapKind, paceSecPerKm } from "@/engine";
import {
  clock,
  dayLabel,
  km,
  pace,
  placeLabel,
  SPORT,
  timeOfDay,
} from "@/lib/format";
import { getAthlete } from "@/lib/queries/week";
import { type LapRow, workoutDetail } from "@/lib/queries/workouts";
import { cn } from "@/lib/utils";
import { CorrectionForm } from "../forms";

export default function WorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <Link href="/workouts" className="text-sm text-[#0b6ef5]">
        ← All workouts
      </Link>
      <Suspense
        fallback={
          <div className="text-sm text-[#5f6673]">Loading workout…</div>
        }
      >
        <Workout params={params} />
      </Suspense>
    </div>
  );
}

const KIND: Record<LapKind, { label: string; chip: string }> = {
  warmup: { label: "Warm-up", chip: "bg-[#eceef2] text-[#4b5260]" },
  work: { label: "Rep", chip: "bg-[#0b6ef5] text-white" },
  rest: { label: "Rest", chip: "bg-[#eceef2] text-[#4b5260]" },
  cooldown: { label: "Cool-down", chip: "bg-[#eceef2] text-[#4b5260]" },
  steady: { label: "Lap", chip: "bg-[#e8f1fe] text-[#0a4aa8]" },
  set: { label: "Set", chip: "bg-[#e8f1fe] text-[#0a4aa8]" },
  other: { label: "Short", chip: "bg-[#f5f6f8] text-[#5f6673]" },
};

function lapSpeed(discipline: string, l: LapRow): string {
  if (discipline === "run") return `${pace(paceSecPerKm(l.avgSpeedMmS))} /km`;
  if (discipline === "swim")
    return l.distanceM > 0
      ? `${pace((l.movingSeconds * 100) / l.distanceM)} /100 m`
      : "—";
  if (l.avgSpeedMmS) return `${((l.avgSpeedMmS * 3.6) / 1000).toFixed(1)} km/h`;
  return "—";
}

async function Workout({
  params,
}: {
  params: PageProps<"/workouts/[id]">["params"];
}) {
  await connection();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete) notFound();
  const w = await workoutDetail(db, athlete.id, id);
  if (!w) notFound();

  const zoneTotal = w.zones?.reduce((s, x) => s + x, 0) ?? 0;
  const avgSpeed =
    w.movingSeconds > 0 && w.distanceM > 0
      ? w.distanceM / w.recordedSeconds
      : null; // m/s from recorded time
  const speedLine =
    avgSpeed == null
      ? null
      : w.discipline === "run"
        ? `${pace(1000 / avgSpeed)} /km`
        : w.discipline === "swim"
          ? `${pace(100 / avgSpeed)} /100 m`
          : `${(avgSpeed * 3.6).toFixed(1)} km/h`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium",
            SPORT[w.discipline].chip,
          )}
        >
          {SPORT[w.discipline].label}
        </span>
        <h1 className="m-0 text-[28px] font-semibold sm:text-[32px]">
          {w.name}
        </h1>
      </div>
      <div className="-mt-3 flex flex-wrap gap-x-3 text-[15px] text-[#5f6673]">
        <span>
          {dayLabel(w.localDate)} · {timeOfDay(w.startUtc, athlete.timezone)}
        </span>
        {placeLabel(w.discipline, w.isTrainer) ? (
          <span>{placeLabel(w.discipline, w.isTrainer)}</span>
        ) : null}
        <a
          href={`https://www.strava.com/activities/${w.stravaId}`}
          target="_blank"
          rel="noreferrer"
          className="text-[#0b6ef5]"
        >
          Open in Strava ↗
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <Card className="p-5">
          <Stat
            label="Time"
            value={clock(w.movingSeconds)}
            note={
              w.corrected
                ? `Corrected from ${clock(w.recordedSeconds)}`
                : "Moving time"
            }
            noteClass={w.corrected ? "text-[#9a5b00]" : undefined}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Distance"
            value={
              w.distanceM > 0
                ? w.discipline === "swim"
                  ? `${w.distanceM.toLocaleString("en-CA")} m`
                  : km(w.distanceM)
                : "—"
            }
            note={speedLine ?? undefined}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Avg heart rate"
            value={w.avgHr ?? "—"}
            unit={w.avgHr ? "bpm" : undefined}
            note={
              w.avgWatts
                ? `Avg power ${w.avgWatts} W`
                : w.avgHr
                  ? undefined
                  : "Not recorded"
            }
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Load"
            value={w.excluded ? 0 : (w.load ?? "—")}
            note={
              w.excluded
                ? "Excluded from load"
                : w.estimated
                  ? "Estimated: easy swim counts as Z2"
                  : w.load == null
                    ? "No heart rate, so no load"
                    : "Zone minutes × 1–5"
            }
            noteClass={
              w.excluded || w.estimated || w.load == null
                ? "text-[#9a5b00]"
                : undefined
            }
          />
        </Card>
      </div>

      {w.reps ? (
        <Card aria-label="Reps">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>
              {w.reps.reps} rep{w.reps.reps === 1 ? "" : "s"}
            </CardTitle>
            {w.reps.fade != null ? (
              <span className="text-sm text-[#5f6673]">
                {w.discipline === "run"
                  ? `Rep 1 to rep ${w.reps.reps}: ${w.reps.fade > 0 ? `${w.reps.fade} s/km slower` : `${-w.reps.fade} s/km faster`}`
                  : `Rep 1 to rep ${w.reps.reps}: ${w.reps.fade >= 0 ? "+" : ""}${w.reps.fade} W`}
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
            {Array.from({ length: w.reps.reps }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: reps are positional
              <div key={i} className="rounded-2xl bg-[#f5f6f8] p-4">
                <div className="text-xs text-[#5f6673]">Rep {i + 1}</div>
                <div className="mt-1 text-2xl font-bold">
                  {w.discipline === "run"
                    ? pace(w.reps?.paceSecPerKm[i] ?? null)
                    : w.reps?.avgWatts[i] != null
                      ? `${w.reps.avgWatts[i]} W`
                      : "—"}
                </div>
                <div className="text-sm text-[#5f6673]">
                  {w.reps?.avgHr[i] != null
                    ? `${w.reps.avgHr[i]} bpm`
                    : "no HR"}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#5f6673]">
            Reps are found from your watch laps: the hard laps are reps, easy
            laps between them are rests.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card aria-label="Time in zones">
          <CardTitle>Time in heart-rate zones</CardTitle>
          {w.zones && zoneTotal > 0 ? (
            <>
              <ZoneBar
                zones={w.zones}
                estimated={w.estimated}
                className="mt-4 h-4"
              />
              <ul className="mt-4 divide-y divide-[#eceef2] text-sm">
                {w.zones.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5 zones
                  <li key={i} className="flex justify-between py-2">
                    <span>Zone {i + 1}</span>
                    <span className="text-[#5f6673]">
                      {clock(s)} · {Math.round((s / zoneTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              {w.estimated ? (
                <p className="mt-2 text-xs text-[#9a5b00]">
                  No heart rate in the pool, so all time is counted as Zone 2
                  (easy).
                </p>
              ) : null}
              {w.corrected ? (
                <p className="mt-2 text-xs text-[#5f6673]">
                  Zones show what Strava recorded; load uses your corrected
                  duration with the same zone mix.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-[#5f6673]">
              No heart-rate data for this workout.
            </p>
          )}
          <div className="mt-3">
            <Legend items={ZONE_LEGEND} />
          </div>
        </Card>

        <Card aria-label="Laps" className="px-4 sm:px-6">
          <CardTitle>Laps</CardTitle>
          {w.laps.length === 0 ? (
            <p className="mt-3 text-sm text-[#5f6673]">No laps recorded.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eceef2] text-xs text-[#5f6673]">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Lap</th>
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Distance</th>
                    <th className="py-2 pr-3 font-medium">
                      {w.discipline === "bike" ? "Speed" : "Pace"}
                    </th>
                    <th className="py-2 pr-3 font-medium">HR</th>
                    {w.discipline === "bike" ? (
                      <th className="py-2 font-medium">Power</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {w.laps.map((l) => (
                    <tr
                      key={l.lapIndex}
                      className={cn(
                        "border-b border-[#eceef2] last:border-0",
                        l.kind === "work" && "font-medium",
                      )}
                    >
                      <td className="py-2.5 pr-3 text-[#5f6673]">
                        {l.lapIndex + 1}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            KIND[l.kind].chip,
                          )}
                        >
                          {KIND[l.kind].label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {clock(l.movingSeconds || l.elapsedSeconds)}
                      </td>
                      <td className="py-2.5 pr-3">
                        {l.distanceM > 0
                          ? w.discipline === "swim"
                            ? `${l.distanceM} m`
                            : km(l.distanceM)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {l.distanceM > 0 ? lapSpeed(w.discipline, l) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">{l.avgHr ?? "—"}</td>
                      {w.discipline === "bike" ? (
                        <td className="py-2.5">
                          {l.avgWatts != null ? `${l.avgWatts} W` : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card aria-label="Correct this workout" className="max-w-[760px]">
        <CardTitle>Correct this workout</CardTitle>
        <p className="mt-1 text-sm text-[#5f6673]">
          Forgot to stop your watch, or it wasn't real training? Fix it here.
          Strava's data is never changed.
        </p>
        {w.note ? <p className="mt-2 text-sm">Note: {w.note}</p> : null}
        <div className="mt-4">
          <CorrectionForm
            id={w.id}
            minutes={w.corrected ? Math.round(w.movingSeconds / 60) : null}
            excluded={w.excluded}
            note={w.note}
            corrected={w.corrected}
          />
        </div>
      </Card>
    </>
  );
}
