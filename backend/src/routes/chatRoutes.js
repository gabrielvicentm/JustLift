const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const chatController = require('../controller/chatController');

const router = express.Router();

router.get('/:targetUserId/messages', authMiddleware, chatController.getMessages);
router.post('/:targetUserId/messages', authMiddleware, chatController.sendMessage);

module.exports = router;
