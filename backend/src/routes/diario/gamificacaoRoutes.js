const express = require('express');
const router = express.Router();
const gamificacaoController = require('../../controller/diario/gamificacaoController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/me', authMiddleware, gamificacaoController.getMinhaGamificacao);
router.get('/historico', authMiddleware, gamificacaoController.getMeuHistoricoGamificacao);
router.get('/ranking', authMiddleware, gamificacaoController.getRankingGamificacao);

module.exports = router;
