# rbac-system

A dummy-but-functional RBAC (role-based access control) system with an AI
chat assistant that does the admin work for you — instead of manually
creating a module, a permission, a permission group, and a user one step at
a time, you describe what you want in plain language and the assistant
walks through the same steps via tool-calling, asking for anything it's
missing along the way.

It also has a governed, human-in-the-loop natural-language provisioning
pathway, an append-only audit log, role-explosion clustering, and
over-privilege detection - see `RBAC_VISION.md` for the full architecture
and how these fit together.

## How the RBAC model works

```
Application
  └─ Module (a page/menu/tab: key, name, moduleType, route)
       └─ Permission (read/add/modify/delete on that module)
            └─ optionally scoped to one MasterDataStorage record
                 (e.g. "read access to Program, but only for Anchor X")

PermissionGroup (a named bundle of Permissions)
  └─ User (a user can belong to multiple PermissionGroups)
       └─ also directly scoped to one or more Applications (ApplicationUserMapping)
```

At login, the backend resolves a user's full **permission tree**
(`src/services/permissionTree.ts`) by walking
`user → groups → group permissions → module → application`, merging
duplicate grants and attaching any data-level scoping. That same tree is
what a frontend would use to build menus/CTAs, and `userCan()` in the same
file is what backend routes call to authorize requests
(`src/auth/middleware.ts` → `requirePermission`).

The data-scoping layer (`MasterGroupStorage` / `MasterDataStorage` /
`PermissionDataMapping`) is what lets a role like "Anchor" see only their
own program/vendor/co-lender data instead of the whole module — a
permission's grant can be pinned to one specific master-data record instead
of the entire module.

## How the AI assistant works

`src/ai/tools.ts` exposes the RBAC service layer (`src/services/rbac.ts`) as
a set of LLM tools: `create_module`, `create_permission`,
`create_permission_group`, `create_user`, `assign_user_to_group`, etc.
`src/ai/agent.ts` runs a multi-turn tool-calling loop: the model reads the
conversation, decides whether it has enough information, either asks a
clarifying question or calls tools to check/create what's needed, and
repeats until it can summarize what it did. `POST /chat/message` drives one
turn of this loop per user message, `POST /chat/session` starts a new
conversation.

Example prompt:

> Add Rajesh (rajesh@example.com) with read and add access to the Vendor
> module in Supply Chain Finance, put him in a new group called Vendor
> Manager.

The assistant will check whether `vendor` exists as a module, ask if
anything is ambiguous, then call `create_permission` → `create_permission_group`
→ `add_permission_to_group` → `create_user` → `assign_user_to_application` →
`assign_user_to_group`, and reply with a plain-language summary.

### Bring your own model — nothing leaves your infra

`src/ai/llm/` defines an `LLMAdapter` interface with two implementations:

- `openaiCompatible.ts` — talks to any server exposing an OpenAI-compatible
  `/v1/chat/completions` endpoint with function-calling (vLLM, Ollama, TGI,
  LocalAI, etc). **This is the one to use in production** — point
  `OPENAI_COMPATIBLE_BASE_URL` at your internally-hosted model and no data
  ever leaves your infrastructure.
- `anthropic.ts` — only for demoing/testing this project without your own
  model running.

Switch providers with `LLM_PROVIDER=openai-compatible` (default) or
`LLM_PROVIDER=anthropic` in `.env`.

## Running it

Requires Node 20+, and a Postgres instance.

```bash
# 1. Postgres (via Docker; use a local Postgres install instead if you don't have Docker)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # then fill in DATABASE_URL / LLM_* as needed
npm install
npm run prisma:migrate        # applies the schema
npm run prisma:seed           # creates the seeded admin + a demo "Supply Chain Finance" app
npm run dev                   # http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Seeded login: `admin@example.com` / `Admin@123` (full `rbac-admin`
permission, so it can drive the chat assistant).

The seed also creates a demo "Supply Chain Finance" application with
Program/Anchor/Vendor/Co-lender modules and Anchor/Vendor/Co-lender/Originator
master groups, so there's something realistic to point the assistant at
immediately.

### Tests

```bash
cd backend
createdb rbac_system_test              # one-time; see .env.test for the connection string
DATABASE_URL=... npx prisma migrate deploy   # apply the schema to the test DB
npm test
```

`backend/test/` covers permission-tree resolution (including data-scoped
grants) and the auth/guard behavior (401 unauthenticated, 403 lacking
permission, 400 on invalid input) against a real Postgres test database via
supertest - see `backend/.env.test`.

### Production notes

- Set `NODE_ENV=production`, a real random `JWT_SECRET`, and
  `FRONTEND_ORIGIN` (comma-separated allowed origins for CORS) - the server
  fails fast at boot if these are missing in production (`src/env.ts`).
- Run `npm run prisma:deploy` (`prisma migrate deploy`) as a release step
  rather than `prisma:migrate`, which is dev-only.
- Set `frontend`'s `VITE_API_BASE_URL` to the deployed backend's URL - the
  frontend no longer assumes same-origin/dev-proxy in production.

## Project layout

```
backend/
  prisma/schema.prisma       RBAC schema
  prisma/seed.ts             bootstrap admin + demo domain data
  src/services/rbac.ts       core CRUD service layer (used by REST routes AND AI tools)
  src/services/permissionTree.ts  the permission-tree resolver + backend guard check
  src/auth/                  JWT, password hashing, route middleware
  src/routes/admin.ts        plain REST CRUD surface, gated by rbac-admin permission
  src/ai/llm/                pluggable LLM adapters (anthropic / openai-compatible)
  src/ai/tools.ts            tool definitions + executor, wraps services/rbac.ts
  src/ai/agent.ts            multi-turn tool-calling orchestration loop
  src/routes/chat.ts         POST /chat/session, POST /chat/message
frontend/
  src/Login.tsx, Chat.tsx    minimal chat UI
```

## What's intentionally left out

This is a demo, not a production deployment: no rate limiting, no refresh
tokens, no audit log, no soft deletes, no pagination, no role-based UI for
managing master data beyond the API. The point is to prove the concept —
schema + guard + AI-orchestrated admin workflow — end to end.
