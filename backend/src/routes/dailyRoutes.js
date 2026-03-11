const express = require('express');
const dailyController = require('../controller/dailyController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, dailyController.createDailyBatch);
router.get('/user/:userId/summary', authMiddleware, dailyController.getDailySummaryByUser);
router.get('/user/:userId', authMiddleware, dailyController.getActiveDailiesByUser);
router.post('/:dailyId/like', authMiddleware, dailyController.toggleLike);
router.post('/:dailyId/view', authMiddleware, dailyController.markViewed);

module.exports = router;
