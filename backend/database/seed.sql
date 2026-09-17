-- ============================================================================
-- SUPPLY CHAIN DEMAND MANAGEMENT SYSTEM - SEED DATA
-- Default password for all seed users is: password123
-- Password hash generated with bcrypt 10 salt rounds:
-- $2a$10$sP3Vv5p6W1C7X2U8D4eF..UqN.2f7bI1L8O9Z3R6K5T4M1P0E2W1G
-- ============================================================================

-- Customers
INSERT INTO customers (customer_id, customer_name, contact_person, company_name, region, email, priority, phone, address, credit_limit, tier, is_active)
VALUES 
  (1, 'Apple Inc.', 'Tim Cook', 'Apple Corporation', 'US', 'procurement@apple.com', 'HIGH', '+1-408-996-1010', '1 Apple Park Way, Cupertino, CA', 10000000.00, 'STRATEGIC', TRUE),
  (2, 'TechStore Ltd', 'Alex Mercer', 'TechStore Global', 'EU', 'purchasing@techstore.com', 'LOW', '+44-20-7946-0958', '100 London Wall, London, UK', 80000.00, 'SPOT', TRUE),
  (3, 'Dell Technologies', 'Michael Dell', 'Dell Global', 'US', 'supply@dell.com', 'NORMAL', '+1-800-456-3355', '1 Dell Way, Round Rock, TX', 5000000.00, 'STANDARD', TRUE)
ON CONFLICT (customer_id) DO UPDATE SET
  customer_name = EXCLUDED.customer_name,
  credit_limit = EXCLUDED.credit_limit,
  tier = EXCLUDED.tier;

-- Products
INSERT INTO products (product_id, product_name, category, unit_price, standard_cost, status, is_active)
VALUES
  (1, 'Micron HBM3E 24GB 8-High', 'PREMIUM', 350.00, 260.00, 'ACTIVE', TRUE),
  (2, 'Micron DDR5 32GB Server DRAM', 'STANDARD', 120.00, 112.00, 'ACTIVE', TRUE), -- Margin ~6.67% (Tests Rule 3.5 Low Margin)
  (3, 'Micron DDR3 8GB Legacy Module', 'LEGACY', 25.00, 20.00, 'DISCONTINUED', TRUE), -- Discontinued (Tests Rule 1.3)
  (4, 'Micron 9400 NVMe SSD 30.72TB', 'RESTRICTED_EXPORT', 2400.00, 1900.00, 'ACTIVE', TRUE) -- Tests Rule 2.4 EU Export Restriction
ON CONFLICT (product_id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  unit_price = EXCLUDED.unit_price,
  standard_cost = EXCLUDED.standard_cost,
  status = EXCLUDED.status;

-- Users
-- Password is 'password123'
INSERT INTO users (user_id, name, email, password_hash, role, phone, customer_id, is_active)
VALUES
  (1, 'System Administrator', 'admin@micron.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'ADMIN', '+1-208-368-4000', NULL, TRUE),
  (2, 'David Chen (Level 1 Validator)', 'level1@micron.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'LEVEL1', '+1-208-368-4001', NULL, TRUE),
  (3, 'Sarah Jenkins (Level 2 Supply Validator)', 'level2@micron.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'LEVEL2', '+1-208-368-4002', NULL, TRUE),
  (4, 'Marcus Brody (Level 3 Matching Planner)', 'level3@micron.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'LEVEL3', '+1-208-368-4003', NULL, TRUE),
  (5, 'Elena Rostova (Level 4 Executive Approver)', 'level4@micron.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'LEVEL4', '+1-208-368-4004', NULL, TRUE),
  (6, 'Apple Procurement Officer', 'apple_buyer@apple.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'CUSTOMER', '+1-408-996-1011', 1, TRUE),
  (7, 'TechStore Purchasing Agent', 'spot_buyer@techstore.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'CUSTOMER', '+44-20-7946-0959', 2, TRUE),
  (8, 'Dell Procurement Lead', 'dell_buyer@dell.com', '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS', 'CUSTOMER', '+1-800-456-3356', 3, TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Supply Plans for Month 9 (September 2026)
-- Product 1: HBM3E
INSERT INTO supply (product_id, month, week, available_quantity, allocated_quantity, created_by)
VALUES
  (1, 9, 1, 600.00, 0.00, 1),
  (1, 9, 2, 800.00, 0.00, 1),
  (1, 9, 3, 1000.00, 0.00, 1),
  (1, 9, 4, 1200.00, 0.00, 1),
  -- Product 2: DDR5
  (2, 9, 1, 1500.00, 600.00, 1),
  (2, 9, 2, 2000.00, 0.00, 1),
  (2, 9, 3, 1800.00, 0.00, 1),
  (2, 9, 4, 2500.00, 0.00, 1)
ON CONFLICT (product_id, month, week) DO UPDATE SET
  available_quantity = EXCLUDED.available_quantity;

-- Sample Demands to demonstrate workflows
-- Demand 1: Fresh submission at Level 0 (for Level 1 to review)
INSERT INTO demand_raw (demand_id, customer_id, product_id, requested_quantity, required_date, level, status, suggested_quantity, reason, confidence)
VALUES 
  (1, 1, 1, 500.00, CURRENT_DATE + INTERVAL '14 days', 0, 'PENDING', 500.00, 'Strategic client with excellent credit and healthy inventory', 95)
ON CONFLICT (demand_id) DO NOTHING;

INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, approved_by)
VALUES (1, 0, 'SUBMITTED', 500.00, 'Customer submitted online request', 6)
ON CONFLICT DO NOTHING;

-- Demand 2: At Level 2 awaiting supply validation
INSERT INTO demand_raw (demand_id, customer_id, product_id, requested_quantity, required_date, level, status, suggested_quantity, reason, confidence)
VALUES 
  (2, 3, 2, 1000.00, CURRENT_DATE + INTERVAL '20 days', 1, 'PENDING', 1000.00, 'Validated customer credit and product line status', 88)
ON CONFLICT (demand_id) DO NOTHING;

INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, approved_by)
VALUES 
  (2, 0, 'SUBMITTED', 1000.00, 'Submitted by Dell procurement', 8),
  (2, 1, 'APPROVED', 1000.00, 'Level 1: Passed credit limit and product active checks', 2)
ON CONFLICT DO NOTHING;

-- Demand 3: Partially allocated demand at Level 3
INSERT INTO demand_raw (demand_id, customer_id, product_id, requested_quantity, required_date, level, status, suggested_quantity, reason, confidence)
VALUES 
  (3, 1, 2, 1000.00, CURRENT_DATE + INTERVAL '25 days', 3, 'PARTIALLY_ALLOCATED', 600.00, 'Allocated 600 from Week 1; waiting for Week 2 supply replenishment', 78)
ON CONFLICT (demand_id) DO NOTHING;

INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, approved_by)
VALUES 
  (3, 0, 'SUBMITTED', 1000.00, 'Apple high-volume batch request', 6),
  (3, 1, 'APPROVED', 1000.00, 'Passed customer and tier validation', 2),
  (3, 2, 'APPROVED', 1000.00, 'Supply plan confirmed for September 2026', 3),
  (3, 3, 'PARTIALLY_ALLOCATED', 600.00, 'Partial allocation: 600/1000 units allocated from Week 1. Waiting for additional supply.', 4)
ON CONFLICT DO NOTHING;

-- Tie Demand 3 to supply allocation
INSERT INTO supply_allocation (allocation_id, demand_id, supply_id, allocated_quantity)
SELECT 1, 3, supply_id, 600.00 FROM supply WHERE product_id = 2 AND month = 9 AND week = 1
ON CONFLICT DO NOTHING;

-- Seed notification
INSERT INTO notifications (user_id, demand_id, title, body, is_read)
VALUES 
  (2, 1, 'New Demand Awaiting Validation', 'Apple Inc. requested 500 units of Micron HBM3E 24GB', FALSE),
  (4, 3, 'Partial Allocation in Progress', 'Demand #3 has 600/1000 units allocated. Awaiting replenishment.', FALSE)
ON CONFLICT DO NOTHING;

-- Reset sequence IDs
SELECT setval(pg_get_serial_sequence('customers', 'customer_id'), COALESCE(max(customer_id), 1)) FROM customers;
SELECT setval(pg_get_serial_sequence('products', 'product_id'), COALESCE(max(product_id), 1)) FROM products;
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE(max(user_id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('demand_raw', 'demand_id'), COALESCE(max(demand_id), 1)) FROM demand_raw;
SELECT setval(pg_get_serial_sequence('supply', 'supply_id'), COALESCE(max(supply_id), 1)) FROM supply;
