ALTER TABLE "set" ADD COLUMN "status" varchar(20) DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "set" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "session_status" varchar(20) DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "workout" ADD COLUMN "rest_ends_at" timestamp;--> statement-breakpoint
UPDATE "set"
SET "status" = CASE WHEN "completed" THEN 'completed' ELSE 'planned' END,
	"completed_at" = CASE WHEN "completed" THEN "created_at" ELSE NULL END;--> statement-breakpoint
UPDATE "workout"
SET "session_status" = 'finished',
	"started_at" = "created_at",
	"finished_at" = "created_at",
	"duration_seconds" = 0;
