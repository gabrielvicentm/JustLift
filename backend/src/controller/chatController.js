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
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'CHAT_BLOCKED') {
      return res.status(403).json({ message: 'Esta conversa esta bloqueada.' });
    }

    if (err.message === 'CANNOT_CHAT_WITH_SELF') {
      return res.status(400).json({ message: 'Nao e permitido abrir chat com voce mesmo.' });
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
    const { content } = req.body;

    const data = await chatService.sendMessage({
      userId,
      targetUserId,
      content,
    });

    return res.status(201).json(data);
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (err.message === 'CHAT_BLOCKED') {
      return res.status(403).json({ message: 'Nao e possivel enviar mensagem porque este chat esta bloqueado.' });
    }

    if (err.message === 'CANNOT_CHAT_WITH_SELF') {
      return res.status(400).json({ message: 'Nao e permitido abrir chat com voce mesmo.' });
    }

    if (err.message === 'EMPTY_MESSAGE') {
      return res.status(400).json({ message: 'A mensagem nao pode estar vazia.' });
    }

    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ message: 'Erro no servidor ao enviar mensagem.' });
  }
};
