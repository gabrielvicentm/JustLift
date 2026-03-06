const express = require('express');
const router = express.Router();
const diarioController = require('../../controller/diario/diarioController');
const authMiddleware = require('../../middleware/authMiddleware');

// Salvar um treino finalizado
router.post('/salvar', authMiddleware, diarioController.salvarTreino);

//Buscar dados da última série para um conjunto de exercícios
//router.post('/last-series', treinoController.getLastSeriesData);

// Pegar os exercícios do banco
router.get('/exercicios', authMiddleware, diarioController.buscarExercicios);

// exercicio personalizadp
router.post('/custom', authMiddleware, diarioController.criarExercicioCustomizado);

// Busca exercícios customizados do usuário autenticado
router.get('/custom', authMiddleware, diarioController.buscarExerciciosCustomizados);

// Busca as últimas séries por exercício para preencher "anterior"
router.get('/ultimas-series', authMiddleware, diarioController.buscarUltimasSeries);

// Fluxo "repetir treino"
router.get('/repetir-treino/lista', authMiddleware, diarioController.listarTreinosParaRepetir);
router.get('/repetir-treino/template/:treinoId', authMiddleware, diarioController.buscarTemplateTreinoParaRepetir);

module.exports = router;
