const db = require('../config/database');
const AllocationService = require('./allocationService');

class SupplyService {
  /**
   * Add or update weekly supply for a product
   */
  static async addSupplyPlan({ productId, month, week, availableQuantity, createdByUserId }) {
    // Validate inputs
    const prodId = Number(productId);
    const m = Number(month);
    const w = Number(week);
    const qty = Number(availableQuantity);

    if (isNaN(prodId) || isNaN(m) || isNaN(w) || isNaN(qty)) {
      const err = new Error('Invalid supply parameters');
      err.statusCode = 400;
      throw err;
    }

    if (m < 1 || m > 12) {
      const err = new Error('Month must be between 1 and 12');
      err.statusCode = 400;
      throw err;
    }

    if (w < 1 || w > 4) {
      const err = new Error('Week must be between 1 and 4');
      err.statusCode = 400;
      throw err;
    }

    if (qty < 0) {
      const err = new Error('Available quantity cannot be negative');
      err.statusCode = 400;
      throw err;
    }

    // Ensure product exists
    const pRes = await db.query('SELECT product_id, product_name FROM products WHERE product_id = $1', [prodId]);
    if (pRes.rows.length === 0) {
      const err = new Error(`Product #${prodId} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Insert or update supply record
    const result = await db.query(
      `INSERT INTO supply (product_id, month, week, available_quantity, allocated_quantity, created_by, updated_at) 
       VALUES ($1, $2, $3, $4, 0, $5, NOW()) 
       ON CONFLICT (product_id, month, week) DO UPDATE SET 
         available_quantity = EXCLUDED.available_quantity,
         updated_at = NOW() 
       RETURNING *`,
      [prodId, m, w, qty, createdByUserId]
    );

    const supplyRecord = result.rows[0];

    // Trigger Auto-Completion sweep for partial demands waiting on this product!
    let autoCompletionResults = [];
    try {
      autoCompletionResults = await AllocationService.triggerAutoCompletion(prodId);
    } catch (autoErr) {
      console.warn('Auto-completion sweep warning:', autoErr.message);
    }

    return {
      supply: supplyRecord,
      autoCompletedDemands: autoCompletionResults
    };
  }

  /**
   * List all supply availability grouped by product and month
   */
  static async listSupply(productId = null, month = null) {
    let query = `
      SELECT sp.*, pr.product_name, pr.category, pr.unit_price,
             (sp.available_quantity - sp.allocated_quantity) as remaining_quantity
      FROM supply sp
      JOIN products pr ON sp.product_id = pr.product_id
    `;
    const params = [];
    const conditions = [];

    if (productId) {
      params.push(Number(productId));
      conditions.push(`sp.product_id = $${params.length}`);
    }

    if (month) {
      params.push(Number(month));
      conditions.push(`sp.month = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sp.month ASC, sp.product_id ASC, sp.week ASC';

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = SupplyService;
