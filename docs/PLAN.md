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

## Data model
`athlete`, `strava_auth` (encrypted tokens), `strava_zones` (history), `activities` (raw_json), `activity_zone_seconds`, `activity_load`, `daily_metrics`, `constraints`, `plans`, `plan_weeks`, `planned_sessions` (status, matched_activity_id, gcal_event_id, source generated|manual), `plan_proposals`, `plan_changes`, `weekly_checkins`, `checkin_answers`, `calendar_link`, `sync_events`, plus a versioned `settings` table.

## UI
Sidebar: Today, Calendar, Workouts, Insights, Weekly review, Settings; reusable cards. Dashboard: weekly load trend, fitness/fatigue, race countdown, discipline balance, key-session completion, this week's sessions, volume vs plan, short performance updates. Calendar shows planned and actual together. No drag-and-drop dashboard builder yet.

## Roadmap
- **MVP (target 2026-11-19, tight; trim constraints screen first):** Strava sync + backfill, load/fitness engine, rules-based season plan, constraints, calendar + dashboard, manual session editing, installable PWA.
- **v1 (by end of Feb 2027):** Google Calendar push to "Triathlon Training" calendar with workout details in the description (completed Strava activity replaces planned event at real start/duration); weekly check-in; weekly proposals with approval; Claude review packet; threshold-drift insight; race-readiness indicators.
- **Later:** API proposer with cost cap, taper/race-week view, post-race review, multi-athlete prep.
- **Gates:** MVP done when four weeks of load match hand-checked numbers. v1 done when one full week runs end to end (proposal, calendar, recap).

## Non-goals
Multi-user accounts, sleep/HRV, native apps, nutrition planning, race-day pacing tools, live Strava calls on page load, applying plan changes without approval.
