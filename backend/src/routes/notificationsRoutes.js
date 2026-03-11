const express = require('express');
const notificationsController = require('../controller/notificationsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get("/", authMiddleware, notificationsController.listNotifications);
router.get("/unread-count", authMiddleware, notificationsController.unreadCount);
router.patch("/:id/read", authMiddleware, notificationsController.markRead);
router.post("/push-token", authMiddleware, notificationsController.savePushToken);

module.exports = router;
