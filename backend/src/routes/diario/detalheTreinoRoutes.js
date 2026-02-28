const express = require('express');
const detalheTreinoController = require('../../controller/diario/detalheTreinoController');
const authMiddleware = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/dias', authMiddleware, detalheTreinoController.buscarDiasComTreino);
router.get('/detalhe', authMiddleware, detalheTreinoController.buscarDetalheTreinoPorData);

module.exports = router;

// Buscar detalhes de um detalheTreino por ID
//router.get('/detalhe-id', detalheTreinoController.detalhedetalheTreinoPorId);
// NOVO: Buscar histórico de detalheTreinos de um usuário
//router.get('/historico', detalheTreinoController.getHistoricodetalheTreinos);
// NOVO: Buscar detalhes completos de um detalheTreino por ID
//router.get('/completo/:id', detalheTreinoController.getdetalheTreinoCompletoPorId);
