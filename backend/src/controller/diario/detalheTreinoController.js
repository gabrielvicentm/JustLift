const detalheTreinoService = require('../../service/diario/detalheTreinoService');

exports.buscarDiasComTreino = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const dias = await detalheTreinoService.buscarDiasComTreinoPorUsuario({ userId });

    return res.status(200).json({
      dias,
      meta: {
        count: dias.length,
      },
    });
  } catch (err) {
    console.error('Erro ao buscar dias com treino:', err);
    return res.status(500).json({ message: 'Erro ao buscar dias com treino' });
  }
};

exports.buscarDetalheTreinoPorData = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const data = typeof req.query.data === 'string' ? req.query.data.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ message: 'Parâmetro data inválido. Use YYYY-MM-DD.' });
    }

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    const treinos = await detalheTreinoService.buscarDetalheTreinoPorData({
      userId,
      data,
      lang,
    });

    return res.status(200).json({
      data,
      treinos,
      meta: {
        count: treinos.length,
      },
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes de treino por data:', err);
    return res.status(500).json({ message: 'Erro ao buscar detalhes do treino' });
  }
};

exports.buscarRetrospectiva = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const periodInput = typeof req.query.period === 'string' ? req.query.period.trim().toLowerCase() : 'yearly';
    const period = ['weekly', 'monthly', 'yearly'].includes(periodInput) ? periodInput : 'yearly';

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    if (period !== 'yearly') {
      const isPremium = await detalheTreinoService.getIsPremium({ userId });
      if (!isPremium) {
        return res.status(403).json({ message: 'Retrospectiva disponível apenas para usuários Premium.' });
      }
    }

    const retrospectiva = await detalheTreinoService.buscarRetrospectiva({
      userId,
      period,
      lang,
    });

    return res.status(200).json(retrospectiva);
  } catch (err) {
    console.error('Erro ao buscar retrospectiva:', err);
    return res.status(500).json({ message: 'Erro ao buscar retrospectiva' });
  }
};
