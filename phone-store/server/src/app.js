const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const { apiLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Security & logging
app.use(helmet());
app.use(compression()); // gzip responses
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limit toàn bộ API
app.use('/api', apiLimiter);

// Load models
require('./models/index');

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/brands', require('./routes/brand.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/profile', require('./routes/profile.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/returns', require('./routes/return.routes'));
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/loyalty', require('./routes/loyalty.routes'));
app.use('/api/flash-sales', require('./routes/flashsale.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/banners', require('./routes/banner.routes'));
app.use('/api/chat', require('./routes/chat.routes'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server đang chạy', env: process.env.NODE_ENV, timestamp: new Date() });
});

app.get('/api/health/email', async (req, res) => {
  const { verifyEmailConfig } = require('./utils/otp.utils');
  const result = await verifyEmailConfig();
  res.json({ success: true, email: result });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} không tồn tại` });
});

// Error handler — phải đặt cuối cùng
app.use(errorHandler);

module.exports = app;
