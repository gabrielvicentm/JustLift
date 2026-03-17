const premiumService = require('../service/premiumService');

function getUserId(req) {
  return req.user?.userId || req.user?.id || null;
}

exports.getStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
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
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao buscar status premium:', err);
    return res.status(500).json({ message: 'Erro ao buscar status premium' });
  }
};

exports.sync = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const status = await premiumService.syncFromRevenueCat(userId);
    return res.status(200).json({
      message: 'Premium sincronizado com sucesso',
      isPremium: Boolean(status.is_premium),
      premiumStatus: status.premium_status,
      premiumSource: status.premium_source,
      premiumUntil: status.premium_until,
      premiumUpdatedAt: status.premium_updated_at,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    if (err.message === 'REVENUECAT_NOT_CONFIGURED') {
      return res.status(500).json({ message: 'RevenueCat nao configurado' });
    }

    if (err.message === 'REVENUECAT_SUBSCRIBER_NOT_FOUND') {
      return res.status(404).json({ message: 'Assinatura nao encontrada' });
    }

    if (typeof err.message === 'string' && err.message.startsWith('REVENUECAT_HTTP_')) {
      return res.status(502).json({ message: 'Falha ao consultar RevenueCat' });
    }

    console.error('Erro ao sincronizar premium:', err);
    return res.status(500).json({ message: 'Erro ao sincronizar premium' });
  }
};

exports.setFake = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Usuario nao autenticado' });
    }

    const enabled = Boolean(req.body?.enabled);
    const status = await premiumService.setManualStatus(userId, enabled);
    return res.status(200).json({
      message: enabled ? 'Premium falso ativado' : 'Premium falso desativado',
      isPremium: Boolean(status.is_premium),
      premiumStatus: status.premium_status,
      premiumSource: status.premium_source,
      premiumUntil: status.premium_until,
      premiumUpdatedAt: status.premium_updated_at,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'Usuario nao encontrado' });
    }

    console.error('Erro ao atualizar premium falso:', err);
    return res.status(500).json({ message: 'Erro ao atualizar premium falso' });
  }
};
