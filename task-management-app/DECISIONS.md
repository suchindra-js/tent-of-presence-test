# Architectural Decisions & Trade-offs

This document explains the main architectural choices, trade-offs, and security measures in the Task Management App, and what we would improve with more time.

---

## Architectural Decisions

### 1. Monorepo-style layout (frontend + backend + database in one repo)

- **Decision:** Single repo with `backend/`, `frontend/`, and `database/` at the same level, orchestrated by one `docker-compose.yml`.
- **Why:** One place for code, schema, and run instructions; easier to keep API and DB in sync; simple CI and local setup.

### 2. REST API + SPA (no SSR)

- **Decision:** Backend exposes REST JSON APIs; frontend is a React SPA that calls the API and stores JWT in `localStorage`.
- **Why:** Clear separation of concerns; backend can serve other clients later; SPA is sufficient for this scope and keeps deployment simple (static assets + API).

### 3. JWT for authentication

- **Decision:** Login returns a JWT; frontend sends `Authorization: Bearer <token>`; backend validates JWT on protected routes; no server-side session store.
- **Why:** Stateless auth fits horizontal scaling and multiple gateways; 7-day expiry balances convenience and risk for this app. No session store to operate.

### 4. Row-level authorization by `user_id`

- **Decision:** Every task is tied to `user_id`. All task queries and mutations filter/scope by the authenticated user’s ID from the JWT.
- **Why:** Simple and safe: users cannot see or change each other’s tasks; no need for role-based logic in this version.

### 5. Raw SQL + connection pool (no ORM)

- **Decision:** Use `pg` with a pool; write SQL in route handlers; schema in SQL migration files.
- **Why:** Full control over queries and indexes; no ORM learning curve or migration layer; small surface area for a focused API.

### 6. SQL migrations as versioned files

- **Decision:** Migrations are ordered SQL files in `database/migrations/`; applied by `run-migrations.sh` (local) or `init-db.sh` (Docker).
- **Why:** Schema is in version control; same steps for local and containerized DB; no extra migration runtime.

### 7. CORS and API layout

- **Decision:** CORS allows the frontend origin (`origin: true` in dev); API under `/api`; frontend uses relative `/api` in dev (Vite proxy) and optional `VITE_API_URL` in production.
- **Why:** Simple dev story (no CORS issues with proxy); production can point to any backend URL via env.

### 8. Frontend auth and routing

- **Decision:** Auth state in React Context; token in `localStorage`; `ProtectedRoute` redirects unauthenticated users to login; API client attaches token to requests.
- **Why:** Minimal dependencies; behavior is explicit and easy to follow.

---

## Trade-offs Made

| Area | Choice | Trade-off |
|------|--------|-----------|
| **JWT in localStorage** | Store token in `localStorage` | **Pro:** Simple, works across tabs. **Con:** Vulnerable to XSS; no built-in refresh. Mitigated by short-ish expiry and avoiding rendering unsanitized user content. |
| **No refresh tokens** | Single JWT with 7d expiry | **Pro:** No refresh endpoint or token store. **Con:** User must re-login after expiry or if token is lost. |
| **No ORM** | Raw SQL + `pg` | **Pro:** Direct control, no magic. **Con:** More manual work for new tables/columns and no type-safe query builder. |
| **Migrations on container init** | `init-db.sh` runs in Postgres `docker-entrypoint-initdb.d` | **Pro:** DB is ready after first `docker compose up`. **Con:** Only runs on empty data volume; later migrations need a separate strategy (e.g. run in backend startup or a job). |
| **Broad CORS** | `origin: true` (reflect request origin) | **Pro:** Easy for multiple frontend origins in dev. **Con:** Production should restrict to known origins for tighter security. |
| **Inline error handling** | Mix of try/catch and `asyncHandler` | **Pro:** Works. **Con:** Inconsistent; some routes use `next(err)`, others use shared handler. Could be unified. |
| **No rate limiting** | No per-IP or per-user throttling | **Pro:** Simpler. **Con:** Login and API are more exposed to abuse; should be added for production. |

---

## What We’d Improve With More Time

1. **Auth**
   - Refresh tokens (short-lived access + refresh) and optional “remember me”.
   - Stricter CORS in production (explicit allowlist of origins).
   - Optional 2FA or account lockout after failed logins.

2. **API**
   - Request validation (e.g. Zod/Joi) and shared error shapes.
   - Rate limiting (e.g. express-rate-limit) on `/api/auth/login` and optionally on task endpoints.
   - Pagination metadata (total count, next/prev) returned consistently from list endpoints.

3. **Database**
   - Migration runner that runs on app startup or via a CLI (so new migrations apply after first deploy, not only on fresh DB).
   - Optional soft deletes for tasks (e.g. `deleted_at`) for recovery and auditing.

4. **Frontend**
   - Centralized API error handling and token-expiry redirect to login.
   - Optional optimistic updates for task create/update/delete.
   - E2E tests (e.g. Playwright) for login and critical task flows.

5. **DevOps / Observability**
   - Health check that verifies DB connectivity.
   - Structured logging and request IDs.
   - Optional APM or error tracking in production.

---

## Security Considerations Implemented

- **Passwords:** Hashed with **bcrypt** (salt rounds 10); never stored or logged in plain text.
- **Auth:** **JWT** signed with a server-held secret (`JWT_SECRET`); validated on every protected route; expiry (7d) to limit exposure of stolen tokens.
- **Authorization:** Tasks are **scoped by `user_id`** from the JWT; users cannot access or modify other users’ tasks.
- **SQL:** Queries use **parameterized values** (`$1`, `$2`, …); no string concatenation of user input into SQL, reducing injection risk.
- **Input:** Basic validation (required fields, enum checks for status/priority); duplicate email handled on register (409).
- **HTTPS:** Not enforced in code; assumed to be provided by a reverse proxy or host in production. **Recommendation:** Run behind TLS in production.
- **Secrets:** `JWT_SECRET` and `DATABASE_URL` come from environment variables, not from code; `.env` is gitignored; examples use placeholders in `.env.example`.

What we did **not** add (and would for a production hardening pass): rate limiting, strict CORS allowlist, CSRF if we ever added cookie-based auth, and a security headers middleware (e.g. Helmet).
