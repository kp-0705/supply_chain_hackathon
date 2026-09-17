const db = require('../config/database');
const ValidationService = require('./validationService');

class DemandService {
  /**
   * AI Demand Heuristic Engine
   * Evaluates customer tier, historical credibility, product category, and supply health.
   */
  static async evaluateDemandAI(customerId, productId, requestedQty, requiredDate) {
    const custRes = await db.query('SELECT * FROM customers WHERE customer_id = $1', [customerId]);
    const prodRes = await db.query('SELECT * FROM products WHERE product_id = $1', [productId]);

    const customer = custRes.rows[0];
    const product = prodRes.rows[0];

    const reqDate = new Date(requiredDate);
    const month = reqDate.getMonth() + 1;

    const supRes = await db.query(
      'SELECT SUM(available_quantity - allocated_quantity) as remaining FROM supply WHERE product_id = $1 AND month = $2',
      [productId, month]
    );
    const availableInMonth = Number(supRes.rows[0]?.remaining || 0);

    let confidence = 85;
    let suggestedQty = Number(requestedQty);
    let reasons = [];

    // Customer tier adjustment
    if (customer?.tier === 'STRATEGIC') {
      confidence = Math.min(98, confidence + 10);
      reasons.push('Strategic tier partner with verified demand history');
    } else if (customer?.tier === 'SPOT') {
      confidence = Math.max(60, confidence - 15);
      reasons.push('Spot tier customer with volatile purchasing pattern');
    }

    // Supply constraint check
    if (availableInMonth < requestedQty) {
      suggestedQty = Math.max(0, availableInMonth);
      confidence = Math.max(50, confidence - 20);
      reasons.push(`Target month supply capacity (${availableInMonth}) is below requested amount (${requestedQty})`);
    } else {
      reasons.push('Supply capacity is currently sufficient to meet full request');
    }

    // Credit buffer check
    const orderVal = Number(requestedQty) * Number(product?.unit_price || 0);
    if (customer && Number(customer.credit_limit) >= orderVal * 2) {
      confidence = Math.min(99, confidence + 5);
      reasons.push('Healthy credit limit buffer (>2x order value)');
    }

    return {
      suggestedQuantity: suggestedQty,
      confidence,
      reason: reasons.join('. ') + '.'
    };
  }

  /**
   * Submit a new demand with Level 1 pre-validation
   */
  static async submitDemand({ customerId, productId, requestedQuantity, requiredDate, submittedByUserId }) {
    // 1. Basic Sanity Check on Quantity and Date
    if (!requestedQuantity || Number(requestedQuantity) <= 0) {
      const error = new Error('Requested quantity must be a positive number');
      error.statusCode = 400;
      throw error;
    }
    if (!requiredDate) {
      const error = new Error('Required delivery date is required');
      error.statusCode = 400;
      throw error;
    }

    // 2. AI Recommendation
    const ai = await this.evaluateDemandAI(customerId, productId, requestedQuantity, requiredDate);

    // 3. Insert into demand_raw (level=0, status='PENDING')
    const insertRes = await db.query(
      `INSERT INTO demand_raw 
       (customer_id, product_id, requested_quantity, required_date, level, status, suggested_quantity, reason, confidence) 
       VALUES ($1, $2, $3, $4, 0, 'PENDING', $5, $6, $7) 
       RETURNING *`,
      [customerId, productId, requestedQuantity, requiredDate, ai.suggestedQuantity, ai.reason, ai.confidence]
    );
    const demand = insertRes.rows[0];

    // 4. Log to demand_action_log
    await db.query(
      `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, approved_by) 
       VALUES ($1, 0, 'SUBMITTED', $2, 'Customer online demand submission', $3)`,
      [demand.demand_id, requestedQuantity, submittedByUserId]
    );

    // 5. Notify Level 1 Validators
    await db.query(
      `INSERT INTO notifications (user_id, demand_id, title, body) 
       SELECT user_id, $1, 'New Demand Submitted', $2 
       FROM users WHERE role = 'LEVEL1'`,
      [demand.demand_id, `Demand #${demand.demand_id} submitted for ${requestedQuantity} units. Requires Level 1 review.`]
    );

    return demand;
  }

  /**
   * Get demand details with timeline, allocations, and exceptions
   */
  static async getDemandTimeline(demandId) {
    const demRes = await db.query(
      `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
              p.product_name, p.category, p.unit_price, p.standard_cost
       FROM demand_raw dr
       JOIN customers c ON dr.customer_id = c.customer_id
       JOIN products p ON dr.product_id = p.product_id
       WHERE dr.demand_id = $1`,
      [demandId]
    );

    if (demRes.rows.length === 0) {
      const err = new Error(`Demand #${demandId} not found`);
      err.statusCode = 404;
      throw err;
    }
    const demand = demRes.rows[0];

    // Action Logs
    const logRes = await db.query(
      `SELECT dal.*, u.name as user_name, u.role as user_role 
       FROM demand_action_log dal 
       LEFT JOIN users u ON dal.approved_by = u.user_id 
       WHERE dal.demand_id = $1 
       ORDER BY dal.created_at ASC`,
      [demandId]
    );

    // Supply Allocations
    const allocRes = await db.query(
      `SELECT sa.*, s.week, s.month, s.available_quantity 
       FROM supply_allocation sa 
       JOIN supply s ON sa.supply_id = s.supply_id 
       WHERE sa.demand_id = $1 
       ORDER BY s.week ASC`,
      [demandId]
    );

    // Exceptions
    const excRes = await db.query(
      `SELECT de.*, er.code, er.description 
       FROM demand_exceptions de 
       JOIN exception_rules er ON de.rule_id = er.rule_id 
       WHERE de.demand_id = $1`,
      [demandId]
    );

    const totalAllocated = allocRes.rows.reduce((sum, a) => sum + Number(a.allocated_quantity), 0);

    return {
      demand: {
        ...demand,
        total_allocated: totalAllocated,
        remaining_quantity: Number(demand.requested_quantity) - totalAllocated
      },
      timeline: logRes.rows,
      allocations: allocRes.rows,
      exceptions: excRes.rows
    };
  }
}

module.exports = DemandService;
