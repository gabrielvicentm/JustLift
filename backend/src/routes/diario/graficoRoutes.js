const express = require('express');
const router = express.Router();
const graficoController = require('../../controller/diario/graficoController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/volume-treino', authMiddleware, graficoController.getGraficoVolumeTreino);

module.exports = router;
