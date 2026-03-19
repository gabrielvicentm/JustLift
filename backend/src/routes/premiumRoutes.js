const express = require('express');
const premiumController = require('../controller/premiumController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/status', authMiddleware, premiumController.getStatus);
router.post('/sync', authMiddleware, premiumController.sync);

module.exports = router
