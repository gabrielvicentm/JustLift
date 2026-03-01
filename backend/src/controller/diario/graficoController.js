const graficoService = require('../../service/diario/graficoService');

const ALLOWED_PERIODS = new Set(['7d', '30d', '1y', 'all']);

exports.getGraficoVolumeTreino = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const periodInput = typeof req.query.period === 'string'
      ? req.query.period.trim().toLowerCase()
      : '7d';

    const period = ALLOWED_PERIODS.has(periodInput) ? periodInput : '7d';

    const payload = await graficoService.getVolumeDistribution({ userId, period });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Erro ao buscar gráfico de volume de treino:', err);
    return res.status(500).json({ message: 'Erro ao buscar gráfico de volume de treino' });
  }
};
