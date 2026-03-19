const express = require('express');
const mediaController = require('../controller/mediaController');
const authMiddleware = require('../middleware/authMiddleware');
const { mediaLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/presign', authMiddleware, mediaLimiter, mediaController.presignUpload);
router.post('/complete', authMiddleware, mediaLimiter, mediaController.completeUpload);

module.exports = router;
