const express = require('express');
const router = express.Router();
const profileController = require('../controller/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Legacy routes
router.post('/profile', authMiddleware, profileController.profile);
router.put('/updateProfile', authMiddleware, profileController.updateProfile);

// REST routes
router.get('/me', authMiddleware, profileController.getMe);
router.put('/me', authMiddleware, profileController.updateMe);

module.exports = router;
