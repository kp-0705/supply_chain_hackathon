const db = require('../config/database');
const DemandService = require('../services/demandService');
const AiService = require('../services/aiService');

class CustomerController {
  static async submitDemand(req, res) {
    try {
      const { product_id, requested_quantity, required_date } = req.body;
      let customerId = req.user.customer_id;

      // Allow admin or tester without customer_id to supply one in body
      if (!customerId && req.body.customer_id) {
        customerId = Number(req.body.customer_id);
      }

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'No associated customer profile found for this account. Please specify customer_id.',
          data: null,
          errors: [{ field: 'customer_id', message: 'Missing customer link' }]
        });
      }

      if (!product_id || !requested_quantity || !required_date) {
        return res.status(400).json({
          success: false,
          message: 'product_id, requested_quantity, and required_date are required',
          data: null,
          errors: [{ field: 'fields', message: 'Missing required parameters' }]
        });
      }

      const demand = await DemandService.submitDemand({
        customerId,
        productId: Number(product_id),
        requestedQuantity: Number(requested_quantity),
        requiredDate: required_date,
        submittedByUserId: req.user.user_id
      });

      return res.status(201).json({
        success: true,
        message: 'Demand submitted successfully and queued for Level 1 validation',
        data: demand,
        errors: []
      });
    } catch (err) {
      console.error('Customer demand submission error:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        data: null,
        errors: err.errors || [{ message: err.message }]
      });
    }
  }

  static async getMyDemands(req, res) {
    try {
      const customerId = req.user.customer_id || req.query.customer_id;

      let query = `
        SELECT dr.*, c.customer_name, p.product_name, p.unit_price,
               COALESCE(SUM(sa.allocated_quantity), 0) as allocated_quantity,
               (dr.requested_quantity - COALESCE(SUM(sa.allocated_quantity), 0)) as remaining_quantity
        FROM demand_raw dr
        JOIN customers c ON dr.customer_id = c.customer_id
        JOIN products p ON dr.product_id = p.product_id
        LEFT JOIN supply_allocation sa ON dr.demand_id = sa.demand_id
      `;
      const params = [];

      if (customerId) {
        params.push(Number(customerId));
        query += ' WHERE dr.customer_id = $1';
      }

      query += `
        GROUP BY dr.demand_id, c.customer_name, p.product_name, p.unit_price
        ORDER BY dr.created_at DESC
      `;

      const result = await db.query(query, params);

      const enriched = await Promise.all(
        result.rows.map(async (d) => {
          const logRes = await db.query(
            `SELECT dal.*, u.name as user_name, u.role as user_role 
             FROM demand_action_log dal 
             LEFT JOIN users u ON dal.approved_by = u.user_id 
             WHERE dal.demand_id = $1 
             ORDER BY dal.created_at ASC`,
            [d.demand_id]
          );

          let approvedData = null;
          let officialAllocatedQty = 0;
          if (d.status === 'APPROVED') {
            const appRes = await db.query(
              'SELECT * FROM demand_approved WHERE demand_id = $1',
              [d.demand_id]
            );
            if (appRes.rows.length > 0) {
              approvedData = appRes.rows[0];
              officialAllocatedQty = Number(approvedData.fulfilled_quantity);
            } else {
              officialAllocatedQty = Number(d.allocated_quantity) || Number(d.suggested_quantity) || Number(d.requested_quantity);
            }
          }

          return {
            ...d,
            allocated_quantity: officialAllocatedQty,
            remaining_quantity: Number(d.requested_quantity) - officialAllocatedQty,
            actions: logRes.rows || [],
            approved_data: approvedData
          };
        })
      );

      return res.json({
        success: true,
        message: `Retrieved ${enriched.length} demands`,
        data: enriched,
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve demands',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async getDemandStatus(req, res) {
    try {
      const { demand_id } = req.params;
      const details = await DemandService.getDemandTimeline(Number(demand_id));

      // Check ownership if user is customer
      if (req.user.role === 'CUSTOMER' && req.user.customer_id && Number(details.demand.customer_id) !== Number(req.user.customer_id)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this demand',
          data: null,
          errors: []
        });
      }

      return res.json({
        success: true,
        message: 'Demand status retrieved',
        data: details.demand,
        errors: []
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async getDemandTimeline(req, res) {
    try {
      const { demand_id } = req.params;
      const details = await DemandService.getDemandTimeline(Number(demand_id));

      return res.json({
        success: true,
        message: 'Demand lifecycle timeline retrieved',
        data: details,
        errors: []
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  /**
   * Customer AI Chatbot — restricted to the authenticated customer's own demands.
   * Answers conversational questions about demand status, rejection reasons,
   * allocation quantities, and supply availability using real database data.
   * Never exposes internal business data (costs, margins, other customers).
   */
  static async chatbotQuery(req, res) {
    const { demand_id, question } = req.body;

    if (!demand_id || !question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'demand_id and question are required',
        data: null,
        errors: [{ field: 'question', message: 'Question cannot be empty' }]
      });
    }

    const customerId = req.user.customer_id;
    if (!customerId) {
      return res.status(403).json({
        success: false,
        message: 'Only customer accounts can use the chatbot',
        data: null,
        errors: []
      });
    }

    try {
      // Ownership verification: ensure this demand belongs to the authenticated customer
      const ownerCheck = await db.query(
        'SELECT demand_id FROM demand_raw WHERE demand_id = $1 AND customer_id = $2',
        [Number(demand_id), Number(customerId)]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to query this demand',
          data: null,
          errors: []
        });
      }

      const result = await AiService.answerCustomerQuery(
        Number(customerId),
        Number(demand_id),
        question.trim()
      );

      // Audit log — store chatbot interaction for quality review
      try {
        await db.query(
          `INSERT INTO chatbot_messages (demand_id, customer_id, question, answer)
           VALUES ($1, $2, $3, $4)`,
          [Number(demand_id), Number(customerId), question.trim(), result.answer]
        );
      } catch (logErr) {
        // Non-fatal: chatbot_messages table may not exist yet (graceful degradation)
        console.warn('chatbot_messages log skipped:', logErr.message);
      }

      return res.json({
        success: true,
        message: 'Chatbot response generated',
        data: result,
        errors: []
      });
    } catch (err) {
      console.error('Chatbot query error:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }
}

module.exports = CustomerController;
