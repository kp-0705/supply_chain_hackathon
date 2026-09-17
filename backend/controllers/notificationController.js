const db = require('../config/database');

class NotificationController {
  static async getNotifications(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.user.user_id]
      );

      const unreadCount = result.rows.filter(n => !n.is_read).length;

      return res.json({
        success: true,
        message: 'Notifications fetched',
        data: {
          unreadCount,
          notifications: result.rows
        },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }

  static async markAsRead(req, res) {
    const { id } = req.params;
    try {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2',
        [id, req.user.user_id]
      );

      return res.json({
        success: true,
        message: 'Notification marked as read',
        data: { notification_id: id },
        errors: []
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification',
        data: null,
        errors: [{ message: err.message }]
      });
    }
  }
}

module.exports = NotificationController;
