CREATE TABLE "training_segment" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"duration_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "set" ADD COLUMN "actual_reps" integer;--> statement-breakpoint
ALTER TABLE "set" ADD COLUMN "actual_weight" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "set" ADD COLUMN "actual_weight_unit" varchar(10);--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "active_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "training_segment" ADD CONSTRAINT "training_segment_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "set"
SET "actual_reps" = "reps",
	"actual_weight" = "weight",
	"actual_weight_unit" = "weight_unit"
WHERE "completed" = true;--> statement-breakpoint
UPDATE "workout"
SET "active_started_at" = "started_at"
WHERE "session_status" = 'active';--> statement-breakpoint
INSERT INTO "training_segment" ("workout_id", "started_at", "finished_at", "duration_seconds")
SELECT
	"id",
	"started_at",
	"finished_at",
	CASE WHEN "finished_at" IS NULL THEN NULL ELSE "duration_seconds" END
FROM "workout"
WHERE "started_at" IS NOT NULL;
