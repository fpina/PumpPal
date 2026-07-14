# Workout Prescription ordering query plans

Recorded on 2026-07-14 against the isolated PostgreSQL integration database after seeding:

- 20,000 Workout Prescriptions for one Athlete;
- 4,000 Prescription Exercises (20 for each of 200 prescriptions);
- 20,000 Set Targets (5 for each Prescription Exercise).

The baseline plans were captured after removing the four indexes introduced or guaranteed by migrations 0012–0014. The post-migration plans were captured after recreating them and running `ANALYZE`. Each statement used `EXPLAIN (ANALYZE, BUFFERS)`.

| Query                                                       | Before                                         | After                                                                   | Execution time      |
| ----------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- | ------------------- |
| Athlete Workout Prescription list, newest 50                | Sequential scan of 20,000 rows plus top-N sort | `workout_user_date_id_idx` index scan, already in requested order       | 2.134 ms → 0.061 ms |
| Ordered Prescription Exercises for one Workout Prescription | Sequential scan; 3,980 rows discarded          | Bitmap index scan on `workout_exercise_order_unique`; 20 heap rows read | 0.141 ms → 0.040 ms |
| Ordered Set Targets for one Prescription Exercise           | Sequential scan; 19,995 rows discarded         | Bitmap index scan on `set_target_number_unique`; 5 heap rows read       | 0.649 ms → 0.026 ms |
| Active Set Targets for one Prescription Exercise            | Sequential scan of 20,000 rows                 | `set_workout_exercise_status_idx` index scan                            | 0.885 ms → 0.019 ms |

PostgreSQL chose a small in-memory sort after each bitmap scan in the two nested ordering queries. This is appropriate at 20 and 5 matching rows: the composite indexes eliminate the table scan, while sorting the tiny result is cheaper than forcing an ordered index scan. The indexes can also satisfy an ordered index scan when cardinality and cost estimates make that preferable.

Representative post-migration plan nodes:

```text
Limit
  -> Index Scan using workout_user_date_id_idx on workout
       Index Cond: (user_id = 'plan-athlete')

Bitmap Heap Scan on workout_exercise
  Recheck Cond: (workout_id = 100)
  -> Bitmap Index Scan on workout_exercise_order_unique
       Index Cond: (workout_id = 100)

Bitmap Heap Scan on set
  Recheck Cond: (workout_exercise_id = 100)
  -> Bitmap Index Scan on set_target_number_unique
       Index Cond: (workout_exercise_id = 100)

Index Scan using set_workout_exercise_status_idx on set
  Index Cond: ((workout_exercise_id = 100) AND (status = 'active'))
```

The timing values are local diagnostic evidence, not performance thresholds. Tests assert ordering behavior and invariants rather than planner choices, which can legitimately change between PostgreSQL versions and data distributions.
