const searchService = require('../service/searchService');

exports.searchUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const q = String(req.query.q || '').trim(); // pega "q" da query string; garante que vire string; remove espaços no começo/fim.
    const limit = req.query.limit;

    const users = await searchService.searchUsersByUsername(userId, q, limit);
    return res.status(200).json(users);
  } catch (err) {
    console.error('Erro ao pesquisar usuarios:', err);
    return res.status(500).json({ message: 'Erro no servidor ao pesquisar usuarios.' });
  }
};

exports.searchPosts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const q = String(req.query.q || '').trim();
    const limit = req.query.limit;

    const posts = await searchService.searchPostsByDescription(userId, q, limit);
    return res.status(200).json(posts);
  } catch (err) {
    console.error('Erro ao pesquisar posts:', err);
    return res.status(500).json({ message: 'Erro no servidor ao pesquisar posts.' });
  }
};
