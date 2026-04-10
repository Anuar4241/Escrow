# CLAUDE.md — Revorus Escrow

This file provides guidance for AI assistants (Claude Code and similar) working on this repository.

---

## Project Overview

**Revorus Escrow** is a marketplace escrow microservice. It securely holds buyer funds during a transaction and releases them to the seller only after the buyer confirms receipt of goods. The system supports disputes, refunds, and a full immutable audit trail.

The monorepo contains two services:
- `backend/` — NestJS REST API (Node.js + TypeScript)
- `frontend/` — Next.js web app + Capacitor mobile (iOS/Android)

---

## Repository Structure

```
/
├── backend/                        # NestJS microservice
│   ├── src/
│   │   ├── domain/escrow/
│   │   │   └── escrow.engine.ts    # CORE: state machine + optimistic lock guard
│   │   ├── infrastructure/
│   │   │   ├── idempotency/        # Redis-backed idempotency interceptor
│   │   │   ├── logging/            # Structured JSON logger
│   │   │   ├── messaging/          # RabbitMQ publisher
│   │   │   └── prisma/             # Prisma DB service
│   │   └── modules/
│   │       ├── escrow/             # Controller, service, DTOs
│   │       └── webhooks/           # Payment provider webhook handler
│   ├── prisma/
│   │   └── schema.prisma           # Database schema (PostgreSQL)
│   └── test/                       # E2E test configs
├── frontend/
│   └── src/app/
│       ├── page.tsx                # Product listing (home)
│       ├── checkout/               # Payment init
│       ├── escrow/[id]/            # Escrow tracker + demo controls
│       └── timeline/               # Audit history view
├── k8s/                            # Kubernetes manifests
├── .github/workflows/ci.yml        # GitHub Actions CI/CD
└── docker-compose.yml              # Local dev orchestration
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 (TypeScript) |
| ORM / DB | Prisma 7 + PostgreSQL 15 |
| Cache | Redis 7 (idempotency) |
| Message queue | RabbitMQ 3 (AMQP topic exchange) |
| API docs | Swagger / OpenAPI (`/api`) |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Mobile | Capacitor 8 (iOS + Android) |
| Testing | Jest 30 (backend unit + E2E) |
| Containerisation | Docker (multi-stage) + Docker Compose |
| Orchestration | Kubernetes |
| CI/CD | GitHub Actions |

---

## Development Setup

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- (Mobile) JDK 17, Android SDK

### Local environment (recommended)

```bash
# Start all infrastructure and services
docker compose up -d
```

Services exposed:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger UI: http://localhost:3001/api
- RabbitMQ management: http://localhost:15672 (root / rootpassword)
- PostgreSQL: localhost:5432 (root / rootpassword / revorus_escrow)

### Backend (standalone dev)

```bash
cd backend
npm install
npx prisma generate
npm run start:dev       # watch mode
```

Required environment variables for backend:
```
DATABASE_URL=postgresql://root:rootpassword@localhost:5432/revorus_escrow
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://root:rootpassword@localhost:5672
NODE_ENV=development
```

### Frontend (standalone dev)

```bash
cd frontend
npm install
npm run dev             # http://localhost:3000
```

Required environment variable for frontend:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Backend Commands

```bash
npm run build           # Compile TypeScript → dist/
npm run start:dev       # Development server (watch mode)
npm run start:prod      # Production build
npm run lint            # ESLint with auto-fix
npm run format          # Prettier
npm run test            # Unit tests (Jest)
npm run test:watch      # Unit tests in watch mode
npm run test:cov        # Coverage report
npm run test:e2e        # End-to-end tests
```

## Frontend Commands

```bash
npm run dev             # Dev server (port 3000)
npm run build           # Next.js production build
npm run start           # Serve production build
npm run lint            # ESLint
npx cap sync android    # Sync Capacitor Android project
```

---

## Core Architectural Patterns

### 1. Strict State Machine (most critical)

The escrow lifecycle is governed entirely by `EscrowEngine` at `backend/src/domain/escrow/escrow.engine.ts`.

**17 defined states:**
```
DRAFT → CREATED → AWAITING_PAYMENT → FUNDED → AWAITING_SELLER_ACTION
  → SHIPPED / HANDED_OVER → AWAITING_BUYER_CONFIRMATION → COMPLETED → PAYOUT_APPROVED

At any active state:
  → DISPUTE_OPENED → UNDER_REVIEW → PAYOUT_APPROVED / REFUND_APPROVED → REFUNDED

Terminal abort paths:
  CANCELLED, EXPIRED → REFUND_APPROVED
```

**Rules:**
- All state transitions go through `EscrowEngine.validateTransition()`. Any attempt to jump to a non-allowed target state throws `EscrowTransitionException`.
- **Never** assign `status` directly on a deal without calling the engine first.
- New states or transitions must be added to the static `transitions` Map in `escrow.engine.ts`.

### 2. Optimistic Concurrency Locking

Every mutating operation requires the caller to pass `expectedVersion` (the `version` field from the DB record). `EscrowEngine.checkOptimisticLock()` throws a `CONCURRENCY_ERROR` if the version doesn't match, preventing lost updates under concurrent requests.

Pattern in all service methods:
```typescript
EscrowEngine.checkOptimisticLock(deal as any, expectedVersion);
EscrowEngine.validateTransition(deal.status, targetStatus);
// ... then update with version: { increment: 1 }
```

### 3. Idempotency

All mutating endpoints (`POST :id/fund`, `confirm-shipment`, `confirm-delivery`, `release`, `open-dispute`) are decorated with `@UseInterceptors(IdempotencyInterceptor)`.

Clients **must** send an `x-idempotency-key` header. The interceptor caches responses in Redis for 24 hours. Re-sending the same key returns the cached response without re-executing the operation.

### 4. Atomic Transactions with Post-Commit Events

All state transitions follow this two-phase pattern in `escrow.service.ts`:

1. **DB transaction** (`prisma.$transaction`): validate state, run side effects, update deal, append `EscrowStatusHistory`.
2. **After successful commit**: publish a domain event to RabbitMQ exchange `revorus.escrow.events` with routing key `escrow.<newStatus>`.

Events are **never** published inside the DB transaction — always after it commits.

### 5. Immutable Audit Log

`EscrowStatusHistory` is append-only. Every transition creates a new row. Never update or delete history records.

---

## Database Schema Highlights

Key constraints to respect:
- `EscrowDeal.status` — string field, values must match `EscrowStatus` enum values (lowercase, e.g. `"funded"`)
- `EscrowDeal.version` — incremented on every update; used for optimistic locking
- `PaymentTransaction.idempotencyKey` — `@unique`; use format `charge_<providerTxId>` for charges
- `TermsSnapshot.escrowId` — `@unique` (one snapshot per deal)
- `DisputeCase.escrowId` — `@unique` (one dispute per deal)

### Prisma usage

```bash
# From backend/
npx prisma generate               # Regenerate client after schema changes
npx prisma migrate dev            # Create + apply a new migration (dev)
npx prisma migrate deploy         # Apply pending migrations (prod/CI)
npx prisma studio                 # Visual DB browser
```

**Note:** The `datasource db` block in `schema.prisma` does not inline `url`; it is provided via the `DATABASE_URL` environment variable at runtime. Do not add `url = env("DATABASE_URL")` directly to the schema unless you understand the Prisma 7 config format.

---

## API Endpoints

Base URL: `http://localhost:3001`

| Method | Path | Description |
|---|---|---|
| `POST` | `/escrows` | Create escrow deal |
| `GET` | `/escrows/:id/timeline` | Get immutable audit log |
| `POST` | `/escrows/:id/fund` | PSP webhook funds escrow (idempotent) |
| `POST` | `/escrows/:id/confirm-shipment` | Seller confirms shipment |
| `POST` | `/escrows/:id/confirm-delivery` | Buyer confirms delivery |
| `POST` | `/escrows/:id/release` | Buyer releases funds |
| `POST` | `/escrows/:id/open-dispute` | Open a dispute |
| `POST` | `/webhooks/payment` | Payment provider webhook |

Swagger UI available at `/api` when the backend is running.

All mutating endpoints require:
- `x-idempotency-key` header (UUID recommended)
- `expectedVersion` in the request body

---

## Messaging (RabbitMQ)

Exchange: `revorus.escrow.events` (topic, durable)

Domain events are published after every successful state transition with routing key `escrow.<status>`. Examples:
- `escrow.funded`
- `escrow.shipped`
- `escrow.completed`
- `escrow.dispute_opened`
- `escrow.refund_approved`

Payload shape:
```json
{
  "escrowId": "<uuid>",
  "newStatus": "<status>",
  "timestamp": "<ISO 8601>",
  "trigger": "<TRIGGER_EVENT>"
}
```

---

## CI/CD Pipeline

File: `.github/workflows/ci.yml`

Triggers on push/PR to `main`. Three parallel jobs:

| Job | What it does |
|---|---|
| `build_backend` | Install, prisma generate, ESLint, build, Docker push to Docker Hub |
| `build_frontend` | Install, ESLint, Next.js build, Docker push to Docker Hub |
| `build_android` | Install, `cap sync android`, JDK 17, `gradlew assembleDebug`, upload APK artifact |

Required GitHub secrets: `DOCKERHUB_LOGIN`, `DOCKERHUB_PASSWORD`

Docker images pushed to: `anuarbakhitkhanov1357/revorus-backend:latest` and `anuarbakhitkhanov1357/revorus-frontend:latest`

**Note:** ESLint runs with `continue-on-error: true` in CI — lint failures do not block the build.

---

## Kubernetes

Manifests live in `k8s/`. Key files:
- `backend-deployment.yaml` — 3 replicas, rolling update strategy
- `configmap.yaml` — non-sensitive environment configuration
- `secrets.yaml` — sensitive credentials (DATABASE_URL, RABBITMQ_URL, etc.)

---

## Mobile (Capacitor)

App ID: `com.revorus.escrow`

```bash
cd frontend
npx cap sync android        # Sync web assets to Android project
npx cap sync ios            # Sync web assets to iOS project
npx cap open android        # Open in Android Studio
npx cap open ios            # Open in Xcode
```

Production server URL: `https://revorus-escrow.vercel.app`

---

## Code Conventions

### Backend
- **NestJS module pattern**: each feature gets a module, controller, service, and `dto/` folder
- **DTOs**: use `class-validator` decorators for all request bodies; never accept raw unvalidated input
- **Service methods**: always go through `transitionStatus()` for state changes — do not write ad-hoc `prisma.escrowDeal.update()` calls that bypass the engine
- **Error handling**: throw NestJS built-in exceptions (`BadRequestException`, `ConflictException`) — the framework serialises them correctly
- **No state mutation outside the engine**: the engine is the single source of truth for what transitions are legal

### Frontend
- App Router (`src/app/`) with server and client components
- Client components suffix: `*Client.tsx` (e.g. `EscrowTrackerClient.tsx`)
- Styling: Tailwind utility classes; dark-mode-first (`bg-neutral-900`)
- No external state management — use React `useState`/`useReducer`

### General
- TypeScript strict mode — avoid `any` except where Prisma transaction typing requires it
- UUIDs for all primary keys
- Amounts stored as `Decimal(12,2)` — do not use floats for money
- All timestamps in ISO 8601 / UTC

---

## Key Files Quick Reference

| What | Where |
|---|---|
| State machine + enum | `backend/src/domain/escrow/escrow.engine.ts` |
| Business logic (service) | `backend/src/modules/escrow/escrow.service.ts` |
| REST endpoints | `backend/src/modules/escrow/escrow.controller.ts` |
| Request DTOs | `backend/src/modules/escrow/dto/escrow.dto.ts` |
| Webhook handler | `backend/src/modules/webhooks/webhook.controller.ts` |
| Idempotency interceptor | `backend/src/infrastructure/idempotency/idempotency.interceptor.ts` |
| RabbitMQ publisher | `backend/src/infrastructure/messaging/rabbitmq.service.ts` |
| Database schema | `backend/prisma/schema.prisma` |
| App bootstrap | `backend/src/main.ts` |
| Frontend home | `frontend/src/app/page.tsx` |
| Escrow tracker (demo UI) | `frontend/src/app/escrow/[id]/EscrowTrackerClient.tsx` |
| Docker Compose | `docker-compose.yml` |
| CI/CD | `.github/workflows/ci.yml` |
