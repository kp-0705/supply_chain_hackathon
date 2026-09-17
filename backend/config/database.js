const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('./env');

let pool = null;
let isPostgres = false;
let mockDb = null;

// Initialize PostgreSQL Pool
try {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000
  });
} catch (e) {
  console.warn('PostgreSQL pool creation warning:', e.message);
}

// In-Memory Database Fallback if PostgreSQL is not running locally
class InMemoryDatabase {
  constructor() {
    this.users = [];
    this.customers = [];
    this.products = [];
    this.supply = [];
    this.demand_raw = [];
    this.demand_action_log = [];
    this.supply_allocation = [];
    this.exception_rules = [];
    this.demand_exceptions = [];
    this.demand_approved = [];
    this.notifications = [];
    this.counters = {
      user_id: 10,
      customer_id: 10,
      product_id: 10,
      supply_id: 20,
      demand_id: 10,
      action_id: 20,
      allocation_id: 20,
      rule_id: 10,
      exception_id: 10,
      approval_id: 10,
      notification_id: 20
    };
    this.seedDefaultData();
  }

  seedDefaultData() {
    // Password is 'password123'
    const passwordHash = '$2a$10$GKu1Qgc4CDkdrWiLc4XqJ.eah9jjPJz91mhbNRO8ayzrD6w0FjDLS';

    this.customers = [
      { customer_id: 1, customer_name: 'Apple Inc.', contact_person: 'Tim Cook', company_name: 'Apple Corporation', region: 'US', email: 'procurement@apple.com', priority: 'HIGH', phone: '+1-408-996-1010', address: '1 Apple Park Way, Cupertino, CA', credit_limit: 10000000.00, tier: 'STRATEGIC', is_active: true, created_at: new Date() },
      { customer_id: 2, customer_name: 'TechStore Ltd', contact_person: 'Alex Mercer', company_name: 'TechStore Global', region: 'EU', email: 'purchasing@techstore.com', priority: 'LOW', phone: '+44-20-7946-0958', address: '100 London Wall, London, UK', credit_limit: 80000.00, tier: 'SPOT', is_active: true, created_at: new Date() },
      { customer_id: 3, customer_name: 'Dell Technologies', contact_person: 'Michael Dell', company_name: 'Dell Global', region: 'US', email: 'supply@dell.com', priority: 'NORMAL', phone: '+1-800-456-3355', address: '1 Dell Way, Round Rock, TX', credit_limit: 5000000.00, tier: 'STANDARD', is_active: true, created_at: new Date() }
    ];

    this.products = [
      { product_id: 1, product_name: 'Micron HBM3E 24GB 8-High', category: 'PREMIUM', unit_price: 350.00, standard_cost: 260.00, status: 'ACTIVE', is_active: true, created_at: new Date() },
      { product_id: 2, product_name: 'Micron DDR5 32GB Server DRAM', category: 'STANDARD', unit_price: 120.00, standard_cost: 112.00, status: 'ACTIVE', is_active: true, created_at: new Date() },
      { product_id: 3, product_name: 'Micron DDR3 8GB Legacy Module', category: 'LEGACY', unit_price: 25.00, standard_cost: 20.00, status: 'DISCONTINUED', is_active: true, created_at: new Date() },
      { product_id: 4, product_name: 'Micron 9400 NVMe SSD 30.72TB', category: 'RESTRICTED_EXPORT', unit_price: 2400.00, standard_cost: 1900.00, status: 'ACTIVE', is_active: true, created_at: new Date() }
    ];

    this.users = [
      { user_id: 1, name: 'System Administrator', email: 'admin@micron.com', password_hash: passwordHash, role: 'ADMIN', phone: '+1-208-368-4000', customer_id: null, is_active: true, created_at: new Date() },
      { user_id: 2, name: 'David Chen (Level 1 Validator)', email: 'level1@micron.com', password_hash: passwordHash, role: 'LEVEL1', phone: '+1-208-368-4001', customer_id: null, is_active: true, created_at: new Date() },
      { user_id: 3, name: 'Sarah Jenkins (Level 2 Supply Validator)', email: 'level2@micron.com', password_hash: passwordHash, role: 'LEVEL2', phone: '+1-208-368-4002', customer_id: null, is_active: true, created_at: new Date() },
      { user_id: 4, name: 'Marcus Brody (Level 3 Matching Planner)', email: 'level3@micron.com', password_hash: passwordHash, role: 'LEVEL3', phone: '+1-208-368-4003', customer_id: null, is_active: true, created_at: new Date() },
      { user_id: 5, name: 'Elena Rostova (Level 4 Executive Approver)', email: 'level4@micron.com', password_hash: passwordHash, role: 'LEVEL4', phone: '+1-208-368-4004', customer_id: null, is_active: true, created_at: new Date() },
      { user_id: 6, name: 'Apple Procurement Officer', email: 'apple_buyer@apple.com', password_hash: passwordHash, role: 'CUSTOMER', phone: '+1-408-996-1011', customer_id: 1, is_active: true, created_at: new Date() },
      { user_id: 7, name: 'TechStore Purchasing Agent', email: 'spot_buyer@techstore.com', password_hash: passwordHash, role: 'CUSTOMER', phone: '+44-20-7946-0959', customer_id: 2, is_active: true, created_at: new Date() },
      { user_id: 8, name: 'Dell Procurement Lead', email: 'dell_buyer@dell.com', password_hash: passwordHash, role: 'CUSTOMER', phone: '+1-800-456-3356', customer_id: 3, is_active: true, created_at: new Date() }
    ];

    this.supply = [
      // Product 1: Month 9 (September 2026)
      { supply_id: 1, product_id: 1, month: 9, week: 1, available_quantity: 600.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 2, product_id: 1, month: 9, week: 2, available_quantity: 800.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 3, product_id: 1, month: 9, week: 3, available_quantity: 1000.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 4, product_id: 1, month: 9, week: 4, available_quantity: 1200.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      // Product 1: Month 10 (October 2026)
      { supply_id: 9, product_id: 1, month: 10, week: 1, available_quantity: 800.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 10, product_id: 1, month: 10, week: 2, available_quantity: 1000.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 11, product_id: 1, month: 10, week: 3, available_quantity: 1200.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 12, product_id: 1, month: 10, week: 4, available_quantity: 1500.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      // Product 2: Month 9 (September 2026)
      { supply_id: 5, product_id: 2, month: 9, week: 1, available_quantity: 1500.00, allocated_quantity: 600.00, created_by: 1, created_at: new Date() },
      { supply_id: 6, product_id: 2, month: 9, week: 2, available_quantity: 2000.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 7, product_id: 2, month: 9, week: 3, available_quantity: 1800.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 8, product_id: 2, month: 9, week: 4, available_quantity: 2500.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      // Product 2: Month 10 (October 2026)
      { supply_id: 13, product_id: 2, month: 10, week: 1, available_quantity: 2000.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 14, product_id: 2, month: 10, week: 2, available_quantity: 2200.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 15, product_id: 2, month: 10, week: 3, available_quantity: 2500.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() },
      { supply_id: 16, product_id: 2, month: 10, week: 4, available_quantity: 3000.00, allocated_quantity: 0.00, created_by: 1, created_at: new Date() }
    ];

    const today = new Date();
    const plus5 = new Date(today); plus5.setDate(today.getDate() + 5);
    const plus10 = new Date(today); plus10.setDate(today.getDate() + 10);
    const plus12 = new Date(today); plus12.setDate(today.getDate() + 12);

    this.demand_raw = [
      { demand_id: 1, customer_id: 1, product_id: 1, requested_quantity: 500.00, required_date: plus5.toISOString().split('T')[0], level: 0, status: 'PENDING', suggested_quantity: 500.00, reason: 'Strategic client with excellent credit', confidence: 95, created_at: new Date() },
      { demand_id: 2, customer_id: 3, product_id: 2, requested_quantity: 1000.00, required_date: plus10.toISOString().split('T')[0], level: 1, status: 'PENDING', suggested_quantity: 1000.00, reason: 'Validated customer credit and active status', confidence: 88, created_at: new Date() },
      { demand_id: 3, customer_id: 1, product_id: 2, requested_quantity: 1000.00, required_date: plus12.toISOString().split('T')[0], level: 3, status: 'PARTIALLY_ALLOCATED', suggested_quantity: 600.00, reason: 'Partial allocation: 600 allocated from Week 1; waiting for Week 2 supply', confidence: 78, created_at: new Date() }
    ];

    this.demand_action_log = [
      { action_id: 1, demand_id: 1, level: 0, action_type: 'SUBMITTED', approved_quantity: 500.00, reason: 'Customer submitted online request', comment: null, approved_by: 6, created_at: new Date() },
      { action_id: 2, demand_id: 2, level: 0, action_type: 'SUBMITTED', approved_quantity: 1000.00, reason: 'Submitted by Dell procurement', comment: null, approved_by: 8, created_at: new Date() },
      { action_id: 3, demand_id: 2, level: 1, action_type: 'APPROVED', approved_quantity: 1000.00, reason: 'Level 1: Passed credit limit and product active checks', comment: null, approved_by: 2, created_at: new Date() },
      { action_id: 4, demand_id: 3, level: 0, action_type: 'SUBMITTED', approved_quantity: 1000.00, reason: 'Apple high-volume batch request', comment: null, approved_by: 6, created_at: new Date() },
      { action_id: 5, demand_id: 3, level: 1, action_type: 'APPROVED', approved_quantity: 1000.00, reason: 'Passed customer and tier validation', comment: null, approved_by: 2, created_at: new Date() },
      { action_id: 6, demand_id: 3, level: 2, action_type: 'APPROVED', approved_quantity: 1000.00, reason: 'Supply plan confirmed for September 2026', comment: null, approved_by: 3, created_at: new Date() },
      { action_id: 7, demand_id: 3, level: 3, action_type: 'PARTIALLY_ALLOCATED', approved_quantity: 600.00, reason: 'Partial allocation: 600/1000 units allocated from Week 1. Waiting for additional supply.', comment: null, approved_by: 4, created_at: new Date() }
    ];

    this.supply_allocation = [
      { allocation_id: 1, demand_id: 3, supply_id: 5, allocated_quantity: 600.00, allocated_at: new Date() }
    ];

    this.exception_rules = [
      { rule_id: 1, code: 'LOW_MARGIN', description: 'Order margin is below 8%', threshold: { margin_pct_lt: 8 }, is_active: true },
      { rule_id: 2, code: 'HIGH_VALUE', description: 'Order value exceeds $1M', threshold: { order_value_gt: 1000000 }, is_active: true },
      { rule_id: 3, code: 'STRATEGIC_CUSTOMER', description: 'Strategic tier customer with high priority', threshold: { tier: 'STRATEGIC', priority: 'HIGH' }, is_active: true },
      { rule_id: 4, code: 'SUPPLY_SHORTFALL', description: 'Approved qty is less than 70% of requested', threshold: { approved_pct_of_requested_lt: 70 }, is_active: true },
      { rule_id: 5, code: 'PARTIAL_ALLOCATION', description: 'Demand only partially allocated', threshold: { is_partial: true }, is_active: true }
    ];

    this.notifications = [
      { notification_id: 1, user_id: 2, demand_id: 1, title: 'New Demand Awaiting Validation', body: 'Apple Inc. requested 500 units of Micron HBM3E 24GB', is_read: false, created_at: new Date() },
      { notification_id: 2, user_id: 4, demand_id: 3, title: 'Partial Allocation in Progress', body: 'Demand #3 has 600/1000 units allocated. Awaiting replenishment.', is_read: false, created_at: new Date() }
    ];
  }

  // High-fidelity query parser for fallback mode
  async query(text, params = []) {
    const q = text.trim();
    const upper = q.toUpperCase();

    // SELECT 1 test
    if (upper === 'SELECT 1' || upper === 'SELECT 1 AS RESULT') {
      return { rows: [{ result: 1 }], rowCount: 1 };
    }

    // USERS queries
    if (upper.includes('FROM USERS') && (upper.includes('WHERE USER_ID') || upper.includes('WHERE U.USER_ID') || upper.includes('WHERE USER_ID ='))) {
      const id = Number(params[0]);
      const found = this.users.find(u => Number(u.user_id) === id);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.includes('FROM USERS') && (upper.includes('WHERE EMAIL') || upper.includes('WHERE LOWER(EMAIL)') || upper.includes('LOWER(EMAIL) ='))) {
      const email = params[0];
      const found = this.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.startsWith('INSERT INTO USERS')) {
      const id = ++this.counters.user_id;
      const newUser = {
        user_id: id,
        name: params[0],
        email: params[1],
        password_hash: params[2],
        role: params[3],
        phone: params[4] || null,
        customer_id: params[5] ? Number(params[5]) : null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.users.push(newUser);
      return { rows: [{ ...newUser }], rowCount: 1 };
    }

    // CUSTOMERS queries
    if (upper.includes('FROM CUSTOMERS WHERE CUSTOMER_ID =')) {
      const id = Number(params[0]);
      const found = this.customers.find(c => Number(c.customer_id) === id);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.includes('FROM CUSTOMERS') && !upper.includes('WHERE')) {
      return { rows: this.customers.map(c => ({ ...c })), rowCount: this.customers.length };
    }

    // PRODUCTS queries
    if (upper.includes('FROM PRODUCTS WHERE PRODUCT_ID =')) {
      const id = Number(params[0]);
      const found = this.products.find(p => Number(p.product_id) === id);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.includes('FROM PRODUCTS') && !upper.includes('WHERE')) {
      return { rows: this.products.map(p => ({ ...p })), rowCount: this.products.length };
    }

    if (upper.startsWith('INSERT INTO PRODUCTS')) {
      const id = ++this.counters.product_id;
      const newProduct = {
        product_id: id,
        product_name: params[0],
        category: params[1],
        unit_price: Number(params[2]),
        standard_cost: Number(params[3]),
        status: params[4] || 'ACTIVE',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.products.push(newProduct);
      return { rows: [{ ...newProduct }], rowCount: 1 };
    }

    // SUPPLY queries
    if (upper.includes('FROM SUPPLY') && upper.includes('WHERE PRODUCT_ID =') && upper.includes('MONTH =') && upper.includes('WEEK =')) {
      const prodId = Number(params[0]);
      const month = Number(params[1]);
      const week = Number(params[2]);
      const found = this.supply.find(s => Number(s.product_id) === prodId && Number(s.month) === month && Number(s.week) === week);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.includes('FROM SUPPLY') && upper.includes('WHERE PRODUCT_ID =') && upper.includes('MONTH =')) {
      const prodId = Number(params[0]);
      const month = Number(params[1]);
      const rows = this.supply.filter(s => Number(s.product_id) === prodId && Number(s.month) === month);
      return { rows: rows.map(r => ({ ...r })), rowCount: rows.length };
    }

    if (upper.includes('FROM SUPPLY') && upper.includes('WHERE PRODUCT_ID =') && upper.includes('ORDER BY WEEK')) {
      const prodId = Number(params[0]);
      const rows = this.supply.filter(s => Number(s.product_id) === prodId).sort((a, b) => a.week - b.week);
      return { rows: rows.map(r => ({ ...r })), rowCount: rows.length };
    }

    if (upper.includes('FROM SUPPLY_AVAILABILITY') || (upper.includes('FROM SUPPLY') && upper.includes('JOIN PRODUCTS'))) {
      const rows = this.supply.map(s => {
        const prod = this.products.find(p => Number(p.product_id) === Number(s.product_id)) || {};
        return {
          supply_id: s.supply_id,
          product_id: s.product_id,
          month: s.month,
          week: s.week,
          available_quantity: Number(s.available_quantity),
          allocated_quantity: Number(s.allocated_quantity),
          remaining_quantity: Number(s.available_quantity) - Number(s.allocated_quantity),
          product_name: prod.product_name || 'Product ' + s.product_id,
          unit_price: prod.unit_price || 0
        };
      }).sort((a, b) => a.month - b.month || a.week - b.week);
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO SUPPLY')) {
      const prodId = Number(params[0]);
      const month = Number(params[1]);
      const week = Number(params[2]);
      const available = Number(params[3]);
      const createdBy = Number(params[4]);
      
      const existingIdx = this.supply.findIndex(s => Number(s.product_id) === prodId && Number(s.month) === month && Number(s.week) === week);
      if (existingIdx >= 0) {
        this.supply[existingIdx].available_quantity = available;
        this.supply[existingIdx].updated_at = new Date();
        return { rows: [{ ...this.supply[existingIdx] }], rowCount: 1 };
      }

      const id = ++this.counters.supply_id;
      const newSupply = {
        supply_id: id,
        product_id: prodId,
        month,
        week,
        available_quantity: available,
        allocated_quantity: 0.00,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.supply.push(newSupply);
      return { rows: [{ ...newSupply }], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE SUPPLY SET ALLOCATED_QUANTITY = ALLOCATED_QUANTITY +')) {
      const delta = Number(params[0]);
      const supplyId = Number(params[1]);
      const item = this.supply.find(s => Number(s.supply_id) === supplyId);
      if (item) {
        item.allocated_quantity = Number(item.allocated_quantity) + delta;
        item.updated_at = new Date();
      }
      return { rowCount: item ? 1 : 0 };
    }

    if (upper.startsWith('UPDATE SUPPLY SET ALLOCATED_QUANTITY = ALLOCATED_QUANTITY -')) {
      const delta = Number(params[0]);
      const supplyId = Number(params[1]);
      const item = this.supply.find(s => Number(s.supply_id) === supplyId);
      if (item) {
        item.allocated_quantity = Math.max(0, Number(item.allocated_quantity) - delta);
        item.updated_at = new Date();
      }
      return { rowCount: item ? 1 : 0 };
    }

    // DEMAND_RAW queries
    if (upper.includes('FROM DEMAND_RAW') && (upper.includes('WHERE DEMAND_ID =') || upper.includes('WHERE DR.DEMAND_ID ='))) {
      const id = Number(params[0]);
      const demand = this.demand_raw.find(d => Number(d.demand_id) === id);
      if (!demand) return { rows: [], rowCount: 0 };
      const cust = this.customers.find(c => Number(c.customer_id) === Number(demand.customer_id)) || {};
      const prod = this.products.find(p => Number(p.product_id) === Number(demand.product_id)) || {};
      return {
        rows: [{
          ...demand,
          customer_name: cust.customer_name,
          tier: cust.tier,
          priority: cust.priority,
          credit_limit: cust.credit_limit,
          region: cust.region,
          product_name: prod.product_name,
          category: prod.category,
          unit_price: prod.unit_price,
          standard_cost: prod.standard_cost
        }],
        rowCount: 1
      };
    }

    if (upper.includes('FROM DEMAND_RAW DR') && upper.includes('WHERE DR.LEVEL =')) {
      const lvl = Number(params[0]);
      const filtered = this.demand_raw.filter(d => Number(d.level) === lvl && (d.status === 'PENDING' || d.status === 'PARTIALLY_ALLOCATED'));
      const rows = filtered.map(d => {
        const cust = this.customers.find(c => Number(c.customer_id) === Number(d.customer_id)) || {};
        const prod = this.products.find(p => Number(p.product_id) === Number(d.product_id)) || {};
        return {
          ...d,
          customer_name: cust.customer_name,
          tier: cust.tier,
          priority: cust.priority,
          credit_limit: cust.credit_limit,
          region: cust.region,
          product_name: prod.product_name,
          category: prod.category,
          unit_price: prod.unit_price,
          standard_cost: prod.standard_cost
        };
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return { rows, rowCount: rows.length };
    }

    if (upper.includes('FROM DEMAND_RAW') && upper.includes('WHERE CUSTOMER_ID =') && !upper.includes('STATUS IN')) {
      const custId = Number(params[0]);
      const filtered = this.demand_raw.filter(d => Number(d.customer_id) === custId);
      const rows = filtered.map(d => {
        const prod = this.products.find(p => Number(p.product_id) === Number(d.product_id)) || {};
        const cust = this.customers.find(c => Number(c.customer_id) === Number(d.customer_id)) || {};
        const allocations = this.supply_allocation.filter(a => Number(a.demand_id) === Number(d.demand_id));
        const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocated_quantity), 0);
        return {
          ...d,
          customer_name: cust.customer_name,
          product_name: prod.product_name,
          unit_price: prod.unit_price,
          allocated_quantity: totalAllocated,
          remaining_quantity: Number(d.requested_quantity) - totalAllocated
        };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows, rowCount: rows.length };
    }

    if (upper.includes('FROM DEMAND_RAW') && upper.includes('STATUS = \'PARTIALLY_ALLOCATED\'')) {
      let filtered = this.demand_raw.filter(d => d.status === 'PARTIALLY_ALLOCATED' && Number(d.level) === 3);
      if (params.length > 0) {
        filtered = filtered.filter(d => Number(d.product_id) === Number(params[0]));
      }
      return { rows: filtered.map(d => ({ ...d })), rowCount: filtered.length };
    }

    if (upper.includes('FROM DEMAND_RAW') && upper.includes('CUSTOMER_ID =') && upper.includes('PRODUCT_ID =') && upper.includes('STATUS IN')) {
      const custId = Number(params[0]);
      const prodId = Number(params[1]);
      const found = this.demand_raw.filter(d => Number(d.customer_id) === custId && Number(d.product_id) === prodId && ['PENDING', 'APPROVED', 'PARTIALLY_ALLOCATED'].includes(d.status));
      return { rows: found.map(d => ({ ...d })), rowCount: found.length };
    }

    if (upper.startsWith('INSERT INTO DEMAND_RAW')) {
      const id = ++this.counters.demand_id;
      const newDemand = {
        demand_id: id,
        customer_id: Number(params[0]),
        product_id: Number(params[1]),
        requested_quantity: Number(params[2]),
        required_date: params[3],
        level: params[4] !== undefined ? Number(params[4]) : 0,
        status: params[5] || 'PENDING',
        suggested_quantity: params[6] !== undefined ? Number(params[6]) : null,
        reason: params[7] || null,
        confidence: params[8] !== undefined ? Number(params[8]) : null,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.demand_raw.push(newDemand);
      return { rows: [{ ...newDemand }], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE DEMAND_RAW')) {
      const demandId = Number(params[params.length - 1]);
      const item = this.demand_raw.find(d => Number(d.demand_id) === demandId);
      if (item) {
        if (upper.includes('LEVEL = 1')) item.level = 1;
        else if (upper.includes('LEVEL = 2')) item.level = 2;
        else if (upper.includes('LEVEL = 3')) item.level = 3;
        else if (upper.includes('LEVEL = 4')) item.level = 4;

        if (upper.includes("STATUS = 'APPROVED'")) item.status = 'APPROVED';
        else if (upper.includes("STATUS = 'REJECTED'")) item.status = 'REJECTED';
        else if (upper.includes("STATUS = 'PARTIALLY_ALLOCATED'")) item.status = 'PARTIALLY_ALLOCATED';

        if (params.length === 4) {
          item.status = params[0];
          item.level = Number(params[1]);
          if (params[2] !== undefined && params[2] !== null) item.suggested_quantity = Number(params[2]);
        }
        item.updated_at = new Date();
      }
      return { rowCount: item ? 1 : 0 };
    }

    // ACTION LOG queries
    if (upper.includes('FROM DEMAND_ACTION_LOG') && upper.includes('WHERE DEMAND_ID =')) {
      const id = Number(params[0]);
      const logs = this.demand_action_log.filter(l => Number(l.demand_id) === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const rows = logs.map(l => {
        const user = this.users.find(u => Number(u.user_id) === Number(l.approved_by)) || {};
        return {
          ...l,
          user_name: user.name || 'System',
          role: user.role || 'SYSTEM'
        };
      });
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO DEMAND_ACTION_LOG')) {
      const id = ++this.counters.action_id;
      const newLog = {
        action_id: id,
        demand_id: Number(params[0]),
        level: Number(params[1]),
        action_type: params[2],
        approved_quantity: params[3] !== undefined && params[3] !== null ? Number(params[3]) : null,
        reason: params[4] || null,
        comment: params[5] || null,
        approved_by: params[6] ? Number(params[6]) : null,
        created_at: new Date()
      };
      this.demand_action_log.push(newLog);
      return { rows: [{ ...newLog }], rowCount: 1 };
    }

    // SUPPLY ALLOCATION queries
    if (upper.includes('FROM SUPPLY_ALLOCATION') && upper.includes('SUM(ALLOCATED_QUANTITY)')) {
      const id = Number(params[0]);
      const allocations = this.supply_allocation.filter(a => Number(a.demand_id) === id);
      const total = allocations.reduce((sum, a) => sum + Number(a.allocated_quantity), 0);
      return { rows: [{ total_alloc: total }], rowCount: 1 };
    }

    if (upper.includes('FROM SUPPLY_ALLOCATION') && upper.includes('WHERE DEMAND_ID =')) {
      const id = Number(params[0]);
      const allocations = this.supply_allocation.filter(a => Number(a.demand_id) === id);
      const rows = allocations.map(a => {
        const sup = this.supply.find(s => Number(s.supply_id) === Number(a.supply_id)) || {};
        return { ...a, week: sup.week, month: sup.month };
      });
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO SUPPLY_ALLOCATION')) {
      const id = ++this.counters.allocation_id;
      const newAlloc = {
        allocation_id: id,
        demand_id: Number(params[0]),
        supply_id: Number(params[1]),
        allocated_quantity: Number(params[2]),
        allocated_at: new Date()
      };
      this.supply_allocation.push(newAlloc);
      return { rows: [{ ...newAlloc }], rowCount: 1 };
    }

    if (upper.startsWith('DELETE FROM SUPPLY_ALLOCATION WHERE DEMAND_ID =')) {
      const id = Number(params[0]);
      const initialCount = this.supply_allocation.length;
      this.supply_allocation = this.supply_allocation.filter(a => Number(a.demand_id) !== id);
      return { rowCount: initialCount - this.supply_allocation.length };
    }

    // EXCEPTIONS queries
    if (upper.includes('FROM DEMAND_EXCEPTIONS') && upper.includes('WHERE DEMAND_ID =')) {
      const id = Number(params[0]);
      const exceptions = this.demand_exceptions.filter(e => Number(e.demand_id) === id);
      const rows = exceptions.map(e => {
        const rule = this.exception_rules.find(r => Number(r.rule_id) === Number(e.rule_id)) || {};
        return { ...e, code: rule.code, description: rule.description };
      });
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO DEMAND_EXCEPTIONS')) {
      const id = ++this.counters.exception_id;
      const newEx = {
        exception_id: id,
        demand_id: Number(params[0]),
        rule_id: Number(params[1]),
        severity: params[2] || 'MEDIUM',
        detail: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        raised_at: new Date(),
        resolved_by: null,
        resolution: null,
        resolved_at: null
      };
      const existing = this.demand_exceptions.find(e => Number(e.demand_id) === newEx.demand_id && Number(e.rule_id) === newEx.rule_id);
      if (!existing) this.demand_exceptions.push(newEx);
      return { rows: [newEx], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE DEMAND_EXCEPTIONS SET RESOLUTION =')) {
      const resolution = params[0];
      const resolvedBy = Number(params[1]);
      const demandId = Number(params[2]);
      this.demand_exceptions.forEach(e => {
        if (Number(e.demand_id) === demandId) {
          e.resolution = resolution;
          e.resolved_by = resolvedBy;
          e.resolved_at = new Date();
        }
      });
      return { rowCount: 1 };
    }

    // DEMAND_APPROVED queries
    if (upper.startsWith('INSERT INTO DEMAND_APPROVED')) {
      const id = ++this.counters.approval_id;
      const newAppr = {
        approval_id: id,
        demand_id: Number(params[0]),
        customer_id: Number(params[1]),
        product_id: Number(params[2]),
        fulfilled_quantity: Number(params[3]),
        total_value: Number(params[4]),
        approved_by: Number(params[5]),
        approval_date: new Date(),
        created_at: new Date()
      };
      this.demand_approved.push(newAppr);
      return { rows: [{ ...newAppr }], rowCount: 1 };
    }

    if (upper.includes('FROM DEMAND_APPROVED') && upper.includes('SUM(TOTAL_VALUE)')) {
      const id = Number(params[0]);
      const rows = this.demand_approved.filter(a => Number(a.customer_id) === id);
      const total = rows.reduce((sum, a) => sum + Number(a.total_value), 0);
      return { rows: [{ total_approved: total }], rowCount: 1 };
    }

    if (upper.includes('FROM DEMAND_APPROVED')) {
      if (params.length > 0) {
        const id = Number(params[0]);
        const rows = this.demand_approved.filter(a => Number(a.customer_id) === id);
        return { rows: rows.map(r => ({ ...r })), rowCount: rows.length };
      }
      return { rows: this.demand_approved.map(r => ({ ...r })), rowCount: this.demand_approved.length };
    }

    // NOTIFICATIONS queries
    if (upper.includes('FROM NOTIFICATIONS WHERE USER_ID =')) {
      const id = Number(params[0]);
      const notes = this.notifications.filter(n => Number(n.user_id) === id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: notes.map(n => ({ ...n })), rowCount: notes.length };
    }

    if (upper.startsWith('INSERT INTO NOTIFICATIONS')) {
      const id = ++this.counters.notification_id;
      const newNote = {
        notification_id: id,
        user_id: Number(params[0]),
        demand_id: params[1] ? Number(params[1]) : null,
        title: params[2],
        body: params[3] || null,
        is_read: false,
        created_at: new Date()
      };
      this.notifications.push(newNote);
      return { rows: [{ ...newNote }], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE NOTIFICATIONS SET IS_READ = TRUE WHERE NOTIFICATION_ID =')) {
      const id = Number(params[0]);
      const note = this.notifications.find(n => Number(n.notification_id) === id);
      if (note) note.is_read = true;
      return { rowCount: note ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  // Client mock for transactions
  getClient() {
    return {
      query: (text, params) => this.query(text, params),
      release: () => {}
    };
  }
}

// Database query wrapper
async function query(text, params = []) {
  if (isPostgres && pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      // If error is connection loss, fallback
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.warn('PostgreSQL connection dropped, falling back to mock database:', err.message);
        isPostgres = false;
        if (!mockDb) mockDb = new InMemoryDatabase();
        return await mockDb.query(text, params);
      }
      throw err;
    }
  }

  if (!mockDb) {
    mockDb = new InMemoryDatabase();
  }
  return await mockDb.query(text, params);
}

// Transaction client provider
async function getClient() {
  if (isPostgres && pool) {
    try {
      return await pool.connect();
    } catch (err) {
      console.warn('Failed to obtain PG client, using mock DB:', err.message);
      isPostgres = false;
    }
  }

  if (!mockDb) {
    mockDb = new InMemoryDatabase();
  }
  return mockDb.getClient();
}

// Database initializer
async function initDb() {
  console.log('Initializing Supply Chain Database connection...');
  if (pool) {
    try {
      const testRes = await pool.query('SELECT 1 AS connected');
      if (testRes.rows[0]?.connected === 1) {
        console.log('✓ Successfully connected to PostgreSQL at:', env.DATABASE_URL);
        isPostgres = true;

        // Apply Schema & Seed
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const seedPath = path.join(__dirname, '../database/seed.sql');

        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(schemaSql);
          console.log('✓ PostgreSQL schema verified/applied');
        }

        // Check if users exist before running seed
        const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
        if (parseInt(userCheck.rows[0].count, 10) === 0 && fs.existsSync(seedPath)) {
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          await pool.query(seedSql);
          console.log('✓ PostgreSQL seed data successfully applied');
        }
        return true;
      }
    } catch (err) {
      console.warn('PostgreSQL connection failed (' + err.message + ').');
      console.log('→ Activating zero-dependency in-memory Supply Chain Database engine with full seed dataset.');
      isPostgres = false;
    }
  }

  if (!mockDb) {
    mockDb = new InMemoryDatabase();
  }
  console.log('✓ In-memory database initialized with test customers, products, supply, and approvers.');
  return true;
}

module.exports = {
  query,
  getClient,
  initDb,
  getIsPostgres: () => isPostgres
};
