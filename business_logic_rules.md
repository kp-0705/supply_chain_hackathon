# Business Logic Rules by Approval Level

## Overview
Each level has specific validation rules that must pass before the demand can move to the next level. Rules are checked in order; if any rule fails, the demand is rejected.

---

## LEVEL 1: DEMAND_VALIDATOR

**Purpose:** Validate customer creditworthiness and product availability

### Rules to Check

#### Rule 1.1: Customer Exists & Active
```
Condition: customer_id must exist in customers table AND is_active = TRUE
Action on Fail: REJECT
Error Message: "Customer does not exist or is inactive"
```

#### Rule 1.2: Customer Has Sufficient Credit
```
Condition: customer.credit_limit >= (requested_quantity * product.unit_price)
Action on Fail: REJECT
Error Message: "Customer credit limit exceeded. Limit: $X, Demand Value: $Y"
```

#### Rule 1.3: Product Exists & Active
```
Condition: product_id must exist in products table AND status = 'ACTIVE'
Action on Fail: REJECT
Error Message: "Product does not exist or is discontinued"
```

#### Rule 1.4: Valid Quantity
```
Condition: requested_quantity > 0 AND requested_quantity <= 999999
Action on Fail: REJECT
Error Message: "Requested quantity must be positive and reasonable"
```

#### Rule 1.5: Valid Required Date
```
Condition: required_date >= TODAY() AND required_date <= TODAY() + 90 days
Action on Fail: REJECT
Error Message: "Required date must be within 90 days from today"
```

#### Rule 1.6: Customer Tier Eligibility
```
Condition: IF product.category = 'PREMIUM' THEN customer.tier IN ('STRATEGIC', 'STANDARD')
Action on Fail: REJECT
Error Message: "Customer tier not eligible for premium products"
```

#### Rule 1.7: No Duplicate Demand
```
Condition: No existing PENDING/APPROVED demand for same (customer, product, month)
Action on Fail: REJECT
Error Message: "Demand for this product already exists for this period"
```

---

## LEVEL 2: SUPPLY_VALIDATOR

**Purpose:** Confirm supply plan is locked and realistic

### Rules to Check

#### Rule 2.1: Supply Plan Exists
```
Condition: supply row exists for (product_id, month, week) 
Action on Fail: REJECT
Error Message: "Supply plan for this product/month not yet created by admin"
```

#### Rule 2.2: Supply Plan is Finalized
```
Condition: supply.planned_qty > 0 AND created_at is NOT NULL
Action on Fail: REJECT
Error Message: "Supply plan for this product is incomplete/pending"
```

#### Rule 2.3: Minimum Threshold Check
```
Condition: supply.available_quantity >= (requested_quantity * 0.3)
Meaning: At least 30% of requested qty should be available across all weeks
Action on Fail: REJECT (or WARN and allow with comment)
Error Message: "Low supply availability (only X% available). Reject or add comment"
```

#### Rule 2.4: Regional Constraint
```
Condition: IF customer.region = 'EU' THEN product.category != 'RESTRICTED_EXPORT'
Action on Fail: REJECT
Error Message: "This product cannot be shipped to customer region due to export restrictions"
```

#### Rule 2.5: No Supply Shortfall > 50%
```
Condition: Total available supply for month >= (requested_quantity * 0.5)
Meaning: We can cover at least 50% of demand
Action on Fail: WARN (allow with escalation comment to level 4)
Error Message: "Supply shortfall >50%. This will require executive attention"
```

#### Rule 2.6: Planned vs Actual Consistency
```
Condition: SUM(supply.allocated_qty) <= SUM(supply.available_qty)
Meaning: Total allocated can't exceed total available
Action on Fail: REJECT (data integrity error)
Error Message: "Supply allocation exceeds available. Data inconsistency detected"
```

---

## LEVEL 3: MATCHING_PLANNER

**Purpose:** Allocate supply and optimize fulfillment

### Rules to Check

#### Rule 3.1: Allocate Available Supply
```
Logic:
  available_qty = SUM(supply.available_qty - supply.allocated_qty) for all weeks for this product
  
  IF available_qty >= requested_qty:
    approved_qty = requested_qty  (FULL ALLOCATION)
  ELSE:
    approved_qty = available_qty  (PARTIAL ALLOCATION)
    status = 'PARTIALLY_ALLOCATED'

Action: Allocate to supply_allocation table, update supply.allocated_qty
```

#### Rule 3.2: Allocation Priority by Customer Tier
```
When multiple demands compete for same supply:
  1. STRATEGIC tier customers get priority
  2. HIGH priority customers get priority
  3. FIRST-COME-FIRST-SERVED for rest

Action: Sort demands by tier/priority, allocate in order
Error Message: "Cannot allocate, priority demand takes precedence"
```

#### Rule 3.3: FIFO (First-In-First-Out) for Same Priority
```
For customers of same tier/priority:
  Allocate based on required_date (earlier dates first)
  
Example: 2 STANDARD tier demands on same day
  - Both want 500 units
  - Only 500 available
  - Give to whoever required_date is earlier

Action: Order by required_date ASC, allocate sequentially
```

#### Rule 3.4: Allocation by Week Preference
```
Logic: Allocate from earliest week to latest
  If required_date is Sept 10 (week 2), allocate:
  - First from week 1 (if available)
  - Then from week 2
  - Then from week 3, 4 only if early allocation insufficient

Action: Query weeks in order, reserve sequentially
```

#### Rule 3.5: Margin Check
```
Calculation:
  total_value = approved_qty * product.unit_price
  profit_margin = ((unit_price - standard_cost) / unit_price) * 100
  
Condition: profit_margin >= 8%
Action on Fail: WARN (flag as exception for level 4)
Message: "Low margin (X%). Flagged for executive review"
```

#### Rule 3.6: Order Value Threshold
```
Condition: IF (approved_qty * unit_price) > $1,000,000 THEN flag for executive
Action: Automatic escalation to Level 4 (executive must review)
Message: "High value order ($X). Requires executive approval"
```

#### Rule 3.7: No Overbooking
```
Condition: BEFORE allocating, check:
  SUM(existing_allocations) + new_allocation <= total_available
  
Action: Wrap in transaction, use SELECT ... FOR UPDATE to prevent race conditions
Error Message: "Supply exhausted by concurrent demand. Partial allocation only"
```

#### Rule 3.8: Strategic Customer Exception
```
Condition: IF customer.tier = 'STRATEGIC' AND customer.priority = 'HIGH':
  Can approve_qty > available_qty (with executive override flag)
  
Action: Flag for level 4, but allow planner to propose overage
Message: "Strategic customer. Proposing overage; needs executive approval"
```

#### Rule 3.9: Allocation Completeness Check
```
At end of month (or when all weeks added):
  IF status = 'PARTIALLY_ALLOCATED' AND all weeks' supply added:
    Remaining quantity = requested - approved
    available_qty = SUM(unallocated supply across all weeks)
    
    IF available_qty >= remaining:
      Auto-allocate remaining
      Move demand to APPROVED, level=4
      Notify Level 4
    ELSE:
      Keep as PARTIALLY_ALLOCATED, flag for manual review
```

---

## LEVEL 4: EXECUTIVE_APPROVER

**Purpose:** Final approval, exception handling, business decision

### Rules to Check

#### Rule 4.1: No Outstanding Exceptions
```
Condition: demand_exceptions table for this demand_id should be empty
           OR approver has reviewed and added resolution
           
Action on Fail: WARN (show exceptions, require comment to override)
Message: "X exceptions flagged. Please review and comment before approval"
```

#### Rule 4.2: Customer Credit is Final
```
Condition: RECALCULATE credit:
  total_demand_value = SUM(approved_qty * unit_price) for all approved demands for this customer
  IF total_demand_value > credit_limit:
    REJECT or flag high-risk

Action: Calculate total exposure, warn if near/exceeding limit
Message: "Customer total exposure: $X / Limit: $Y"
```

#### Rule 4.3: Revenue Impact Analysis
```
Calculate:
  expected_revenue = approved_qty * unit_price
  expected_profit = approved_qty * (unit_price - standard_cost)
  profit_margin_pct = (profit / revenue) * 100

Flag if:
  - profit_margin < 5% (critical)
  - expected_revenue < $10,000 (low value, check if worth processing)

Action: Show financials, allow override with comment
```

#### Rule 4.4: No Overcommitment Beyond Week 4
```
Condition: IF approved_qty > available_qty AND required_date is in week 4+
           REJECT or flag critical risk
           
Action: Prevent allocating beyond current month
Error Message: "Cannot commit beyond current month without future supply plan"
```

#### Rule 4.5: Strategic Customer Override
```
Condition: IF customer.tier = 'STRATEGIC' THEN allow override of:
  - Low margin (< 8%)
  - Partial allocation approval
  - Overbooking (with future supply contingency)
  
Action: Allow, but require comment explaining business rationale
Message: "Strategic customer override approved. Reason: [comment]"
```

#### Rule 4.6: Spot Customer Restrictions
```
Condition: IF customer.tier = 'SPOT':
  - Require FULL allocation (no partials)
  - Require positive margin (>= 10%)
  - Require advance payment confirmation
  
Action on Fail: REJECT
Error Message: "Spot customers require full allocation and higher margins"
```

#### Rule 4.7: Final Approval Creates demand_approved Row
```
On APPROVE:
  1. Insert into demand_approved (fulfillment record)
  2. Update demand_raw.status = 'APPROVED'
  3. Update supply_allocation to COMMIT (entry_type='COMMIT')
  4. Log to demand_action_log with action='APPROVED'
  5. Notify customer
  
On REJECT:
  1. Update demand_raw.status = 'REJECTED'
  2. RELEASE allocations (reverse supply_allocation inserts)
  3. Log to demand_action_log with action='REJECTED', reason=...
  4. Notify customer with reason
```

#### Rule 4.8: Concurrent Demand Balancing
```
If multiple demands for same product in same month:
  Check if collective approved_qty <= total_supply
  
Action: Prevent approval if would exceed total supply
Error Message: "Approval would exceed total supply. Reduce to X units"
```

---

## Summary Table

| Level | Focus | Key Action | Failure = |
|-------|-------|-----------|----------|
| 1 | **Customer & Product Validation** | Check customer credit, product active | REJECT |
| 2 | **Supply Plan Validation** | Confirm supply exists & realistic | REJECT |
| 3 | **Supply Allocation** | Allocate available qty (full or partial) | PARTIAL_ALLOCATE or REJECT |
| 4 | **Business Decision** | Override authority, exception handling | APPROVE or REJECT |

---

## Special Cases

### Case A: Partial Allocation Waiting for Next Week's Supply
```
Week 1: Demand for 1000, Available 600 → Allocate 600, status=PARTIALLY_ALLOCATED, level stays 3
Week 2: Supply for 500 added → System auto-allocates 400 of remaining 500
        Total allocated = 600 + 400 = 1000 ✓
        Status → APPROVED, level → 4, notify Level 4
```

### Case B: Low Margin but Strategic Customer
```
Rule 3.5: Margin 6% (< 8%) → Flag exception
Rule 4.5: Customer tier STRATEGIC → Allow override
Action: Level 3 flags, Level 4 approves with comment "Strategic priority"
```

### Case C: Demand Exceeds Monthly Supply
```
Month's total supply = 500 units
Demand = 1000 units
Allocate 500, status=PARTIALLY_ALLOCATED
No future weeks → Manual review at level 4 (reject or negotiate)
```

### Case D: Spot Customer Needs Fast Fulfillment
```
Spot customer wants 100 units, need by week 2
Supply available: week 1=60, week 2=50, week 3=100
Allocate: 60 from week 1, 40 from week 2 → 100 total ✓
Margin check: 12% → Pass
Approval: Level 3 APPROVE, Level 4 APPROVE
```

---

## Implementation Tips

1. **Wrap everything in transactions** - If a rule fails mid-execution, rollback all changes
2. **Log every rule check** - For debugging and audit, log which rules passed/failed
3. **Use database constraints** - CHECK constraints for ranges (confidence 0-100, quantities >= 0)
4. **Notify users at key points:**
   - Demand submitted
   - Moved to next level
   - Rejected (with reason)
   - Partially allocated (waiting for supply)
   - Fully approved
5. **AI can suggest quantities** - But rules must be checked by backend, not skipped
