const express = require('express');
const router = express.Router();
const graficoController = require('../../controller/diario/graficoController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/volume-treino', authMiddleware, graficoController.getGraficoVolumeTreino);
router.get('/exercicios', authMiddleware, graficoController.getGraficoExercicios);
router.get('/exercicios/evolucao', authMiddleware, graficoController.getGraficoExercicioEvolucao);

module.exports = router;
