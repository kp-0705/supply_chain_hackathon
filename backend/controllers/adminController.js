const db = require('../config/database');
const SupplyService = require('../services/supplyService');

class AdminController {
  static async addSupply(req, res) {
    try {
      const { product_id, month, week, available_quantity } = req.body;

      if (!product_id || !month || !week || available_quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'product_id, month, week, and available_quantity are required',
          data: null,
          errors: [{ field: 'params', message: 'Missing parameters' }]
        });
      }

      const result = await SupplyService.addSupplyPlan({
        productId: product_id,
        month,
        week,
        availableQuantity: available_quantity,
        createdByUserId: req.user.user_id
      });

      return res.status(201).json({
        success: true,
        message: `Supply plan updated for Product #${product_id}, Month ${month}, Week ${week}`,
        data: result,
        errors: []
      });
    } catch (err) {
      console.error('Admin addSupply error:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async listSupply(req, res) {
    try {
      const { product_id, month } = req.query;
      const list = await SupplyService.listSupply(product_id, month);
      return res.json({
        success: true,
        message: `Fetched ${list.length} supply records`,
        data: list,
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve supply records',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async createProduct(req, res) {
    try {
      const { product_name, category, unit_price, standard_cost, status } = req.body;

      if (!product_name || unit_price === undefined || standard_cost === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Product name, unit price, and standard cost are required',
          data: null,
          errors: [{ field: 'fields', message: 'Missing product attributes' }]
        });
      }

      const price = Number(unit_price);
      const cost = Number(standard_cost);

      if (price < 0 || cost < 0) {
        return res.status(400).json({
          success: false,
          message: 'Unit price and standard cost must be non-negative',
          data: null,
          errors: [{ field: 'price', message: 'Negative price/cost' }]
        });
      }

      const result = await db.query(
        `INSERT INTO products (product_name, category, unit_price, standard_cost, status, is_active) 
         VALUES ($1, $2, $3, $4, $5, TRUE) 
         RETURNING *`,
        [product_name.trim(), category || 'STANDARD', price, cost, status || 'ACTIVE']
      );

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: result.rows[0],
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create product',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async listProducts(req, res) {
    try {
      const result = await db.query('SELECT * FROM products ORDER BY product_id ASC');
      return res.json({
        success: true,
        message: `Fetched ${result.rows.length} products`,
        data: result.rows,
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve products',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async listCustomers(req, res) {
    try {
      const result = await db.query('SELECT * FROM customers ORDER BY customer_id ASC');
      return res.json({
        success: true,
        message: `Fetched ${result.rows.length} customers`,
        data: result.rows,
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve customers',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async createCustomer(req, res) {
    try {
      const { customer_name, contact_person, company_name, region, email, priority, phone, address, credit_limit, tier } = req.body;

      if (!customer_name || !company_name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Customer name, company name, and email are required',
          data: null,
          errors: [{ field: 'fields', message: 'Missing customer details' }]
        });
      }

      const result = await db.query(
        `INSERT INTO customers 
         (customer_name, contact_person, company_name, region, email, priority, phone, address, credit_limit, tier, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) 
         RETURNING *`,
        [
          customer_name,
          contact_person || null,
          company_name,
          region || 'US',
          email.toLowerCase(),
          priority || 'NORMAL',
          phone || null,
          address || null,
          credit_limit ? Number(credit_limit) : 0,
          tier || 'STANDARD'
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Customer registered successfully',
        data: result.rows[0],
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to register customer',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async getStats(req, res) {
    try {
      const [supRes, demRes, excRes, appRes] = await Promise.all([
        db.query('SELECT COALESCE(SUM(available_quantity), 0) as total_supply, COALESCE(SUM(allocated_quantity), 0) as total_allocated FROM supply'),
        db.query('SELECT COUNT(*) as total_demands, COUNT(CASE WHEN status = \'PENDING\' THEN 1 END) as pending_demands, COUNT(CASE WHEN status = \'PARTIALLY_ALLOCATED\' THEN 1 END) as partial_demands FROM demand_raw'),
        db.query('SELECT COUNT(*) as open_exceptions FROM demand_exceptions WHERE resolved_at IS NULL'),
        db.query('SELECT COALESCE(SUM(total_value), 0) as total_revenue, COUNT(*) as approved_orders FROM demand_approved')
      ]);

      return res.json({
        success: true,
        message: 'System stats computed',
        data: {
          supply: supRes.rows[0],
          demands: demRes.rows[0],
          exceptions: excRes.rows[0],
          approvals: appRes.rows[0]
        },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to compute stats',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }
}

module.exports = AdminController;
