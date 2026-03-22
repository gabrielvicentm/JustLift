const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const feedController = require('../controller/feedController');

const router = express.Router();

router.get('/home', authMiddleware, feedController.getHomeFeed);
router.get('/explore', authMiddleware, feedController.getExploreFeed);
router.get('/suggested-users', authMiddleware, feedController.getSuggestedUsers);

module.exports = router;
