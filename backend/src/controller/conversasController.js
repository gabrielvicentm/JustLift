const conversasService = require('../service/conversasService');

const getUserId = (req) => req.user?.userId || req.user?.id || null;

exports.list = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const conversas = await conversasService.listConversations({
      userId,
      search: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json({ conversas });
  } catch (err) {
    console.error('Erro ao listar conversas:', err);
    return res.status(500).json({ message: 'Erro no servidor ao listar conversas.' });
  }
};
