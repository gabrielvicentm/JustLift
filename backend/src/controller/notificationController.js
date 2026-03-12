const notificationService = require('../service/notificationService');

function getUserIdFromRequest(req) {
  return req.user?.userId || req.user?.id || null;
}

exports.listNotifications = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const notifications = await notificationService.listByRecipient({
      recipientUserId: userId,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json({ notifications });
  } catch (err) {
    console.error('Erro ao listar notificações:', err);
    return res.status(500).json({ message: 'Erro ao listar notificações' });
  }
};

exports.getUnreadNotificationsCount = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const unreadCount = await notificationService.countUnreadByRecipient({
      recipientUserId: userId,
    });

    return res.status(200).json({ unreadCount });
  } catch (err) {
    console.error('Erro ao contar notificacoes nao lidas:', err);
    return res.status(500).json({ message: 'Erro ao contar notificacoes' });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const notificationId = Number(req.params?.notificationId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ message: 'Id de notificação invalido' });
    }

    const updated = await notificationService.markAsRead({
      notificationId,
      recipientUserId: userId,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Notificacao nao encontrada' });
    }

    return res.status(200).json({ message: 'Notificacao marcada como lida' });
  } catch (err) {
    console.error('Erro ao marcar notificacao como lida:', err);
    return res.status(500).json({ message: 'Erro ao atualizar notificacao' });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    await notificationService.markAllAsRead({ recipientUserId: userId });
    return res.status(200).json({ message: 'Todas as notificacoes foram marcadas como lidas' });
  } catch (err) {
    console.error('Erro ao marcar todas notificacoes como lidas:', err);
    return res.status(500).json({ message: 'Erro ao atualizar notificacoes' });
  }
};

exports.registerPushToken = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || '').trim().toLowerCase() || 'unknown';
    const deviceId = req.body?.deviceId ? String(req.body.deviceId).trim() : null;

    if (!token) {
      return res.status(400).json({ message: 'Token de push obrigatorio' });
    }

    await notificationService.registerPushToken({
      userId,
      token,
      platform,
      deviceId,
    });

    return res.status(201).json({ message: 'Token registrado' });
  } catch (err) {
    console.error('Erro ao registrar push token:', err);
    return res.status(500).json({ message: 'Erro ao registrar push token' });
  }
};

exports.unregisterPushToken = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ message: 'Token de push obrigatorio' });
    }

    await notificationService.unregisterPushToken({ userId, token });
    return res.status(200).json({ message: 'Token removido' });
  } catch (err) {
    console.error('Erro ao remover push token:', err);
    return res.status(500).json({ message: 'Erro ao remover push token' });
  }
};
