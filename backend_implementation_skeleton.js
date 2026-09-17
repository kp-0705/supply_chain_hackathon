/**
 * Supply Chain Demand Management System
 * Backend Implementation Skeleton (Node.js + Express)
 * 
 * Shows structure for implementing business logic rules
 */

const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Authorization middleware
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

class ValidationError extends Error {
  constructor(rule, message) {
    super(message);
    this.rule = rule;
    this.code = 'VALIDATION_FAILED';
  }
}

// Generic rule checker pattern
const checkRule = async (ruleName, condition, errorMessage) => {
  if (!condition) {
    throw new ValidationError(ruleName, errorMessage);
  }
  console.log(`✓ Rule ${ruleName} passed`);
};

// ============================================================================
// LEVEL 1: DEMAND_VALIDATOR
// ============================================================================

class Level1Validator {
  static async validateDemand(customerId, productId, requestedQty, requiredDate) {
    const errors = [];
    
    try {
      // Rule 1.1: Customer exists & active
      const customerResult = await pool.query(
        'SELECT * FROM customers WHERE customer_id = $1',
        [customerId]
      );
      await checkRule(
        '1.1_customer_exists',
        customerResult.rows.length > 0 && customerResult.rows[0].is_active !== false,
        'Customer does not exist or is inactive'
      );
      const customer = customerResult.rows[0];

      // Rule 1.2: Customer has sufficient credit
      const demandValue = requestedQty * (await this.getProductPrice(productId));
      await checkRule(
        '1.2_credit_limit',
        customer.credit_limit >= demandValue,
        `Customer credit limit exceeded. Limit: $${customer.credit_limit}, Demand Value: $${demandValue}`
      );

      // Rule 1.3: Product exists & active
      const productResult = await pool.query(
        'SELECT * FROM products WHERE product_id = $1',
        [productId]
      );
      await checkRule(
        '1.3_product_exists',
        productResult.rows.length > 0 && productResult.rows[0].status === 'ACTIVE',
        'Product does not exist or is discontinued'
      );

      // Rule 1.4: Valid quantity
      await checkRule(
        '1.4_valid_quantity',
        requestedQty > 0 && requestedQty <= 999999,
        'Requested quantity must be positive and reasonable'
      );

      // Rule 1.5: Valid required date
      const today = new Date();
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      await checkRule(
        '1.5_valid_date',
        new Date(requiredDate) >= today && new Date(requiredDate) <= maxDate,
        'Required date must be within 90 days from today'
      );

      // Rule 1.6: Customer tier eligibility
      const product = productResult.rows[0];
      if (product.category === 'PREMIUM') {
        await checkRule(
          '1.6_tier_eligibility',
          ['STRATEGIC', 'STANDARD'].includes(customer.tier),
          'Customer tier not eligible for premium products'
        );
      }

      // Rule 1.7: No duplicate demand
      const duplicateResult = await pool.query(
        `SELECT * FROM demand_raw 
         WHERE customer_id = $1 AND product_id = $2 AND status IN ('PENDING', 'APPROVED')`,
        [customerId, productId]
      );
      await checkRule(
        '1.7_no_duplicate',
        duplicateResult.rows.length === 0,
        'Demand for this product already exists for this period'
      );

      return { success: true, customer, product };

    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push({ rule: error.rule, message: error.message });
        return { success: false, errors };
      }
      throw error;
    }
  }

  static async getProductPrice(productId) {
    const result = await pool.query(
      'SELECT unit_price FROM products WHERE product_id = $1',
      [productId]
    );
    return result.rows[0]?.unit_price || 0;
  }
}

// ============================================================================
// LEVEL 3: MATCHING_PLANNER (Most complex)
// ============================================================================

class Level3MatchingPlanner {
  static async allocateSupply(demandId, customerId, productId, requestedQty, requiredDate) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get demand details
      const demandResult = await client.query(
        'SELECT * FROM demand_raw WHERE demand_id = $1',
        [demandId]
      );
      const demand = demandResult.rows[0];

      // Get customer tier for priority
      const customerResult = await client.query(
        'SELECT tier, priority FROM customers WHERE customer_id = $1',
        [customerId]
      );
      const customer = customerResult.rows[0];

      // Get product cost for margin calculation
      const productResult = await client.query(
        'SELECT unit_price, standard_cost FROM products WHERE product_id = $1',
        [productId]
      );
      const product = productResult.rows[0];

      // Rule 3.1: Calculate available supply (FIFO by week)
      const supplyResult = await client.query(
        `SELECT supply_id, week, available_quantity, allocated_quantity 
         FROM supply 
         WHERE product_id = $1 
         ORDER BY week ASC
         FOR UPDATE`,  -- Lock rows to prevent concurrent allocation
        [productId]
      );
      
      let allocatedQty = 0;
      const allocations = [];
      
      for (const supply of supplyResult.rows) {
        const availableThisWeek = supply.available_quantity - supply.allocated_quantity;
        const toAllocate = Math.min(availableThisWeek, requestedQty - allocatedQty);
        
        if (toAllocate > 0) {
          allocations.push({
            supplyId: supply.supply_id,
            allocateQty: toAllocate,
            week: supply.week
          });
          allocatedQty += toAllocate;
        }
        
        if (allocatedQty >= requestedQty) break;
      }

      // Rule 3.1 Check: Did we allocate anything?
      if (allocatedQty === 0) {
        await client.query('ROLLBACK');
        throw new ValidationError(
          '3.1_supply_available',
          'No supply available for allocation'
        );
      }

      // Rule 3.5: Margin Check
      const totalValue = allocatedQty * product.unit_price;
      const profit = allocatedQty * (product.unit_price - product.standard_cost);
      const marginPct = (profit / totalValue) * 100;
      
      const marginWarning = marginPct < 8;
      if (marginWarning) {
        console.warn(`⚠ Rule 3.5: Low margin ${marginPct.toFixed(2)}% (< 8%)`);
        // Flag for executive review (Rule 3.6 check)
      }

      // Rule 3.6: Order value threshold
      const valueWarning = totalValue > 1000000;
      if (valueWarning) {
        console.warn(`⚠ Rule 3.6: High value order $${totalValue}`);
      }

      // Insert allocations
      for (const alloc of allocations) {
        await client.query(
          `INSERT INTO supply_allocation (demand_id, supply_id, allocated_quantity)
           VALUES ($1, $2, $3)`,
          [demandId, alloc.supplyId, alloc.allocateQty]
        );

        // Update supply allocated quantity
        await client.query(
          `UPDATE supply 
           SET allocated_quantity = allocated_quantity + $1
           WHERE supply_id = $2`,
          [alloc.allocateQty, alloc.supplyId]
        );
      }

      // Determine status
      const isFullyAllocated = allocatedQty >= requestedQty;
      const status = isFullyAllocated ? 'APPROVED' : 'PARTIALLY_ALLOCATED';
      const nextLevel = isFullyAllocated ? 4 : 3;

      // Update demand
      await client.query(
        `UPDATE demand_raw 
         SET status = $1, level = $2, suggested_quantity = $3, updated_at = NOW()
         WHERE demand_id = $4`,
        [status, nextLevel, allocatedQty, demandId]
      );

      // Log action
      const actionType = isFullyAllocated ? 'APPROVED' : 'PARTIALLY_ALLOCATED';
      const reason = isFullyAllocated 
        ? 'Full supply allocated'
        : `Partial allocation: ${allocatedQty}/${requestedQty} available. Waiting for next week supply.`;

      await client.query(
        `INSERT INTO demand_action_log 
         (demand_id, level, action_type, approved_quantity, reason, approved_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [demandId, 3, actionType, allocatedQty, reason, req.user.user_id]
      );

      // Raise exceptions if needed
      if (marginWarning) {
        await client.query(
          `INSERT INTO demand_exceptions (demand_id, rule_id, severity, detail)
           VALUES ($1, $2, $3, $4)`,
          [demandId, 1, 'MEDIUM', JSON.stringify({ margin: marginPct, threshold: 8 })]
        );
      }

      if (valueWarning) {
        await client.query(
          `INSERT INTO demand_exceptions (demand_id, rule_id, severity, detail)
           VALUES ($1, $2, $3, $4)`,
          [demandId, 2, 'HIGH', JSON.stringify({ value: totalValue, threshold: 1000000 })]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        allocatedQty,
        requestedQty,
        status,
        isFullyAllocated,
        marginPct: marginPct.toFixed(2),
        requiresExecutiveReview: marginWarning || valueWarning
      };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ValidationError) {
        return { success: false, error: error.message };
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. Customer submits demand
app.post(
  '/api/customer/demand/submit',
  authenticate,
  authorize(['CUSTOMER']),
  async (req, res) => {
    const { product_id, requested_quantity, required_date } = req.body;
    const customer_id = req.user.customer_id;

    try {
      // Validate using Level 1 rules
      const validation = await Level1Validator.validateDemand(
        customer_id,
        product_id,
        requested_quantity,
        required_date
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Create demand
      const result = await pool.query(
        `INSERT INTO demand_raw 
         (customer_id, product_id, requested_quantity, required_date, level, status)
         VALUES ($1, $2, $3, $4, 0, 'PENDING')
         RETURNING *`,
        [customer_id, product_id, requested_quantity, required_date]
      );

      const demand = result.rows[0];

      // Log action
      await pool.query(
        `INSERT INTO demand_action_log 
         (demand_id, level, action_type, approved_quantity, approved_by)
         VALUES ($1, 0, 'SUBMITTED', $2, $3)`,
        [demand.demand_id, requested_quantity, req.user.user_id]
      );

      res.status(201).json({
        success: true,
        message: 'Demand submitted successfully',
        data: demand
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 2. Level 3 (Matching Planner) allocates supply
app.post(
  '/api/level3/demand/:demand_id/allocate',
  authenticate,
  authorize(['LEVEL3']),
  async (req, res) => {
    const { demand_id } = req.params;

    try {
      // Get demand details
      const demandResult = await pool.query(
        'SELECT * FROM demand_raw WHERE demand_id = $1',
        [demand_id]
      );

      if (demandResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Demand not found' });
      }

      const demand = demandResult.rows[0];

      // Allocate supply with Level 3 rules
      const allocation = await Level3MatchingPlanner.allocateSupply(
        demand.demand_id,
        demand.customer_id,
        demand.product_id,
        demand.requested_quantity,
        demand.required_date
      );

      if (!allocation.success) {
        return res.status(400).json({ success: false, ...allocation });
      }

      res.json({
        success: true,
        message: `${allocation.status}: ${allocation.allocatedQty}/${allocation.requestedQty} units allocated`,
        data: allocation
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 3. Get demands at current level
app.get(
  '/api/:level/demands',
  authenticate,
  async (req, res) => {
    const { level } = req.params;
    const currentLevel = parseInt(level.replace('level', ''));

    try {
      const result = await pool.query(
        `SELECT dr.*, c.customer_name, p.product_name, p.unit_price
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         WHERE dr.level = $1 AND dr.status IN ('PENDING', 'PARTIALLY_ALLOCATED')
         ORDER BY dr.created_at ASC`,
        [currentLevel - 1]  // level-1 because current level reviews previous level's work
      );

      res.json({
        success: true,
        message: `${result.rows.length} demands at level ${currentLevel}`,
        data: result.rows
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
