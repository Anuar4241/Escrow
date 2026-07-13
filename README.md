# Revorus Escrow

Marketplace escrow orchestration prototype for KZT transactions: NestJS API, Next.js/Capacitor client, PostgreSQL, Redis idempotency and RabbitMQ transactional outbox.

> This code is not a bank, licensed payment institution, or custodian. Production requires a contracted bank adapter, KYC/AML operations, reconciliation, legal approval and independent security review. Sandbox events must never be represented as real funds.

## Local run

Copy `.env.example` to `.env`, replace every placeholder, then run `docker compose up --build`. The frontend is on port 3000 and API on port 3001.

## Included controls

- JWT authentication, roles and participant-level authorization
- KYC gating and immutable terms snapshots
- optimistic concurrency and Redis request idempotency
- signed, timestamped and replay-safe bank webhooks
- payments, ledger entries and transactional outbox
- environment validation, probes, non-root images and migration jobs
- CI for migrations, audits, lint, tests, web build and Android APK
