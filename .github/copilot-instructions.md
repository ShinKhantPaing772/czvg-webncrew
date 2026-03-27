# Copilot Instructions for webncrew

## 1) Big-picture architecture

- Next.js (App Router) with `src/app` folder.
- Public routes under `/` and crew routes under `/crew`; `/crew` uses `src/app/crew/layout.tsx` + `AuthGuard`.
- API endpoints under `src/app/api/*`, all server `route.ts` handlers.
- Database via Sequelize MySQL in `src/lib/database.ts`, models in `src/lib/models/index.ts` (Pilot, Token, Pirep, Route, etc.).
- Auth: login/signup in `src/app/api/auth/route.ts`, token verification in `src/app/api/auth/verify/route.ts`.
- Client auth state in `src/lib/utils/auth.ts` (localStorage key `auth_token`).

## 2) Critical flows and patterns

- `AuthGuard` (client) checks `/api/auth/verify` and redirects between `/crew`, `/crew/home`, and `/crew/admin/*`.
- Permission-based admin branches: `permissions` from `models.Permission`, keys like `admin`, `home`, `routes`, `aircrafts`.
- Common API response style: `NextResponse.json({ ... }, { status: N })`, with `try/catch` and stratified messages.
- DB token lifecycle: create in login, cleanup expired tokens in verify endpoint, `isRevoked` field.
- `posts`/`gets` in API use `models.<Entity>`; strategy is to keep queries in handler functions (`handleLogin`, `handleSignup`).

## 3) Developer workflows

- `pnpm dev` or `npm run dev` to run site locally.
- `npm run build` for production build; `npm run start` to run.
- `npm run lint` for lint (Next.js ESLint config).
- No test script present; use manual API checks and `next dev` logs.
- Database config via env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, optionally `DISCORD_WEBHOOK_ADMIN`.

## 4) Project conventions (vs generic)

- `use client` at top of client components (e.g., `AuthGuard`, crew layout); server components are default.
- `public` UI provided with `src/components/ui/*` (shadcn/radix component wrappers). Use these directly for forms, tables and dialogs.
- Strict Sequelize declarations; new Model fields should be added to `src/lib/models/index.ts` and used via `models.<Name>`; avoids direct `sequelize.define` elsewhere.
- Priority on robust error logging in backend; preserve existing `console.error` style.

## 5) Integration points

- MySQL / Sequelize (use `mysql2` dialect module).
- JWT token generation in auth routes (`jsonwebtoken`).
- Discord webhook post on signup (`DISCORD_WEBHOOK_ADMIN`).
- Admin dashboard aggregate stats uses raw SQL query via `sequelize.query` (see `src/app/api/admin/dashboard/route.ts`).

## 6) UI and theming patterns

- Theme provider setup in `src/components/theme-provider.tsx` wraps the app (check `src/app/layout.tsx`).
- Tailwind CSS configured in `tailwind.config.ts`; custom colors and utilities defined there.
- Use CSS variables (e.g., `--primary`, `--secondary`) in Tailwind for consistent theming across light/dark modes.
- shadcn/radix components from `src/components/ui/*` inherit theme automatically; apply custom Tailwind classes for spacing, sizing, and layout.
- Dark mode toggle (if present) stored in localStorage; sync with `ThemeProvider` context to persist user preference.
