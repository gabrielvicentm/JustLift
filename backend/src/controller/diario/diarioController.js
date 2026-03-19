// Camada de controller do módulo diário:
// - recebe req/res do Express
// - valida e normaliza payload
// - delega persistência/consulta para o service
const diarioService = require('../../service/diario/diarioService');

// Lista branca de equipamentos permitidos para exercícios customizados.
const ALLOWED_EQUIPMENTS = ['barra', 'halteres', 'peso corporal', 'cabo', 'máquina', 'elástico'];
// Limite defensivo de exercícios por treino (proteção de payload).
const MAX_EXERCISES_PER_WORKOUT = 30;
// Limite defensivo de séries por exercício (proteção de payload).
const MAX_SERIES_PER_EXERCISE = 20;

// Cria exercício customizado do usuário autenticado.
// Endpoint esperado: POST /diario/custom
exports.criarExercicioCustomizado = async (req, res) => {
  try {
    // Compatibilidade com formatos diferentes de token (userId ou id).
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // Campos recebidos do front.
    const { nome, equipamento, musculo_alvo, img_url } = req.body;

    // Validação mínima de nome.
    if (!nome || String(nome).trim().length < 2) {
      return res.status(400).json({ message: 'Nome do exercício é obrigatório' });
    }

    // Valida equipamento usando lista branca para manter domínio controlado.
    if (!equipamento || !ALLOWED_EQUIPMENTS.includes(String(equipamento).trim().toLowerCase())) {
      return res.status(400).json({ message: 'Equipamento inválido' });
    }

    // Validação mínima de músculo alvo.
    if (!musculo_alvo || String(musculo_alvo).trim().length < 2) {
      return res.status(400).json({ message: 'Músculo alvo é obrigatório' });
    }

    // Normaliza strings e chama o service para persistir.
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
    // Erro inesperado: log interno + resposta genérica.
    console.error('Erro ao criar exercício customizado:', err);
    return res.status(500).json({ message: 'Erro ao criar exercício customizado' });
  }
};

// Busca exercícios canônicos com filtros e paginação.
// Endpoint esperado: GET /diario/exercicios
exports.buscarExercicios = async (req, res) => {
  try {
    // q é opcional; se não for string válida, considera null.
    const q = typeof req.query.q === 'string' ? req.query.q : null;
    // Limita idioma para 'pt' ou 'en'. Qualquer outro valor cai em 'pt'.
    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';
    // Filtros opcionais por chave canônica.
    const muscleKey = typeof req.query.muscle === 'string' ? req.query.muscle.trim().toLowerCase() : null;
    const equipmentKey = typeof req.query.equipment === 'string' ? req.query.equipment.trim().toLowerCase() : null;
    // Normaliza paginação com limites de segurança.
    const limitInput = Number(req.query.limit);
    const offsetInput = Number(req.query.offset);
    const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.floor(limitInput), 1), 100) : 30;
    const offset = Number.isFinite(offsetInput) ? Math.max(Math.floor(offsetInput), 0) : 0;

    // Consulta no service.
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
    // Erro inesperado na busca.
    console.error('Erro ao buscar exercícios:', err);
    return res.status(500).json({ message: 'Erro ao buscar exercícios' });
  }
};

// Lista exercícios customizados do usuário autenticado.
// Endpoint esperado: GET /diario/custom
exports.buscarExerciciosCustomizados = async (req, res) => {
  try {
    // Garante autenticação antes de consultar dados privados.
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const limitInput = Number(req.query.limit);
    const offsetInput = Number(req.query.offset);
    const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.floor(limitInput), 1), 100) : 50;
    const offset = Number.isFinite(offsetInput) ? Math.max(Math.floor(offsetInput), 0) : 0;

    // Consulta customizados do usuário.
    const exercicios = await diarioService.getCustomExercisesByUser({ userId, limit, offset });
    return res.status(200).json({
      exercicios,
      meta: { count: exercicios.length, limit, offset },
    });
  } catch (err) {
    // Erro inesperado.
    console.error('Erro ao buscar exercícios customizados:', err);
    return res.status(500).json({ message: 'Erro ao buscar exercícios customizados' });
  }
};

// Busca as séries do último treino finalizado para cada exercício informado.
// Endpoint esperado: GET /diario/ultimas-series?api_ids=a,b&custom_ids=1,2
exports.buscarUltimasSeries = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const apiIdsRaw = typeof req.query.api_ids === 'string' ? req.query.api_ids : '';
    const customIdsRaw = typeof req.query.custom_ids === 'string' ? req.query.custom_ids : '';

    const apiExerciseIds = apiIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const customExerciseIds = customIdsRaw
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const items = await diarioService.getLastSeriesByExercises({
      userId,
      apiExerciseIds,
      customExerciseIds,
    });

    return res.status(200).json({
      items,
      meta: {
        count: items.length,
        requested_api: apiExerciseIds.length,
        requested_custom: customExerciseIds.length,
      },
    });
  } catch (err) {
    console.error('Erro ao buscar últimas séries:', err);
    return res.status(500).json({ message: 'Erro ao buscar últimas séries' });
  }
};

// Lista treinos finalizados para seleção no fluxo de repetir treino.
// Endpoint esperado: GET /diario/repetir-treino/lista?limit=20
exports.listarTreinosParaRepetir = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const limitInput = Number(req.query.limit);
    const limit = Number.isFinite(limitInput) ? limitInput : 20;

    const treinos = await diarioService.getRecentWorkoutsForRepeat({
      userId,
      limit,
    });

    return res.status(200).json({
      treinos,
      meta: {
        count: treinos.length,
        limit: Math.min(Math.max(Math.floor(limit), 1), 50),
      },
    });
  } catch (err) {
    console.error('Erro ao listar treinos para repetir:', err);
    return res.status(500).json({ message: 'Erro ao listar treinos para repetir' });
  }
};

// Retorna template (exercícios + quantidade de séries) de um treino finalizado.
// Endpoint esperado: GET /diario/repetir-treino/template/:treinoId?lang=pt|en
exports.buscarTemplateTreinoParaRepetir = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const treinoId = Number(req.params?.treinoId);
    if (!Number.isInteger(treinoId) || treinoId <= 0) {
      return res.status(400).json({ message: 'Treino inválido' });
    }

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    const template = await diarioService.getWorkoutTemplateById({
      userId,
      treinoId,
      lang,
    });

    if (!template) {
      return res.status(404).json({ message: 'Treino não encontrado' });
    }

    return res.status(200).json(template);
  } catch (err) {
    console.error('Erro ao buscar template de treino:', err);
    return res.status(500).json({ message: 'Erro ao buscar template de treino' });
  }
};

// Salva treino completo enviado pelo front.
// Endpoint esperado: POST /diario/salvar
exports.salvarTreino = async (req, res) => {
  try {
    // Garante autenticação.
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // Aceita dois formatos de payload por compatibilidade:
    // - body.exercicios (atual)
    // - body.series_data (legado)
    const body = req.body || {};
    const rawExercises = Array.isArray(body.exercicios)
      ? body.exercicios
      : (Array.isArray(body.series_data) ? body.series_data : []);

    // Treino precisa ter ao menos 1 exercício.
    if (rawExercises.length === 0) {
      return res.status(400).json({ message: 'Treino sem exercícios' });
    }
    // Limite superior para proteger banco/app de payload excessivo.
    if (rawExercises.length > MAX_EXERCISES_PER_WORKOUT) {
      return res.status(400).json({
        message: `Quantidade de exercícios inválida: limite de ${MAX_EXERCISES_PER_WORKOUT} por treino`,
      });
    }

    // Normalização de metadados do treino.
    // - data: string opcional (service converte para date ou usa CURRENT_DATE)
    // - duracao: inteiro >= 0
    // - finalizado: true por padrão; só false quando explicitamente false
    const data = typeof body.data === 'string' && body.data.trim() ? body.data.trim() : null;
    const duracaoRaw = Number(body.duracao);
    const duracao = Number.isFinite(duracaoRaw) && duracaoRaw >= 0 ? Math.floor(duracaoRaw) : 0;
    const finalizado = body.finalizado !== false;

    // Normaliza cada exercício e suas séries.
    const exercicios = rawExercises.map((item, exIdx) => {
      // "source" determina se exercício é da base canônica ('api') ou customizado ('custom').
      const source = item?.source === 'custom' ? 'custom' : 'api';
      // Para source=api, exige exercise_id string.
      const exerciseId = source === 'api' && typeof item?.exercise_id === 'string'
        ? item.exercise_id.trim()
        : null;
      // Para source=custom, exige custom_exercise_id inteiro positivo.
      const customExerciseIdRaw = Number(item?.custom_exercise_id);
      const customExerciseId = source === 'custom' && Number.isInteger(customExerciseIdRaw) && customExerciseIdRaw > 0
        ? customExerciseIdRaw
        : null;

      // Erros de validação por item são lançados com posição para facilitar debug no front.
      if (source === 'api' && !exerciseId) {
        throw new Error(`Exercício inválido na posição ${exIdx + 1}`);
      }
      if (source === 'custom' && !customExerciseId) {
        throw new Error(`Exercício customizado inválido na posição ${exIdx + 1}`);
      }

      // Séries são opcionais no payload, mas quando existem são normalizadas.
      const rawSeries = Array.isArray(item?.series) ? item.series : [];
      // Limite defensivo por exercício.
      if (rawSeries.length > MAX_SERIES_PER_EXERCISE) {
        throw new Error(`Quantidade de séries inválida na posição ${exIdx + 1}: limite de ${MAX_SERIES_PER_EXERCISE}`);
      }
      // Normalização de campos numéricos e booleanos das séries.
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

      // Retorna formato final consumido pelo service.
      return {
        exercise_id: exerciseId,
        custom_exercise_id: customExerciseId,
        // Suporta "anotacoes" (novo) e "anotacao" (legado), com limite de 255 chars.
        anotacoes: typeof item?.anotacoes === 'string'
          ? item.anotacoes.slice(0, 255)
          : (typeof item?.anotacao === 'string' ? item.anotacao.slice(0, 255) : null),
        series,
      };
    });

    // Delega persistência transacional ao service.
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
    // Mapeia erros de validação conhecidos para HTTP 400.
    // Demais falhas retornam 500 para não expor detalhes internos.
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
