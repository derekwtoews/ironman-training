# Ironman Training

Personal training PWA for Ironman Ottawa (2027-08-08). Strava in, load/fitness engine, rules-based season plan, weekly approve-the-diff loop.

- Plan and decisions: [docs/PLAN.md](docs/PLAN.md)
- Conventions: [CLAUDE.md](CLAUDE.md)

## Setup
```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate
npm run dev
```
