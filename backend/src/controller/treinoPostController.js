const treinoPostService = require('../service/treinoPostService');

const MAX_MIDIAS = 9;
const MAX_DESCRICAO = 1000;

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
    }))
    .filter((item) => item.url.length > 0);
}

exports.getTreinoPreview = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const treinoId = Number(req.params?.treinoId);
    if (!Number.isInteger(treinoId) || treinoId <= 0) {
      return res.status(400).json({ message: 'treinoId invalido' });
    }

    const langInput = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'pt';
    const lang = langInput === 'en' ? 'en' : 'pt';

    const resumo = await treinoPostService.getTreinoResumoById({
      userId,
      treinoId,
      lang,
    });

    if (!resumo) {
      return res.status(404).json({ message: 'Treino nao encontrado' });
    }

    return res.status(200).json({ resumo });
  } catch (err) {
    console.error('Erro ao buscar resumo de treino:', err);
    return res.status(500).json({ message: 'Erro ao buscar resumo de treino' });
  }
};

exports.createTreinoPost = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const treinoId = Number(req.body?.treinoId);
    if (!Number.isInteger(treinoId) || treinoId <= 0) {
      return res.status(400).json({ message: 'treinoId invalido' });
    }

    const descricao = String(req.body?.descricao || '').trim();
    const midias = normalizeMediaList(req.body?.midias);

    if (!descricao && midias.length === 0) {
      return res.status(400).json({ message: 'Post vazio. Adicione descricao ou midia.' });
    }

    if (descricao.length > MAX_DESCRICAO) {
      return res.status(400).json({ message: `Descricao maior que ${MAX_DESCRICAO} caracteres` });
    }

    if (midias.length > MAX_MIDIAS) {
      return res.status(400).json({ message: `Limite de ${MAX_MIDIAS} midias por post` });
    }

    if (midias.some((item) => item.type !== 'image' && item.type !== 'video')) {
      return res.status(400).json({ message: 'Tipo de midia invalido. Use image ou video.' });
    }

    const created = await treinoPostService.createTreinoPost({
      userId,
      treinoId,
      descricao: descricao || '',
      midias,
    });

    if (!created) {
      return res.status(404).json({ message: 'Treino nao encontrado' });
    }

    return res.status(201).json({
      message: 'Post de treino criado com sucesso',
      post: created,
    });
  } catch (err) {
    console.error('Erro ao criar post de treino:', err);
    return res.status(500).json({ message: 'Erro ao criar post de treino' });
  }
};
