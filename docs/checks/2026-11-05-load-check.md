# Load check, Oct 12 – Nov 8, 2026 (MVP gate)

Formula v2: minutes in each Strava HR zone x weight 1–5. Strength: all minutes in the avg-HR zone. Swims (no HR): estimated, easy = Z2.

**Completeness:** Strava lists 19 activities in range; the app has the same 19 (ids and moving times match).
**Math:** every activity's load recomputed independently from stored zone seconds; 19 of 19 match.
**Oct 19 weight session:** Strava recorded 3:05:30 because the watch was left running; Derek confirmed the real session was 1 hour. Stored as an override (duration 3600 s): load 186 -> 60. Raw data untouched.
**Baseline:** the brief (Oct 12 – Nov 1) says 3.8 h/week (ride 1.4, run 1.3, swim 0.75, strength 0.35). The app now gives 4.15 h/week for those three weeks (4.06, 4.02, 4.36). The 3.8 only works if the Oct 19 session is excluded entirely (3.81), so the brief's baseline left it out; strength is really about 0.68 h/week.

| Week (Mon) | Time | Load | Notes |
|---|---|---|---|
| Oct 12 | 4.06 h | 455 | |
| Oct 19 | 4.02 h | 444 | weight session corrected to 1 h (load 60) |
| Oct 26 | 4.36 h | 513 | |
| Nov 2 | 2.74 h | 300 | in progress (through Nov 5) |

Hand check, Oct 14 run, zones [34, 681, 1977, 63, 0] s: (34 + 1362 + 5931 + 252) / 60 = 126.3, stored 126.

Overrides (`activity_overrides`) support a corrected duration and an exclude-from-load switch; the Workouts page will expose both.
