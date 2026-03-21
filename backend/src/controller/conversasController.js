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

exports.hide = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    await conversasService.hideConversation({
      userId,
      targetUserId: req.params.targetUserId,
    });

    return res.status(200).json({ message: 'Conversa ocultada com sucesso.' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'INVALID_TARGET') {
      return res.status(400).json({ message: 'Operacao invalida.' });
    }

    console.error('Erro ao ocultar conversa:', err);
    return res.status(500).json({ message: 'Erro no servidor ao ocultar conversa.' });
  }
};

exports.pin = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    await conversasService.pinConversation({
      userId,
      targetUserId: req.params.targetUserId,
    });

    return res.status(200).json({ message: 'Conversa fixada com sucesso.' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'INVALID_TARGET') {
      return res.status(400).json({ message: 'Operacao invalida.' });
    }

    if (err.message === 'PIN_LIMIT_REACHED') {
      return res.status(400).json({ message: 'Voce pode fixar no maximo 5 conversas.' });
    }

    console.error('Erro ao fixar conversa:', err);
    return res.status(500).json({ message: 'Erro no servidor ao fixar conversa.' });
  }
};

exports.unpin = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    await conversasService.unpinConversation({
      userId,
      targetUserId: req.params.targetUserId,
    });

    return res.status(200).json({ message: 'Conversa desafixada com sucesso.' });
  } catch (err) {
    console.error('Erro ao desafixar conversa:', err);
    return res.status(500).json({ message: 'Erro no servidor ao desafixar conversa.' });
  }
};

exports.block = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    await conversasService.blockUser({
      userId,
      targetUserId: req.params.targetUserId,
    });

    return res.status(200).json({ message: 'Usuario bloqueado com sucesso.' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'INVALID_TARGET') {
      return res.status(400).json({ message: 'Operacao invalida.' });
    }

    console.error('Erro ao bloquear usuario:', err);
    return res.status(500).json({ message: 'Erro no servidor ao bloquear usuario.' });
  }
};

exports.unblock = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    await conversasService.unblockUser({
      userId,
      targetUserId: req.params.targetUserId,
    });

    return res.status(200).json({ message: 'Usuario desbloqueado com sucesso.' });
  } catch (err) {
    console.error('Erro ao desbloquear usuario:', err);
    return res.status(500).json({ message: 'Erro no servidor ao desbloquear usuario.' });
  }
};
