const db = require('../config/database');
const ValidationService = require('../services/validationService');

class Level1Controller {
  /**
   * Get demands awaiting Level 1 Demand Validation (level = 0)
   */
  static async getDemands(req, res) {
    try {
      const result = await db.query(
        `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                p.product_name, p.category, p.unit_price, p.status as product_status
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         WHERE dr.level = 0 AND dr.status = 'PENDING'
         ORDER BY dr.created_at ASC`
      );

      // Evaluate rules in advance for UI badges
      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const val = await ValidationService.validateLevel1({
            customer_id: d.customer_id,
            product_id: d.product_id,
            requested_quantity: d.requested_quantity,
            required_date: d.required_date,
            demand_id: d.demand_id
          });
          return {
            ...d,
            validation: {
              canApprove: val.success,
              errors: val.errors,
              warnings: val.warnings
            }
          };
        })
      );

      return res.json({
        success: true,
        message: `Fetched ${enriched.length} demands awaiting Level 1 validation`,
        data: enriched,
        errors: []
      });
    } catch (err) {
      console.error('Level 1 getDemands error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Level 1 demands',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Approve demand at Level 1 (advances to Level 1 -> ready for Level 2)
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

      if (demand.level !== 0) {
        return res.status(400).json({
          success: false,
          message: `Demand #${demand_id} is at Level ${demand.level}, not Level 0`,
          data: null,
          errors: []
        });
      }

      // Check Level 1 rules (1.1 - 1.7)
      const val = await ValidationService.validateLevel1({
        customer_id: demand.customer_id,
        product_id: demand.product_id,
        requested_quantity: demand.requested_quantity,
        required_date: demand.required_date,
        demand_id: demand.demand_id
      });

      // Level 1 validator performs manual review; if any rules are flagged, a rationale comment is required
      if (!val.success && (!comment || comment.trim().length < 3)) {
        return res.status(400).json({
          success: false,
          message: 'Level 1 validator comment is required to approve demand.',
          data: null,
          errors: val.errors
        });
      }

      // Advance to Level 1 (which means ready for Level 2 review)
      await db.query(
        `UPDATE demand_raw SET level = 1, updated_at = NOW() WHERE demand_id = $1`,
        [demand_id]
      );

      // Log action
      await db.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, comment, approved_by) 
         VALUES ($1, 1, 'APPROVED', $2, 'Level 1: Passed customer, credit, and product validations', $3, $4)`,
        [demand_id, demand.requested_quantity, comment || null, req.user.user_id]
      );

      // Notify Level 2 Validators
      await db.query(
        `INSERT INTO notifications (user_id, demand_id, title, body) 
         SELECT user_id, $1, 'Demand Ready for Level 2 Supply Check', $2 
         FROM users WHERE role = 'LEVEL2'`,
        [demand_id, `Demand #${demand_id} passed Level 1 validation and is queued for supply plan verification.`]
      );

      return res.json({
        success: true,
        message: `Demand #${demand_id} approved at Level 1 and advanced to Level 2`,
        data: { demand_id, new_level: 1, status: demand.status },
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
   * Reject demand at Level 1
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
         VALUES ($1, 1, 'REJECTED', $2, $3, $4)`,
        [demand_id, reason || 'Rejected by Level 1 Validator', comment || null, req.user.user_id]
      );

      // Notify Customer
      const custUser = await db.query('SELECT user_id FROM users WHERE customer_id = $1', [dRes.rows[0].customer_id]);
      if (custUser.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, demand_id, title, body) VALUES ($1, $2, $3, $4)`,
          [custUser.rows[0].user_id, demand_id, 'Demand Rejected at Level 1', `Demand #${demand_id} was rejected: ${reason || comment}`]
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
}

module.exports = Level1Controller;
