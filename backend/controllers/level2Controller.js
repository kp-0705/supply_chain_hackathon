const db = require('../config/database');
const ValidationService = require('../services/validationService');
const AllocationService = require('../services/allocationService');

class Level2Controller {
  /**
   * Get demands awaiting Level 2 Supply Validation (level = 1)
   */
  static async getDemands(req, res) {
    try {
      const result = await db.query(
        `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                p.product_name, p.category, p.unit_price, p.status as product_status
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         WHERE (dr.level = 1 AND dr.status = 'PENDING')
            OR (dr.level = 2 AND dr.status = 'PARTIALLY_ALLOCATED')
         ORDER BY dr.created_at ASC`
      );

      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const val = await ValidationService.validateLevel2(d.demand_id);
          return {
            ...d,
            validation: {
              canApprove: val.success,
              errors: val.errors || [],
              warnings: val.warnings || [],
              supplyRows: val.supplyRows || []
            }
          };
        })
      );

      return res.json({
        success: true,
        message: `Fetched ${enriched.length} demands awaiting Level 2 supply validation`,
        data: enriched,
        errors: []
      });
    } catch (err) {
      console.error('Level 2 getDemands error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Level 2 demands',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Approve demand at Level 2 (advances to Level 2 -> ready for Level 3 Matching Planner)
   */
  static async approve(req, res) {
    const { demand_id } = req.params;
    const { comment, manualWeeks } = req.body;

    try {
      const dRes = await db.query('SELECT * FROM demand_raw WHERE demand_id = $1', [demand_id]);
      if (dRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Demand not found', data: null, errors: [] });
      }
      const demand = dRes.rows[0];

      if (demand.level !== 1) {
        return res.status(400).json({
          success: false,
          message: `Demand #${demand_id} is at Level ${demand.level}, not Level 1`,
          data: null,
          errors: []
        });
      }

      // Check Level 2 rules (2.1 - 2.6)
      const val = await ValidationService.validateLevel2(demand_id);

      if (!val.success) {
        return res.status(400).json({
          success: false,
          message: 'Level 2 supply validation failed. Cannot approve demand.',
          data: null,
          errors: val.errors
        });
      }

      // Advance to Level 2 (Allocation)
      const allocResult = await AllocationService.allocateDemand(demand_id, manualWeeks, req.user.user_id);

      return res.json({
        success: true,
        message: allocResult.isFullyAllocated 
          ? `Demand #${demand_id} allocated 100% and queued for Level 3 business review`
          : `Demand #${demand_id} partially allocated. Waiting for more supply.`,
        data: allocResult,
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
   * Reject demand at Level 2
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

      await db.query(
        `UPDATE demand_raw SET status = 'REJECTED', updated_at = NOW() WHERE demand_id = $1`,
        [demand_id]
      );

      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, reason, comment, approved_by) 
         VALUES ($1, 2, 'REJECTED', $2, $3, $4)`,
        [demand_id, reason || 'Rejected by Level 2 Supply Validator', comment || null, req.user.user_id]
      );

      const custUser = await db.query('SELECT user_id FROM users WHERE customer_id = $1', [dRes.rows[0].customer_id]);
      if (custUser.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, demand_id, title, body) VALUES ($1, $2, $3, $4)`,
          [custUser.rows[0].user_id, demand_id, 'Demand Rejected at Level 2', `Demand #${demand_id} was rejected: ${reason || comment}`]
        );
      }

      return res.json({
        success: true,
        message: `Demand #${demand_id} has been rejected`,
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

module.exports = Level2Controller;
