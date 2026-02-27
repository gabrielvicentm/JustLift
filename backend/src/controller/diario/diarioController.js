const diarioService = require('../../service/diario/diarioService');

const ALLOWED_EQUIPMENTS = ['barra', 'halteres', 'peso corporal', 'cabo', 'máquina', 'elástico'];

exports.criarExercicioCustomizado = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const { nome, equipamento, musculo_alvo, img_url } = req.body;

    if (!nome || String(nome).trim().length < 2) {
      return res.status(400).json({ message: 'Nome do exercício é obrigatório' });
    }

    if (!equipamento || !ALLOWED_EQUIPMENTS.includes(String(equipamento).trim().toLowerCase())) {
      return res.status(400).json({ message: 'Equipamento inválido' });
    }

    if (!musculo_alvo || String(musculo_alvo).trim().length < 2) {
      return res.status(400).json({ message: 'Músculo alvo é obrigatório' });
    }

    const created = await diarioService.createCustomExercise({
      userId,
      nome: String(nome).trim(),
      equipamento: String(equipamento).trim(),
      musculoAlvo: String(musculo_alvo).trim(),
      imgUrl: img_url ? String(img_url).trim() : null,
    });

    return res.status(201).json({
      message: 'Exercício customizado criado com sucesso',
      exercicio: created,
    });
  } catch (err) {
    console.error('Erro ao criar exercício customizado:', err);
    return res.status(500).json({ message: 'Erro ao criar exercício customizado' });
  }
};

exports.buscarExercicios = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : null;
    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';
    const muscleKey = typeof req.query.muscle === 'string' ? req.query.muscle.trim().toLowerCase() : null;
    const equipmentKey = typeof req.query.equipment === 'string' ? req.query.equipment.trim().toLowerCase() : null;
    const limitInput = Number(req.query.limit);
    const offsetInput = Number(req.query.offset);
    const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.floor(limitInput), 1), 100) : 30;
    const offset = Number.isFinite(offsetInput) ? Math.max(Math.floor(offsetInput), 0) : 0;

    const exercicios = await diarioService.searchExercises({
      query: q,
      lang,
      muscleKey: muscleKey || null,
      equipmentKey: equipmentKey || null,
      limit,
      offset,
    });

    return res.status(200).json({
      exercicios,
      meta: { limit, offset, count: exercicios.length },
    });
  } catch (err) {
    console.error('Erro ao buscar exercícios:', err);
    return res.status(500).json({ message: 'Erro ao buscar exercícios' });
  }
};

exports.buscarExerciciosCustomizados = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const exercicios = await diarioService.getCustomExercisesByUser({ userId });
    return res.status(200).json({
      exercicios,
      meta: { count: exercicios.length },
    });
  } catch (err) {
    console.error('Erro ao buscar exercícios customizados:', err);
    return res.status(500).json({ message: 'Erro ao buscar exercícios customizados' });
  }
};

exports.salvarTreino = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const body = req.body || {};
    const rawExercises = Array.isArray(body.exercicios)
      ? body.exercicios
      : (Array.isArray(body.series_data) ? body.series_data : []);

    if (rawExercises.length === 0) {
      return res.status(400).json({ message: 'Treino sem exercícios' });
    }

    const data = typeof body.data === 'string' && body.data.trim() ? body.data.trim() : null;
    const duracaoRaw = Number(body.duracao);
    const duracao = Number.isFinite(duracaoRaw) && duracaoRaw >= 0 ? Math.floor(duracaoRaw) : 0;
    const finalizado = body.finalizado !== false;

    const exercicios = rawExercises.map((item, exIdx) => {
      const source = item?.source === 'custom' ? 'custom' : 'api';
      const exerciseId = source === 'api' && typeof item?.exercise_id === 'string'
        ? item.exercise_id.trim()
        : null;
      const customExerciseIdRaw = Number(item?.custom_exercise_id);
      const customExerciseId = source === 'custom' && Number.isInteger(customExerciseIdRaw) && customExerciseIdRaw > 0
        ? customExerciseIdRaw
        : null;

      if (source === 'api' && !exerciseId) {
        throw new Error(`Exercício inválido na posição ${exIdx + 1}`);
      }
      if (source === 'custom' && !customExerciseId) {
        throw new Error(`Exercício customizado inválido na posição ${exIdx + 1}`);
      }

      const rawSeries = Array.isArray(item?.series) ? item.series : [];
      const series = rawSeries.map((serie, serieIdx) => {
        const numeroRaw = Number(serie?.numero);
        const kgRaw = Number(serie?.kg);
        const repsRaw = Number(serie?.repeticoes ?? serie?.reps);

        return {
          numero: Number.isFinite(numeroRaw) && numeroRaw > 0 ? Math.floor(numeroRaw) : (serieIdx + 1),
          kg: Number.isFinite(kgRaw) && kgRaw >= 0 ? kgRaw : 0,
          repeticoes: Number.isFinite(repsRaw) && repsRaw >= 0 ? Math.floor(repsRaw) : 0,
          concluido: Boolean(serie?.concluido),
        };
      });

      return {
        exercise_id: exerciseId,
        custom_exercise_id: customExerciseId,
        anotacoes: typeof item?.anotacoes === 'string'
          ? item.anotacoes.slice(0, 255)
          : (typeof item?.anotacao === 'string' ? item.anotacao.slice(0, 255) : null),
        series,
      };
    });

    const treino = await diarioService.saveWorkout({
      userId,
      data,
      duracao,
      finalizado,
      exercicios,
    });

    return res.status(201).json({
      message: 'Treino salvo com sucesso',
      treino,
    });
  } catch (err) {
    console.error('Erro ao salvar treino:', err);
    if (err?.message && (
      String(err.message).includes('inválido')
      || String(err.message).includes('Treino sem exercícios')
    )) {
      return res.status(400).json({ message: String(err.message) });
    }
    return res.status(500).json({ message: 'Erro ao salvar treino' });
  }
};
