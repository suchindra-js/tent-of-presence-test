# Architectural Decisions & Trade-offs

---

## Architectural Decisions

### 1. Vite instead of Next.js

- **Decision:** Frontend is built with **Vite** (React + TypeScript), not Next.js or another full-stack framework.
- **Why:** This app is a thin SPA talking to a separate backend; we don’t need SSR, file-based routing, or API routes. Vite gives fast dev feedback, simple config, and static build output that’s easy to host and proxy to the API.

### 2. Docker for orchestration

- **Decision:** Use **Docker** and **docker-compose** to run PostgreSQL, backend, and frontend dev server in one command.
- **Why:** Reproducible local and CI environment; same stack as production-style deployment; DB and API start together without manual installs.

### 3. REST API instead of other API protocols

- **Decision:** Backend exposes a **REST** JSON API over HTTP; did not choose GraphQL, gRPC, WebSockets, or other protocols.
- **Why:** REST is widely understood, easy to debug (curl, browser), and fits our resource-oriented task CRUD; no need for schema stitching or real-time subscriptions for this scope.

### 4. REST API + SPA (no SSR)

- **Decision:** Backend exposes REST JSON APIs; frontend is a React SPA that calls the API and stores JWT in `localStorage`.
- **Why:** Clear separation of concerns; backend can serve other clients later; SPA is sufficient for this scope and keeps deployment simple (static assets + API).

### 5. JWT for authentication

- **Decision:** Login returns a **JWT**; frontend sends `Authorization: Bearer <token>`; backend validates JWT on protected routes; no server-side session store.
- **Why:** Stateless auth fits horizontal scaling and multiple gateways; 7-day expiry balances convenience and risk for this app. No session store to operate.

### 6. PostgreSQL as the database

- **Decision:** Use **PostgreSQL** for all persistent data (users, tasks).
- **Why:** Robust, ACID-compliant RDBMS; good JSON support if needed later; widely supported and easy to run via Docker; fits our relational model (users → tasks).

### 7. Raw SQL queries instead of ORMs

- **Decision:** Use **raw SQL** with the `pg` client and a connection pool; no ORM (e.g. Prisma, TypeORM, Sequelize).
- **Why:** Full control over queries and indexes; no ORM learning curve or migration layer; small surface area for a focused API; schema lives in plain SQL migrations.

### 8. Basic SQL migrations (no migration package)

- **Decision:** **No migration package** (e.g. Knex, node-pg-migrate, Flyway); just versioned SQL files in `database/migrations/` applied by `run-migrations.sh` (local) or `init-db.sh` (Docker).
- **Why:** Schema is in version control; same steps for local and containerized DB; no extra runtime or DSL; minimal tooling.

---

## Trade-offs Made


| Area                    | Choice                | Trade-off                                                                                                    |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **No refresh tokens**   | Single JWT, 7d expiry | **Pro:** No refresh endpoint; stateless. **Con:** Re-login after expiry; no silent refresh.                  |
| **No ORM**              | Raw SQL + `pg`        | **Pro:** Full control; schema in plain SQL. **Con:** Manual work for new tables; no type-safe query builder. |
| **Vite over Next.js**   | Vite + React SPA      | **Pro:** Fast HMR, simple config, static build. **Con:** No SSR or file-based routing                        |
| **Express over NestJS** | Express only          | **Pro:** Minimal, familiar; no DI or decorators. **Con:** No built-in structure, validation.                 |


---

## What We’d Improve With More Time

1. **Auth**

- Refresh tokens (short-lived access + refresh) and optional “remember me”.
- Stricter CORS in production (explicit allowlist of origins).
- Optional 2FA or account lockout after failed logins.

1. **API**

- Request validation (e.g. Zod/Joi).
- Rate limiting (e.g. express-rate-limit) on `/api/auth/login` and optionally on task endpoints.
- Pagination metadata (total count, next/prev) returned consistently from list endpoints.

1. **Database**

- Optional soft deletes for tasks (e.g. `deleted_at`) for recovery and auditing.

1. **Frontend**

- Centralized API error handling and token-expiry redirect to login.
- E2E tests (e.g. Playwright) for login and critical task flows.

1. **DevOps / Observability**

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

