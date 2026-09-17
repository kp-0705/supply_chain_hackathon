const db = require('../config/database');
const ValidationService = require('../services/validationService');
const AllocationService = require('../services/allocationService');

class Level4Controller {
  /**
   * Get demands ready for Level 4 Executive Approval (level >= 3 with allocations)
   */
  static async getDemands(req, res) {
    try {
      const result = await db.query(
        `SELECT dr.*, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                p.product_name, p.category, p.unit_price, p.standard_cost,
                COALESCE(SUM(sa.allocated_quantity), 0) as allocated_quantity
         FROM demand_raw dr
         JOIN customers c ON dr.customer_id = c.customer_id
         JOIN products p ON dr.product_id = p.product_id
         LEFT JOIN supply_allocation sa ON dr.demand_id = sa.demand_id
         WHERE (dr.level = 3 AND dr.status IN ('PENDING', 'APPROVED'))
            OR (dr.level = 4 AND dr.status IN ('PENDING', 'APPROVED'))
         GROUP BY dr.demand_id, c.customer_name, c.tier, c.priority, c.credit_limit, c.region,
                  p.product_name, p.category, p.unit_price, p.standard_cost
         ORDER BY dr.created_at ASC`
      );

      // Check for already approved ones vs awaiting sign-off
      const approvedIdsRes = await db.query('SELECT demand_id FROM demand_approved');
      const approvedIds = new Set(approvedIdsRes.rows.map(a => Number(a.demand_id)));

      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const excRes = await db.query(
            `SELECT de.*, er.code, er.description 
             FROM demand_exceptions de 
             JOIN exception_rules er ON de.rule_id = er.rule_id 
             WHERE de.demand_id = $1`,
            [d.demand_id]
          );

          const unitPrice = Number(d.unit_price);
          const standardCost = Number(d.standard_cost);
          const allocQty = Number(d.allocated_quantity) || Number(d.suggested_quantity) || Number(d.requested_quantity);
          const totalValue = allocQty * unitPrice;
          const profit = allocQty * (unitPrice - standardCost);
          const marginPct = totalValue > 0 ? ((profit / totalValue) * 100).toFixed(2) : 0;

          return {
            ...d,
            allocated_quantity: allocQty,
            total_value: totalValue,
            profit,
            marginPct,
            is_final_approved: approvedIds.has(Number(d.demand_id)),
            exceptions: excRes.rows
          };
        })
      );

      return res.json({
        success: true,
        message: `Fetched ${enriched.length} demands for Level 4 Executive review`,
        data: enriched,
        errors: []
      });
    } catch (err) {
      console.error('Level 4 getDemands error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Level 4 demands',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Get exceptions for a demand
   */
  static async getExceptions(req, res) {
    const { demand_id } = req.params;
    try {
      const excRes = await db.query(
        `SELECT de.*, er.code, er.description 
         FROM demand_exceptions de 
         JOIN exception_rules er ON de.rule_id = er.rule_id 
         WHERE de.demand_id = $1`,
        [demand_id]
      );

      return res.json({
        success: true,
        message: `Fetched ${excRes.rows.length} exceptions for demand #${demand_id}`,
        data: excRes.rows,
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
   * Final Executive Approval (Rules 4.1 - 4.7)
   */
  static async approve(req, res) {
    const { demand_id } = req.params;
    const { comment, override_exceptions } = req.body;

    try {
      const client = await db.getClient();
      await client.query('BEGIN');

      try {
        // 1. Fetch demand
        const dRes = await client.query('SELECT * FROM demand_raw WHERE demand_id = $1 FOR UPDATE', [demand_id]);
        if (dRes.rows.length === 0) {
          throw new Error('Demand not found');
        }
        const demand = dRes.rows[0];

        // 2. Fetch customer & product
        const cRes = await client.query('SELECT * FROM customers WHERE customer_id = $1', [demand.customer_id]);
        const customer = cRes.rows[0];

        const pRes = await client.query('SELECT * FROM products WHERE product_id = $1', [demand.product_id]);
        const product = pRes.rows[0];

        // 3. Allocations check
        const aRes = await client.query(
          'SELECT COALESCE(SUM(allocated_quantity), 0) as total_alloc FROM supply_allocation WHERE demand_id = $1',
          [demand_id]
        );
        let allocatedQty = Number(aRes.rows[0].total_alloc);
        if (allocatedQty === 0) {
          allocatedQty = Number(demand.suggested_quantity) || Number(demand.requested_quantity);
        }

        const totalValue = allocatedQty * Number(product.unit_price);
        const marginPct = Number(product.unit_price) > 0 
          ? (((Number(product.unit_price) - Number(product.standard_cost)) / Number(product.unit_price)) * 100).toFixed(2)
          : 0;

        // Rule 4.1: Check outstanding exceptions
        const rule41 = await ValidationService.validateRule4_1(demand_id, comment, client);
        if (!rule41.passed && !override_exceptions) {
          throw new Error(rule41.message);
        }

        // Rule 4.2: Recalculate customer exposure
        const rule42 = await ValidationService.validateRule4_2(demand.customer_id, totalValue, client);
        if (!rule42.passed) {
          if (customer.tier !== 'STRATEGIC') {
            throw new Error(rule42.message);
          }
        }

        // Rule 4.6: Spot customer restrictions
        const rule46 = ValidationService.validateRule4_6(customer, allocatedQty, demand.requested_quantity, marginPct);
        if (!rule46.passed) {
          throw new Error(rule46.message);
        }

        // Rule 4.7: Final Approval Actions
        // a. Insert into demand_approved
        await client.query(
          `INSERT INTO demand_approved 
           (demand_id, customer_id, product_id, fulfilled_quantity, total_value, approved_by) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (demand_id) DO UPDATE SET 
             fulfilled_quantity = EXCLUDED.fulfilled_quantity,
             total_value = EXCLUDED.total_value,
             approval_date = NOW()`,
          [demand_id, demand.customer_id, demand.product_id, allocatedQty, totalValue, req.user.user_id]
        );

        // b. Update demand_raw
        await client.query(
          `UPDATE demand_raw SET status = 'APPROVED', level = 4, updated_at = NOW() WHERE demand_id = $1`,
          [demand_id]
        );

        // c. Resolve all exceptions
        await client.query(
          `UPDATE demand_exceptions 
           SET resolution = $1, resolved_by = $2, resolved_at = NOW() 
           WHERE demand_id = $3 AND resolved_at IS NULL`,
          [comment || 'Executive override and final sign-off', req.user.user_id, demand_id]
        );

        // d. Log to demand_action_log
        await client.query(
          `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, comment, approved_by) 
           VALUES ($1, 4, 'APPROVED', $2, 'Executive Final Sign-off Completed', $3, $4)`,
          [demand_id, allocatedQty, comment || 'Final fulfillment authorization granted.', req.user.user_id]
        );

        // e. Notify Customer
        await client.query(
          `INSERT INTO notifications (user_id, demand_id, title, body) 
           SELECT user_id, $1, 'Order Fully Approved & Scheduled for Fulfillment', $2 
           FROM users WHERE customer_id = $3`,
          [demand_id, `Your demand #${demand_id} for ${allocatedQty} units of ${product.product_name} ($${totalValue.toLocaleString()}) has received final executive approval!`, demand.customer_id]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: `Demand #${demand_id} has received final Executive Approval and is committed for fulfillment!`,
          data: {
            demand_id,
            fulfilled_quantity: allocatedQty,
            total_value: totalValue,
            status: 'APPROVED',
            level: 4
          },
          errors: []
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Level 4 approve error:', err);
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Final Executive Rejection (Rule 4.7)
   * Releases allocated supply back to the inventory pool!
   */
  static async reject(req, res) {
    const { demand_id } = req.params;
    const { reason, comment } = req.body;

    if (!reason && !comment) {
      return res.status(400).json({
        success: false,
        message: 'A rejection rationale is required',
        data: null,
        errors: [{ field: 'reason', message: 'Reason required' }]
      });
    }

    try {
      const client = await db.getClient();
      await client.query('BEGIN');

      try {
        const dRes = await client.query('SELECT * FROM demand_raw WHERE demand_id = $1 FOR UPDATE', [demand_id]);
        if (dRes.rows.length === 0) {
          throw new Error('Demand not found');
        }
        const demand = dRes.rows[0];

        // 1. Release all allocations back to supply pool
        await AllocationService.releaseAllocations(demand_id, client);

        // 2. Update demand status and reason
        const finalReason = reason && comment ? `${reason}: ${comment}` : (reason || comment);
        await client.query(
          `UPDATE demand_raw SET status = 'REJECTED', reason = $1, updated_at = NOW() WHERE demand_id = $2`,
          [finalReason, demand_id]
        );

        // 3. Log action
        await client.query(
          `INSERT INTO demand_action_log (demand_id, level, action_type, reason, comment, approved_by) 
           VALUES ($1, 4, 'REJECTED', $2, $3, $4)`,
          [demand_id, reason || 'Rejected by Executive Approver', comment || null, req.user.user_id]
        );

        // 4. Notify customer
        await client.query(
          `INSERT INTO notifications (user_id, demand_id, title, body) 
           SELECT user_id, $1, 'Demand Order Rejected at Executive Level', $2 
           FROM users WHERE customer_id = $3`,
          [demand_id, `Your demand #${demand_id} was rejected: ${reason || comment}. Supply allocations have been released.`, demand.customer_id]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: `Demand #${demand_id} rejected and all supply allocations released back to inventory pool.`,
          data: { demand_id, status: 'REJECTED' },
          errors: []
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
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

module.exports = Level4Controller;
