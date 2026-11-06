# Load check, Oct 12 – Nov 8, 2026 (MVP gate)

Formula v2: minutes in each Strava HR zone x weight 1–5. Strength: all minutes in the avg-HR zone. Swims (no HR): estimated, easy = Z2.

**Completeness:** Strava lists 19 activities in range; the app has the same 19 (ids and moving times match).
**Math:** every activity's load recomputed independently from stored zone seconds; 19 of 19 match.
**Baseline:** Derek's brief (Oct 12 – Nov 1) says ride 1.4 h, run 1.3 h, swim 0.75 h, strength 0.35 h, total 3.8 h/week. The app gives exactly that once the Oct 19 weight session (3:05:30 moving, 98 bpm avg) is left out.

| Week (Mon) | Time | Load | Notes |
|---|---|---|---|
| Oct 12 | 4.06 h | 455 | |
| Oct 19 | 6.11 h | 570 | includes 3.09 h weight session (load 186); without it 3.02 h, 384 |
| Oct 26 | 4.36 h | 513 | |
| Nov 2 | 2.74 h | 300 | in progress (through Nov 5) |

Hand check, Oct 14 run, zones [34, 681, 1977, 63, 0] s: (34 + 1362 + 5931 + 252) / 60 = 126.3, stored 126.

Open question: exclude or trim the Oct 19 weight session? Needs an "exclude from load" override on activities.
