import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarChart, Legend, LineChart } from "@/components/charts";
import { Card, CardTitle, Stat } from "@/components/ui/card";
import { getDb } from "@/db";
import type { Discipline } from "@/engine";
import {
  clock,
  dayLabel,
  hours,
  km,
  SPORT,
  shortDate,
  weekRange,
} from "@/lib/format";
import { getAthlete, getThisWeek, localToday } from "@/lib/queries/week";
import { cn } from "@/lib/utils";

export default function ThisWeekPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-[#5f6673]">Loading your week…</div>
      }
    >
      <ThisWeek />
    </Suspense>
  );
}

async function ThisWeek() {
  await connection(); // reads the database on every request
  const db = getDb();
  const athlete = await getAthlete(db);
  if (!athlete) return <Setup />;
  const today = localToday(athlete.timezone);
  const w = await getThisWeek(db, athlete, today);

  const lastWeek = w.weeks[w.weeks.length - 2];
  const loadDelta =
    lastWeek && lastWeek.load > 0
      ? Math.round(((w.totals.load - lastWeek.load) / lastWeek.load) * 100)
      : null;
  const avgSeconds = (() => {
    const done = w.weeks.slice(-4, -1).filter((x) => x.seconds > 0);
    return done.length
      ? done.reduce((s, x) => s + x.seconds, 0) / done.length
      : 0;
  })();
  const now = w.fitness.at(-1);
  const fitnessSeries = w.fitness.map((p) => Math.round(p.fitness));
  const fatigueSeries = w.fitness.map((p) => Math.round(p.fatigue));
  const mid = Math.floor(w.fitness.length / 2);

  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="m-0 text-[32px] font-semibold">This week</h1>
        <span className="text-[15px] text-[#5f6673]">
          {weekRange(w.weekStart, w.weekEnd)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card aria-label="Race countdown" className="p-[26px]">
          <div className="text-sm text-[#5f6673]">
            Ironman Ottawa
            {w.race
              ? ` · ${shortDate(w.race.date)}, ${w.race.date.slice(0, 4)}`
              : ""}
          </div>
          {w.race ? (
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[56px] font-bold leading-[1.1] tracking-tight">
                {w.race.daysToGo}
              </span>
              <span className="text-lg text-[#5f6673]">days to go</span>
            </div>
          ) : (
            <div className="mt-2 text-[#5f6673]">Race date not set yet.</div>
          )}
          <div className="mt-1.5 text-sm text-[#5f6673]">
            Goal under 12:00 · stretch about 11:00 · Muskoka 70.3 was 5:55:38
          </div>
        </Card>

        <Card
          aria-label="Strava sync"
          className="flex flex-col gap-1.5 p-[26px]"
        >
          <CardTitle className="text-xl">Strava</CardTitle>
          <div className="text-sm text-[#5f6673]">
            {w.sync.activityCount} activities synced
            {w.sync.lastActivityDate
              ? ` · latest ${shortDate(w.sync.lastActivityDate)}`
              : ""}
          </div>
          {w.sync.queued > 0 ? (
            <div className="mt-1 text-[15px] font-medium text-[#9a5b00]">
              {w.sync.queued} older activities still syncing
            </div>
          ) : (
            <div className="mt-1 text-[15px] font-medium text-[#15803d]">
              Up to date
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
        <Card>
          <Stat
            label="Load this week"
            value={w.totals.load}
            note={
              loadDelta === null
                ? "No load last week"
                : `${loadDelta >= 0 ? "+" : ""}${loadDelta}% vs last week (full)`
            }
            noteClass={
              loadDelta !== null && loadDelta > 12
                ? "text-[#9a5b00]"
                : undefined
            }
          />
        </Card>
        <Card>
          <Stat
            label="Time this week"
            value={(w.totals.seconds / 3600).toFixed(1)}
            unit="h"
            note={
              avgSeconds ? `Last 3 weeks avg ${hours(avgSeconds)}` : undefined
            }
          />
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <Stat
            label="Sessions this week"
            value={w.totals.sessions}
            note="Planned sessions arrive with the plan generator"
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card aria-label="This week's sessions">
          <div className="flex items-baseline justify-between">
            <CardTitle>This week's sessions</CardTitle>
            <Link href="/workouts" className="text-sm text-[#0b6ef5]">
              See all
            </Link>
          </div>
          {w.thisWeek.length === 0 ? (
            <p className="mt-3 text-sm text-[#5f6673]">
              Nothing recorded yet this week.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[#eceef2]">
              {w.thisWeek.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "w-[72px] shrink-0 rounded-lg px-2 py-0.5 text-center text-xs font-medium",
                      SPORT[a.discipline as Discipline].chip,
                    )}
                  >
                    {SPORT[a.discipline as Discipline].label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">
                      {a.name}
                    </div>
                    <div className="text-[13px] text-[#5f6673]">
                      {dayLabel(a.localDate)} · {clock(a.movingSeconds)}
                      {a.distanceM > 0 ? ` · ${km(a.distanceM)}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {a.load == null ? (
                      <span className="text-[#9a5b00]">No load</span>
                    ) : (
                      <span className="font-semibold">{a.load}</span>
                    )}
                    {a.estimated ? (
                      <div className="text-[11px] font-medium text-[#9a5b00]">
                        est.
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-label="Worth a look">
          <CardTitle>Worth a look</CardTitle>
          {w.insights.length === 0 ? (
            <p className="mt-3 text-sm text-[#5f6673]">
              Nothing stands out right now.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-[#eceef2]">
              {w.insights.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3.5 py-3.5"
                >
                  <span className="whitespace-nowrap rounded-lg bg-[#eceef2] px-2.5 py-1 text-xs font-medium text-[#4b5260]">
                    {{ ramp: "Ramp", gap: "Gap", data: "Data" }[i.kind]}
                  </span>
                  <div className="min-w-[200px] flex-1">
                    <div className="text-[15px] font-medium">{i.title}</div>
                    <div className="text-sm text-[#5f6673]">{i.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-label="Weekly load">
          <div className="flex items-baseline justify-between">
            <CardTitle>Weekly load</CardTitle>
            <span className="text-[13px] text-[#5f6673]">Last 8 weeks</span>
          </div>
          <BarChart
            values={w.weeks.map((x) => x.load)}
            labels={w.weeks.map((x) => shortDate(x.weekStart))}
            ariaLabel="Bar chart of weekly training load for the last eight weeks"
          />
          <Legend
            items={[
              { color: "#0b6ef5", label: "This week (in progress)" },
              { color: "#9cc4fb", label: "Earlier weeks" },
            ]}
          />
          {w.sync.queued > 0 ? (
            <p className="mt-2 text-xs text-[#9a5b00]">
              Weeks before Oct 12 are incomplete while {w.sync.queued} older
              activities sync.
            </p>
          ) : null}
        </Card>

        <Card aria-label="Fitness and fatigue">
          <div className="flex items-baseline justify-between">
            <CardTitle>Fitness and fatigue</CardTitle>
            <span className="text-[13px] text-[#5f6673]">
              42-day vs 7-day load
            </span>
          </div>
          {now ? (
            <>
              <div className="mt-2 flex flex-wrap gap-6 text-sm">
                <span>
                  Fitness <b className="text-base">{Math.round(now.fitness)}</b>
                </span>
                <span>
                  Fatigue <b className="text-base">{Math.round(now.fatigue)}</b>
                </span>
                <span>
                  Form <b className="text-base">{Math.round(now.form)}</b>
                </span>
              </div>
              <LineChart
                series={[
                  {
                    name: "Fitness",
                    color: "#0b6ef5",
                    points: fitnessSeries,
                    width: 3,
                  },
                  {
                    name: "Fatigue",
                    color: "#c2410c",
                    points: fatigueSeries,
                    width: 2,
                  },
                ]}
                xLabels={[
                  { index: 0, text: shortDate(w.fitness[0].date) },
                  { index: mid, text: shortDate(w.fitness[mid].date) },
                  {
                    index: w.fitness.length - 1,
                    text: shortDate(w.fitness.at(-1)?.date ?? today),
                  },
                ]}
                ariaLabel="Line chart of fitness and fatigue over the last twelve weeks"
              />
              <Legend
                items={[
                  { color: "#0b6ef5", label: "Fitness" },
                  { color: "#c2410c", label: "Fatigue" },
                ]}
              />
              {w.sync.queued > 0 ? (
                <p className="mt-2 text-xs text-[#9a5b00]">
                  Fitness is still building: {w.sync.queued} older activities
                  are syncing, so it reads low until they finish.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-[#5f6673]">No activities yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-label="Discipline balance">
          <div className="flex items-baseline justify-between">
            <CardTitle>Discipline balance</CardTitle>
            <span className="text-[13px] text-[#5f6673]">
              Avg hours per week, last 3 weeks
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3.5">
            {(["bike", "run", "swim", "strength", "row"] as Discipline[]).map(
              (d) => {
                const s = w.secondsByDiscipline[d] ?? 0;
                const max = Math.max(
                  1,
                  ...Object.values(w.secondsByDiscipline),
                );
                return (
                  <div key={d}>
                    <div className="flex justify-between text-sm">
                      <span>{SPORT[d].label}</span>
                      <span className="text-[#5f6673]">
                        {(s / 3600).toFixed(2)} h
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-[#eceef2]">
                      <div
                        className="h-2 rounded bg-[#0b6ef5]"
                        style={{ width: `${Math.round((s / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </Card>

        <Card aria-label="Season plan">
          <CardTitle>Season plan</CardTitle>
          <p className="mt-3 text-sm text-[#5f6673]">
            There's no plan yet. Once the plan generator is built, this card
            shows planned vs done for the week, with each session's targets.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Setup() {
  return (
    <Card className="max-w-xl">
      <CardTitle>Connect Strava to get started</CardTitle>
      <p className="mt-2 text-sm text-[#5f6673]">
        No athlete is set up yet. Use the connect link to link your Strava
        account.
      </p>
    </Card>
  );
}
