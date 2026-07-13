# Operations

## Schema delivery

`drizzle/` is PumpPal's authoritative schema history. Change the Drizzle schema, generate and commit a versioned migration, then apply it with `npm run db:migrate`. The same command is used locally, in CI, and before deployment; schema push is not part of this workflow.

A local database created by the retired schema-push workflow must be recreated before adopting migrations because it has no migration ledger. Do not try to mix unmanaged schema state with the versioned history.

## Operational failures

Route adapters classify PostgreSQL SQLSTATE, `postgres` connection, and Node socket errors as operational failures. Expected `WorkoutDomainError` and known Better Auth credential/email-conflict responses retain their 4xx outcomes; every other service failure writes a structured error event with its operation name and returns a generic internal failure to the Athlete.

## Local database

`docker compose up` starts PostgreSQL 16.4 on port 5433. Test harnesses derive and remove `_test_` databases; they never reset the configured development database.
