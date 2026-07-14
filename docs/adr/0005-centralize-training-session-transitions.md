# Centralize Training Session transitions

PumpPal owns Training Session lifecycle, Set Target state, timing, rest deadlines, transaction boundaries, and row locks in one server module. SvelteKit adapters submit commands and translate typed outcomes; they do not reconstruct transition rules. Detail and live views receive stable capabilities from the module instead of inferring available actions from persistence fields.

## Training Session transitions

| Current state | Command | Result                  | Meaning                                                                                                           |
| ------------- | ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `planned`     | start   | `active` / `started`    | Records the first Session Instant and opens one Training Segment.                                                 |
| `active`      | start   | `active` / `resumed`    | Idempotently resumes the existing session without opening another segment.                                        |
| `active`      | finish  | `finished` / `finished` | Closes the open segment, accumulates Elapsed Duration, clears rest, and returns any active Set Target to planned. |
| `finished`    | reopen  | `active` / `reopened`   | Opens a new Training Segment while preserving first finish, prior segments, and Set Results.                      |

Every other state/command pair returns `invalid_transition`. A command against a Training Session or Set Target that is not owned by the Athlete returns `not_found`.

## Set Target transitions

Set Target commands and Set Result recording are legal only while their Training Session is active.

| Current state | Activate Set Target | Record Set Result             | Skip Set Target |
| ------------- | ------------------- | ----------------------------- | --------------- |
| `planned`     | `active`            | invalid                       | `skipped`       |
| `active`      | idempotent `active` | `completed` with a Set Result | `skipped`       |
| `skipped`     | `active`            | invalid                       | invalid         |
| `completed`   | invalid             | invalid                       | invalid         |

Activating one Set Target returns any other active target in the same Training Session to planned. Completing a target preserves its prescription, records its Set Result and completion Session Instant, and derives the persisted rest deadline. Rest dismissal is an idempotent command available only to an active Training Session.

## Persistence and concurrency

Commands lock the Athlete-owned Training Session row before checking and applying transitions, so concurrent requests serialize against one lifecycle state. PostgreSQL also enforces a partial unique index allowing at most one open Training Segment per Training Session. Missing open-segment state during finish is treated as an operational invariant failure rather than a domain rejection.

We rejected route-owned state checks because they race with mutations and duplicate domain meaning. We also rejected silently correcting completed Set Results during reopen; reopening remains the append-only continuation defined in ADR 0001.
