ALTER TABLE "exercise" DROP CONSTRAINT "exercise_name_unique";--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "normalized_name" varchar(255);--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "exercise"
SET "name" = regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'),
	"normalized_name" = lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'));--> statement-breakpoint
WITH "ranked_exercises" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY coalesce("owner_id", '__catalog__'), "normalized_name"
			ORDER BY "id"
		) AS "duplicate_number"
	FROM "exercise"
)
UPDATE "exercise" AS "exercise_to_disambiguate"
SET "name" = left("exercise_to_disambiguate"."name", 225) || ' [legacy ' || "exercise_to_disambiguate"."id" || ']',
	"normalized_name" = lower(left("exercise_to_disambiguate"."name", 225) || ' [legacy ' || "exercise_to_disambiguate"."id" || ']')
FROM "ranked_exercises"
WHERE "exercise_to_disambiguate"."id" = "ranked_exercises"."id"
	AND "ranked_exercises"."duplicate_number" > 1;--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "normalized_name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_catalog_normalized_name_unique" ON "exercise" USING btree ("normalized_name") WHERE "exercise"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_owner_normalized_name_unique" ON "exercise" USING btree ("owner_id","normalized_name") WHERE "exercise"."owner_id" is not null;
