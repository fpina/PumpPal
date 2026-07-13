# Domain documentation

PumpPal is a single-context repository.

## Before exploring

Read the following when they exist:

- `CONTEXT.md` at the repository root for the domain glossary.
- `docs/adr/` for architectural decisions relevant to the area being changed.

If either location does not exist, proceed without blocking. Domain-modeling workflows create them lazily when terminology or load-bearing decisions are resolved.

## Layout

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Consumer rules

- Use glossary terms exactly in issue titles, plans, tests, and implementation discussions.
- If a required term is missing, treat that as a domain-modeling question rather than silently inventing a synonym.
- Surface conflicts with existing ADRs explicitly instead of overriding them.
- Record only durable, load-bearing decisions as ADRs.
