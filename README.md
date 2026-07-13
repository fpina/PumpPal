# PumPal - Your All-in-One Fitness App

PumpPal is your all-in-one fitness app designed to help you plan, track, and crush your workouts. Whether you're lifting for strength, training for endurance, or just staying consistent, PumpPal makes it easy to stay on track and see real progress.

With intelligent workout suggestions tailored to your goals, a fast and intuitive training log, and detailed performance insights, PumpPal keeps your fitness journey organized and motivating. Track every rep, monitor your gains, and stay accountable with features built for lifters, by lifters.

## Technology Stack

- **Framework:** SvelteKit (^2.16.0)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database ORM:** Drizzle ORM
- **Database:** PostgreSQL (via Docker)
- **Authentication:** Better Auth (email and password)
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Linting/Formatting:** ESLint, Prettier

## Project Setup

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd PumPal
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    - Copy `.env.example` to `.env` (if it exists, otherwise create `.env`).
    - Fill in `DATABASE_URL`, `AUTH_SECRET`, and `BETTER_AUTH_URL`.
    - Generate `AUTH_SECRET` with `openssl rand -base64 32`.
4.  **Start the database (using Docker):**
    ```bash
    npm run db:start
    ```
    _(Ensure Docker Desktop is running)_
5.  **Apply database migrations:**

    ```bash
    npm run db:migrate
    ```

    PumpPal uses the committed `drizzle/` migration history as the only schema-delivery path. After changing `src/lib/server/db/schema.ts`, generate and commit a new migration with `npx drizzle-kit generate`; do not use schema push for local, CI, or deployment databases.

    If your local database was created by the retired schema-push workflow, recreate that local development database before its first migration run. It has no migration ledger, so replaying the initial schema against it is intentionally rejected.

6.  **Run the development server:**
    ```bash
    npm run dev -- --open
    ```
    The app will be available at `http://localhost:5173` (or the next available port).

## Key Features

- Email/password registration, login, sessions, and logout
- User-owned workout logging
- Shared Catalog Exercises and private Custom Exercises
- Sets, reps, weight, rest time, and completion tracking

Performance visualization and intelligent workout suggestions remain future work.

## Project Structure

- `src/lib/server/db/`: Drizzle ORM setup (schema, database connection).
- `src/routes/`: SvelteKit routes defining the application pages and API endpoints.
- `drizzle/`: Authoritative versioned Drizzle migrations.
- `tests/harness/`: Isolated PostgreSQL integration and browser-test harnesses.
- `.github/workflows/`: CI quality gates, including empty-database migration verification.

## Delivery and operations

Run `npm run db:migrate` against every environment before starting the application. CI starts from an empty PostgreSQL database, applies the same migration history, then runs typechecking, linting, unit/integration and browser tests, and a production build. See [testing documentation](docs/testing.md) for test database isolation.

## Contributing

_(Details to be added later)_
