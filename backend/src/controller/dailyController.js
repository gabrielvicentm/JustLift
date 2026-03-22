const dailyService = require('../service/dailyService');

const MAX_DAILY_PER_REQUEST = 20;
const MAX_VIDEO_DURATION_SECONDS = 15;

function getUserIdFromRequest(req) {
  return req.user?.userId || req.user?.id || null;
}

function normalizeMediaList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => ({
      type: String(item?.type || '').trim().toLowerCase(),
      url: String(item?.url || '').trim(),
      key: item?.key ? String(item.key).trim() : null,
      duration_seconds: Number(item?.duration_seconds) || null,
    }))
    .filter((item) => item.url.length > 0);
}

exports.createDailyBatch = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const midias = normalizeMediaList(req.body?.midias);
    if (midias.length === 0) {
      return res.status(400).json({ message: 'Selecione pelo menos uma midia para o Daily.' });
    }

    if (midias.length > MAX_DAILY_PER_REQUEST) {
      return res.status(400).json({ message: `Limite de ${MAX_DAILY_PER_REQUEST} midias por envio de Daily.` });
    }

    if (midias.some((item) => item.type !== 'image' && item.type !== 'video')) {
      return res.status(400).json({ message: 'Tipo de midia invalido. Use image ou video.' });
    }

    for (const item of midias) {
      if (item.type === 'video') {
        if (!item.duration_seconds || item.duration_seconds <= 0) {
          return res.status(400).json({ message: 'Video do Daily precisa informar duracao.' });
        }
        if (item.duration_seconds > MAX_VIDEO_DURATION_SECONDS) {
          return res.status(400).json({ message: `Cada video do Daily pode ter no maximo ${MAX_VIDEO_DURATION_SECONDS} segundos.` });
        }
      }
    }

    const enriched = midias.map((item) => ({
      ...item,
      duration_seconds: item.type === 'video' ? item.duration_seconds : MAX_VIDEO_DURATION_SECONDS,
    }));

    const created = await dailyService.createDailyBatch({
      userId,
      midias: enriched,
    });

    return res.status(201).json({
      message: 'Daily publicado com sucesso',
      daily: created,
    });
  } catch (err) {
    if (err.message === 'DAILY_BATCH_TOO_LARGE') {
      return res.status(400).json({ message: `Limite de ${MAX_DAILY_PER_REQUEST} midias por envio de Daily.` });
    }
    console.error('Erro ao criar Daily:', err);
    return res.status(500).json({ message: 'Erro ao criar Daily' });
  }
};

exports.getActiveDailyByUser = async (req, res) => {
  try {
    const viewerUserId = getUserIdFromRequest(req);
    if (!viewerUserId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId obrigatorio' });
    }

    const daily = await dailyService.getActiveDailyByUser({ userId, viewerUserId });
    return res.status(200).json({ daily });
  } catch (err) {
    console.error('Erro ao buscar Daily ativo:', err);
    return res.status(500).json({ message: 'Erro ao buscar Daily' });
  }
};

exports.getDailySummaryByUser = async (req, res) => {
  try {
    const viewerUserId = getUserIdFromRequest(req);
    if (!viewerUserId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId obrigatorio' });
    }

    const summary = await dailyService.getDailySummaryByUser({ userId, viewerUserId });
    return res.status(200).json({ summary });
  } catch (err) {
    console.error('Erro ao buscar resumo de Daily:', err);
    return res.status(500).json({ message: 'Erro ao buscar resumo de Daily' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const dailyId = Number(req.params?.dailyId);
    if (!Number.isInteger(dailyId) || dailyId <= 0) {
      return res.status(400).json({ message: 'dailyId invalido' });
    }

    const result = await dailyService.toggleLike({ dailyId, userId });
    if (!result) {
      return res.status(404).json({ message: 'Daily nao encontrado' });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao alternar like no Daily:', err);
    return res.status(500).json({ message: 'Erro ao alternar like no Daily' });
  }
};

exports.markViewed = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const dailyId = Number(req.params?.dailyId);
    if (!Number.isInteger(dailyId) || dailyId <= 0) {
      return res.status(400).json({ message: 'dailyId invalido' });
    }

    const result = await dailyService.markViewed({ dailyId, userId });
    if (!result) {
      return res.status(404).json({ message: 'Daily nao encontrado' });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao marcar Daily como visto:', err);
    return res.status(500).json({ message: 'Erro ao marcar Daily como visto' });
  }
};

exports.deleteDaily = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const dailyId = Number(req.params?.dailyId);
    if (!Number.isInteger(dailyId) || dailyId <= 0) {
      return res.status(400).json({ message: 'dailyId invalido' });
    }

    const deleted = await dailyService.deleteDaily({ dailyId, userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Daily nao encontrado' });
    }

    return res.status(200).json({ message: 'Daily removido' });
  } catch (err) {
    console.error('Erro ao excluir Daily:', err);
    return res.status(500).json({ message: 'Erro ao excluir Daily' });
  }
};
