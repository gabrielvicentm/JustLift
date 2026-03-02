const gamificacaoService = require('../../service/diario/gamificacaoService');

exports.getMinhaGamificacao = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const data = await gamificacaoService.getMyGamificacao({ userId });
    return res.status(200).json(data);
  } catch (err) {
    console.error('Erro ao buscar dados de gamificação:', err);
    return res.status(500).json({ message: 'Erro ao buscar dados de gamificação' });
  }
};

exports.getMeuHistoricoGamificacao = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const limitInput = Number(req.query.limit);
    const offsetInput = Number(req.query.offset);
    const limit = Number.isFinite(limitInput) ? limitInput : 30;
    const offset = Number.isFinite(offsetInput) ? offsetInput : 0;

    const data = await gamificacaoService.getMyGamificacaoHistorico({
      userId,
      limit,
      offset,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('Erro ao buscar histórico de gamificação:', err);
    return res.status(500).json({ message: 'Erro ao buscar histórico de gamificação' });
  }
};

exports.getRankingGamificacao = async (req, res) => {
  try {
    const limitInput = Number(req.query.limit);
    const limit = Number.isFinite(limitInput) ? limitInput : 20;

    const ranking = await gamificacaoService.getRanking({ limit });
    return res.status(200).json({
      ranking,
      meta: { limit: Math.min(Math.max(Math.floor(limit), 1), 100), count: ranking.length },
    });
  } catch (err) {
    console.error('Erro ao buscar ranking de gamificação:', err);
    return res.status(500).json({ message: 'Erro ao buscar ranking de gamificação' });
  }
};
