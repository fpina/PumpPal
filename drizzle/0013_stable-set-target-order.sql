WITH "ranked_targets" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "workout_exercise_id"
			ORDER BY "set_number" ASC, "id" ASC
		)::integer AS "normalized_number"
	FROM "set"
)
UPDATE "set"
SET "set_number" = "ranked_targets"."normalized_number"
FROM "ranked_targets"
WHERE "set"."id" = "ranked_targets"."id";--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_target_number_unique" UNIQUE("workout_exercise_id","set_number") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_target_number_positive_check" CHECK ("set"."set_number" > 0);--> statement-breakpoint
CREATE FUNCTION "validate_set_target_number"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	"parent_id" integer;
	"parent_ids" integer[];
BEGIN
	IF TG_OP = 'DELETE' THEN
		"parent_ids" := ARRAY[OLD."workout_exercise_id"];
	ELSIF TG_OP = 'UPDATE' AND OLD."workout_exercise_id" IS DISTINCT FROM NEW."workout_exercise_id" THEN
		"parent_ids" := ARRAY[OLD."workout_exercise_id", NEW."workout_exercise_id"];
	ELSE
		"parent_ids" := ARRAY[NEW."workout_exercise_id"];
	END IF;

	FOREACH "parent_id" IN ARRAY "parent_ids" LOOP
		IF EXISTS (
			SELECT 1
			FROM "set"
			WHERE "workout_exercise_id" = "parent_id"
			HAVING min("set_number") <> 1 OR max("set_number") <> count(*)
		) THEN
			RAISE EXCEPTION 'Set Target numbers must be contiguous for Prescription Exercise %', "parent_id"
				USING ERRCODE = '23514', CONSTRAINT = 'set_target_number_contiguous';
		END IF;
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "set_target_number_contiguous"
AFTER INSERT OR UPDATE OR DELETE ON "set"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_set_target_number"();
