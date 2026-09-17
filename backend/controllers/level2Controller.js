const db = require('../config/database');
const ValidationService = require('../services/validationService');

class Level2Controller {
  /**
   * Get demands awaiting Level 2 Supply Validation (level = 1, PENDING or PARTIALLY_ALLOCATED)
   */
  static async getDemands(req, res) {
    try {
      const result = await db.query(
        `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                p.product_name, p.category, p.unit_price, p.status as product_status
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         WHERE dr.level = 1 AND dr.status IN ('PENDING', 'PARTIALLY_ALLOCATED')
         ORDER BY dr.created_at ASC`
      );

      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const val = await ValidationService.validateLevel2(d.demand_id);
          const supplyRows = val.supplyRows || [];
          const totalAvailable = supplyRows.reduce(
            (sum, s) => sum + Math.max(0, Number(s.available_quantity) - Number(s.allocated_quantity)),
            0
          );
          const requestedQty = Number(d.requested_quantity);
          const isSupplyShorter = totalAvailable < requestedQty;

          return {
            ...d,
            totalAvailable,
            requestedQty,
            isSupplyShorter,
            validation: {
              canApprove: val.success && !isSupplyShorter,
              canPartiallyAccept: val.success && isSupplyShorter,
              errors: val.errors || [],
              warnings: val.warnings || [],
              supplyRows
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
   * Partially Accept demand at Level 2 (available < requested)
   * Stays in Level 2 until next week supply increases!
   */
  static async partialAccept(req, res) {
    const { demand_id } = req.params;
    const { comment } = req.body;

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

      const note = comment || 'Partially accepted: available supply is less than requested. Retaining in Level 2 until supply replenishment.';

      // Stays at level = 1, status = 'PARTIALLY_ALLOCATED'
      await db.query(
        `UPDATE demand_raw SET status = 'PARTIALLY_ALLOCATED', level = 1, updated_at = NOW() WHERE demand_id = $1`,
        [demand_id]
      );

      // Log action
      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, comment, approved_by) 
         VALUES ($1, 2, 'PARTIALLY_ALLOCATED', $2, 'Partial acceptance at Level 2: Retained awaiting supply increase', $3, $4)`,
        [demand_id, demand.requested_quantity, note, req.user.user_id]
      );

      return res.json({
        success: true,
        message: `Demand #${demand_id} partially accepted. It will remain in Level 2 until additional supply is added.`,
        data: { demand_id, level: 1, status: 'PARTIALLY_ALLOCATED' },
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
   * Approve demand at Level 2 (advances to Level 2 -> ready for Level 3 Matching Planner)
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

      // Advance to Level 2 (ready for Level 3 Matching Planner)
      await db.query(
        `UPDATE demand_raw SET level = 2, status = 'PENDING', updated_at = NOW() WHERE demand_id = $1`,
        [demand_id]
      );

      const warningText = val.warnings?.length > 0
        ? `Warnings noted: ${val.warnings.map(w => w.message).join('; ')}`
        : null;

      // Log action
      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, comment, approved_by) 
         VALUES ($1, 2, 'APPROVED', $2, 'Level 2: Supply plan confirmed and sufficient', $3, $4)`,
        [demand_id, demand.requested_quantity, [comment, warningText].filter(Boolean).join(' | ') || 'Supply plan confirmed', req.user.user_id]
      );

      // Notify Level 3 Planners
      await db.query(
        `INSERT INTO notifications (user_id, demand_id, title, body) 
         SELECT user_id, $1, 'Demand Ready for Supply Allocation (Level 3)', $2 
         FROM users WHERE role = 'LEVEL3'`,
        [demand_id, `Demand #${demand_id} passed supply validation and is ready for matching and allocation.`]
      );

      return res.json({
        success: true,
        message: `Demand #${demand_id} approved at Level 2 and queued for Level 3 allocation`,
        data: { demand_id, new_level: 2, warnings: val.warnings },
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

      const finalReason = reason && comment ? `${reason}: ${comment}` : (reason || comment);
      await db.query(
        `UPDATE demand_raw SET status = 'REJECTED', reason = $1, updated_at = NOW() WHERE demand_id = $2`,
        [finalReason, demand_id]
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
          [custUser.rows[0].user_id, demand_id, 'Demand Rejected at Level 2', `Demand #${demand_id} was rejected: ${finalReason}`]
        );
      }

      return res.json({
        success: true,
        message: `Demand #${demand_id} has been rejected at Level 2`,
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
}

module.exports = Level2Controller;
