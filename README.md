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
- **UI Components:** Storybook
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
5.  **Apply database schema:**
    ```bash
    npm run db:push
    ```
    _(Run this after any changes to `src/lib/server/db/schema.ts`)_
6.  **Run the development server:**
    ```bash
    npm run dev -- --open
    ```
    The app will be available at `http://localhost:5173` (or the next available port).

## Key Features

- Email/password registration, login, sessions, and logout
- User-owned workout logging
- Reusable exercise library and custom exercises
- Sets, reps, weight, rest time, and completion tracking

Performance visualization and intelligent workout suggestions remain future work.

## Project Structure

- `src/lib/server/db/`: Drizzle ORM setup (schema, database connection).
- `src/routes/`: SvelteKit routes defining the application pages and API endpoints.
- `src/lib/components/`: Reusable Svelte components (if needed).
- `src/stories/`: Storybook stories for UI components.
- `drizzle/`: Drizzle Kit migration files (if using `db:migrate`).

## Contributing

_(Details to be added later)_
