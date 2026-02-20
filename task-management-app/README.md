# Task Management App

## Setup indstructions (how to run locally)

**Prerequisites:** Docker and Docker Compose

From the project root:

```bash
cd task-management-app
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)  
- **Backend:** [http://localhost:3000](http://localhost:3000)  
- **PostgreSQL:** port 5432 (if you need to connect from the host)

---

## Environment variables

No `.env` file is required for local development. All needed values (database URL, ports, `NODE_ENV`, and a default `JWT_SECRET`) are defined in `docker-compose.yml`, so the stack runs with no extra setup.

---

## Database setup steps

You don’t run anything manually. When you start the stack with `docker compose up`, the database container runs migrations on first start via `database/init-db.sh` (SQL files in `database/migrations/`).

Schema is in `**database/migrations/001_initial.sql`** (users table, tasks table, indexes).

---

## Technology choices

**Frontend**

- **Vite + React** — Fast dev server and builds; familiar component-based UI.
- **react-router-dom** — Client-side routing for a single-page app.
- **Tailwind** — Utility-first styling and responsive layout without custom CSS.

**Backend**

- **Express + Node** — Lightweight, widely used API framework on Node.
- **bcrypt** — Standard secure password hashing.
- **JWT** — Stateless auth; works well with SPAs.

**Database**

- **PostgreSQL** — Reliable, ACID; good fit for multi-user tasks and auth.

**CI/CD**

- **Docker Compose** — One-command local stack (frontend, backend, DB); consistent environment and no local installs beyond Docker.

