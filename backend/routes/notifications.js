const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', NotificationController.getNotifications);
router.patch('/:id/read', NotificationController.markAsRead);

module.exports = router;
