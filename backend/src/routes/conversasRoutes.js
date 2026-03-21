const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const conversasController = require('../controller/conversasController');

const router = express.Router();

router.get('/', authMiddleware, conversasController.list);
router.post('/:targetUserId/hide', authMiddleware, conversasController.hide);
router.post('/:targetUserId/pin', authMiddleware, conversasController.pin);
router.delete('/:targetUserId/pin', authMiddleware, conversasController.unpin);
router.post('/:targetUserId/block', authMiddleware, conversasController.block);
router.delete('/:targetUserId/block', authMiddleware, conversasController.unblock);

module.exports = router;
