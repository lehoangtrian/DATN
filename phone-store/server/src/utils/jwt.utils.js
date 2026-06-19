const jwt = require('jsonwebtoken');

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!REFRESH_SECRET) throw new Error('[JWT] JWT_REFRESH_SECRET chưa được cấu hình trong .env');

const generateRefreshToken = (id) =>
  jwt.sign({ id }, REFRESH_SECRET, { expiresIn: '30d' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken };
