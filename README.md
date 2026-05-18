# Prowider — Mini Lead Distribution System

A Next.js full-stack application implementing a fair lead distribution system with real-time dashboard updates, concurrency safety, and idempotent webhook processing.

## Live Demo
> Add your deployed URL here after deploying to Vercel / Railway / Render.

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd prowider
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local and set your DATABASE_URL
```

### 3. Initialize Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data (services, providers, allocation states)
npm run db:seed
```

### 4. Run
```bash
npm run dev
# Visit http://localhost:3000
```

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Home / overview |
| `/request-service` | Customer enquiry form |
| `/dashboard` | Real-time provider dashboard |
| `/test-tools` | Webhook simulation & testing panel |

---

## Architecture & Design Decisions

### Allocation Algorithm

Every lead is assigned to exactly **3 providers**. The algorithm runs inside a single serializable transaction:

1. **Mandatory providers** are assigned first (per service rules below), if they have quota remaining.
2. **Remaining slots** are filled from the eligible pool using **persistent round-robin** — a pointer (`nextIndex`) is stored per pool in the `AllocationState` table and advanced after each allocation. This survives server restarts.
3. If a mandatory provider has exhausted their quota, they are skipped (graceful degradation). The system will still try to fill all 3 slots from the pool.

**Service rules:**
| Service | Mandatory | Pool |
|---|---|---|
| Service 1 | Provider 1 | Providers 2, 3, 4 |
| Service 2 | Provider 5 | Providers 6, 7, 8 |
| Service 3 | Providers 1 & 4 | Providers 2, 3, 5, 6, 7, 8 |

### Concurrency Handling

Two layers protect against race conditions:

1. **PostgreSQL Advisory Locks** (`pg_advisory_xact_lock`): Before reading or modifying allocation state, the transaction acquires an exclusive in-process advisory lock keyed to the pool. This serializes all concurrent allocations for the same service, preventing double-assignment.

2. **Serializable Transaction Isolation**: The entire allocation (read quota → pick providers → write assignments → increment counters → advance pointer) runs in a `SERIALIZABLE` transaction. PostgreSQL will abort and retry if a conflict is detected.

This means even if 10 leads for Service 1 arrive simultaneously, each will wait its turn and receive a distinct, correctly-ordered set of providers.

### Webhook Idempotency

Every webhook call must include an `Idempotency-Key` header (a UUID or timestamp-based string).

- On first call: the key is stored in `WebhookEvent` table inside the same transaction as the quota reset.
- On subsequent calls with the same key: the system finds the existing record and returns `{ status: "already_processed" }` immediately — **no DB writes occur**.
- This prevents duplicate quota resets even if the payment gateway retries the webhook.

### Real-Time Dashboard

Server-Sent Events (SSE) via `/api/sse`:
- Dashboard pages open a persistent connection to the SSE endpoint.
- After every successful lead allocation or quota reset, `emitLeadUpdate()` broadcasts a JSON event to all connected clients.
- Clients receive the event and re-fetch `/api/providers` to get fresh data.
- A 25-second heartbeat keeps connections alive through proxies.

> **Multi-instance note:** The current SSE implementation uses an in-process Map. For multi-instance deployments (Kubernetes, multiple Vercel serverless instances), replace `lib/sse.ts` with a Redis pub/sub broadcaster (e.g. `ioredis` with `publish`/`subscribe`).

### Database Design

Key constraints enforced at the database level:

- `Lead.@@unique([phone, serviceId])` — prevents duplicate service requests from the same phone
- `LeadAssignment.@@unique([leadId, providerId])` — prevents a provider being assigned to the same lead twice
- `AllocationState` table — persists round-robin pointers independently of server memory
- `WebhookEvent` table — idempotency log with unique constraint on key

---

## Testing Checklist

| Test | How |
|---|---|
| Duplicate lead rejection | Submit same phone + service twice from `/request-service` |
| Concurrent lead creation | Click "Generate 10 Leads" on `/test-tools` |
| Real-time update | Open dashboard, submit lead in another tab |
| Quota enforcement | Generate many leads until quota hits 10 |
| Quota reset (webhook) | Click "Reset Quota" on `/test-tools` |
| Idempotency | Click "Call Webhook 5×" — only first should apply |
