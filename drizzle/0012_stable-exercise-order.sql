WITH "ranked_exercises" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "workout_id"
			ORDER BY "order" ASC NULLS LAST, "id" ASC
		)::integer AS "normalized_order"
	FROM "workout_exercise"
)
UPDATE "workout_exercise"
SET "order" = "ranked_exercises"."normalized_order"
FROM "ranked_exercises"
WHERE "workout_exercise"."id" = "ranked_exercises"."id";--> statement-breakpoint
ALTER TABLE "workout_exercise" ALTER COLUMN "order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_order_unique" UNIQUE("workout_id","order") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_order_positive_check" CHECK ("workout_exercise"."order" > 0);--> statement-breakpoint
CREATE FUNCTION "validate_workout_exercise_order"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	"parent_id" integer;
	"parent_ids" integer[];
BEGIN
	IF TG_OP = 'DELETE' THEN
		"parent_ids" := ARRAY[OLD."workout_id"];
	ELSIF TG_OP = 'UPDATE' AND OLD."workout_id" IS DISTINCT FROM NEW."workout_id" THEN
		"parent_ids" := ARRAY[OLD."workout_id", NEW."workout_id"];
	ELSE
		"parent_ids" := ARRAY[NEW."workout_id"];
	END IF;

	FOREACH "parent_id" IN ARRAY "parent_ids" LOOP
		IF EXISTS (
			SELECT 1
			FROM "workout_exercise"
			WHERE "workout_id" = "parent_id"
			HAVING min("order") <> 1 OR max("order") <> count(*)
		) THEN
			RAISE EXCEPTION 'Prescription Exercise order must be contiguous for Workout Prescription %', "parent_id"
				USING ERRCODE = '23514', CONSTRAINT = 'workout_exercise_order_contiguous';
		END IF;
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "workout_exercise_order_contiguous"
AFTER INSERT OR UPDATE OR DELETE ON "workout_exercise"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_workout_exercise_order"();
