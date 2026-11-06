import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Legend, ZONE_LEGEND, ZoneBar } from "@/components/charts";
import { Card, CardTitle, Stat } from "@/components/ui/card";
import { getDb } from "@/db";
import {
  clock,
  dayLabel,
  hours,
  km,
  placeLabel,
  SPORT,
  shortDate,
} from "@/lib/format";
import { HISTORY_START } from "@/lib/history";
import { getAthlete, localToday } from "@/lib/queries/week";
import {
  listWorkouts,
  recentWeights,
  SPORT_FILTERS,
  type SportFilter,
  summary28,
} from "@/lib/queries/workouts";
import { cn } from "@/lib/utils";
import { WeightForm } from "./forms";

const PAGE_SIZE = 40;

export default function WorkoutsPage({ searchParams }: PageProps<"/workouts">) {
  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="m-0 text-[32px] font-semibold">Workouts</h1>
        <span className="text-[15px] text-[#5f6673]">
          From Strava since {shortDate(HISTORY_START)},{" "}
          {HISTORY_START.slice(0, 4)}, newest first
        </span>
      </div>
      <Suspense
        fallback={
          <div className="text-sm text-[#5f6673]">Loading workouts…</div>
        }
      >
        <Workouts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Workouts({
  searchParams,
}: {
  searchParams: PageProps<"/workouts">["searchParams"];
}) {
  await connection();
  const sp = await searchParams;
  const sport = SPORT_FILTERS.includes(sp.sport as SportFilter)
    ? (sp.sport as SportFilter)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete)
    return <p className="text-sm text-[#5f6673]">Connect Strava first.</p>;
  const today = localToday(athlete.timezone);
  const [list, sum, weights] = await Promise.all([
    listWorkouts(db, athlete.id, {
      sport,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    summary28(db, athlete.id, today),
    recentWeights(db, athlete.id),
  ]);
  const href = (q: { sport?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q.sport) p.set("sport", q.sport);
    if (q.page && q.page > 1) p.set("page", String(q.page));
    const s = p.toString();
    return s ? `/workouts?${s}` : "/workouts";
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <Card className="p-5">
          <Stat
            label="Workouts, last 28 days"
            value={sum.count}
            note={`${(sum.count / 4).toFixed(1)} per week`}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Time, last 28 days"
            value={(sum.seconds / 3600).toFixed(1)}
            unit="h"
            note={`${hours(sum.seconds / 4)} per week`}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Load, last 28 days"
            value={sum.load}
            note={
              sum.estimated
                ? `${sum.estimated} swim${sum.estimated === 1 ? "" : "s"} estimated`
                : undefined
            }
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Needs attention"
            value={sum.noLoad.length}
            note={
              sum.noLoad.length
                ? "No heart rate, so no load"
                : "All workouts have load"
            }
            noteClass={sum.noLoad.length ? "text-[#9a5b00]" : "text-[#15803d]"}
          />
        </Card>
      </div>

      <Card aria-label="Workout list" className="px-4 py-5 sm:px-6">
        <nav aria-label="Filter by sport" className="flex flex-wrap gap-2">
          {[undefined, ...SPORT_FILTERS].map((s) => {
            const on = s === sport;
            return (
              <Link
                key={s ?? "all"}
                href={href({ sport: s })}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  on
                    ? "bg-[#14171f] text-white"
                    : "bg-[#eceef2] text-[#14171f]",
                )}
              >
                {s ? SPORT[s].label : "All"}
              </Link>
            );
          })}
        </nav>

        {list.rows.length === 0 ? (
          <p className="mt-6 text-sm text-[#5f6673]">No workouts here yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#eceef2] text-xs font-medium text-[#5f6673]">
                  <th className="py-2.5 pr-3 font-medium">Date</th>
                  <th className="py-2.5 pr-3 font-medium">Workout</th>
                  <th className="py-2.5 pr-3 font-medium">Type</th>
                  <th className="py-2.5 pr-3 font-medium">Time</th>
                  <th className="py-2.5 pr-3 font-medium">Distance</th>
                  <th className="py-2.5 pr-3 font-medium">Avg HR</th>
                  <th className="py-2.5 pr-3 font-medium">Load</th>
                  <th className="w-[18%] py-2.5 font-medium">Time in zones</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#eceef2] last:border-0"
                  >
                    <td className="whitespace-nowrap py-3 pr-3 text-[#5f6673]">
                      {dayLabel(r.localDate)}
                    </td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/workouts/${r.id}`}
                        className="font-medium text-[#14171f] hover:text-[#0b6ef5]"
                      >
                        {r.name}
                      </Link>
                      <div className="text-xs text-[#5f6673]">
                        {[
                          placeLabel(r.discipline, r.isTrainer),
                          r.corrected ? "Duration corrected" : null,
                          r.excluded ? "Excluded from load" : null,
                          r.estimated ? "No heart rate, load estimated" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium",
                          SPORT[r.discipline].chip,
                        )}
                      >
                        {SPORT[r.discipline].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {clock(r.movingSeconds)}
                      {r.corrected ? (
                        <div className="text-xs text-[#5f6673] line-through">
                          {clock(r.recordedSeconds)}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {r.distanceM > 0
                        ? r.discipline === "swim"
                          ? `${r.distanceM.toLocaleString("en-CA")} m`
                          : km(r.distanceM)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {r.avgHr ?? <span className="text-[#5f6673]">—</span>}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {r.excluded ? (
                        <span className="text-[#5f6673]">0</span>
                      ) : r.load == null ? (
                        <span className="font-medium text-[#9a5b00]">
                          No load
                        </span>
                      ) : (
                        <span className="font-semibold">{r.load}</span>
                      )}
                      {r.estimated ? (
                        <span className="ml-1 text-[11px] font-medium text-[#9a5b00]">
                          est.
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <ZoneBar zones={r.zones} estimated={r.estimated} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Legend items={ZONE_LEGEND} />
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={href({ sport, page: page - 1 })}
                className="rounded-xl bg-[#eceef2] px-4 py-2 text-sm font-medium"
              >
                Newer
              </Link>
            ) : null}
            {list.hasMore ? (
              <Link
                href={href({ sport, page: page + 1 })}
                className="rounded-xl bg-[#eceef2] px-4 py-2 text-sm font-medium"
              >
                Older
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      <Card aria-label="Body weight" className="max-w-[640px]">
        <CardTitle>Body weight</CardTitle>
        <p className="mt-1 text-sm text-[#5f6673]">
          Log it whenever you weigh in. Strava only keeps your current weight,
          so history lives here. Used for watts per kg.
        </p>
        <div className="mt-4">
          <WeightForm today={today} />
        </div>
        {weights.length ? (
          <ul className="mt-4 divide-y divide-[#eceef2] text-sm">
            {weights.map((w) => (
              <li
                key={`${w.date}-${w.source}`}
                className="flex justify-between py-2"
              >
                <span>{dayLabel(w.date)}</span>
                <span>
                  <b className="font-semibold">
                    {(w.grams / 1000).toFixed(1)} kg
                  </b>
                  <span className="ml-2 text-xs text-[#5f6673]">
                    {w.source === "strava" ? "from Strava" : "entered"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#5f6673]">No weigh-ins yet.</p>
        )}
      </Card>
    </>
  );
}
