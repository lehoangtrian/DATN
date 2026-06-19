require('dotenv').config();
const http = require('http');
const app = require('./src/app');

// ISSUE #17: cảnh báo JWT_SECRET yếu khi khởi động
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('[SECURITY] JWT_SECRET chưa được đặt hoặc quá ngắn (< 32 ký tự). Hãy đặt giá trị mạnh trong .env trước khi deploy!');
}
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
app.set('io', io);

// Kết nối Socket.IO với notification controller
const { setIO } = require('./src/controllers/notification.controller');
setIO(io);

// Theo dõi admin online qua in-memory Set
const adminSockets = new Map(); // socketId → userId
const { User } = require('./src/models/index');

io.on('connection', (socket) => {
  // Client gửi userId để join room cá nhân
  socket.on('join', async (userId) => {
    if (!userId) return;
    socket.join(String(userId));
    socket._chatUserId = String(userId);
    console.log(`[Socket] join: userId=${userId}, socketId=${socket.id}`);

    try {
      const user = await User.findById(userId).select('role').lean();
      if (user && ['admin', 'staff'].includes(user.role)) {
        adminSockets.set(socket.id, String(userId));
        socket.join('admin_chat_room');
        // Thông báo tất cả users rằng admin đang online
        io.emit('chat:admin_status', { isOnline: true });
      }
    } catch (_) {}
  });

  socket.on('disconnect', () => {
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
      if (adminSockets.size === 0) {
        io.emit('chat:admin_status', { isOnline: false });
      }
    }
  });
});

// Helper cho chat controller: có admin nào đang online KHÁC userId không?
const isAdminOnline = (excludeUserId) => {
  if (!excludeUserId) return adminSockets.size > 0;
  for (const uid of adminSockets.values()) {
    if (uid !== String(excludeUserId)) return true;
  }
  return false;
};
app.set('isAdminOnline', isAdminOnline);

// Helper cho chat controller: admin cụ thể (đã được assignedTo một session) có đang online không?
// Cần để tránh kẹt tin nhắn khi admin đã nhận session rồi disconnect mà không clear assignedTo.
const isSpecificAdminOnline = (userId) => {
  if (!userId) return false;
  for (const uid of adminSockets.values()) {
    if (uid === String(userId)) return true;
  }
  return false;
};
app.set('isSpecificAdminOnline', isSpecificAdminOnline);

// Kết nối Socket.IO với chat controller
const { setChatIO } = require('./src/controllers/chat.controller');
setChatIO(io, app);

connectDB()
  .then(() => {
    const { startStockReleaseJob } = require('./src/jobs/stockRelease.job');
    const { startAutoExpireOrdersJob } = require('./src/jobs/autoExpireOrders.job');
    const { startBirthdayCouponJob } = require('./src/jobs/birthdayCoupon.job');
    startStockReleaseJob();
    startAutoExpireOrdersJob();
    startBirthdayCouponJob();
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
