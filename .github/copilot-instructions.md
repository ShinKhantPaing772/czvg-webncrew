# Copilot Instructions for webncrew

## 1) Big-picture architecture

- Next.js 15 (App Router) and React 19 with the `src/app` folder.
- Public routes under `/` and crew routes under `/crew`; `/crew` uses `src/app/crew/layout.tsx` + `AuthGuard`.
- API endpoints under `src/app/api/*`, all server `route.ts` handlers.
- Database via Sequelize MySQL in `src/lib/database.ts`, models in `src/lib/models/index.ts` (Pilot, Token, Pirep, Route, etc.).
- Auth: login/signup in `src/app/api/auth/route.ts`, token verification in `src/app/api/auth/verify/route.ts`.
- Client auth state in `src/lib/utils/auth.ts` (localStorage key `auth_token`).

## 2) Critical flows and patterns

- `AuthGuard` (client) checks `/api/auth/verify` and redirects between `/crew`, `/crew/home`, and `/crew/admin/*`.
- Permission-based admin branches: `permissions` from `models.Permission`, keys like `admin`, `home`, `routes`, `aircrafts`.
- Common API response style: `NextResponse.json({ ... }, { status: N })`, with `try/catch` and stratified messages.
- DB token lifecycle: created at login and signup, deleted at logout, all of a pilot's tokens deleted on password reset; the verify endpoint purges expired tokens at most hourly.
- `posts`/`gets` in API use `models.<Entity>`; strategy is to keep queries in handler functions (`handleLogin`, `handleSignup`).

## 3) Developer workflows

- Use pnpm. Vercel installs with `pnpm install --frozen-lockfile`, so keep `pnpm-lock.yaml` in sync with `package.json`.
- `pnpm dev` runs the site locally; `pnpm build` and `pnpm start` for production.
- `pnpm lint` runs ESLint (flat config in `eslint.config.mjs`).
- `pnpm test` runs Vitest. Tests sit next to the code as `*.test.ts(x)` and mock the database; the MySQL integration suites skip unless `SCHEDULING_TEST_DATABASE_URL` is set.
- Environment variables are listed in `README.md`.

## 4) Project conventions (vs generic)

- `use client` at top of client components (e.g., `AuthGuard`, crew layout); server components are default.
- `public` UI provided with `src/components/ui/*` (shadcn/radix component wrappers). Use these directly for forms, tables and dialogs.
- Strict Sequelize declarations; new Model fields should be added to `src/lib/models/index.ts` and used via `models.<Name>`; avoids direct `sequelize.define` elsewhere.
- Priority on robust error logging in backend; preserve existing `console.error` style.

## 5) Integration points

- MySQL / Sequelize (use `mysql2` dialect module).
- JWT token generation in auth routes (`jsonwebtoken`).
- Discord webhooks for new applications (`DISCORD_WEBHOOK_ADMIN`) and PIREPs/awards (`DISCORD_WEBHOOK`).
- Work that must not fail a request (Discord posts, emails, award checks) runs after the response with `after()` from `next/server`.
- Public endpoints that spend the Infinite Flight API budget are rate-limited with database counters (`incrementCounter` in `src/lib/utils/if-cache.ts`). Infinite Flight data may only live in short-lived caches (see `.github/llms.txt`).
- Admin dashboard aggregate stats uses raw SQL query via `sequelize.query` (see `src/app/api/admin/dashboard/route.ts`).

## 6) UI and theming patterns

- Theme provider setup in `src/components/theme-provider.tsx` wraps the app (check `src/app/layout.tsx`).
- Tailwind CSS configured in `tailwind.config.ts`; custom colors and utilities defined there.
- Use CSS variables (e.g., `--primary`, `--secondary`) in Tailwind for consistent theming across light/dark modes.
- shadcn/radix components from `src/components/ui/*` inherit theme automatically; apply custom Tailwind classes for spacing, sizing, and layout.
- Dark mode toggle (if present) stored in localStorage; sync with `ThemeProvider` context to persist user preference.
