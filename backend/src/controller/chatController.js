const chatService = require('../service/chatService');

const getUserId = (req) => req.user?.userId || req.user?.id || null;

exports.getMessages = async (req, res) => { 
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId } = req.params;
    const data = await chatService.getMessages({
      userId,
      targetUserId,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json(data);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    if (err.message === 'CHAT_BLOCKED') {
      return res.status(403).json({ message: 'Esta conversa está bloqueada.' });
    }

    if (err.message === 'CANNOT_CHAT_WITH_SELF') {
      return res.status(400).json({ message: 'Não é permitido abrir chat com você mesmo.' });
    }

    console.error('Erro ao buscar mensagens:', err);
    return res.status(500).json({ message: 'Erro no servidor ao buscar mensagens.' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId } = req.params;
    const { content, replyToMessageId } = req.body;

    const data = await chatService.sendMessage({
      userId,
      targetUserId,
      content,
      replyToMessageId,
    });

    return res.status(201).json(data);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    if (err.message === 'CHAT_BLOCKED') {
      return res.status(403).json({ message: 'Não é possível enviar mensagem porque este chat está bloqueado.' });
    }

    if (err.message === 'CANNOT_CHAT_WITH_SELF') {
      return res.status(400).json({ message: 'Não é permitido abrir chat com você mesmo.' });
    }

    if (err.message === 'EMPTY_MESSAGE') {
      return res.status(400).json({ message: 'A mensagem não pode estar vazia.' });
    }

    if (err.message === 'INVALID_MESSAGE') {
      return res.status(400).json({ message: 'Mensagem invalida.' });
    }

    if (err.message === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ message: 'Mensagem não encontrada.' });
    }

    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ message: 'Erro no servidor ao enviar mensagem.' });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId, messageId } = req.params;
    const { content } = req.body;

    const data = await chatService.updateMessage({
      userId,
      targetUserId,
      messageId,
      content,
    });

    return res.status(200).json(data);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    if (err.message === 'CHAT_BLOCKED') {
      return res.status(403).json({ message: 'Não é possível editar mensagem porque este chat está bloqueado.' });
    }

    if (err.message === 'EMPTY_MESSAGE' || err.message === 'INVALID_MESSAGE') {
      return res.status(400).json({ message: 'Mensagem invalida.' });
    }

    if (err.message === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ message: 'Mensagem não encontrada.' });
    }

    if (err.message === 'MESSAGE_NOT_OWNED') {
      return res.status(403).json({ message: 'Você só pode editar mensagens enviadas por você.' });
    }

    if (err.message === 'EDIT_WINDOW_EXPIRED') {
      return res.status(400).json({ message: 'Essa mensagem não pode mais ser editada.' });
    }

    console.error('Erro ao editar mensagem:', err);
    return res.status(500).json({ message: 'Erro no servidor ao editar mensagem.' });
  }
};

exports.deleteMessageForMe = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId, messageId } = req.params;
    await chatService.deleteMessageForMe({ userId, targetUserId, messageId });

    return res.status(200).json({ message: 'Mensagem excluída para você.' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND' || err.message === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ message: 'Mensagem não encontrada.' });
    }

    if (err.message === 'INVALID_MESSAGE') {
      return res.status(400).json({ message: 'Mensagem invalida.' });
    }

    console.error('Erro ao excluir mensagem para voce:', err);
    return res.status(500).json({ message: 'Erro no servidor ao excluir mensagem.' });
  }
};

exports.deleteMessageForEveryone = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Token invalido' });
    }

    const { targetUserId, messageId } = req.params;
    await chatService.deleteMessageForEveryone({ userId, targetUserId, messageId });

    return res.status(200).json({ message: 'Mensagem excluída para todos.' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND' || err.message === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ message: 'Mensagem não encontrada.' });
    }

    if (err.message === 'INVALID_MESSAGE') {
      return res.status(400).json({ message: 'Mensagem invalida.' });
    }

    if (err.message === 'MESSAGE_NOT_OWNED') {
      return res.status(403).json({ message: 'Você só pode excluir para todos mensagens enviadas por você.' });
    }

    console.error('Erro ao excluir mensagem para todos:', err);
    return res.status(500).json({ message: 'Erro no servidor ao excluir mensagem.' });
  }
};
