const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const followController = require('../controller/followController');

const router = express.Router();

router.get('/followers', authMiddleware, followController.getFollowers);
router.get('/following', authMiddleware, followController.getFollowing);
router.delete('/following/:targetUserId', authMiddleware, followController.unfollow);
router.delete('/followers/:followerUserId', authMiddleware, followController.removeFollower);

module.exports = router;
