const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Customers and Admins can access customer routes
router.use(authorize(['CUSTOMER', 'ADMIN']));

router.post('/demand/submit', CustomerController.submitDemand);
router.get('/demands', CustomerController.getMyDemands);
router.get('/demand/:demand_id/status', CustomerController.getDemandStatus);
router.get('/demand/:demand_id/timeline', CustomerController.getDemandTimeline);

// Shared resources for customer
const AdminController = require('../controllers/adminController');
router.get('/products', AdminController.listProducts);

module.exports = router;
