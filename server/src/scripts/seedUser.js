require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedUser() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = [
    {
      name: 'Người Dùng Test',
      email: 'user@test.com',
      password: '123456',
      phone: '0912345678',
      role: 'user',
      isVerified: true,
      isActive: true,
    },
    {
      name: 'Admin PhoneStore',
      email: 'admin@test.com',
      password: '123456',
      phone: '0987654321',
      role: 'admin',
      isVerified: true,
      isActive: true,
    },
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`⚠️  ${u.email} đã tồn tại — bỏ qua`);
      continue;
    }
    await User.create(u);
    console.log(`✅ Tạo: ${u.email} / 123456 (${u.role})`);
  }

  console.log('\nĐăng nhập tại http://localhost:5173/login');
  await mongoose.disconnect();
  process.exit(0);
}

seedUser().catch((e) => { console.error(e); process.exit(1); });
