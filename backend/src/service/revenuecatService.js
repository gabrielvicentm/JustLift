const https = require('https');

function requestRevenueCatSubscriber(appUserId, apiKey) {
  return new Promise((resolve, reject) => {
    const path = `/v1/subscribers/${encodeURIComponent(appUserId)}`;
    const req = https.request(
      {
        method: 'GET',
        hostname: 'api.revenuecat.com',
        path,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 404) {
            return reject(new Error('REVENUECAT_SUBSCRIBER_NOT_FOUND'));
          }
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`REVENUECAT_HTTP_${res.statusCode || 500}`));
          }

          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.end();
  });
}

module.exports = {
  requestRevenueCatSubscriber,
};
