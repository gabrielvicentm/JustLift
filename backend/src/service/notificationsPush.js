const db = require("../utils/db");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const INVALID_TOKEN_ERRORS = new Set(["DeviceNotRegistered", "InvalidExpoPushToken"]);

async function getActiveTokens(userId) {
  const result = await db.query(
    `
    SELECT expo_push_token
    FROM user_push_tokens
    WHERE user_id = $1
      AND is_active = TRUE
      AND revoked_at IS NULL
  `,
    [userId]
  );

  return result.rows.map((row) => row.expo_push_token);
}

async function sendPushToTokens(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    return { sent: 0, invalid: [] };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return { sent: 0, invalid: [], error: payload || "push_failed" };
  }

  const invalid = [];
  const dataItems = Array.isArray(payload?.data) ? payload.data : [];
  dataItems.forEach((item, index) => {
    if (item?.status === "error" && INVALID_TOKEN_ERRORS.has(item?.details?.error)) {
      invalid.push(tokens[index]);
    }
  });

  if (invalid.length > 0) {
    await db.query(
      `
      UPDATE user_push_tokens
      SET is_active = FALSE,
          revoked_at = NOW(),
          updated_at = NOW()
      WHERE expo_push_token = ANY($1)
    `,
      [invalid]
    );
  }

  return { sent: messages.length, invalid };
}

async function sendPushToUser({ userId, title, body, data = {} }) {
  const tokens = await getActiveTokens(userId);
  return sendPushToTokens(tokens, { title, body, data });
}

module.exports = {
  getActiveTokens,
  sendPushToTokens,
  sendPushToUser,
};
