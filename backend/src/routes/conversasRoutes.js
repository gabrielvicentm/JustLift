const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const conversasController = require('../controller/conversasController');

const router = express.Router();

router.get('/', authMiddleware, conversasController.list);

module.exports = router;
