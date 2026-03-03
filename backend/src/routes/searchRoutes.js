const express = require('express');
const searchController = require('../controller/searchController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/users', authMiddleware, searchController.searchUsers);

module.exports = router;
