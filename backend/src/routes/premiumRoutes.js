const express = require('express');
const premiumController = require('../controller/premiumController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/status', authMiddleware, premiumController.getStatus);
router.post('/activate', authMiddleware, premiumController.activate);
router.post('/deactivate', authMiddleware, premiumController.deactivate);

module.exports = router;
