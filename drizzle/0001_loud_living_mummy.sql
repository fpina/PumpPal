ALTER TABLE "workout" ADD COLUMN "repeat_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_repeat_token_unique" ON "workout" USING btree ("repeat_token");