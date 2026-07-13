# Testing PumpPal

PumpPal's database-backed tests never use the development database directly. The harness derives dedicated databases from `DATABASE_URL`, recreates and migrates them before each test project, and drops them after the project completes.

## Test seams

- Unit tests cover in-process behavior without PostgreSQL.
- Integration tests call workout domain interfaces against `local_test_integration` and reset all application data before each test.
- Playwright tests use `local_test_e2e`; the shared Athlete fixture owns registration, login, unique credentials, and cascade cleanup.
- Browser journeys cover route wiring, accessibility, and Athlete behavior. Transaction, lifecycle, ownership, repetition, and ordering rules belong primarily at the domain interface.

Run all checks with:

```sh
npm run check
npm run test
```

The source database name changes with the configured `DATABASE_URL`; the names above show the default local configuration. The harness refuses to reset or drop any database whose name does not contain `_test_`.

## Isolation and parallel execution

Vitest runs files serially because integration fixtures reset one shared database; the fixture also takes a PostgreSQL advisory lock while it owns that database. Playwright Athletes receive UUID-backed emails and are deleted after each test, with related authentication and workout data removed by database cascades.

Separate test processes or CI shards must set a distinct `PUMPPAL_TEST_RUN_ID`. For example, `PUMPPAL_TEST_RUN_ID=shard_2` derives `local_test_integration_shard_2` and `local_test_e2e_shard_2`. This provides one isolated database pair per process; Playwright workers can then be increased after the journeys assigned to that shard have been checked for shared non-Athlete fixtures.
