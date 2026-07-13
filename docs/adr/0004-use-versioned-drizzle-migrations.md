# Use versioned Drizzle migrations for schema delivery

PumpPal applies the committed `drizzle/` migration history through `npm run db:migrate` in local development, CI, and deployments. Schema push is intentionally excluded because migration history is reviewable, reproducible from an empty database, and preserves an auditable upgrade path.
