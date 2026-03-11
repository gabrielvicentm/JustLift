const followService = require('../service/followService');

const getUserId = (req) => req.user?.userId || req.user?.id || null;

exports.getFollowers = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const users = await followService.listFollowers({
      userId,
      search: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json(users);
  } catch (err) {
    console.error('Erro ao listar seguidores:', err);
    return res.status(500).json({ message: 'Erro no servidor ao listar seguidores.' });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const users = await followService.listFollowing({
      userId,
      search: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json(users);
  } catch (err) {
    console.error('Erro ao listar seguindo:', err);
    return res.status(500).json({ message: 'Erro no servidor ao listar seguindo.' });
  }
};

exports.unfollow = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId } = req.params;
    const result = await followService.unfollow({ userId, targetUserId });

    if (result.status === 'not_found') {
      return res.status(404).json({ message: 'Relacao de seguindo ou solicitacao nao encontrada.' });
    }

    if (result.status === 'request_canceled') {
      return res.status(200).json({ message: 'Solicitacao de follow cancelada com sucesso.' });
    }

    return res.status(200).json({ message: 'Usuario removido de seguindo com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover seguindo:', err);
    return res.status(500).json({ message: 'Erro no servidor ao remover seguindo.' });
  }
};

exports.removeFollower = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { followerUserId } = req.params;
    const removed = await followService.removeFollower({ userId, followerUserId });

    if (!removed) {
      return res.status(404).json({ message: 'Seguidor nao encontrado.' });
    }

    return res.status(200).json({ message: 'Seguidor removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover seguidor:', err);
    return res.status(500).json({ message: 'Erro no servidor ao remover seguidor.' });
  }
};

exports.follow = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId } = req.params;
    const result = await followService.follow({ userId, targetUserId });

    if (result.status === 'already_following') {
      return res.status(200).json({ message: 'Usuario ja estava sendo seguido.', status: result.status });
    }

    if (result.status === 'already_requested') {
      return res.status(200).json({ message: 'Solicitacao de follow ja enviada.', status: result.status });
    }

    if (result.status === 'requested') {
      return res.status(202).json({ message: 'Solicitacao de follow enviada.', status: result.status });
    }

    return res.status(201).json({ message: 'Agora voce esta seguindo este usuario.', status: result.status });
  } catch (err) {
    if (err.message === 'CANNOT_FOLLOW_SELF') {
      return res.status(400).json({ message: 'Nao e permitido seguir a si mesmo.' });
    }
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario alvo nao encontrado.' });
    }

    console.error('Erro ao seguir usuario:', err);
    return res.status(500).json({ message: 'Erro no servidor ao seguir usuario.' });
  }
};

exports.getIncomingFollowRequests = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const requests = await followService.listIncomingFollowRequests({
      userId,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Erro ao listar solicitacoes de follow:', err);
    return res.status(500).json({ message: 'Erro no servidor ao listar solicitacoes de follow.' });
  }
};

exports.acceptFollowRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { requestId } = req.params;
    await followService.acceptFollowRequest({ userId, requestId });
    return res.status(200).json({ message: 'Solicitacao de follow aceita com sucesso.' });
  } catch (err) {
    if (err.message === 'FOLLOW_REQUEST_NOT_FOUND') {
      return res.status(404).json({ message: 'Solicitacao de follow nao encontrada.' });
    }

    console.error('Erro ao aceitar solicitacao de follow:', err);
    return res.status(500).json({ message: 'Erro no servidor ao aceitar solicitacao de follow.' });
  }
};

exports.rejectFollowRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { requestId } = req.params;
    await followService.rejectFollowRequest({ userId, requestId });
    return res.status(200).json({ message: 'Solicitacao de follow recusada com sucesso.' });
  } catch (err) {
    if (err.message === 'FOLLOW_REQUEST_NOT_FOUND') {
      return res.status(404).json({ message: 'Solicitacao de follow nao encontrada.' });
    }

    console.error('Erro ao recusar solicitacao de follow:', err);
    return res.status(500).json({ message: 'Erro no servidor ao recusar solicitacao de follow.' });
  }
};
