-- ═══════════════════════════════════════════════════════════════════════════
-- OMS Platform — Full Database Schema
-- Version : 2.0 (Multi-Tenant)
-- Target  : Supabase-hosted PostgreSQL
--
-- USE THIS FILE FOR: fresh installations only.
-- FOR EXISTING DATABASES: use migrations/v2_0_multi_tenancy.sql instead.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ════════════════════════════════════════════════════════════════════════════
-- 1. ENUMS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM (
  'admin',
  'clerk',
  'viewer'
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'dispatched',
  'delivered',
  'cancelled'
);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. BUSINESSES (root entity)
--
-- One row per registered tenant.
-- All tenant-owned tables carry a business_id FK to this table.
-- Suspension sets is_active = FALSE; the verifyToken middleware checks
-- this on every authenticated request, enforcing instant lockout.
-- Data is never deleted on suspension — full reactivation is possible.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE businesses (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255)  NOT NULL,
  order_prefix      VARCHAR(10)   NOT NULL UNIQUE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  suspended_at      TIMESTAMPTZ,
  suspended_reason  TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  businesses                  IS 'Root tenant entity. One row per registered business.';
COMMENT ON COLUMN businesses.order_prefix     IS 'Immutable. Short code for order numbers, e.g. ND. Unique across all businesses.';
COMMENT ON COLUMN businesses.is_active        IS 'FALSE = suspended. Checked on every authenticated request.';
COMMENT ON COLUMN businesses.suspended_at     IS 'Set when is_active → FALSE. NULL when active.';
COMMENT ON COLUMN businesses.suspended_reason IS 'Platform operator note recorded at suspension time.';


-- ════════════════════════════════════════════════════════════════════════════
-- 3. PLATFORM_ADMINS
--
-- Platform operator accounts. Entirely separate from business-scoped users.
-- Authenticated via /api/platform/auth/login (not /api/auth/login).
-- Zero visibility into order data, audit logs, or business user data.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE platform_admins (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255)  NOT NULL UNIQUE,
  full_name   VARCHAR(255)  NOT NULL,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_admins IS 'Platform operator accounts. Never mixed with business-scoped users.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. USERS
--
-- Business-scoped user profiles, linked to Supabase Auth by id (UUID).
-- Each user belongs to exactly one business (business_id).
-- One user cannot belong to multiple businesses — not supported by design.
-- Supabase Auth handles password hashing and JWT issuance.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID          NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  email        VARCHAR(255)  NOT NULL UNIQUE,
  full_name    VARCHAR(255)  NOT NULL,
  role         user_role     NOT NULL DEFAULT 'clerk',
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users              IS 'Business-scoped user profiles. Linked to Supabase Auth by id.';
COMMENT ON COLUMN users.business_id  IS 'FK → businesses. One user, one business. Never reassignable.';
COMMENT ON COLUMN users.role         IS 'admin: full business access | clerk: own orders | viewer: read-only';
COMMENT ON COLUMN users.is_active    IS 'Soft deactivation — never hard-delete users (orders FK them).';


-- ════════════════════════════════════════════════════════════════════════════
-- 5. ORDERS
--
-- Core entity. Every order is scoped to a business via business_id.
-- The business_id is never supplied by the client — it is always stamped
-- server-side from the verified JWT (req.user.business_id).
-- total_zar is a stored computed column — never set directly.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE orders (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID          NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  order_number    VARCHAR(20)   NOT NULL UNIQUE,
  client_name     VARCHAR(255)  NOT NULL,
  mineral_type    VARCHAR(100)  NOT NULL,
  quantity_kg     NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  unit_price_zar  NUMERIC(12,2) NOT NULL CHECK (unit_price_zar > 0),
  total_zar       NUMERIC(14,2) NOT NULL GENERATED ALWAYS AS (quantity_kg * unit_price_zar) STORED,
  status          order_status  NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_by      UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  orders               IS 'Mineral distribution orders. Fully tenant-scoped via business_id.';
COMMENT ON COLUMN orders.business_id   IS 'Tenant discriminator. Always stamped server-side. Never from client.';
COMMENT ON COLUMN orders.order_number  IS 'Format: {PREFIX}-{YEAR}-{SEQUENCE}. Generated by fn_next_order_number().';
COMMENT ON COLUMN orders.total_zar     IS 'Computed: quantity_kg * unit_price_zar. Never set directly.';


-- ════════════════════════════════════════════════════════════════════════════
-- 6. AUDIT_LOGS
--
-- Immutable. One row per field changed per event.
-- UPDATE and DELETE are blocked by trigger (see Section 9).
-- business_id is included for efficient tenant-scoped queries.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID         NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  order_id       UUID         NOT NULL REFERENCES orders(id)     ON DELETE RESTRICT,
  changed_by     UUID         NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
  field_changed  VARCHAR(100) NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  changed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  audit_logs             IS 'Immutable audit trail. One row per field changed per event.';
COMMENT ON COLUMN audit_logs.business_id IS 'Tenant discriminator. Enables efficient per-tenant audit queries.';


-- ════════════════════════════════════════════════════════════════════════════
-- 7. ORDER_COUNTERS
--
-- Atomic per-business, per-year sequence table.
-- Replaces the non-atomic application-layer MAX()+1 approach.
-- The composite PK (business_id, year) gives each business a fully
-- independent counter. Business A's ND-2026-0099 and Business B's
-- ABC-2026-0099 are produced by independent rows in this table.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE order_counters (
  business_id    UUID      NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  year           SMALLINT  NOT NULL,
  last_sequence  INTEGER   NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);

COMMENT ON TABLE  order_counters               IS 'Atomic per-business, per-year order number counters.';
COMMENT ON COLUMN order_counters.last_sequence IS 'Incremented atomically by fn_next_order_number(). Never set directly.';


-- ════════════════════════════════════════════════════════════════════════════
-- 8. INDEXES
--
-- business_id is the leading column in every composite index.
-- This lets Postgres eliminate all rows for other tenants in a single
-- index scan before evaluating the secondary predicate.
-- ════════════════════════════════════════════════════════════════════════════

-- orders
CREATE INDEX idx_orders_biz_status      ON orders (business_id, status);
CREATE INDEX idx_orders_biz_created_at  ON orders (business_id, created_at DESC);
CREATE INDEX idx_orders_biz_created_by  ON orders (business_id, created_by);
CREATE INDEX idx_orders_biz_client_name ON orders (business_id, client_name);
CREATE INDEX idx_orders_biz_mineral     ON orders (business_id, mineral_type);

-- users
CREATE INDEX idx_users_biz              ON users (business_id);
CREATE INDEX idx_users_biz_role         ON users (business_id, role);
CREATE INDEX idx_users_biz_active       ON users (business_id, is_active);

-- audit_logs
CREATE INDEX idx_audit_biz_order        ON audit_logs (business_id, order_id);
CREATE INDEX idx_audit_biz_changed_at   ON audit_logs (business_id, changed_at DESC);

-- businesses (used by verifyToken on every request)
CREATE INDEX idx_businesses_active      ON businesses (is_active);


-- ════════════════════════════════════════════════════════════════════════════
-- 9. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 9a. Auto-update orders.updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();


-- ─── 9b. Protect audit_logs from mutation ────────────────────────────────────
-- Audit logs are immutable by design. This trigger enforces that at the
-- database layer — even a service role client cannot UPDATE or DELETE them.

CREATE OR REPLACE FUNCTION fn_protect_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_protect_audit_logs();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_protect_audit_logs();


-- ════════════════════════════════════════════════════════════════════════════
-- 10. ATOMIC ORDER NUMBER FUNCTION
--
-- fn_next_order_number(p_business_id, p_year)
--
-- Returns a formatted order number: PREFIX-YEAR-SEQUENCE
-- e.g. ND-2026-0001
--
-- Uses INSERT ON CONFLICT DO UPDATE to atomically read-and-increment
-- the counter in a single statement. No SELECT then UPDATE — no race.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_next_order_number(
  p_business_id  UUID,
  p_year         SMALLINT
) RETURNS VARCHAR AS $$
DECLARE
  v_sequence  INTEGER;
  v_prefix    VARCHAR(10);
BEGIN
  SELECT order_prefix
    INTO v_prefix
    FROM businesses
   WHERE id = p_business_id;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'fn_next_order_number: business not found: %', p_business_id;
  END IF;

  INSERT INTO order_counters (business_id, year, last_sequence)
    VALUES (p_business_id, p_year, 1)
  ON CONFLICT (business_id, year)
  DO UPDATE
    SET last_sequence = order_counters.last_sequence + 1
  RETURNING last_sequence
    INTO v_sequence;

  RETURN v_prefix
    || '-' || p_year::TEXT
    || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_next_order_number(UUID, SMALLINT) IS
  'Atomically increments the per-business counter and returns a formatted order number. '
  'Called exclusively by the orders service via supabase.rpc().';


-- ════════════════════════════════════════════════════════════════════════════
-- 11. ROW LEVEL SECURITY
--
-- The backend service role client bypasses RLS entirely (correct and
-- intentional). RLS is a defence-in-depth layer for direct DB access.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_counters  ENABLE ROW LEVEL SECURITY;

-- businesses: authenticated users can read only their own business
CREATE POLICY "businesses_select_own"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- users: scoped to own business
CREATE POLICY "users_select_own_business"
  ON users FOR SELECT
  TO authenticated
  USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "users_update_own_business"
  ON users FOR UPDATE
  TO authenticated
  USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- orders: scoped to own business
CREATE POLICY "orders_select_own_business"
  ON orders FOR SELECT
  TO authenticated
  USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "orders_insert_own_business"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "orders_update_own_business"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- audit_logs: read-only for own business
CREATE POLICY "audit_select_own_business"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- platform_admins, order_counters: no authenticated access (service role only)


-- ════════════════════════════════════════════════════════════════════════════
-- 12. HELPER VIEW
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_orders_with_creator
SET (security_invoker = on)
AS SELECT
  o.id,
  o.business_id,
  o.order_number,
  o.client_name,
  o.mineral_type,
  o.quantity_kg,
  o.unit_price_zar,
  o.total_zar,
  o.status,
  o.notes,
  o.created_at,
  o.updated_at,
  u.id         AS creator_id,
  u.full_name  AS creator_name,
  u.email      AS creator_email
FROM orders o
JOIN users u ON o.created_by = u.id;

COMMENT ON VIEW v_orders_with_creator IS
  'Orders joined with creator. v2.0: includes business_id for tenant scoping.';


-- ════════════════════════════════════════════════════════════════════════════
-- 13. SEED DATA
-- ════════════════════════════════════════════════════════════════════════════

-- Pilot tenant: Ntsoaki Distributions
-- The first admin user is provisioned via: npm run provision
-- (CLI provisioning script — see SRS §6.1)

INSERT INTO businesses (id, name, order_prefix, is_active)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000001',
  'Ntsoaki Distributions',
  'ND',
  TRUE
);


-- ════════════════════════════════════════════════════════════════════════════
-- 14. VERIFY (run manually after applying schema)
-- ════════════════════════════════════════════════════════════════════════════

/*
SELECT
  table_name,
  COUNT(column_name) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'businesses', 'platform_admins', 'users',
    'orders', 'audit_logs', 'order_counters'
  )
GROUP BY table_name
ORDER BY table_name;

-- Confirm function exists
SELECT proname, pronargs FROM pg_proc WHERE proname = 'fn_next_order_number';

-- Smoke-test the function (does NOT create an order — just tests number format)
-- SELECT fn_next_order_number('a1b2c3d4-0000-4000-8000-000000000001', 2026::SMALLINT);
-- → Expected: ND-2026-0001 (counter row created atomically)
-- → Run again: ND-2026-0002
*/