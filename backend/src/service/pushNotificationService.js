const db = require('../utils/db');
const https = require('https');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function normalizeMessages(messages) {
  return messages.filter((item) => item && typeof item.to === 'string' && item.to.length > 0);
}

function sendExpoPush(messages) {
  const payload = normalizeMessages(messages);
  if (payload.length === 0) {
    return Promise.resolve(null);
  }

  const body = JSON.stringify(payload);
  const url = new URL(EXPO_PUSH_URL);

  return new Promise((resolve) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log('[Push][Expo] status:', res.statusCode);
            console.log('[Push][Expo] response:', JSON.stringify(parsed));
            resolve(parsed);
          } catch (err) {
            console.error('Resposta invalida do Expo Push:', err);
            console.log('[Push][Expo] raw:', data);
            resolve(null);
          }
        });
      },
    );

    req.on('error', (err) => {
      console.error('Erro ao enviar push Expo:', err);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

async function removeInvalidTokens(tokens) {
  if (!tokens.length) return;

  await db.query(
    `
      DELETE FROM user_push_tokens
      WHERE token = ANY($1::text[])
    `,
    [tokens],
  );
}

exports.sendPushToUser = async ({ userId, title, body, data }) => {
  if (!userId) {
    return;
  }

  const tokens = await db.query(
    `
      SELECT token
      FROM user_push_tokens
      WHERE user_id = $1
    `,
    [userId],
  );

  if (!tokens.rows.length) {
    return;
  }

  const messages = tokens.rows.map((row) => ({
    to: row.token,
    title,
    body,
    data: data || {},
    sound: 'default',
  }));

  const response = await sendExpoPush(messages);
  const ticketData = response?.data || [];

  const invalidTokens = [];
  for (let i = 0; i < ticketData.length; i += 1) {
    const ticket = ticketData[i];
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      invalidTokens.push(messages[i].to);
    }
  }

  if (invalidTokens.length > 0) {
    await removeInvalidTokens(invalidTokens);
  }
};
