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
         WHERE (dr.level = 2 AND dr.status = 'PENDING') 
            OR (dr.level = 3 AND dr.status = 'PARTIALLY_ALLOCATED')
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
   * Allocate supply for a demand
   */
  static async allocate(req, res) {
    const { demand_id } = req.params;
    const { manualWeeks, comment } = req.body;

    try {
      const allocation = await AllocationService.allocateDemand(
        Number(demand_id),
        manualWeeks || null,
        req.user.user_id,
        comment || null
      );

      return res.json({
        success: true,
        message: allocation.isFullyAllocated
          ? `Allocated ${allocation.allocatedQty} units across weeks. Advanced to Level 4 for Executive Approval.`
          : `Partially allocated ${allocation.allocatedQty}/${allocation.requestedQty} units. Retained at Level 3 awaiting supply replenishment.`,
        data: allocation,
        errors: []
      });
    } catch (err) {
      console.error('Level 3 allocate error:', err);
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Reject demand at Level 3
   */
  static async reject(req, res) {
    const { demand_id } = req.params;
    const { reason, comment } = req.body;

    if (!reason && !comment) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required',
        data: null,
        errors: [{ field: 'reason', message: 'Reason required' }]
      });
    }

    try {
      const dRes = await db.query('SELECT * FROM demand_raw WHERE demand_id = $1', [demand_id]);
      if (dRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Demand not found', data: null, errors: [] });
      }

      const finalReason = reason && comment ? `${reason}: ${comment}` : (reason || comment);
      await db.query(
        `UPDATE demand_raw SET status = 'REJECTED', reason = $1, updated_at = NOW() WHERE demand_id = $2`,
        [finalReason, demand_id]
      );

      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, reason, comment, approved_by) 
         VALUES ($1, 3, 'REJECTED', $2, $3, $4)`,
        [demand_id, reason || 'Rejected by Level 3 Matching Planner', comment || null, req.user.user_id]
      );

      const custUser = await db.query('SELECT user_id FROM users WHERE customer_id = $1', [dRes.rows[0].customer_id]);
      if (custUser.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, demand_id, title, body) VALUES ($1, $2, $3, $4)`,
          [custUser.rows[0].user_id, demand_id, 'Demand Rejected at Level 3', `Demand #${demand_id} was rejected: ${finalReason}`]
        );
      }

      return res.json({
        success: true,
        message: `Demand #${demand_id} has been rejected at Level 3`,
        data: { demand_id, status: 'REJECTED' },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Get real-time supply availability for planner cockpit
   */
  static async getSupplyAvailability(req, res) {
    try {
      const { product_id, month } = req.query;

      if (!product_id || !month) {
        return res.status(400).json({
          success: false,
          message: 'product_id and month are required',
          data: null,
          errors: []
        });
      }

      const supRes = await db.query(
        `SELECT sp.*, pr.product_name, pr.category, pr.unit_price, pr.standard_cost,
                (sp.available_quantity - sp.allocated_quantity) as remaining_quantity
         FROM supply sp
         JOIN products pr ON sp.product_id = pr.product_id
         WHERE sp.product_id = $1 AND sp.month = $2
         ORDER BY sp.week ASC`,
        [Number(product_id), Number(month)]
      );

      return res.json({
        success: true,
        message: 'Supply availability retrieved',
        data: supRes.rows,
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }
}

module.exports = Level3Controller;
