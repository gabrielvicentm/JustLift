const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const chatController = require('../controller/chatController');

const router = express.Router();

router.get('/:targetUserId/messages', authMiddleware, chatController.getMessages);
router.post('/:targetUserId/messages', authMiddleware, chatController.sendMessage);
router.patch('/:targetUserId/messages/:messageId', authMiddleware, chatController.updateMessage);
router.delete('/:targetUserId/messages/:messageId/for-me', authMiddleware, chatController.deleteMessageForMe);
router.delete('/:targetUserId/messages/:messageId/for-everyone', authMiddleware, chatController.deleteMessageForEveryone);

module.exports = router;
