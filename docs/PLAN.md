# Ironman Training App — Plan

Personal training web app for Derek's Ironman Ottawa build. Status legend: **DECIDED** = ask before deviating.

## Goal and user
- Single user for now. `athlete_id` on every table so multi-user stays possible; do not build for it.
- A-race: **Ironman Ottawa, 2027-08-08**. Goal: finish under 12:00, stretch ~11:00, better age-group percentile than Muskoka 70.3 (2026-07-05, 5:55:38).
- Pattern: two sessions/day (morning, after work). Friday volleyball through end of February, YMCA pool, home smart trainer. Strava is the source of truth for activities. No sleep/HRV tracking.
- Baseline (Strava, full weeks 2026-10-12 to 2026-11-01): ~3.8 h/week over 5-6 sessions (ride 1.4 h, run 1.3 h, swim 0.75 h, strength 0.35 h). Longest recent run 9.3 km, longest ride 32 km. 121 km Gran Fondo on 2026-09-12.

## DECIDED: stack and architecture
- Hosted PWA: Next.js (App Router) on Vercel; Postgres (Supabase free tier); Drizzle ORM; zod; Tailwind + shadcn; recharts; Vitest. Mobile-first for Today and logging, desktop for analysis.
- Supabase free projects pause when idle: daily Vercel cron touches the DB.
- Conventions (borrowed from personal-finance-tracker `docs/ARCHITECTURE.md`):
  - Pages are Server Components that read the DB.
  - Mutations are server actions: validate with zod, call plain functions in `src/lib`, then `revalidatePath`.
  - Library functions take `db` as an argument so tests can use a test DB.
  - Integers only (seconds, meters, bpm). `'YYYY-MM-DD'` text dates.
  - Idempotent ingest keyed by Strava id. Versioned settings table.
  - `CLAUDE.md` / `AGENTS.md` lists the rules reviewers enforce.
- All load, volume, plan and guardrail math lives in a pure, tested TypeScript package (`packages/engine` or `src/engine`) with no network access. The LLM never owns math.
- Raw Strava payloads stored as received. Derived values (zone seconds, load, fitness/fatigue) are recomputable caches tagged with `formula_version`. Never call Strava on page load.

## DECIDED: Strava
- OAuth + webhooks + paced, queued backfill (from 2025-01) + nightly catch-up job. Rate limits are low.
- Check Strava's current API terms on AI use of athlete data before sending any activity data to a model.
- Use Strava's HR and power zones as returned by the API. "Threshold drift" insight suggests when to change Strava zones.
- Indoor rides are treated like outdoor rides (power/HR matter; distance estimated). Pool swims flagged `is_trainer`.

## DECIDED: load model
- Default load = minutes in each Strava HR zone, weighted 1-5, as a versioned formula. A custom formula may come later; history must recompute.
- Strength: use the activity's average HR to pick one Strava HR zone; put full moving minutes in that zone.
- Fitness/fatigue = 42-day and 7-day exponentially weighted averages of daily load. Strava Relative Effort is a secondary reference only.
- "Stress" on dashboards = training load and fatigue, not sleep/HRV.

## DECIDED: plan, guardrails, constraints
- Race date is chosen by Derek; the season plan adapts. A rules-based generator back-solves phases from race date, constraints and current volume.
- Guardrails are tunable settings enforced in code: weekly load ramp capped ~12%; recovery week every 4th week at ~60-70% of prior week; 2-3 week taper.
- Constraints: weekly anchors (long ride / long run on Sat/Sun, swappable), blackout or reduced-capacity periods, equipment. Assumed 2027: Jan 24-31 (Dominican Republic; treadmill, stationary bike, maybe swim), Feb 8-22 (Thailand; some running only). Blackouts store `allowed_disciplines`.
- Manual schedule edits always allowed (move, change, delete). A guardrail-breaking edit warns, never blocks. Edits sync to the calendar and feed the next weekly proposal.
- Weekly loop: check-in (multiple-choice/rating per workout) -> plan proposal as before/after diff -> Derek approves. Proposer is a pluggable interface: (1) rules engine (MVP), (2) review packet run through Claude outside the app (v1), (3) optional API proposer with monthly cost cap (later).

## Added: workout prescriptions and progress
- **Every planned session is a structured workout**, not just a duration: segments (warm-up, main sets with reps and rest, cool-down), each with a target.
  - Run: HR range (bpm) and pace range from Strava zones. Bike: watts range from FTP plus HR range. Swim: sets, distances, rest and effort by feel/pace (no HR in the pool).
  - Targets are computed in the engine from Strava zones and FTP; never typed by an LLM. Stored as `planned_sessions.structure` (jsonb, zod-validated).
  - Needs from Derek as settings: FTP (Strava has 315 W), a threshold run pace (Strava run zones are race-pace based), and a swim threshold pace (CSS) or a recent 400 m time.
- **Progress section: three sub-pages (Swim, Bike, Run)**, each data-dense, derived from synced activities (never live Strava calls). Every chart offers 12 weeks / 6 months / since Jan 2025, dots per session plus a 4-week rolling line, and % change vs 8 weeks ago.
  - Swim: avg pace per 100 m (all / easy / main sets), SWOLF for a 25 m pool (time + strokes per length; strokes from Strava stroke rate x length time, estimated until validated against the watch), strokes per length, distance per stroke, weekly meters vs plan, test results and CSS history, main-set pace fade, longest swim, recent swims table.
  - Bike: avg power (all / endurance / threshold / long rides) with % change, W/kg = FTP / body weight (weekly weigh-ins stored here, since Strava keeps only current weight), weekly hours or km vs plan, elevation per week, power at Z2 HR, best 5/20/60-min power vs 6 months ago, FTP history, recent rides table.
  - Run: weekly km vs plan, avg pace by run type (easy / long / threshold, type from the matched planned session), threshold rep breakdown and fade from watch laps, pace at Z2 HR, long-run build vs plan, best efforts vs all-time PBs with computed estimates, recent runs table.
  - New data needed: `body_weight` (athlete_id, date, grams), per-lap rows (`activity_laps`, from Strava laps, raw kept), and a `run_type` / `session_type` on matched sessions.
- Placement: structured workouts ship with the plan generator (MVP); Progress charts ship in MVP-lite (pace/power at HR from existing data), with PRs and test prompts in v1.

## Athlete benchmarks (from Strava, 2026-11-05)
- FTP 315 W (set manually Aug 15, 2026). Retest at the Saturday threshold ride.
- Swim test Oct 30 (25 m multiples): 200 m at 1:47 /100 m, about 400 m at 1:50 /100 m. Critical swim speed from the two is about 1:53 /100 m, low confidence because the paces are so close; redo the 200 m all-out. Easy swims run about 2:05 /100 m.
- Run: Strava's pace zones come from a 1:57:26 half marathon (Jun 2025) and are much faster than current fitness. The Nov 5 threshold run (3 x 10 min) held about 160 bpm, 5:42 then 6:08 and 6:09 /km. Strava HR Z4 starts at 168, so this effort sat in Z3: that is the threshold-drift insight. Pace targets come from recent efforts, not Strava's race-based pace zones.
- Laps: Strava activity laps (from the watch) give rep splits for intervals and swim sets, so test results and workout compliance can be read automatically, with a one-tap "tag as test" confirm.
- Strava's own race-time predictions are not in the API; the engine computes its own ranges from recent efforts and labels them estimates.

## Data model
`athlete`, `strava_auth` (encrypted tokens), `strava_zones` (history), `activities` (raw_json), `activity_zone_seconds`, `activity_load`, `daily_metrics`, `constraints`, `plans`, `plan_weeks`, `planned_sessions` (structure jsonb, status, matched_activity_id, gcal_event_id, source generated|manual), `plan_proposals`, `plan_changes`, `weekly_checkins`, `checkin_answers`, `calendar_link`, `sync_events`, plus a versioned `settings` table.

## UI
Sidebar: Today, Calendar, Workouts, Insights, Weekly review, Settings; reusable cards. Dashboard: weekly load trend, fitness/fatigue, race countdown, discipline balance, key-session completion, this week's sessions, volume vs plan, short performance updates. Calendar shows planned and actual together. No drag-and-drop dashboard builder yet.

## Roadmap
- **MVP (target 2026-11-19, tight; trim constraints screen first):** Strava sync + backfill, load/fitness engine, rules-based season plan, constraints, calendar + dashboard, manual session editing, installable PWA.
- **v1 (by end of Feb 2027):** Google Calendar push to "Triathlon Training" calendar with workout details in the description (completed Strava activity replaces planned event at real start/duration); weekly check-in; weekly proposals with approval; Claude review packet; threshold-drift insight; race-readiness indicators.
- **Later:** API proposer with cost cap, taper/race-week view, post-race review, multi-athlete prep.
- **Gates:** MVP done when four weeks of load match hand-checked numbers. v1 done when one full week runs end to end (proposal, calendar, recap).

## Non-goals
Multi-user accounts, sleep/HRV, native apps, nutrition planning, race-day pacing tools, live Strava calls on page load, applying plan changes without approval.
