# Domain-driven architecture transition plan

**Status:** Draft  
**Date:** 2026-07-14  
**Scope:** PumpPal's single Training bounded context

## Purpose

Evolve PumpPal from a domain-oriented modular monolith into a domain-driven modular monolith whose business behavior is expressed by explicit aggregates and value objects, orchestrated by application commands, and persisted by PostgreSQL adapters. Preserve current Athlete journeys and historical data throughout the transition.

The goal is not to adopt every tactical DDD pattern. The goal is to make the domain model the source of truth for Workout Prescription and Training Session behavior while retaining the leverage of the existing deep module interfaces.

## Desired outcome

At the end of this transition:

- PumpPal remains one deployable SvelteKit application and one Training bounded context.
- Workout Prescription, Training Session, and Exercise Catalog behavior uses the language in [`CONTEXT.md`](../CONTEXT.md).
- Pure domain code owns lifecycle decisions and invariants without importing SvelteKit, Drizzle, PostgreSQL, Better Auth, or the system clock.
- Application commands coordinate authentication-derived Athlete identity, aggregate loading, transactions, time, persistence, and typed outcomes.
- PostgreSQL adapters map aggregate state to storage, acquire the required locks, and reinforce invariants with constraints and indexes.
- SvelteKit routes remain transport adapters that parse, validate, invoke one application command or query, and translate its result.
- Commands load and modify aggregates; reads use purpose-built projections and do not hydrate aggregates unnecessarily.
- Tests are divided between pure domain behavior, application orchestration, PostgreSQL adapter contracts, route wiring, and browser journeys.

## Non-goals

This transition does not require:

- microservices or multiple deployments;
- event sourcing;
- a message broker;
- a generic repository abstraction;
- wrapping every primitive in a class;
- replacing PostgreSQL integration tests with mocks;
- renaming public URLs solely to match internal terminology;
- creating multiple bounded contexts before the language or organization requires them.

Domain events, an outbox, and additional bounded contexts should be introduced only when a real consumer or independent consistency boundary appears.

## Current and pending baseline

PumpPal already has several DDD foundations, with PR #26 completing the Workout Builder portion of this baseline:

- a ubiquitous language in [`CONTEXT.md`](../CONTEXT.md);
- separate Workout Builder and Training Session module interfaces;
- typed command and transition outcomes;
- explicit lifecycle, ownership, editability, and concurrency rules;
- separate Set Target and Set Result values;
- versioned schema migrations and direct PostgreSQL integration tests;
- architectural decisions recorded in [`docs/adr/`](adr/).

The remaining gaps are structural:

- `workout` still combines Workout Prescription identity with Training Session lifecycle and timing;
- `set` still combines Set Target data, session-local state, and Set Result data;
- domain decisions are implemented inside Drizzle transaction functions rather than domain aggregates;
- the domain modules construct or import infrastructure dependencies directly;
- application orchestration, authorization, domain decisions, and persistence are not consistently separated;
- raw strings and numbers still carry several rules that belong to value objects;
- persistence names such as `user`, `workout`, `workout_exercise`, and `set` retain the legacy model;
- most behavioral verification requires a database even when the rule itself is pure.

## Roadmap relationship

This plan begins after the current architecture foundation is stable:

1. Merge PR #26 for issue #17, which establishes the Workout Builder command seam and Builder Command Outcomes.
2. Complete issue #18 before restructuring aggregate persistence. Its ordering constraints, indexes, and concurrency tests should become guarantees of the future PostgreSQL adapters rather than being reimplemented during the migration.
3. Issue #19 may proceed independently if extracted UI modules consume stable capabilities and read models instead of persistence fields.

## Strategic model

### Bounded context

Retain one **Training** bounded context. PumpPal does not currently have competing language, independent teams, or consistency requirements that justify splitting it further.

Within that context:

- **Core domain:** prescribing training, performing it, and preserving the distinction between intended and performed work.
- **Supporting subdomain:** the Exercise Catalog and Athlete-owned Custom Exercises.
- **Generic subdomain:** identity and access management, provided by Better Auth.

PostgreSQL persistence, logging, and HTTP transport are technical infrastructure rather than subdomains.

Better Auth is an upstream identity system. The route adapter translates its authenticated `user.id` into the domain concept of Athlete identity; Better Auth's User model does not become a Training aggregate. Keep this as a value conversion at the transport edge unless translation behavior becomes substantial enough to justify its own module.

### Aggregate boundaries

#### Workout Prescription aggregate

The Workout Prescription aggregate owns:

- Workout Date, name, and notes;
- ordered Prescription Exercises;
- exercise-specific notes;
- ordered Set Targets;
- editability;
- repetition source identity and repetition rules.

Its invariants include:

- every Prescription Exercise and Set Target belongs to exactly one Workout Prescription;
- exercise and Set Target ordering is deterministic, contiguous, and unique within its parent;
- only an Exercise visible to the Athlete may be selected;
- repetition copies prescription facts and Set Targets, never Set Results;
- deleting or rewriting a prescription cannot destroy historical Training Session facts;
- a compatible repetition-token retry is idempotent and incompatible reuse is a conflict.

#### Training Session aggregate

The Training Session aggregate owns:

- its lifecycle state;
- the session-local state associated with each Set Target;
- Set Results;
- Training Segments;
- Session Instants and Elapsed Duration;
- rest deadlines;
- start, finish, reopen, activation, skipping, and result-recording transitions.

Its invariants include:

- legal transitions match ADR 0005;
- at most one Training Segment is open;
- at most one Set Target is active;
- a Set Result can be recorded only for an active Set Target in an active Training Session;
- completed Set Results remain historical facts and cannot be silently rewritten;
- reopening appends a Training Segment and preserves earlier timing and results;
- finishing closes the open segment and leaves no active Set Target or rest deadline.

#### Exercise Catalog module

The Exercise Catalog module owns:

- visibility of Catalog Exercises and Custom Exercises;
- Custom Exercise ownership;
- display-name normalization;
- normalized-name uniqueness policies;
- selection eligibility for a Workout Prescription.

An Exercise is referenced by a Workout Prescription but is not part of that aggregate. Exercise creation and prescription selection may be coordinated in one application transaction without pretending the two concepts are one aggregate.

### Aggregate relationship

Preserve the current product behavior of one Workout Prescription having at most one planned or performed Training Session during the initial transition. Repetition continues to create a new Workout Prescription rather than adding another Training Session to the same prescription.

Changing this to many Training Sessions per Workout Prescription is a separate product and domain decision. The new persistence model should avoid an irreversible assumption where practical, but the first migration must not silently change repetition semantics.

### Value objects

Introduce value objects only where they centralize validation, normalization, or comparison:

- `WorkoutDate`;
- `ExerciseName`;
- `RepetitionToken`;
- `Reps`;
- `Load`, containing amount and unit;
- `RestDuration`;
- `SessionInstant`;
- `ElapsedDuration`;
- branded aggregate and entity IDs where they prevent ID mix-ups.

Value-object constructors return typed validation results or create only valid values. Routes may still accept strings and numbers, but application commands translate them before invoking aggregate behavior.

## Decisions required before persistence changes

These decisions must be resolved through concrete scenarios before the schema split:

1. **Prescription freeze point.** Recommended: freeze a Workout Prescription when its Training Session first starts. This lets the session reference stable Set Targets without duplicating the entire prescription. If editing after start must remain legal, snapshot or version the prescription at start instead.
2. **Session cardinality.** Preserve zero-or-one Training Session per Workout Prescription for this transition. Any move to multiple performances needs its own decision and migration.
3. **Session-local Set Target state.** Choose a domain term for the planned/active/skipped/completed state of a Set Target inside one Training Session. Do not add a provisional term to `CONTEXT.md` until scenarios distinguish it clearly from Set Target and Set Result.
4. **Deletion and retention.** Recommended: a Workout Prescription with a started Training Session cannot be physically deleted. A future archival capability should be explicit rather than cascade historical facts.
5. **Result correction.** Preserve the existing rule that completed Set Results cannot be edited. A correction or revision model is separate work.

Each decision should be tested against at least these scenarios:

- an Athlete starts a session and then tries to edit a Set Target;
- an Athlete repeats a completed prescription whose Set Result differs from its Set Target;
- a repeated prescription is retried with the same token but a different source or date;
- an Athlete reopens a finished session multiple times;
- two requests activate or complete different Set Targets concurrently;
- an Athlete tries to remove an Exercise or Set Target referenced by history;
- legacy data contains a Set Target with a Set Result, a skipped Set Target, and an open Training Segment.

Record an ADR only for decisions that are costly to reverse, surprising without context, and selected from genuine alternatives. Update `CONTEXT.md` immediately when a domain term is resolved.

## Target dependency direction

```text
SvelteKit routes and views
        |
        v
Application commands and queries
        |
        +------> Domain aggregates and value objects
        |
        +------> Aggregate-specific persistence seams
                         ^
                         |
                 Drizzle/PostgreSQL adapters
```

Dependencies point inward:

- domain code imports only domain code;
- application code imports domain code and narrow dependency interfaces;
- infrastructure code imports domain/application interfaces and Drizzle;
- route adapters import application interfaces and transport validation;
- domain and application modules never import generated SvelteKit route types.

Read queries may use Drizzle projections directly behind a query module. They must return domain-named read models rather than raw Drizzle rows.

## Proposed code shape

The exact filenames may evolve, but the dependency direction should be visible in the tree:

```text
src/lib/training/
  domain/
    workout-prescription.ts
    training-session.ts
    exercise-catalog.ts
    values/
  application/
    workout-builder.ts
    training-session-commands.ts
    queries.ts
    ports.ts
  infrastructure/
    postgres/
      workout-prescription-repository.ts
      training-session-repository.ts
      exercise-catalog-repository.ts
      queries.ts
      mappers.ts
src/routes/
```

Do not introduce a generic `Repository<T>` or one class per database table. Persistence interfaces should speak in aggregate operations such as loading one Athlete-owned Training Session for update and saving the resulting aggregate state.

## Command and outcome model

Separate three categories that are currently partially mixed:

1. **Domain decisions:** the aggregate exists and decides whether a transition is legal. Examples: `invalid_transition`, `prescription_frozen`, or `exercise_name_conflict`.
2. **Application outcomes:** orchestration results such as `not_found`, authorization-safe absence, idempotent retry, and the aggregate's domain decision.
3. **Operational failures:** broken persistence, missing locked state, failed constraints, and unavailable infrastructure. These throw, are logged once, and become generic transport errors.

`not_found` is normally an application outcome because an aggregate cannot decide that it was not loaded. HTTP status codes and form errors remain route-adapter concerns.

## Time, identity, and concurrency

- Aggregate methods receive required Session Instants as arguments; they do not call `new Date()`.
- Application commands obtain time from an injected clock.
- Route adapters translate the authenticated Better Auth identity to `AthleteId` once.
- Aggregate repositories load by Athlete ownership and aggregate ID so unauthorized and missing records remain indistinguishable to callers.
- State-sensitive commands load the aggregate inside one transaction and acquire a row lock or use an explicit version check.
- PostgreSQL constraints remain defense in depth; they do not replace aggregate decisions.
- Concurrency behavior must be observable through PostgreSQL integration tests, not inferred from pure tests.

## Persistence target

The target schema should represent distinct lifecycles. Names remain provisional until the domain decisions above are resolved:

- `workout_prescription`;
- `prescription_exercise`;
- `set_target`;
- `training_session`;
- a Training Session-owned association that stores each Set Target's session-local state;
- `set_result`;
- `training_segment`;
- `exercise` or explicitly separated catalog/custom exercise persistence if later justified.

A Set Result references the Training Session-owned Set Target association, not only the prescription's Set Target. This prevents session state and performance facts from leaking back into the prescription aggregate.

Preserve existing identifiers where doing so reduces route, foreign-key, and migration risk. New domain code must not rely on database sequences being the only possible identity generator.

## Phased implementation

### Phase 0: stabilize the current seams

**Work**

- Merge PR #26 and complete issue #18.
- Capture the current command/outcome and browser behavior as a compatibility matrix.
- Record representative production-shaped data fixtures for planned, active, finished, repeated, skipped, and reopened sessions.
- Keep issue #19 UI modules dependent on capabilities/read models rather than raw persistence statuses.

**Exit criteria**

- Workout Builder and Training Session interfaces are stable.
- Ordering and ownership query paths have database-backed invariants and indexes.
- The full unit, PostgreSQL integration, migration, and browser suites are green.

### Phase 1: resolve the domain decisions

**Work**

- Run scenario-based modeling for the five decisions listed above.
- Write aggregate responsibility and invariant tests as executable examples.
- Update the glossary for newly resolved terms.
- Record only the hard-to-reverse decisions as ADRs.

**Exit criteria**

- The freeze point, cardinality, deletion policy, and result-correction policy are explicit.
- Every lifecycle state belongs to one aggregate.
- Set Target, session-local state, and Set Result are unambiguous.

### Phase 2: introduce the pure domain kernel

**Work**

- Implement value objects and aggregate behavior without database imports.
- Start with Training Session because it has the richest invariant set.
- Model `start`, `finish`, `reopen`, activation, skipping, result recording, and rest dismissal as aggregate decisions.
- Make time explicit in method arguments.
- Return named domain decisions and collect domain events internally only when they have an immediate use.
- Replace duplicated pure lifecycle helpers with tests through the aggregate interface.

**Exit criteria**

- Pure tests cover every transition table row from ADR 0005.
- Domain tests need no SvelteKit setup or PostgreSQL connection.
- Domain code has no imports from `$lib/server`, Drizzle, SvelteKit, or Better Auth.

### Phase 3: migrate one Training Session tracer bullet

**Work**

- Introduce an application command handler, clock, transaction scope, and aggregate-specific Training Session repository interface.
- Implement the PostgreSQL adapter against the existing schema and a deterministic in-memory adapter for application orchestration tests. PostgreSQL integration tests remain responsible for lock and constraint behavior.
- Migrate one end-to-end command, preferably `recordSetResult`, because it crosses ownership, lifecycle, Set Target state, result preservation, time, rest, and persistence.
- Route the existing SvelteKit action through the new handler.
- Remove the old implementation for that command immediately; do not maintain two sources of transition truth.

**Exit criteria**

- The browser flow is unchanged.
- Pure tests verify the decision, application tests verify orchestration, and PostgreSQL tests verify locking and persistence.
- The application command interface does not expose Drizzle rows or transaction objects.

### Phase 4: complete Training Session migration

**Work**

- Migrate the remaining Training Session commands one vertical slice at a time.
- Move capability derivation onto the domain model or a domain read policy.
- Keep database locking and mapping inside the PostgreSQL adapter.
- Replace the old Training Session implementation and obsolete tests as each slice moves.

**Exit criteria**

- All Training Session mutations cross the application/domain seam.
- Routes contain transport concerns only.
- Deleting the domain module would redistribute lifecycle rules across handlers, adapters, and tests, demonstrating that the module is deep.

### Phase 5: migrate Workout Builder and Exercise Catalog behavior

**Work**

- Implement the Workout Prescription aggregate and its ordering/editability/repetition decisions.
- Move Custom Exercise normalization and visibility policies into the Exercise Catalog module.
- Add application commands for the existing Workout Builder discriminated commands.
- Implement the PostgreSQL adapters against the existing schema first.
- Preserve the public Workout Builder interface where it remains deep; refine only where the new model removes caller knowledge.
- Make cross-aggregate Custom Exercise creation plus prescription selection an application transaction.
- Keep repetition idempotency in the application/persistence coordination while the aggregate defines what prescription facts are copied.

**Exit criteria**

- Workout Builder contains no direct Drizzle queries.
- Prescription and Exercise Catalog invariants have pure tests.
- PostgreSQL adapter tests cover ownership, ordering, name conflicts, repetition retries, and concurrent commands.
- Training Session and Workout Builder mutations both cross application/domain seams before their shared legacy tables are replaced.
- The legacy `src/lib/server/services` implementations are removed rather than wrapped indefinitely.

### Phase 6: split persistence with expand-migrate-contract

**Expand**

- Add the new prescription, session, target, session-state, and result tables.
- Add foreign keys, uniqueness constraints, ordering constraints, ownership-path indexes, and the one-open-segment constraint.
- Keep legacy tables intact.

**Migrate**

- Backfill every legacy `workout` into a Workout Prescription and its zero-or-one Training Session.
- Backfill every legacy `workout_exercise` and `set` into Prescription Exercises and Set Targets.
- Backfill status into the Training Session-owned Set Target association.
- Backfill completed actuals into Set Results; planned and skipped targets receive none.
- Relink Training Segments while preserving their Session Instants and Elapsed Duration.
- Preserve repeat source identity and Workout Dates.
- Validate row counts, ownership, ordering, result cardinality, segment duration, and lifecycle consistency before switching reads.

**Contract**

- Switch the Workout Prescription, Training Session, and Exercise Catalog PostgreSQL adapters and read projections to the new schema together.
- Run shadow comparison queries or migration-verification scripts against production-shaped fixtures.
- Remove legacy writes immediately after the switch.
- Remove legacy tables and compatibility code only after one verified release or an explicitly agreed maintenance migration.

**Exit criteria**

- Workout Prescription data contains no Training Session lifecycle or Set Result fields.
- Training Session data cannot mutate Set Target prescription values.
- Migrations succeed from both an empty database and a representative pre-transition database.
- Rollback and restore procedures are documented and rehearsed.

### Phase 7: establish read models and enforce architecture

**Work**

- Define query modules for the home list, prescription detail, and live Training Session views.
- Return domain-named read models with stable capabilities instead of raw tables.
- Keep query projections independent from aggregate repositories.
- Add dependency checks preventing domain imports from infrastructure and transport packages.
- Update operations, testing, architecture diagrams, and ADR references.
- Remove transitional mappers, flags, compatibility columns, and superseded tests.

**Exit criteria**

- UI modules consume stable read models and capabilities.
- Domain and application dependency direction is enforced automatically.
- No route or view needs to understand database column names to decide available actions.
- The full suite, migration verification, concurrency tests, and representative query plans pass.

## Testing strategy

| Test level         | Purpose                                                               | Dependencies                                     |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------ |
| Domain             | Aggregate decisions, value objects, invariants, emitted facts         | Pure TypeScript                                  |
| Application        | Command orchestration, clock use, ownership-safe absence, idempotency | Deterministic clock and justified local adapters |
| PostgreSQL adapter | Mapping, transactions, locks, constraints, ordering, concurrency      | Real PostgreSQL                                  |
| Migration          | Empty install, legacy backfill, validation, repeatability             | Real PostgreSQL and legacy fixtures              |
| Route adapter      | Parsing and outcome-to-HTTP/form translation                          | SvelteKit test harness                           |
| Browser            | Stable Athlete journeys and accessible behavior                       | Built app and isolated PostgreSQL database       |

Follow the replace-not-layer rule: when behavior is covered through the new aggregate or module interface, remove tests that assert the obsolete implementation's private steps. Keep database tests for behavior that only PostgreSQL can prove.

## Delivery strategy

- Deliver tracer-bullet issues that leave the application releasable after each merge.
- Avoid a long-lived `v2` model or permanent dual writes.
- Preserve current application command interfaces until a vertical slice proves a better interface.
- Keep schema changes additive until backfill and verification succeed.
- Put feature flags around read/write switching only when deployment safety requires them; remove the flags during contract cleanup.
- Record before-and-after query plans and lock behavior for persistence-sensitive changes.
- Do not combine domain restructuring, UI redesign, and product behavior changes in one issue.

## Proposed issue sequence

Each issue should be independently reviewable and should include its own migration and test evidence where applicable:

1. Resolve Workout Prescription freeze, session cardinality, deletion, and session-local Set Target language.
2. Introduce Training Session aggregate and pure transition tests.
3. Migrate `recordSetResult` as the first application/domain tracer bullet.
4. Migrate remaining Training Session commands.
5. Introduce Workout Prescription aggregate and migrate Workout Builder commands.
6. Move Exercise Catalog policies behind the domain/application seam.
7. Add and backfill the separated aggregate schema.
8. Switch all aggregate persistence and queries to the new schema.
9. Add stable read models and Athlete identity translation.
10. Remove legacy schema and enforce dependency direction.

Create these issues only after Phase 1 resolves the domain decisions; otherwise their acceptance criteria would encode assumptions that the model has not settled.

## Risks and mitigations

| Risk                                                  | Mitigation                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Two sources of business truth during migration        | Move one vertical slice at a time and remove the old path immediately                               |
| Data loss during table separation                     | Expand-migrate-contract, legacy fixtures, count/invariant validation, backup and rollback rehearsal |
| Over-engineered repository layers                     | Use aggregate-specific interfaces only where production and test adapters justify a real seam       |
| Domain objects mirror database rows                   | Design behavior and invariants first; keep persistence mapping in adapters                          |
| Read performance regresses after aggregate separation | Dedicated projections, issue #18 indexes, recorded query plans                                      |
| Product behavior changes accidentally                 | Compatibility matrix and browser journeys gate every slice                                          |
| Prescription edits invalidate session history         | Resolve freeze-versus-snapshot policy before schema work                                            |
| Terminology drifts between model and UI               | Update `CONTEXT.md` when terms are resolved and review interfaces against it                        |
| Transitional code becomes permanent                   | Assign contract cleanup to the same workstream and define deletion exit criteria                    |

## Completion criteria

The transition is complete when:

- Workout Prescription and Training Session are separate aggregates in code and persistence;
- Set Targets, session-local state, and Set Results have distinct ownership and storage;
- aggregate behavior is pure and directly testable;
- application commands own orchestration but not domain decisions;
- PostgreSQL adapters own mapping, transactions, and locks but not lifecycle policy;
- routes and views use application outcomes, read models, and capabilities;
- authentication identity is translated into Athlete identity at one seam;
- legacy combined tables and implementations are removed;
- the glossary and ADRs describe the resulting model;
- all existing Athlete journeys remain supported unless a separately approved product decision changes them.
