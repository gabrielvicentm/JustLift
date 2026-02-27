const premiumService = require('../service/premiumService');

function getUserId(req) {
  return req.user?.userId || req.user?.id || null;
}

exports.getStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const status = await premiumService.getPremiumStatus(userId);
    return res.status(200).json({
      isPremium: Boolean(status.is_premium),
      premiumStatus: status.premium_status,
      premiumSource: status.premium_source,
      premiumUntil: status.premium_until,
      premiumUpdatedAt: status.premium_updated_at,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    console.error('Erro ao buscar status premium:', err);
    return res.status(500).json({ message: 'Erro ao buscar status premium' });
  }
};

exports.activate = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const durationDays = Number(req.body?.durationDays || 30);
    const status = await premiumService.activatePremiumFake(userId, durationDays);
    return res.status(200).json({
      message: 'Premium ativado com sucesso',
      isPremium: Boolean(status.is_premium),
      premiumStatus: status.premium_status,
      premiumSource: status.premium_source,
      premiumUntil: status.premium_until,
      premiumUpdatedAt: status.premium_updated_at,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    console.error('Erro ao ativar premium:', err);
    return res.status(500).json({ message: 'Erro ao ativar premium' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const status = await premiumService.deactivatePremiumFake(userId);
    return res.status(200).json({
      message: 'Premium desativado com sucesso',
      isPremium: Boolean(status.is_premium),
      premiumStatus: status.premium_status,
      premiumSource: status.premium_source,
      premiumUntil: status.premium_until,
      premiumUpdatedAt: status.premium_updated_at,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    console.error('Erro ao desativar premium:', err);
    return res.status(500).json({ message: 'Erro ao desativar premium' });
  }
};
