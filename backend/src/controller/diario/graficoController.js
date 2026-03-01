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

exports.getGraficoExercicios = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    const exercicios = await graficoService.getExercisesDone({ userId, lang });
    return res.status(200).json({
      exercicios,
      meta: { count: exercicios.length },
    });
  } catch (err) {
    console.error('Erro ao buscar gráfico de exercícios:', err);
    return res.status(500).json({ message: 'Erro ao buscar gráfico de exercícios' });
  }
};

exports.getGraficoExercicioEvolucao = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const sourceInput = typeof req.query.source === 'string' ? req.query.source.trim().toLowerCase() : '';
    const source = sourceInput === 'custom' ? 'custom' : (sourceInput === 'api' ? 'api' : null);
    if (!source) {
      return res.status(400).json({ message: 'source inválido (use api ou custom)' });
    }

    const exerciseId = typeof req.query.exercise_id === 'string' ? req.query.exercise_id.trim() : null;
    const customExerciseIdRaw = Number(req.query.custom_exercise_id);
    const customExerciseId = Number.isInteger(customExerciseIdRaw) && customExerciseIdRaw > 0
      ? customExerciseIdRaw
      : null;

    if (source === 'api' && !exerciseId) {
      return res.status(400).json({ message: 'exercise_id é obrigatório para source=api' });
    }
    if (source === 'custom' && !customExerciseId) {
      return res.status(400).json({ message: 'custom_exercise_id é obrigatório para source=custom' });
    }

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    const payload = await graficoService.getExerciseProgress({
      userId,
      source,
      exerciseId,
      customExerciseId,
      lang,
    });

    return res.status(200).json(payload);
  } catch (err) {
    console.error('Erro ao buscar evolução do exercício:', err);
    return res.status(500).json({ message: 'Erro ao buscar evolução do exercício' });
  }
};
