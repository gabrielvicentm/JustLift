const express = require('express');
const mediaController = require('../controller/mediaController');

const router = express.Router();

router.post('/presign', mediaController.presignUpload);
router.post('/complete', mediaController.completeUpload);

module.exports = router;
