# OMS — Order Management System (Multi-Tenant SaaS)

This repository contains a multi-tenant Order Management System (OMS) implemented as a shared-schema SaaS platform.

---

## Architecture at a Glance

- **Tenancy model:** shared PostgreSQL schema with a `business_id` discriminator + defense-in-depth via Postgres RLS.
- **Isolation rule (non-negotiable):** every tenant-scoped service call uses `req.user.business_id`.
- **Role hierarchy (two tiers):**
  - **Platform:** `superadmin` (can only manage/suspend/reactivate businesses; never order data)
  - **Business-scoped:** `admin`, `clerk`, `viewer`
- **Frontend:** React 18 + TypeScript (Vite)
- **Backend:** Node.js + TypeScript + Express

---

## Repository Structure

- `backend/` — Express API (OMS API)
- `frontend/` — React web app

---

## SRS v2.0 Compliance Highlights

### 1) Tenant Isolation & JWT business context

- Backend auth middleware verifies tokens via Supabase Auth and loads the tenant context from the `users` table.
- The backend stamps `req.user.business_id` and **the client never supplies** `business_id`.

### 2) Suspension model

- Business suspension is enforced on **every authenticated request** by checking `business.is_active`.
- Suspended businesses retain data; users can be reactivated immediately.

### 3) Order lifecycle

Endpoints are role-scoped and status transitions are enforced:

- Create: `pending` (admin/clerk)
- Update: restricted (admin/clerk; owner-enforced for clerks)
- Cancel: dedicated cancel endpoint (admin/clerk; owner-enforced)
- Delivered/cancelled orders are not editable.

### 4) Audit logging

- Order mutations create immutable audit log entries.
- Only `admin` can retrieve an order’s audit trail.

### 5) Reports

- Reports are tenant-scoped and exported as:
  - Excel (`.xlsx`)
  - PDF (`.pdf`)
- Filenames include the business prefix.

---

## API Overview (Backend)

Base path (default): `http://localhost:5000/api`

### Health

- `GET /health`
  - Returns `{ status: ok, service: OMS API, timestamp }`

### Business Auth (Login / Profile)

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/reset-password`

### Orders (Business-scoped)

- `GET /api/orders/summary`
- `GET /api/orders` (filterable, paginated)
- `GET /api/orders/:id`
- `GET /api/orders/:id/audit` (`admin` only)
- `POST /api/orders` (`admin`, `clerk`)
- `PATCH /api/orders/:id` (`admin`, `clerk`)
- `PATCH /api/orders/:id/cancel` (`admin`, `clerk`)

### Users (Business-scoped)

- `GET /api/users` (`admin`)
- `GET /api/users/:id`
- `POST /api/users` (`admin`)
- `PATCH /api/users/:id` (admin full update; non-admin self limited)
- `PATCH /api/users/:id/deactivate` (`admin`)
- `PATCH /api/users/:id/reactivate` (`admin`)

### Platform Admin (Superadmin only)

- `POST /api/platform/auth/login`
- `GET /api/platform/businesses`
- `GET /api/platform/businesses/:id`
- `PATCH /api/platform/businesses/:id/suspend`
- `PATCH /api/platform/businesses/:id/reactivate`

---

## Running Locally (Development)

### Backend

1. Create a Supabase project and configure environment variables expected by the backend:

   Required (as used in code):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

   Also used:
   - `CLIENT_URL`
   - `PORT`

2. Start the API:

```bash
cd backend
npm install
npm run dev
```

- Default port is typically `5000` (see `backend/src/server.ts`).

3. Verify:

- Open `http://localhost:5000/health`

### Frontend

1. Configure API URL via Vite env (recommended):

- `frontend/.env` (create if missing) with:
  - `VITE_API_URL=http://localhost:5000/api`

2. Start the UI:

```bash
cd frontend
npm install
npm run dev
```

3. Open the app in the browser.

---

## Notes for Provisioning (SRS Phase 4)

The SRS specifies **business provisioning exclusively via CLI** (no self-serve signup).

Backend package scripts include:

- `npm run provision`
- `npm run provision:admin`

Use these for platform operators to provision:

- a new `businesses` row with `order_prefix`
- a first `admin` user in Auth + corresponding `users` profile row scoped to that business

---

## Security Controls (Key Points)

- Tenant isolation: `business_id` enforced by backend scoping and intended RLS.
- 403/404 behavior: tenant enumeration is avoided by returning 404 for cross-tenant resources.
- Suspended business check on every authenticated request.
- Rate limiting:
  - global limiter
  - auth limiter
  - export limiter
- Hardening:
  - Helmet
  - CORS restricted by `CLIENT_URL`
  - `Zod` validation on request bodies

---

## License

Add license information here if applicable.

