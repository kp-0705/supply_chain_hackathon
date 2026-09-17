const db = require('../config/database');
const ValidationService = require('./validationService');

class AllocationService {
  /**
   * Allocate supply to a demand with database transactions and row locking.
   * Supports both automatic FIFO allocation across Weeks 1-4 and manual planner adjustments.
   */
  static async allocateDemand(demandId, manualWeeks = null, approvedByUserId = null) {
    const client = await db.getClient();

    try {
      // 1. Begin transaction
      await client.query('BEGIN');

      // 2. Fetch demand details
      const demandRes = await client.query(
        'SELECT * FROM demand_raw WHERE demand_id = $1 FOR UPDATE',
        [demandId]
      );
      if (demandRes.rows.length === 0) {
        throw new Error(`Demand #${demandId} not found`);
      }
      const demand = demandRes.rows[0];

      // 3. Fetch customer & product
      const custRes = await client.query('SELECT * FROM customers WHERE customer_id = $1', [demand.customer_id]);
      const customer = custRes.rows[0];

      const prodRes = await client.query('SELECT * FROM products WHERE product_id = $1', [demand.product_id]);
      const product = prodRes.rows[0];

      const reqDate = new Date(demand.required_date);
      const targetMonth = reqDate.getMonth() + 1;

      // 4. Fetch available supply rows for this product and month with row-level locks (Rule 3.7)
      const supplyRes = await client.query(
        `SELECT supply_id, week, month, available_quantity, allocated_quantity 
         FROM supply 
         WHERE product_id = $1 AND month = $2 
         ORDER BY week ASC FOR UPDATE`,
        [demand.product_id, targetMonth]
      );

      if (supplyRes.rows.length === 0) {
        throw new Error(`No supply plan found for product #${demand.product_id} in month ${targetMonth}`);
      }

      // 5. Existing allocations for this demand - reverse them first to allow recalculation
      const existingAllocRes = await client.query(
        'SELECT supply_id, allocated_quantity FROM supply_allocation WHERE demand_id = $1',
        [demandId]
      );
      for (const ex of existingAllocRes.rows) {
        await client.query(
          'UPDATE supply SET allocated_quantity = allocated_quantity - $1 WHERE supply_id = $2',
          [Number(ex.allocated_quantity), ex.supply_id]
        );
      }
      await client.query('DELETE FROM supply_allocation WHERE demand_id = $1', [demandId]);

      // Refresh supply rows after restoring allocations
      const refreshedSupplyRes = await client.query(
        `SELECT supply_id, week, month, available_quantity, allocated_quantity 
         FROM supply 
         WHERE product_id = $1 AND month = $2 
         ORDER BY week ASC FOR UPDATE`,
        [demand.product_id, targetMonth]
      );

      const supplyRows = refreshedSupplyRes.rows;
      const requestedQty = Number(demand.requested_quantity);
      let plannedAllocations = [];
      let totalAllocated = 0;

      // Rule 3.4 & 3.1: Sequential week-by-week FIFO allocation
      if (manualWeeks && Array.isArray(manualWeeks)) {
        // Planner provided specific breakdown per week: [{ week: 1, quantity: 400 }, ...]
        for (const mw of manualWeeks) {
          const sup = supplyRows.find(s => Number(s.week) === Number(mw.week));
          if (sup && Number(mw.quantity) > 0) {
            const avail = Number(sup.available_quantity) - Number(sup.allocated_quantity);
            const toAlloc = Math.min(avail, Number(mw.quantity));
            if (toAlloc > 0) {
              plannedAllocations.push({
                supplyId: sup.supply_id,
                week: sup.week,
                quantity: toAlloc
              });
              totalAllocated += toAlloc;
            }
          }
        }
      } else {
        // Automatic FIFO distribution (Rule 3.4)
        let remainingNeeded = requestedQty;
        for (const sup of supplyRows) {
          const avail = Number(sup.available_quantity) - Number(sup.allocated_quantity);
          if (avail > 0 && remainingNeeded > 0) {
            const toAlloc = Math.min(avail, remainingNeeded);
            plannedAllocations.push({
              supplyId: sup.supply_id,
              week: sup.week,
              quantity: toAlloc
            });
            totalAllocated += toAlloc;
            remainingNeeded -= toAlloc;
          }
        }
      }

      // Check if anything could be allocated
      if (totalAllocated === 0) {
        throw new Error('Zero supply available to allocate for this product in the requested month.');
      }

      // Rule 3.7: Prevent overbooking - apply allocations
      for (const alloc of plannedAllocations) {
        await client.query(
          'INSERT INTO supply_allocation (demand_id, supply_id, allocated_quantity) VALUES ($1, $2, $3)',
          [demandId, alloc.supplyId, alloc.quantity]
        );

        await client.query(
          'UPDATE supply SET allocated_quantity = allocated_quantity + $1 WHERE supply_id = $2',
          [alloc.quantity, alloc.supplyId]
        );
      }

      // Partial Allocation Logic
      const isFullyAllocated = totalAllocated >= requestedQty;
      const newStatus = isFullyAllocated ? 'LEVEL3_PENDING' : 'PARTIALLY_ALLOCATED';
      const newLevel = isFullyAllocated ? 3 : 2; // Partial allocation stays at Level 2!


      await client.query(
        `UPDATE demand_raw 
         SET status = $1, level = $2, suggested_quantity = $3, updated_at = NOW() 
         WHERE demand_id = $4`,
        [newStatus, newLevel, totalAllocated, demandId]
      );

      // Audit Action Log
      const reasonText = isFullyAllocated
        ? `Full supply allocated (${totalAllocated} units) across weeks.`
        : `Partial allocation: ${totalAllocated}/${requestedQty} units allocated. Waiting for replenishment.`;

      await client.query(
        `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason, comment, approved_by) 
         VALUES ($1, 2, $2, $3, $4, $5, $6)`,
        [
          demandId,
          newStatus,
          totalAllocated,
          reasonText,
          null,
          approvedByUserId
        ]
      );

      // Notifications
      if (isFullyAllocated) {
        // Notify Level 3 approvers
        await client.query(
          `INSERT INTO notifications (user_id, demand_id, title, body)
           SELECT user_id, $1, 'Demand Ready for Business Review', $2
           FROM users WHERE role = 'LEVEL3'`,
          [demandId, `Demand #${demandId} (${customer.customer_name}) has been fully allocated (${totalAllocated} units) and requires Level 3 business review.`]
        );
      } else {
        // Notify Customer and Planner
        await client.query(
          `INSERT INTO notifications (user_id, demand_id, title, body)
           SELECT user_id, $1, 'Demand Partially Allocated', $2
           FROM users WHERE customer_id = $3`,
          [demandId, `Your demand #${demandId} has been partially allocated ${totalAllocated}/${requestedQty} units.`, customer.customer_id]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        demandId,
        requestedQty,
        allocatedQty: totalAllocated,
        isFullyAllocated,
        status: newStatus,
        level: newLevel,
        financials: {},
        allocations: plannedAllocations,
        exceptions: []
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Auto-Completion Engine (Special Case & Rule 3.9)
   * Scans for all PARTIALLY_ALLOCATED demands at Level 3 and satisfies them from newly added supply.
   */
  static async triggerAutoCompletion(productId = null) {
    const client = await db.getClient();
    const results = [];

    try {
      await client.query('BEGIN');

      let queryText = `
        SELECT demand_id, customer_id, product_id, requested_quantity, required_date 
        FROM demand_raw 
        WHERE status = 'PARTIALLY_ALLOCATED' AND level = 2
      `;
      const queryParams = [];

      if (productId) {
        queryText += ' AND product_id = $1';
        queryParams.push(productId);
      }
      queryText += ' ORDER BY created_at ASC FOR UPDATE';

      const partialDemands = await client.query(queryText, queryParams);

      for (const dem of partialDemands.rows) {
        const reqDate = new Date(dem.required_date);
        const month = reqDate.getMonth() + 1;

        // Check current allocations
        const currAllocRes = await client.query(
          'SELECT COALESCE(SUM(allocated_quantity), 0) as total_alloc FROM supply_allocation WHERE demand_id = $1',
          [dem.demand_id]
        );
        const currentAllocated = Number(currAllocRes.rows[0].total_alloc);
        const remainingNeeded = Number(dem.requested_quantity) - currentAllocated;

        if (remainingNeeded <= 0) continue;

        // Check available supply in the month
        const supplyRes = await client.query(
          `SELECT supply_id, week, (available_quantity - allocated_quantity) as remaining_avail 
           FROM supply 
           WHERE product_id = $1 AND month = $2 AND (available_quantity - allocated_quantity) > 0 
           ORDER BY week ASC FOR UPDATE`,
          [dem.product_id, month]
        );

        let newlyAllocatedThisPass = 0;
        let stillNeeded = remainingNeeded;

        for (const sup of supplyRes.rows) {
          const avail = Number(sup.remaining_avail);
          if (avail > 0 && stillNeeded > 0) {
            const allocQty = Math.min(avail, stillNeeded);

            await client.query(
              'INSERT INTO supply_allocation (demand_id, supply_id, allocated_quantity) VALUES ($1, $2, $3)',
              [dem.demand_id, sup.supply_id, allocQty]
            );

            await client.query(
              'UPDATE supply SET allocated_quantity = allocated_quantity + $1 WHERE supply_id = $2',
              [allocQty, sup.supply_id]
            );

            newlyAllocatedThisPass += allocQty;
            stillNeeded -= allocQty;
          }
        }

        const totalNow = currentAllocated + newlyAllocatedThisPass;

        if (totalNow >= Number(dem.requested_quantity)) {
          // Fully satisfied! Move to Level 3
          await client.query(
            `UPDATE demand_raw 
             SET status = 'LEVEL3_PENDING', level = 3, suggested_quantity = $1, updated_at = NOW() 
             WHERE demand_id = $2`,
            [totalNow, dem.demand_id]
          );

          await client.query(
            `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason) 
             VALUES ($1, 2, 'AUTO_COMPLETED', $2, $3)`,
            [
              dem.demand_id,
              totalNow,
              `Auto-completed: additional ${newlyAllocatedThisPass} units allocated from fresh supply plan. Now 100% fulfilled and advanced to Level 3.`
            ]
          );

          // Notify Level 3 planners
          await client.query(
            `INSERT INTO notifications (user_id, demand_id, title, body) 
             SELECT user_id, $1, 'Demand Auto-Completed by Replenished Supply', $2 
             FROM users WHERE role = 'LEVEL3'`,
            [dem.demand_id, `Demand #${dem.demand_id} was auto-completed with fresh supply and advanced to Level 3 for business review.`]
          );

          results.push({
            demandId: dem.demand_id,
            completed: true,
            totalAllocated: totalNow,
            message: 'Successfully auto-completed demand to 100%'
          });
        } else if (newlyAllocatedThisPass > 0) {
          // Additional partial allocation
          await client.query(
            `UPDATE demand_raw 
             SET suggested_quantity = $1, updated_at = NOW() 
             WHERE demand_id = $2`,
            [totalNow, dem.demand_id]
          );

          await client.query(
            `INSERT INTO demand_action_log (demand_id, level, action_type, approved_quantity, reason) 
             VALUES ($1, 2, 'PARTIALLY_ALLOCATED', $2, $3)`,
            [
              dem.demand_id,
              totalNow,
              `Replenished +${newlyAllocatedThisPass} units. Total now ${totalNow}/${dem.requested_quantity}. Awaiting further supply.`
            ]
          );

          results.push({
            demandId: dem.demand_id,
            completed: false,
            totalAllocated: totalNow,
            message: `Allocated additional ${newlyAllocatedThisPass} units; still pending full replenishment.`
          });
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error during auto-completion sweep:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Release all allocations associated with a demand (used when rejected at Level 4)
   */
  static async releaseAllocations(demandId, client = db) {
    const allocRes = await client.query(
      'SELECT supply_id, allocated_quantity FROM supply_allocation WHERE demand_id = $1',
      [demandId]
    );

    for (const alloc of allocRes.rows) {
      await client.query(
        'UPDATE supply SET allocated_quantity = allocated_quantity - $1 WHERE supply_id = $2',
        [Number(alloc.allocated_quantity), alloc.supply_id]
      );
    }

    await client.query('DELETE FROM supply_allocation WHERE demand_id = $1', [demandId]);
  }
}

module.exports = AllocationService;
