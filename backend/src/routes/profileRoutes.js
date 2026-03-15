const express = require('express');
const router = express.Router();
const profileController = require('../controller/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Legacy routes
router.post('/profile', authMiddleware, profileController.profile);
router.put('/updateProfile', authMiddleware, profileController.updateProfile);

router.post('/account-change/request', authMiddleware, profileController.requestAccountChange);
router.post('/account-change/confirm', authMiddleware, profileController.confirmAccountChange);
router.post('/account-change/apply', authMiddleware, profileController.applyAccountChange);
router.delete('/account', authMiddleware, profileController.deleteAccount);

// REST routes
router.get('/me', authMiddleware, profileController.getMe);
router.put('/me', authMiddleware, profileController.updateMe);
router.get('/u/:username', authMiddleware, profileController.getByUsername);

module.exports = router;
