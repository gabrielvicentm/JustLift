const feedService = require('../service/feedService');

const MAX_LIMIT = 50;

function getUserIdFromRequest(req) {
  return req.user?.userId || req.user?.id || null;
}

function parseLimitOffset(req, defaultLimit) {
  const limitInput = Number(req.query.limit);
  const offsetInput = Number(req.query.offset);
  const limit = Number.isFinite(limitInput)
    ? Math.min(Math.max(Math.floor(limitInput), 1), MAX_LIMIT)
    : defaultLimit;
  const offset = Number.isFinite(offsetInput) ? Math.max(Math.floor(offsetInput), 0) : 0;
  return { limit, offset };
}

exports.getHomeFeed = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const { limit, offset } = parseLimitOffset(req, 20);
    const result = await feedService.getHomeFeed({ userId, limit, offset });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao buscar feed home:', err);
    return res.status(500).json({ message: 'Erro ao buscar feed home' });
  }
};

exports.getExploreFeed = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const { limit, offset } = parseLimitOffset(req, 30);
    const result = await feedService.getExploreFeed({ userId, limit, offset });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro ao buscar feed explorar:', err);
    return res.status(500).json({ message: 'Erro ao buscar feed explorar' });
  }
};

exports.getSuggestedUsers = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const { limit } = parseLimitOffset(req, 10);
    const suggestedUsers = await feedService.getSuggestedUsers({ userId, limit });

    return res.status(200).json({ suggested_users: suggestedUsers });
  } catch (err) {
    console.error('Erro ao buscar sugestoes de usuarios:', err);
    return res.status(500).json({ message: 'Erro ao buscar sugestoes de usuarios' });
  }
};
