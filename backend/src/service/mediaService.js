const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const r2 = require('../config/r2Client');

function sanitizeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

exports.createPresignedUpload = async ({ filename, contentType }) => {
  const safeName = sanitizeName(filename);
  const key = `media/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const expiresIn = Number(process.env.PRESIGN_EXPIRES_SECONDS || 300);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn });
  const publicUrl = process.env.R2_PUBLIC_BASE_URL
    ? `${process.env.R2_PUBLIC_BASE_URL}/${key}`
    : null;

  return { key, uploadUrl, expiresIn, publicUrl };
};
