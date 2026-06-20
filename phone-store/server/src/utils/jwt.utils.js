const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!REFRESH_SECRET) throw new Error('[JWT] JWT_REFRESH_SECRET chưa được cấu hình trong .env');

const generateRefreshToken = (id) =>
  jwt.sign({ id, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: '30d' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

// Hash refresh token để lưu trong DB (không lưu token gốc) — dùng để rotate + phát hiện reuse
const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashRefreshToken };
