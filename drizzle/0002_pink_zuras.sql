CREATE TABLE "activity_laps" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"lap_index" integer NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"moving_seconds" integer NOT NULL,
	"distance_m" integer NOT NULL,
	"avg_speed_mm_s" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"avg_cadence" integer,
	"avg_watts" integer,
	"elevation_gain_m" integer,
	"kind" text NOT NULL,
	"formula_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_weight" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"date" text NOT NULL,
	"grams" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_laps" ADD CONSTRAINT "activity_laps_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_laps" ADD CONSTRAINT "activity_laps_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_weight" ADD CONSTRAINT "body_weight_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_laps_uq" ON "activity_laps" USING btree ("activity_id","lap_index","formula_version");--> statement-breakpoint
CREATE UNIQUE INDEX "body_weight_uq" ON "body_weight" USING btree ("athlete_id","date","source");