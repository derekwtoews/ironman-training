CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"strava_id" bigint NOT NULL,
	"discipline" text NOT NULL,
	"sport_type" text NOT NULL,
	"name" text NOT NULL,
	"start_utc" timestamp with time zone NOT NULL,
	"local_date" text NOT NULL,
	"moving_seconds" integer NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"distance_m" integer DEFAULT 0 NOT NULL,
	"avg_hr" integer,
	"max_hr" integer,
	"avg_watts" integer,
	"is_trainer" boolean DEFAULT false NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_load" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"load" integer NOT NULL,
	"formula_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_zone_seconds" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"zone" integer NOT NULL,
	"seconds" integer NOT NULL,
	"formula_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Toronto' NOT NULL,
	"strava_athlete_id" bigint,
	"race_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "athlete_strava_athlete_id_unique" UNIQUE("strava_athlete_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_link" (
	"athlete_id" integer PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"calendar_id" text NOT NULL,
	"tokens_enc" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"checkin_id" integer NOT NULL,
	"planned_session_id" integer,
	"activity_id" integer,
	"question" text NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constraints" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"allowed_disciplines" jsonb,
	"weekly_day" integer,
	"discipline" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"date" text NOT NULL,
	"load" integer NOT NULL,
	"fitness_x100" integer NOT NULL,
	"fatigue_x100" integer NOT NULL,
	"formula_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"proposal_id" integer,
	"planned_session_id" integer,
	"op" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"warnings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"week_start" text NOT NULL,
	"proposer" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"week_start" text NOT NULL,
	"phase" text NOT NULL,
	"is_recovery" boolean DEFAULT false NOT NULL,
	"target_load" integer NOT NULL,
	"target_seconds" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"plan_week_id" integer,
	"date" text NOT NULL,
	"slot" text NOT NULL,
	"discipline" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_seconds" integer NOT NULL,
	"target_load" integer NOT NULL,
	"is_key" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"matched_activity_id" integer,
	"gcal_event_id" text,
	"source" text DEFAULT 'generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"race_date" text NOT NULL,
	"generator_version" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_auth" (
	"athlete_id" integer PRIMARY KEY NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"kind" text NOT NULL,
	"effective_from" text NOT NULL,
	"zones" jsonb NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"source" text NOT NULL,
	"strava_object_id" bigint,
	"aspect" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "weekly_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"week_start" text NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_load" ADD CONSTRAINT "activity_load_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_load" ADD CONSTRAINT "activity_load_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_zone_seconds" ADD CONSTRAINT "activity_zone_seconds_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_zone_seconds" ADD CONSTRAINT "activity_zone_seconds_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_link" ADD CONSTRAINT "calendar_link_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_checkin_id_weekly_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."weekly_checkins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_planned_session_id_planned_sessions_id_fk" FOREIGN KEY ("planned_session_id") REFERENCES "public"."planned_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_answers" ADD CONSTRAINT "checkin_answers_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_changes" ADD CONSTRAINT "plan_changes_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_changes" ADD CONSTRAINT "plan_changes_proposal_id_plan_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."plan_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_changes" ADD CONSTRAINT "plan_changes_planned_session_id_planned_sessions_id_fk" FOREIGN KEY ("planned_session_id") REFERENCES "public"."planned_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_weeks" ADD CONSTRAINT "plan_weeks_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_weeks" ADD CONSTRAINT "plan_weeks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_plan_week_id_plan_weeks_id_fk" FOREIGN KEY ("plan_week_id") REFERENCES "public"."plan_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_matched_activity_id_activities_id_fk" FOREIGN KEY ("matched_activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_auth" ADD CONSTRAINT "strava_auth_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_zones" ADD CONSTRAINT "strava_zones_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_strava_id_uq" ON "activities" USING btree ("athlete_id","strava_id");--> statement-breakpoint
CREATE INDEX "activities_date_idx" ON "activities" USING btree ("athlete_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "al_uq" ON "activity_load" USING btree ("activity_id","formula_version");--> statement-breakpoint
CREATE UNIQUE INDEX "azs_uq" ON "activity_zone_seconds" USING btree ("activity_id","zone","formula_version");--> statement-breakpoint
CREATE UNIQUE INDEX "dm_uq" ON "daily_metrics" USING btree ("athlete_id","date","formula_version");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_uq" ON "settings" USING btree ("athlete_id","key","version");