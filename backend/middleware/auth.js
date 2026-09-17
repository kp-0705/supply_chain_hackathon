const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required. Please provide a Bearer token.',
      data: null,
      errors: [{ field: 'authorization', message: 'Missing token' }]
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Verify user exists and is active
    const result = await db.query(
      'SELECT user_id, name, email, role, customer_id, is_active FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or no longer exists',
        data: null,
        errors: [{ field: 'user', message: 'Inactive user' }]
      });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
      data: null,
      errors: [{ field: 'token', message: err.message }]
    });
  }
};

const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated user',
        data: null,
        errors: []
      });
    }

    // ADMIN has universal access
    if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      data: null,
      errors: [{ field: 'role', message: 'Insufficient permissions' }]
    });
  };
};

module.exports = {
  authenticate,
  authorize
};
