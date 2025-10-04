# Repository Guidelines

## Project Structure & Module Organization
- Core server logic lives in `server/app.js`; extendable modules belong in `server/routes`, `server/services`, and `server/db` for query helpers.
- Static client assets are served from `public/` (`public/app.js`, `public/admin.js`, `styles.css`, and icons); keep new UI scripts within `public/js/`.
- Shared configuration is read from `config/app.json`; mirror any new keys in both the config file and the server bootstrap.
- Deployment metadata (`Procfile`) and environment examples should stay at repo root for Heroku-style hosting.

## Build, Test, and Development Commands
- `npm install` resolves backend and frontend dependencies; rerun after editing `package.json`.
- `npm run dev` starts the Express server with Nodemon for auto-reloads—use it during local development.
- `npm start` runs the production server entry once; match this command in deployment manifests.
- `node server/app.js` is the minimal command used by the `Procfile` and favoured for container builds.

## Coding Style & Naming Conventions
- Use 4-space indentation in Node files and match the existing semicolon-terminated style across server and browser scripts.
- Prefer `const`/`let`, camelCase variables, and kebab-case filenames (`event-card.js`, `event-styles.css`).
- Keep request handlers lean: delegate cross-cutting concerns to helpers under `server/services/` and broadcast utilities respecting the existing WebSocket pattern.
- Run a linter or formatter (e.g., `npx eslint server/**/*.js`) before committing when available, even though it is not yet wired into scripts.

## Testing Guidelines
- The current project ships without automated tests; add Jest or Vitest suites under `server/__tests__/` or `public/__tests__/`.
- Cover database interactions with integration tests that stub PostgreSQL via `pg` Pool mocks, and hit HTTP routes with `supertest`.
- Name specs after the module under test (`app.routes.test.js`) and ensure `npm test` exits with code 0 once suites are present.

## Commit & Pull Request Guidelines
- Follow the existing history: a concise, sentence-case summary in the imperative mood (e.g., `Add WebSocket support for real-time attendance updates`).
- Reference related issues in the body, enumerate behavioural changes, and include screenshots or curl examples when updating UI or APIs.
- Before opening a PR, confirm schema migrations in `server/app.js` still run idempotently and document any config changes in `README.md` and `config/app.json`.

## Configuration & Environment
- Provide a `.env` with `DATABASE_URL`, `STRIPE_SECRET_KEY`, and `PORT`; never commit secrets.
- Toggle behaviour through `NODE_ENV` (production enables SSL on PostgreSQL) and keep `config/app.json` calendar definitions in sync with Google Calendar endpoints.
