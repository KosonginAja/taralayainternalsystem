# Taralaya OS

ERP / Operating System for a Digital Agency.

## Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Backend:** Node.js + TypeScript + Express + Drizzle ORM + MySQL
- **Frontend:** Next.js (App Router) + TanStack Query *(Wave H)*
- **Auth:** JWT (access + refresh) + RBAC (multi-role, merged, founder bypass)

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# → Edit .env with your DATABASE_URL, JWT_SECRET, FOUNDER_EMAIL, FOUNDER_PASSWORD

# Run DB migrations
pnpm db:migrate

# Seed database (idempotent)
pnpm db:seed

# Start development server
pnpm dev
```

## Project Structure

```
taralaya-os/
├── apps/
│   ├── backend/          # Express REST API
│   └── worker/           # Background job runner (Wave D)
├── packages/
│   ├── shared/           # Shared constants, types, enums
│   ├── db/               # Drizzle schema, migrations, seed
│   ├── ui/               # Shared UI components (Wave H)
│   └── config/           # ESLint, Prettier, TS configs
└── docs/architecture/    # MCP — single source of truth
```

## API

Base URL: `http://localhost:3000/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login → tokens |
| POST | `/auth/refresh` | Public | Rotate refresh token |
| POST | `/auth/logout` | Bearer | Revoke session |
| GET | `/auth/me` | Bearer | Current user + permissions |
| GET | `/users` | `user.view` | List users |
| POST | `/users` | `user.create` | Create user |
| GET | `/users/:id` | `user.view` | Get user |
| PATCH | `/users/:id` | `user.update` | Update user |
| DELETE | `/users/:id` | `user.delete` | Soft-delete user |
| GET | `/roles` | `role.view` | List roles |
| POST | `/roles` | `role.create` | Create role |
| PUT | `/roles/:id/permissions` | `role.permission_change` | Replace role permissions |
| GET | `/permissions` | `permission.view` | List all permission keys |
