import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Conventions: integers only (seconds, meters, bpm), 'YYYY-MM-DD' text dates,
// athlete_id on every table, derived tables carry formula_version.

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const athlete = pgTable("athlete", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Toronto"),
  stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }).unique(),
  raceDate: text("race_date"), // YYYY-MM-DD, user-chosen A-race
  createdAt: createdAt(),
});

export const stravaAuth = pgTable("strava_auth", {
  athleteId: integer("athlete_id")
    .primaryKey()
    .references(() => athlete.id),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: ts("expires_at").notNull(),
  scope: text("scope").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const stravaZones = pgTable("strava_zones", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  kind: text("kind").notNull(), // 'heartrate' | 'power'
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD
  zones: jsonb("zones").notNull(), // [{min,max}] as returned by Strava
  rawJson: jsonb("raw_json").notNull(),
  createdAt: createdAt(),
});

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    stravaId: bigint("strava_id", { mode: "number" }).notNull(),
    discipline: text("discipline").notNull(), // swim|bike|run|strength|row|other
    sportType: text("sport_type").notNull(),
    name: text("name").notNull(),
    startUtc: ts("start_utc").notNull(),
    localDate: text("local_date").notNull(), // YYYY-MM-DD
    movingSeconds: integer("moving_seconds").notNull(),
    elapsedSeconds: integer("elapsed_seconds").notNull(),
    distanceM: integer("distance_m").notNull().default(0),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    avgWatts: integer("avg_watts"),
    isTrainer: boolean("is_trainer").notNull().default(false),
    rawJson: jsonb("raw_json").notNull(), // as received from Strava
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("activities_strava_id_uq").on(t.athleteId, t.stravaId),
    index("activities_date_idx").on(t.athleteId, t.localDate),
  ],
);

// Derived caches below: recomputable, tagged with formula_version.
export const activityZoneSeconds = pgTable(
  "activity_zone_seconds",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id),
    zone: integer("zone").notNull(), // 1-5
    seconds: integer("seconds").notNull(),
    formulaVersion: integer("formula_version").notNull(),
  },
  (t) => [uniqueIndex("azs_uq").on(t.activityId, t.zone, t.formulaVersion)],
);

export const activityLoad = pgTable(
  "activity_load",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id),
    load: integer("load").notNull(), // rounded load points
    estimated: boolean("estimated").notNull().default(false), // true when no HR (e.g. swims)
    formulaVersion: integer("formula_version").notNull(),
  },
  (t) => [uniqueIndex("al_uq").on(t.activityId, t.formulaVersion)],
);

export const dailyMetrics = pgTable(
  "daily_metrics",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    date: text("date").notNull(), // YYYY-MM-DD
    load: integer("load").notNull(),
    fitnessX100: integer("fitness_x100").notNull(), // 42-day EWMA * 100
    fatigueX100: integer("fatigue_x100").notNull(), // 7-day EWMA * 100
    formulaVersion: integer("formula_version").notNull(),
  },
  (t) => [uniqueIndex("dm_uq").on(t.athleteId, t.date, t.formulaVersion)],
);

export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    key: text("key").notNull(), // e.g. 'guardrails', 'load_formula'
    version: integer("version").notNull(),
    value: jsonb("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("settings_uq").on(t.athleteId, t.key, t.version)],
);

export const constraints = pgTable("constraints", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  kind: text("kind").notNull(), // anchor | blackout | equipment
  label: text("label").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  allowedDisciplines: jsonb("allowed_disciplines").$type<string[]>(),
  weeklyDay: integer("weekly_day"), // 0=Mon..6=Sun for anchors
  discipline: text("discipline"),
  details: jsonb("details"),
  createdAt: createdAt(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  raceDate: text("race_date").notNull(),
  generatorVersion: integer("generator_version").notNull(),
  status: text("status").notNull().default("active"), // active | archived
  createdAt: createdAt(),
});

export const planWeeks = pgTable("plan_weeks", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id),
  weekStart: text("week_start").notNull(), // Monday, YYYY-MM-DD
  phase: text("phase").notNull(), // base | build | peak | taper | race
  isRecovery: boolean("is_recovery").notNull().default(false),
  targetLoad: integer("target_load").notNull(),
  targetSeconds: integer("target_seconds").notNull(),
});

export const plannedSessions = pgTable("planned_sessions", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  planWeekId: integer("plan_week_id").references(() => planWeeks.id),
  date: text("date").notNull(), // YYYY-MM-DD
  slot: text("slot").notNull(), // am | pm
  discipline: text("discipline").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  durationSeconds: integer("duration_seconds").notNull(),
  targetLoad: integer("target_load").notNull(),
  isKey: boolean("is_key").notNull().default(false),
  status: text("status").notNull().default("planned"), // planned|done|skipped|moved|deleted
  matchedActivityId: integer("matched_activity_id").references(
    () => activities.id,
  ),
  gcalEventId: text("gcal_event_id"),
  source: text("source").notNull().default("generated"), // generated | manual
  createdAt: createdAt(),
});

export const planProposals = pgTable("plan_proposals", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  weekStart: text("week_start").notNull(),
  proposer: text("proposer").notNull(), // rules | review_packet | api
  status: text("status").notNull().default("pending"), // pending|approved|rejected
  rationale: text("rationale"),
  createdAt: createdAt(),
  decidedAt: ts("decided_at"),
});

export const planChanges = pgTable("plan_changes", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  proposalId: integer("proposal_id").references(() => planProposals.id), // null = manual edit
  plannedSessionId: integer("planned_session_id").references(
    () => plannedSessions.id,
  ),
  op: text("op").notNull(), // add | move | change | delete
  before: jsonb("before"),
  after: jsonb("after"),
  warnings: jsonb("warnings").$type<string[]>(),
  createdAt: createdAt(),
});

export const weeklyCheckins = pgTable("weekly_checkins", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  weekStart: text("week_start").notNull(),
  completedAt: ts("completed_at"),
});

export const checkinAnswers = pgTable("checkin_answers", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  checkinId: integer("checkin_id")
    .notNull()
    .references(() => weeklyCheckins.id),
  plannedSessionId: integer("planned_session_id").references(
    () => plannedSessions.id,
  ),
  activityId: integer("activity_id").references(() => activities.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
});

export const calendarLink = pgTable("calendar_link", {
  athleteId: integer("athlete_id")
    .primaryKey()
    .references(() => athlete.id),
  provider: text("provider").notNull().default("google"),
  calendarId: text("calendar_id").notNull(),
  tokensEnc: text("tokens_enc"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const syncEvents = pgTable("sync_events", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athlete.id),
  source: text("source").notNull(), // webhook | backfill | nightly
  stravaObjectId: bigint("strava_object_id", { mode: "number" }),
  aspect: text("aspect"), // create | update | delete
  status: text("status").notNull().default("queued"), // queued|done|error
  error: text("error"),
  payload: jsonb("payload"),
  createdAt: createdAt(),
  processedAt: ts("processed_at"),
});

// Laps as recorded by the watch (lap button, auto-lap, or pool sets). Derived from
// activities.raw_json.laps, so recomputable; `kind` comes from the engine's lap classifier.
export const activityLaps = pgTable(
  "activity_laps",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id),
    lapIndex: integer("lap_index").notNull(), // 0-based order within the activity
    elapsedSeconds: integer("elapsed_seconds").notNull(),
    movingSeconds: integer("moving_seconds").notNull(),
    distanceM: integer("distance_m").notNull(),
    avgSpeedMmS: integer("avg_speed_mm_s"), // millimeters per second
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    avgCadence: integer("avg_cadence"),
    avgWatts: integer("avg_watts"),
    elevationGainM: integer("elevation_gain_m"),
    kind: text("kind").notNull(), // warmup|work|rest|cooldown|steady|set|other
    formulaVersion: integer("formula_version").notNull(),
  },
  (t) => [
    uniqueIndex("activity_laps_uq").on(
      t.activityId,
      t.lapIndex,
      t.formulaVersion,
    ),
  ],
);

// Body weight log. Strava keeps only the current weight, so history lives here.
export const bodyWeight = pgTable(
  "body_weight",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    date: text("date").notNull(), // YYYY-MM-DD
    grams: integer("grams").notNull(),
    source: text("source").notNull(), // manual | strava
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("body_weight_uq").on(t.athleteId, t.date, t.source)],
);

// Manual corrections to an activity (e.g. forgot to stop the watch). Raw Strava data stays
// untouched in activities.raw_json; readers use coalesce(override, raw) for "effective" values.
export const activityOverrides = pgTable(
  "activity_overrides",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athlete.id),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id),
    movingSeconds: integer("moving_seconds"), // corrected duration, null = keep Strava's
    excludeFromLoad: boolean("exclude_from_load").notNull().default(false),
    note: text("note"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("activity_overrides_uq").on(t.activityId)],
);
