const db = require('../config/database');
const AllocationService = require('../services/allocationService');

class Level3Controller {
  /**
   * Get demands ready for Level 3 Matching Planner:
   * 1. Demands at level 2 (awaiting initial allocation)
   * 2. Demands at level 3 that are PARTIALLY_ALLOCATED (waiting for replenishment)
   */
  static async getDemands(req, res) {
    try {
      const result = await db.query(
        `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                p.product_name, p.category, p.unit_price, p.standard_cost,
                COALESCE(SUM(sa.allocated_quantity), 0) as current_allocated
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         LEFT JOIN supply_allocation sa ON dr.demand_id = sa.demand_id
         WHERE dr.level = 3 AND dr.status = 'LEVEL3_PENDING'
         GROUP BY dr.demand_id, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                  p.product_name, p.category, p.unit_price, p.standard_cost
         ORDER BY 
           CASE WHEN c.tier = 'STRATEGIC' THEN 1 WHEN c.tier = 'STANDARD' THEN 2 ELSE 3 END ASC,
           CASE WHEN c.priority = 'HIGH' THEN 1 WHEN c.priority = 'NORMAL' THEN 2 ELSE 3 END ASC,
           dr.required_date ASC`
      );

      // Enrich with available supply matrix for each demand's product and month
      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const reqDate = new Date(d.required_date);
          const month = reqDate.getMonth() + 1;

          const supRes = await db.query(
            `SELECT supply_id, week, month, available_quantity, allocated_quantity,
                    (available_quantity - allocated_quantity) as remaining_quantity 
             FROM supply 
             WHERE product_id = $1 AND month = $2 
             ORDER BY week ASC`,
            [d.product_id, month]
          );

          // Calculate current profit margin
          const unitPrice = Number(d.unit_price);
          const standardCost = Number(d.standard_cost);
          const margin = unitPrice > 0 ? ((unitPrice - standardCost) / unitPrice) * 100 : 0;

          return {
            ...d,
            marginPct: margin.toFixed(2),
            supplyWeeks: supRes.rows
          };
        })
      );

      return res.json({
        success: true,
        message: `Fetched ${enriched.length} demands for Level 3 Matching Planner`,
        data: enriched,
        errors: []
      });
    } catch (err) {
      console.error('Level 3 getDemands error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Level 3 demands',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Approve demand at Level 3 (Business & Priority Review)
   */
  static async approve(req, res) {
    const { demand_id } = req.params;
    const { comment } = req.body;

    try {
      const dRes = await db.query('SELECT * FROM demand_raw WHERE demand_id = $1', [demand_id]);
      if (dRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Demand not found', data: null, errors: [] });
      }
      const demand = dRes.rows[0];

      if (demand.level !== 3) {
        return res.status(400).json({ success: false, message: 'Demand is not at Level 3' });
      }

      const pRes = await db.query('SELECT * FROM products WHERE product_id = $1', [demand.product_id]);
      const product = pRes.rows[0];

      // Margin & Order Value Checks
      const ValidationService = require('../services/validationService');
      
      const r5 = ValidationService.validateRule3_5(product);
      const r6 = ValidationService.validateRule3_6(demand.suggested_quantity || demand.requested_quantity, product.unit_price);
      
      const exceptionsRaised = [];
      if (!r5.passed) {
        await db.query(
          `INSERT INTO demand_exceptions (demand_id, rule_id, severity, detail) VALUES ($1, 1, 'HIGH', $2) ON CONFLICT (demand_id, rule_id) DO UPDATE SET detail = EXCLUDED.detail`,
          [demand_id, JSON.stringify({ margin_pct: r5.marginPct, message: r5.message })]
        );
        exceptionsRaised.push(r5.code);
      }
      if (!r6.passed) {
        await db.query(
          `INSERT INTO demand_exceptions (demand_id, rule_id, severity, detail) VALUES ($1, 2, 'HIGH', $2) ON CONFLICT (demand_id, rule_id) DO UPDATE SET detail = EXCLUDED.detail`,
          [demand_id, JSON.stringify({ order_value: r6.orderValue, message: r6.message })]
        );
        exceptionsRaised.push(r6.code);
      }

      // Move to Level 4
      await db.query(
        `UPDATE demand_raw SET level = 4, status = 'LEVEL4_PENDING', updated_at = NOW() WHERE demand_id = $1`,
        [demand_id]
      );

      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, reason, comment, approved_by) 
         VALUES ($1, 3, 'APPROVED', $2, $3, $4)`,
        [
          demand_id, 
          'Level 3: Business rules and margins reviewed and approved', 
          [comment, exceptionsRaised.length > 0 ? `Exceptions: ${exceptionsRaised.join(', ')}` : null].filter(Boolean).join(' | '),
          req.user.user_id
        ]
      );

      await db.query(
        `INSERT INTO notifications (user_id, demand_id, title, body) 
         SELECT user_id, $1, 'Demand Ready for Final Executive Approval', 'Demand passed Level 3 business review.' 
         FROM users WHERE role = 'LEVEL4'`,
        [demand_id]
      );

      return res.json({
        success: true,
        message: 'Demand approved at Level 3 and moved to Level 4',
        data: { demand_id, new_level: 4, exceptions: exceptionsRaised },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Reject demand at Level 3
   */
  static async reject(req, res) {
    const { demand_id } = req.params;
    const { reason, comment } = req.body;

    try {
      await db.query('UPDATE demand_raw SET status = $1, updated_at = NOW() WHERE demand_id = $2', ['REJECTED', demand_id]);
      
      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, reason, comment, approved_by) VALUES ($1, 3, 'REJECTED', $2, $3, $4)`,
        [demand_id, reason || 'Rejected during Level 3 Business Review', comment, req.user.user_id]
      );

      // Release allocations since it's rejected
      await AllocationService.releaseAllocations(demand_id);

      return res.json({ success: true, message: 'Demand rejected and allocations released' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }


}

module.exports = Level3Controller;
