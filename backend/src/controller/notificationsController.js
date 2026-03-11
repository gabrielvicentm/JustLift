const notificationsService = require("../service/notificationsService");
const db = require("../utils/db");

async function savePushToken(req, res) {
  const userId = req.user?.userId || req.user?.id || null;
  if (!userId) {
    return res.status(401).json({ message: "Token invalido" });
  }
  const { expoPushToken, platform } = req.body;
  if (!expoPushToken || typeof expoPushToken !== "string" || expoPushToken.trim().length === 0) {
    return res.status(400).json({ message: "Expo push token invalido." });
  }

  console.log("[notifications] savePushToken", { userId, platform, expoPushToken });

  await db.query(`
    INSERT INTO user_push_tokens (
      user_id,
      expo_push_token,
      platform,
      is_active,
      last_seen_at,
      updated_at
    )
    VALUES ($1, $2, $3, TRUE, NOW(), NOW())
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      is_active = TRUE,
      last_seen_at = NOW(),
      updated_at = NOW()
  `, [userId, expoPushToken, platform || null]);

  console.log("[notifications] saved push token");
  res.json({ success: true });
}

async function listNotifications(req, res) {
  const userId = req.user?.userId || req.user?.id || null;
  if (!userId) {
    return res.status(401).json({ message: "Token invalido" });
  }
  const { limit, offset } = req.query;
  const notifications = await notificationsService.getNotifications(userId, { limit, offset });

  res.json(notifications);
}

async function unreadCount(req, res) {
  const userId = req.user?.userId || req.user?.id || null;
  if (!userId) {
    return res.status(401).json({ message: "Token invalido" });
  }
  const count = await notificationsService.getUnreadCount(userId);

  res.json({ unreadCount: count });
}

async function markRead(req, res) {
  const userId = req.user?.userId || req.user?.id || null;
  if (!userId) {
    return res.status(401).json({ message: "Token invalido" });
  }
  const id = req.params.id;
  const updated = await notificationsService.markAsRead(userId, id);
  if (!updated) {
    return res.status(404).json({ message: "Notificacao nao encontrada." });
  }

  res.json({ success: true });
}

module.exports = {
  savePushToken,
  listNotifications,
  unreadCount,
  markRead
};
