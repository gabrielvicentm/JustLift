const express = require('express');
const treinoPostController = require('../controller/treinoPostController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/preview/:treinoId', authMiddleware, treinoPostController.getTreinoPreview);
router.post('/', authMiddleware, treinoPostController.createTreinoPost);

module.exports = router;
