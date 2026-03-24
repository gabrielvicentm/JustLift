const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controller/notificationController');

const router = express.Router();

router.get('/', authMiddleware, notificationController.listNotifications);
router.get('/list-notifications', authMiddleware, notificationController.listNotifications);
router.get('/unread-count', authMiddleware, notificationController.getUnreadNotificationsCount);
router.patch('/read-all', authMiddleware, notificationController.markAllNotificationsAsRead);
router.patch('/:notificationId/read', authMiddleware, notificationController.markNotificationAsRead);
router.post('/push-token', authMiddleware, notificationController.registerPushToken);
router.delete('/push-token', authMiddleware, notificationController.unregisterPushToken);

module.exports = router;
