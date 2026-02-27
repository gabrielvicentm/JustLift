const express = require('express');
const router = express.Router();
const authController = require('../controller/profileController');
const authMiddleware = require('../middleware/authMiddleware');


//router.post('/profile',  authController.profile);
router.put('/updateProfile', authMiddleware, authController.updateProfile);
//router.post('/refresh', authController.handleRefresh);

module.exports = router;