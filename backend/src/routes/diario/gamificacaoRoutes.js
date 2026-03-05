const express = require('express');
const router = express.Router();
const gamificacaoController = require('../../controller/diario/gamificacaoController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/me', authMiddleware, gamificacaoController.getMinhaGamificacao);
router.get('/patentes', authMiddleware, gamificacaoController.getMinhasPatentesTemporada);
router.get('/temporadas', authMiddleware, gamificacaoController.getHistoricoTemporadas);
router.get('/historico', authMiddleware, gamificacaoController.getMeuHistoricoGamificacao);
router.get('/ranking', authMiddleware, gamificacaoController.getRankingGamificacao);

module.exports = router;
