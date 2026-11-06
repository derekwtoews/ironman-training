# Conventions (CLAUDE.md / AGENTS.md)

Full brief: `docs/PLAN.md`. Items marked DECIDED there need Derek's OK to change.

## Rules reviewers enforce
1. **Pure engine.** All load, volume, plan and guardrail math lives in `src/engine/`. No network, no db, no `Date.now()` (take dates as args). The LLM never owns math.
2. **Pages read, actions write.** Pages are Server Components that read the DB. Mutations are server actions: zod-validate, call a plain function in `src/lib`, then `revalidatePath`.
3. **db is an argument.** Functions in `src/lib` take `db` as a parameter so tests can use a test DB.
4. **Integers only** for seconds, meters, bpm. Dates are `'YYYY-MM-DD'` text; timestamps stored as ISO text or timestamptz with the athlete's timezone kept alongside.
5. **Idempotent ingest** keyed by Strava id. Webhooks and backfill must be safe to replay.
6. **Raw is sacred.** Store Strava payloads as received (`activities.raw_json`). Derived values (zone seconds, load, fitness/fatigue) are recomputable caches tagged with `formula_version`.
7. **Never call Strava on page load.** Only webhook, backfill queue, and nightly job touch Strava. Respect rate limits.
8. **athlete_id on every table.** Don't build multi-user features.
9. **Settings are versioned.** Guardrail and formula parameters live in the `settings` table, not constants.
10. **Guardrails warn, never block** manual edits. Plan changes are never applied without Derek's approval.
11. **No AI on Strava data** until Strava's API terms on AI use are checked.
12. **Secrets:** never ask for them in chat. `.env.local` is gitignored; update `.env.example` when adding vars.
13. **Effective values.** Manual corrections live in `activity_overrides`, never in `raw_json`. Anything showing duration or load uses `coalesce(override, raw)` (loads already do). Re-sync re-applies overrides via `refreshActivityLoad`.
14. Tests: engine code needs hand-checked fixtures (Vitest). Commit small, conventional messages.

## Commands
`npm run dev | build | test | lint | db:generate | db:migrate`
