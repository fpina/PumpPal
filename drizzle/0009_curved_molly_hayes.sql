UPDATE "set" SET "weight_unit" = 'kg' WHERE "weight_unit" IS NULL;--> statement-breakpoint
ALTER TABLE "set" ALTER COLUMN "weight_unit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "set" ALTER COLUMN "completed" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_reps_nonnegative_check" CHECK ("set"."reps" >= 0);--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_weight_nonnegative_check" CHECK ("set"."weight" is null or "set"."weight" >= 0);--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_actual_reps_nonnegative_check" CHECK ("set"."actual_reps" is null or "set"."actual_reps" >= 0);--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_actual_weight_nonnegative_check" CHECK ("set"."actual_weight" is null or "set"."actual_weight" >= 0);--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_rest_time_nonnegative_check" CHECK ("set"."rest_time_seconds" is null or "set"."rest_time_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_weight_unit_check" CHECK ("set"."weight_unit" in ('kg', 'lb'));--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_actual_weight_unit_check" CHECK ("set"."actual_weight_unit" is null or "set"."actual_weight_unit" in ('kg', 'lb'));
