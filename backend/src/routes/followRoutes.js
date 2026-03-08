const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const followController = require('../controller/followController');

const router = express.Router();

router.get('/followers', authMiddleware, followController.getFollowers);
router.get('/following', authMiddleware, followController.getFollowing);
router.post('/following/:targetUserId', authMiddleware, followController.follow);
router.delete('/following/:targetUserId', authMiddleware, followController.unfollow);
router.delete('/followers/:followerUserId', authMiddleware, followController.removeFollower);
router.get('/requests/incoming', authMiddleware, followController.getIncomingFollowRequests);
router.post('/requests/:requestId/accept', authMiddleware, followController.acceptFollowRequest);
router.post('/requests/:requestId/reject', authMiddleware, followController.rejectFollowRequest);
router.get('/notifications', authMiddleware, followController.getNotifications);
router.get('/notifications/unread-count', authMiddleware, followController.getUnreadNotificationsCount);
router.patch('/notifications/:notificationId/read', authMiddleware, followController.readNotification);
router.patch('/notifications/read-all', authMiddleware, followController.readAllNotifications);

module.exports = router;
