# Production Readiness Roadmap

Audit of `rbac-system` (Node/Express/Prisma backend + Vite/React frontend)
as of this commit. Ordered by priority.

## P0 — Would break a real deployment

1. **`prisma generate` never runs on a fresh install.** `backend/package.json`
   has no `postinstall` hook, so a clean `npm install` on a deploy host
   leaves `@prisma/client` ungenerated and the build fails. Fix: add
   `"postinstall": "prisma generate"`.
2. **No migration step in the deploy flow.** `prisma migrate dev` is a dev-only
   command (it prompts / can reset). Production needs `prisma migrate deploy`
   run once against the target database as a release step.
3. **CORS is wide open** (`cors()` with no options) and the **JWT secret has a
   hardcoded fallback** (`"change-me-in-production"`) — fine for a local demo,
   unsafe if actually deployed. Fix: restrict CORS to the known frontend
   origin, and fail fast at boot if `JWT_SECRET` is unset in production.
4. **Frontend hardcodes relative API paths** (`fetch("/auth/login")`, etc.)
   and relies on the Vite dev proxy. That breaks the moment frontend and
   backend are deployed as separate services (the normal free-tier shape:
   static frontend on Vercel, API on Render/Railway). Needs a configurable
   `VITE_API_BASE_URL`.
5. **No graceful shutdown.** Prisma's connection pool is never closed on
   `SIGTERM`, which most container platforms send before killing the
   process — can leak connections / cause noisy restarts.

## P1 — Missing for basic production hygiene

6. **No tests at all**, despite the goal's "run the test command" step. Add
   a minimal but real test layer (permission-tree resolution + the auth/guard
   behavior already manually verified in this session) so CI has something
   to check.
7. **No centralized error handling middleware.** Route handlers each
   try/catch ad hoc; an uncaught throw currently returns Express's default
   HTML error page instead of JSON.
8. **No input validation on request bodies.** `zod` is already a dependency
   but unused — routes trust `req.body` shape blindly (e.g. `create_user`
   tool / `/admin/users` POST).
9. **No request logging.** Nothing to debug a deployed instance with beyond
   `console.log` in a couple of places.
10. **Frontend has no loading/error states beyond the chat box** — the login
    form does have basic states, but there's no top-level error boundary, and
    a failed `/chat/session` call on mount fails silently into a disabled
    input with no visible message.

## P2 — Real gaps, acceptable to defer for a demo

11. No refresh tokens (JWT just expires after 8h, forcing re-login).
12. No pagination on `list_users` / `list_modules` / `list_permission_groups`.
13. No audit log of who changed what permission/group/user.
14. No rate limiting on `/auth/login` (brute-force exposure) or `/chat/message`
    (LLM cost/abuse exposure).
15. No soft deletes — everything is a hard delete via cascade.
16. Password policy is unenforced (any string accepted).

## Deployment shape (free tier)

- **Frontend** (`frontend/`): static Vite build → **Vercel** (`vercel --prod`),
  configured with `VITE_API_BASE_URL` pointing at the deployed backend.
- **Backend** (`backend/`): Express + Prisma, needs a running Postgres and a
  persistent process (not a serverless function, since it holds an LLM
  tool-calling loop and a Prisma connection pool) → **Render** free web
  service + Render free Postgres, deployed from the GitHub repo (Render's
  CLI deploy path needs a `render.yaml` blueprint since Render doesn't have
  a plain `render deploy` one-shot CLI command the way Vercel/Railway do).
- Both are chosen because they have a genuinely free tier that doesn't
  require a credit card for this workload; Railway's free tier is
  trial-credit-based (expires), so Render is the safer "free" default for
  the backend + Postgres.
- **Blocker for this session:** none of Vercel/Render/Railway CLIs are
  authenticated in this sandbox (no `VERCEL_TOKEN` / `RENDER_API_KEY` /
  `RAILWAY_TOKEN` in the environment), so actually creating and deploying to
  those accounts requires either a token from the account owner or an
  interactive login only the user can complete.

## This session's plan

Fix P0 items 1–5 and the highest-value P1 items (6, 7, 8, 10) now, verify
`npm run build` passes for both packages, add a minimal test suite and run
it, then request the one thing needed to actually execute phase 4: a
deploy token (or the user completing an interactive `vercel login` /
Render dashboard connection).
