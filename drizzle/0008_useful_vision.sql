ALTER TABLE "set" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone USING "completed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "training_segment" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "training_segment" ALTER COLUMN "finished_at" SET DATA TYPE timestamp with time zone USING "finished_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "workout" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "workout" ALTER COLUMN "active_started_at" SET DATA TYPE timestamp with time zone USING "active_started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "workout" ALTER COLUMN "finished_at" SET DATA TYPE timestamp with time zone USING "finished_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "workout" ALTER COLUMN "rest_ends_at" SET DATA TYPE timestamp with time zone USING "rest_ends_at" AT TIME ZONE 'UTC';
