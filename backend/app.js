const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const { level1Router, level2Router, level3Router, level4Router } = require('./routes/levels');
const notificationRoutes = require('./routes/notifications');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Global Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Micron Supply Chain Demand Management API',
    timestamp: new Date().toISOString()
  });
});

const AdminController = require('./controllers/adminController');
const CustomerController = require('./controllers/customerController');
const { authenticate } = require('./middleware/auth');

// Public / Authenticated Common Routes
app.get('/api/products', authenticate, AdminController.listProducts);
app.get('/api/supply', authenticate, AdminController.listSupply);
app.get('/api/demands/all', authenticate, CustomerController.getMyDemands);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/level1', level1Router);
app.use('/api/level2', level2Router);
app.use('/api/level3', level3Router);
app.use('/api/level4', level4Router);
app.use('/api/notifications', notificationRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
