const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const env = require('../config/env');

class AuthController {
  static async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        data: null,
        errors: [{ field: 'credentials', message: 'Missing email or password' }]
      });
    }

    try {
      const result = await db.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          data: null,
          errors: [{ field: 'email', message: 'User not found' }]
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deactivated. Please contact an administrator.',
          data: null,
          errors: [{ field: 'is_active', message: 'Account deactivated' }]
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          data: null,
          errors: [{ field: 'password', message: 'Incorrect password' }]
        });
      }

      // Generate JWT Token
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
          customer_id: user.customer_id,
          name: user.name
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Customer metadata if applicable
      let customerInfo = null;
      if (user.customer_id) {
        const custRes = await db.query('SELECT * FROM customers WHERE customer_id = $1', [user.customer_id]);
        customerInfo = custRes.rows[0] || null;
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            customer_id: user.customer_id
          },
          customer: customerInfo
        },
        errors: []
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async register(req, res) {
    const { name, email, password, role, phone, customer_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required',
        data: null,
        errors: [{ field: 'fields', message: 'Missing required registration fields' }]
      });
    }

    const validRoles = ['ADMIN', 'CUSTOMER', 'LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${validRoles.join(', ')}`,
        data: null,
        errors: [{ field: 'role', message: 'Role not recognized' }]
      });
    }

    try {
      // Check existing email
      const existing = await db.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email address already exists',
          data: null,
          errors: [{ field: 'email', message: 'Email in use' }]
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, role, phone, customer_id, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, TRUE) 
         RETURNING user_id, name, email, role, phone, customer_id, created_at`,
        [name.trim(), email.trim().toLowerCase(), passwordHash, role, phone || null, customer_id ? Number(customer_id) : null]
      );

      const newUser = result.rows[0];

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user: newUser },
        errors: []
      });
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to register user',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async me(req, res) {
    try {
      const userRes = await db.query('SELECT user_id, name, email, role, phone, customer_id, created_at FROM users WHERE user_id = $1', [req.user.user_id]);
      const user = userRes.rows[0];

      let customer = null;
      if (user?.customer_id) {
        const custRes = await db.query('SELECT * FROM customers WHERE customer_id = $1', [user.customer_id]);
        customer = custRes.rows[0];
      }

      return res.json({
        success: true,
        message: 'Current user profile fetched',
        data: { user, customer },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }
}

module.exports = AuthController;
