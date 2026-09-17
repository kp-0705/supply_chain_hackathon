-- ============================================================================
-- SUPPLY CHAIN DEMAND MANAGEMENT SYSTEM - FINAL DATABASE SCHEMA
-- PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CUSTOMER', 'LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4')),
  phone TEXT,
  customer_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);

CREATE TABLE IF NOT EXISTS customers (
  customer_id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  company_name TEXT NOT NULL,
  region TEXT,
  email TEXT UNIQUE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK (tier IN ('STRATEGIC', 'STANDARD', 'SPOT')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);

CREATE TABLE IF NOT EXISTS products (
  product_id BIGSERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  standard_cost NUMERIC(12,2) NOT NULL CHECK (standard_cost >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISCONTINUED')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS supply (
  supply_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(product_id),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  week INT NOT NULL CHECK (week BETWEEN 1 AND 4),
  available_quantity NUMERIC(14,2) NOT NULL CHECK (available_quantity >= 0),
  allocated_quantity NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  created_by BIGINT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, month, week)
);

CREATE INDEX IF NOT EXISTS idx_supply_product ON supply(product_id);
CREATE INDEX IF NOT EXISTS idx_supply_month_week ON supply(month, week);
CREATE INDEX IF NOT EXISTS idx_supply_product_month_week ON supply(product_id, month, week);

CREATE TABLE IF NOT EXISTS demand_raw (
  demand_id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  product_id BIGINT NOT NULL REFERENCES products(product_id),
  requested_quantity NUMERIC(14,2) NOT NULL CHECK (requested_quantity > 0),
  required_date DATE NOT NULL,
  level INT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PARTIALLY_ALLOCATED')),
  suggested_quantity NUMERIC(14,2) CHECK (suggested_quantity >= 0),
  reason TEXT,
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_raw_customer ON demand_raw(customer_id);
CREATE INDEX IF NOT EXISTS idx_demand_raw_product ON demand_raw(product_id);
CREATE INDEX IF NOT EXISTS idx_demand_raw_level_status ON demand_raw(level, status);
CREATE INDEX IF NOT EXISTS idx_demand_raw_required_date ON demand_raw(required_date);

CREATE TABLE IF NOT EXISTS demand_action_log (
  action_id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demand_raw(demand_id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level BETWEEN 0 AND 4),
  action_type TEXT NOT NULL CHECK (action_type IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_ALLOCATED', 'AUTO_COMPLETED', 'RETURNED')),
  approved_quantity NUMERIC(14,2),
  reason TEXT,
  comment TEXT,
  approved_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_log_demand ON demand_action_log(demand_id);
CREATE INDEX IF NOT EXISTS idx_action_log_level ON demand_action_log(level);
CREATE INDEX IF NOT EXISTS idx_action_log_created_at ON demand_action_log(created_at DESC);

CREATE TABLE IF NOT EXISTS supply_allocation (
  allocation_id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demand_raw(demand_id) ON DELETE CASCADE,
  supply_id BIGINT NOT NULL REFERENCES supply(supply_id),
  allocated_quantity NUMERIC(14,2) NOT NULL CHECK (allocated_quantity > 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allocation_demand ON supply_allocation(demand_id);
CREATE INDEX IF NOT EXISTS idx_allocation_supply ON supply_allocation(supply_id);

CREATE TABLE IF NOT EXISTS exception_rules (
  rule_id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  threshold JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO exception_rules (code, description, threshold, is_active) VALUES
('LOW_MARGIN', 'Order margin is below 8%', '{"margin_pct_lt": 8}', TRUE),
('HIGH_VALUE', 'Order value exceeds $1M', '{"order_value_gt": 1000000}', TRUE),
('STRATEGIC_CUSTOMER', 'Strategic tier customer with high priority', '{"tier": "STRATEGIC", "priority": "HIGH"}', TRUE),
('SUPPLY_SHORTFALL', 'Approved qty is less than 70% of requested', '{"approved_pct_of_requested_lt": 70}', TRUE),
('PARTIAL_ALLOCATION', 'Demand only partially allocated', '{"is_partial": true}', TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS demand_exceptions (
  exception_id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demand_raw(demand_id) ON DELETE CASCADE,
  rule_id INT NOT NULL REFERENCES exception_rules(rule_id),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  detail JSONB,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by BIGINT REFERENCES users(user_id),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  UNIQUE (demand_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_exceptions_demand ON demand_exceptions(demand_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_resolved ON demand_exceptions(resolved_at);

CREATE TABLE IF NOT EXISTS demand_approved (
  approval_id BIGSERIAL PRIMARY KEY,
  demand_id BIGINT NOT NULL REFERENCES demand_raw(demand_id),
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  product_id BIGINT NOT NULL REFERENCES products(product_id),
  fulfilled_quantity NUMERIC(14,2) NOT NULL CHECK (fulfilled_quantity > 0),
  total_value NUMERIC(14,2) NOT NULL CHECK (total_value >= 0),
  approval_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (demand_id)
);

CREATE INDEX IF NOT EXISTS idx_approved_customer ON demand_approved(customer_id);
CREATE INDEX IF NOT EXISTS idx_approved_product ON demand_approved(product_id);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  demand_id BIGINT REFERENCES demand_raw(demand_id),
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Views
CREATE OR REPLACE VIEW supply_availability AS
SELECT 
  sp.supply_id,
  sp.product_id,
  sp.month,
  sp.week,
  sp.available_quantity,
  sp.allocated_quantity,
  (sp.available_quantity - sp.allocated_quantity) AS remaining_quantity,
  pr.product_name,
  pr.unit_price
FROM supply sp
JOIN products pr ON sp.product_id = pr.product_id
ORDER BY sp.month ASC, sp.week ASC;

CREATE OR REPLACE VIEW demand_status_view AS
SELECT 
  dr.demand_id,
  dr.customer_id,
  c.customer_name,
  dr.product_id,
  pr.product_name,
  dr.requested_quantity,
  COALESCE(SUM(sa.allocated_quantity), 0) AS allocated_quantity,
  (dr.requested_quantity - COALESCE(SUM(sa.allocated_quantity), 0)) AS remaining_quantity,
  dr.level,
  dr.status,
  dr.required_date,
  dr.created_at
FROM demand_raw dr
LEFT JOIN customers c ON dr.customer_id = c.customer_id
LEFT JOIN products pr ON dr.product_id = pr.product_id
LEFT JOIN supply_allocation sa ON dr.demand_id = sa.demand_id
GROUP BY dr.demand_id, c.customer_id, c.customer_name, pr.product_name, dr.created_at;
