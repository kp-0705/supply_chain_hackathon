const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize(['ADMIN']));

// Supply Management
router.post('/supply/add', AdminController.addSupply);
router.get('/supply/list', AdminController.listSupply);

// Product Management
router.post('/products/create', AdminController.createProduct);
router.get('/products/list', AdminController.listProducts);

// Customer Management
router.get('/customers', AdminController.listCustomers);
router.post('/customers/create', AdminController.createCustomer);

// System Stats
router.get('/stats', AdminController.getStats);

module.exports = router;
