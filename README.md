# Micron Supply Chain Demand Management System

A production-ready, full-stack **Supply Chain Demand Management System** built for Micron (semiconductor manufacturer) to orchestrate multi-tier demand validation, factory supply allocation, and executive fulfillment governance.

---

## Architecture Overview

- **Backend:** Node.js + Express (REST API with RBAC)
- **Frontend:** React 18 + Tailwind CSS + Lucide Icons (Vite)
- **Database:** PostgreSQL with full schema, constraints, views, and automated fallback engine
- **Authentication:** JWT (JSON Web Tokens) with 6 role-based permission tiers
- **Transaction Safety:** Atomic database transactions with row-level locks (`SELECT ... FOR UPDATE`)
- **Fulfillment Engine:** Weekly FIFO distribution across Weeks 1–4, margin calculations, and auto-completion background sweeps for partial allocations.

---

## Approval Workflow Stages

```
Customer Demand (Level 0)
         │
         ▼
[Level 1] DEMAND_VALIDATOR (Rules 1.1 - 1.7)
         │   Passed credit check, product active, valid date & qty, tier eligibility
         ▼
[Level 2] SUPPLY_VALIDATOR (Rules 2.1 - 2.6)
         │   Confirmed monthly supply plan, >30% threshold, EU regional sanctions
         ▼
[Level 3] MATCHING_PLANNER (Rules 3.1 - 3.9)
         │   Allocates available weeks 1-4 (Full or Partial), checks 8% margin & $1M limit
         ▼
[Level 4] EXECUTIVE_APPROVER (Rules 4.1 - 4.8)
             Final sign-off, overrides, financial commit to demand_approved table
```

---

## Business Logic Rules Reference (All 30 Implemented)

### Level 1: Demand Validator
- **Rule 1.1:** Customer exists and is active
- **Rule 1.2:** Customer credit limit check: `credit_limit >= (requested_qty * unit_price)`
- **Rule 1.3:** Product exists and is active (`status = 'ACTIVE'`)
- **Rule 1.4:** Valid positive quantity (`0 < qty <= 999,999`)
- **Rule 1.5:** Required date within 90 days from today
- **Rule 1.6:** Tier eligibility: `PREMIUM` category requires `STRATEGIC` or `STANDARD` customer tier
- **Rule 1.7:** No duplicate active demand for same (customer, product, month)

### Level 2: Supply Validator
- **Rule 2.1:** Supply plan exists for product and target month
- **Rule 2.2:** Supply plan is realistic (`available_quantity > 0` for at least one week)
- **Rule 2.3:** Minimum threshold check (`SUM(available) >= requested * 0.3`)
- **Rule 2.4:** Regional export restriction: `EU` customers cannot order `RESTRICTED_EXPORT` products
- **Rule 2.5:** Shortfall warning if `SUM(available) < requested * 0.5`
- **Rule 2.6:** Planned vs. actual consistency (`SUM(allocated) <= SUM(available)`)

### Level 3: Matching Planner
- **Rule 3.1:** Full vs. Partial allocation determination
- **Rule 3.2:** Customer tier priority: `STRATEGIC` > `HIGH` priority > First-Come-First-Served
- **Rule 3.3:** FIFO by required date for same priority tier
- **Rule 3.4:** Sequential earliest-week allocation (Week 1 &rarr; Week 2 &rarr; Week 3 &rarr; Week 4)
- **Rule 3.5:** Profit margin check: flags `LOW_MARGIN` exception if margin < 8%
- **Rule 3.6:** Order value threshold: flags `HIGH_VALUE` exception if value > $1,000,000
- **Rule 3.7:** Overbooking prevention using `SELECT ... FOR UPDATE` row locks
- **Rule 3.8:** Strategic customer high priority exception allowance
- **Rule 3.9:** Partial allocation retention at Level 3 and auto-completion sweep trigger

### Level 4: Executive Approver
- **Rule 4.1:** Review open exceptions; mandatory executive rationale comment required to override
- **Rule 4.2:** Total customer exposure recalculation across all approved demands
- **Rule 4.3:** Financial impact analysis: revenue, profit, margin %
- **Rule 4.4:** No overcommitment beyond current month without future supply plan
- **Rule 4.5:** Strategic customer override authority with audit trail
- **Rule 4.6:** Spot customer restrictions: strict 100% full allocation and margin &ge; 10%
- **Rule 4.7:** Final approval commits to `demand_approved` table; rejection releases all allocations back to inventory
- **Rule 4.8:** Concurrent demand balancing across monthly supply pool

---

## Seed Accounts (Password for all accounts: `password123`)

| Role | Name | Email | Permissions |
|------|------|-------|-------------|
| **ADMIN** | System Administrator | `admin@micron.com` | Full system access, supply management, catalog |
| **CUSTOMER** | Apple Procurement | `apple_buyer@apple.com` | Strategic Tier ($10M Credit), submit & track demands |
| **CUSTOMER** | TechStore Agent | `spot_buyer@techstore.com` | Spot Tier ($80k Credit, EU Region) |
| **LEVEL1** | David Chen | `level1@micron.com` | Demand & Credit Validator |
| **LEVEL2** | Sarah Jenkins | `level2@micron.com` | Supply Plan Validator |
| **LEVEL3** | Marcus Brody | `level3@micron.com` | Matching & Allocation Planner |
| **LEVEL4** | Elena Rostova | `level4@micron.com` | Executive Approver & Governance |

---

## Quick Start Guide

### 1. Start the Backend
```bash
cd backend
npm install
npm start
# Server starts on http://localhost:5000
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
# Web application starts on http://localhost:3000
```

### 3. Run Backend Verification Suite
```bash
cd backend
node test_suite.js
```
