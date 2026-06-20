const mongoose = require('mongoose');
require('dotenv').config();
const { Order, ReturnRequest, User, Product, ProductVariant, Cart } = require('./src/models/index');

const runConcurrencyTest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/phonestore');
    console.log('================================================');
    console.log('🚀 BẮT ĐẦU KIỂM THỬ XUNG ĐỘT ĐỒNG THỜI (RACE CONDITION)');
    console.log('================================================\n');

    // TEST 1: Double Refund (ReturnRequest)
    console.log('⏳ KỊCH BẢN 1: 2 Admin cùng lúc bấm Hoàn tiền cho 1 yêu cầu trả hàng (Test Lỗi Double Refund)');
    
    // Tạo Dummy Return Request
    const dummyUser = await User.findOne({ role: 'user' });
    if (!dummyUser) {
      console.log('Không tìm thấy User nào để test. Dừng test.');
      process.exit(1);
    }

    const dummyReturn = await ReturnRequest.create({
      userId: dummyUser._id,
      orderId: new mongoose.Types.ObjectId(),
      reason: 'Lý do test', // Sửa lỗi báo thiếu reason lúc trước
      refundAmount: 500000,
      refundBankInfo: {
        bankName: 'Test',
        accountNumber: '123',
        accountHolder: 'Test',
      },
      status: 'pending'
    });

    const userBefore = await User.findById(dummyUser._id);
    const balanceBefore = userBefore.walletBalance || 0;

    // Giả lập 2 request đồng thời từ 2 Admin (gọi hàm tìm và khóa)
    const processReturn = async (adminName) => {
      let returnReq = await ReturnRequest.findById(dummyReturn._id);
      
      if (returnReq.status !== 'completed') {
        const locked = await ReturnRequest.findOneAndUpdate(
          { _id: returnReq._id, status: returnReq.status },
          { status: 'completed' },
          { new: true }
        );
        if (!locked) {
          return `❌ [${adminName}] Yêu cầu bị từ chối: Trạng thái đã bị thay đổi bởi Admin khác!`;
        }
        
        // Chỉ admin lọt qua được cửa bảo vệ mới cộng tiền
        await User.findByIdAndUpdate(dummyUser._id, { $inc: { walletBalance: 500000 } });
        return `✅ [${adminName}] Xử lý thành công! Đã cộng 500k vào ví khách.`;
      }
      return `❌ [${adminName}] Yêu cầu bị từ chối: Đã hoàn tất.`;
    };

    // Chạy 2 hàm giả lập cùng 1 mili-giây
    const results = await Promise.all([
      processReturn('Admin A'),
      processReturn('Admin B')
    ]);

    const userAfter = await User.findById(dummyUser._id);
    const balanceAfter = userAfter.walletBalance || 0;

    console.log('--- Kết quả xử lý ---');
    console.log(results.join('\n'));
    console.log(`\n💰 Số dư ví khách hàng TRƯỚC: ${balanceBefore}đ`);
    console.log(`💰 Số dư ví khách hàng SAU: ${balanceAfter}đ`);
    
    const diff = balanceAfter - balanceBefore;
    if (diff === 500000) {
      console.log('🎉 KẾT QUẢ: PASS - Chặn thành công lỗi Double Refund. Hệ thống chỉ cộng tiền 1 lần duy nhất.\n');
    } else {
      console.log(`💥 KẾT QUẢ: FAILED - Đã bị lỗi cộng ${diff}đ (Lẽ ra chỉ được cộng 500000đ).\n`);
    }

    // Dọn dẹp Database sau Test 1
    await ReturnRequest.findByIdAndDelete(dummyReturn._id);
    await User.findByIdAndUpdate(dummyUser._id, { walletBalance: balanceBefore });

    // =======================================================
    // TEST 2: Tranh mua hàng (Hold Stock)
    // =======================================================
    console.log('⏳ KỊCH BẢN 2: 2 Khách hàng cùng lúc bấm Thanh toán (Checkout) cho 1 sản phẩm cuối cùng trong kho');
    
    // Tạo 1 Dummy ProductVariant với đúng 1 tồn kho
    const dummyProduct = await Product.findOne({});
    const dummyVariant = await ProductVariant.create({
      productId: dummyProduct._id,
      storage: 'Test Storage',
      color: 'Test Color',
      price: 100000,
      stock: 1 // KHO CHỈ CÒN ĐÚNG 1 SẢN PHẨM
    });

    const processHoldStock = async (userName) => {
      // Giả lập đoạn code giữ hàng bằng Atomic Update giống y hệt trong cart.controller.js
      const updated = await ProductVariant.findOneAndUpdate(
        { _id: dummyVariant._id, stock: { $gte: 1 } },
        { $inc: { stock: -1 } },
        { new: true }
      );
      
      if (!updated) {
         return `❌ [${userName}] Đặt hàng THẤT BẠI: Sản phẩm vừa bị người khác mua mất!`;
      }
      return `✅ [${userName}] Đặt hàng THÀNH CÔNG: Đã giành được sản phẩm cuối cùng.`;
    };

    // 2 khách hàng gửi request thanh toán cùng 1 mili-giây
    const holdResults = await Promise.all([
      processHoldStock('Khách hàng A'),
      processHoldStock('Khách hàng B')
    ]);

    const finalVariant = await ProductVariant.findById(dummyVariant._id);
    const finalStock = finalVariant.stock;

    console.log('--- Kết quả xử lý ---');
    console.log(holdResults.join('\n'));
    console.log(`\n📦 Tồn kho thực tế sau cuộc chiến giành giật: ${finalStock} sản phẩm`);

    if (finalStock === 0) {
      console.log('🎉 KẾT QUẢ: PASS - Chặn thành công lỗi Bán lố (Overselling). Tồn kho không bị âm.\n');
    } else {
      console.log(`💥 KẾT QUẢ: FAILED - Tồn kho bị sai lệch!\n`);
    }

    // Dọn dẹp Test 2
    await ProductVariant.findByIdAndDelete(dummyVariant._id);

    // =======================================================
    // TEST 3: Rollback Giao dịch (Transaction Rollback)
    // =======================================================
    console.log('⏳ KỊCH BẢN 3: Rollback tự động khi 1 sản phẩm trong Giỏ hàng bị hết kho');
    
    // Tạo 2 sản phẩm: A (Còn 10 cái), B (Đã hết hàng)
    const variantA = await ProductVariant.create({
      productId: dummyProduct._id,
      storage: 'A', color: 'Xanh', price: 100000,
      stock: 10 // Đủ hàng
    });
    const variantB = await ProductVariant.create({
      productId: dummyProduct._id,
      storage: 'B', color: 'Đỏ', price: 100000,
      stock: 0 // Hết hàng
    });

    const processTransaction = async () => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Bước 1: Trừ hàng A (Sẽ thành công)
        const updatedA = await ProductVariant.findOneAndUpdate(
          { _id: variantA._id, stock: { $gte: 1 } },
          { $inc: { stock: -1 } },
          { new: true, session } // Chạy trong Transaction
        );
        if (!updatedA) throw new Error('A hết hàng');

        // Bước 2: Trừ hàng B (Sẽ thất bại vì kho = 0)
        const updatedB = await ProductVariant.findOneAndUpdate(
          { _id: variantB._id, stock: { $gte: 1 } },
          { $inc: { stock: -1 } },
          { new: true, session } // Chạy trong Transaction
        );
        if (!updatedB) {
          // Gây ra Rollback vì B hết hàng
          await session.abortTransaction();
          session.endSession();
          return `❌ Checkout thất bại: Sản phẩm B đã hết hàng. Đã kích hoạt Rollback toàn bộ!`;
        }

        await session.commitTransaction();
        session.endSession();
        return `✅ Checkout thành công`;
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return `Lỗi: ${err.message}`;
      }
    };

    const transResult = await processTransaction();
    const finalA = await ProductVariant.findById(variantA._id);
    
    console.log('--- Kết quả xử lý ---');
    console.log(transResult);
    console.log(`\n📦 Tồn kho sản phẩm A TRƯỚC KHI bị lỗi: 10`);
    console.log(`📦 Tồn kho sản phẩm A SAU KHI Rollback: ${finalA.stock}`);

    if (finalA.stock === 10) {
      console.log('🎉 KẾT QUẢ TEST 3: PASS - Dữ liệu đã được bảo toàn 100%. Tồn kho A tự động khôi phục về 10 dù code trừ A đã chạy xong trước khi phát hiện B bị lỗi.\n');
    } else {
      console.log(`💥 KẾT QUẢ TEST 3: FAILED - Rò rỉ dữ liệu (Data Leak). Tồn kho A bị kẹt ở mức ${finalA.stock}.\n`);
    }

    await ProductVariant.deleteMany({ _id: { $in: [variantA._id, variantB._id] } });

    // =======================================================
    // TEST 4: Trả kho sau 15 phút (Chống nhân bản Tồn kho)
    // =======================================================
    console.log('⏳ KỊCH BẢN 4: Hết thời gian Giữ hàng (15p) - 2 Cron Job cùng chạy thu hồi kho');
    
    // Tạo User ảo riêng cho Kịch bản 4 để tránh lỗi trùng lặp Giỏ hàng
    const testUser = await User.create({
      name: 'Test Khách C',
      email: `test_c_${Date.now()}@example.com`,
      password: '123'
    });

    // Tạo 1 Dummy ProductVariant đang hết sạch hàng
    const variantC = await ProductVariant.create({
      productId: dummyProduct._id,
      storage: 'C', color: 'Đen', price: 100000,
      stock: 0 // Đang hết hàng vì bị Khách C giữ
    });

    // Tạo Giỏ hàng của Khách C với thời hạn giữ hàng là 1 tiếng TRƯỚC (Đã quá hạn 15p)
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 giờ trước
    const dummyCart = await Cart.create({
      userId: testUser._id,
      items: [{
        productId: dummyProduct._id,
        variantId: variantC._id,
        quantity: 2, // Khách C đang giữ 2 cái
        price: 100000,
        holdExpiry: pastDate
      }]
    });

    const processCronJob = async (jobName) => {
      // Giả lập logic trong stockRelease.job.js
      const now = new Date();
      // Atomic Update: Thu hồi cờ holdExpiry và trả về giỏ hàng cũ
      const oldCart = await Cart.findOneAndUpdate(
        { _id: dummyCart._id, 'items.holdExpiry': { $lt: now } },
        { $unset: { 'items.$[expired].holdExpiry': '' } },
        { arrayFilters: [{ 'expired.holdExpiry': { $lt: now } }], new: false }
      );

      if (!oldCart) {
        return `❌ [${jobName}] Không có gì để thu hồi (Job khác đã thu hồi trước đó rồi!).`;
      }

      // Khôi phục kho
      const restoredItems = oldCart.items.filter(item => item.holdExpiry && item.holdExpiry < now);
      for (const item of restoredItems) {
        await ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
      }
      return `✅ [${jobName}] Phát hiện 2 sản phẩm hết hạn Giữ hàng -> Đã cộng lại vào kho!`;
    };

    // Giả lập tình huống 2 Server cùng chạy Cron Job thu hồi kho đúng 1 mili-giây
    const cronResults = await Promise.all([
      processCronJob('Cron Server 1'),
      processCronJob('Cron Server 2')
    ]);

    const finalC = await ProductVariant.findById(variantC._id);
    const finalCart = await Cart.findById(dummyCart._id);

    console.log('--- Kết quả xử lý ---');
    console.log(cronResults.join('\n'));
    console.log(`\n📦 Tồn kho sản phẩm TRƯỚC KHI thu hồi: 0`);
    console.log(`📦 Tồn kho sản phẩm SAU KHI thu hồi: ${finalC.stock} (Sẽ là 4 nếu bị lỗi Nhân bản kho)`);
    console.log(`⏳ Trạng thái Giữ hàng trong Giỏ: ${finalCart.items[0].holdExpiry ? 'Vẫn còn' : 'Đã bị xóa (Chờ thanh toán lại)'}`);

    if (finalC.stock === 2) {
      console.log('🎉 KẾT QUẢ TEST 4: PASS - Chặn thành công lỗi Nhân bản Tồn kho (Infinite Stock Duplication). Kho được cộng lại đúng số lượng 2 cái duy nhất.\n');
    } else {
      console.log(`💥 KẾT QUẢ TEST 4: FAILED - Kho bị sai lệch!\n`);
    }

    // Dọn dẹp Kịch bản 4
    await ProductVariant.findByIdAndDelete(variantC._id);
    await Cart.findByIdAndDelete(dummyCart._id);
    await User.findByIdAndDelete(testUser._id);

    // =======================================================
    // TEST 5: Sử dụng Mã Giảm Giá (Coupon Race Condition)
    // =======================================================
    console.log('⏳ KỊCH BẢN 5: 2 Khách hàng cùng lúc sử dụng 1 Mã giảm giá chỉ còn ĐÚNG 1 lượt dùng');
    
    // Tạo 1 Mã giảm giá (Coupon) chỉ có 1 lượt sử dụng
    const { Coupon } = require('./src/models/index');
    const dummyCoupon = await Coupon.create({
      code: `TEST_${Date.now()}`,
      description: 'Giảm giá test',
      type: 'fixed',
      value: 50000,
      usageLimit: 1, // CHỈ CÒN 1 LƯỢT
      usedCount: 0,
      startDate: new Date(Date.now() - 10000),
      endDate: new Date(Date.now() + 100000),
      isActive: true
    });

    // 2 User ảo
    const user1 = await User.create({ name: 'User 1', email: `1_${Date.now()}@test.com`, password: '123' });
    const user2 = await User.create({ name: 'User 2', email: `2_${Date.now()}@test.com`, password: '123' });

    const applyCoupon = async (userId, userName) => {
      // Giả lập logic trong order.controller.js
      const atomicFilter = { _id: dummyCoupon._id, $expr: { $lt: ['$usedCount', dummyCoupon.usageLimit] } };
      const reservedCoupon = await Coupon.findOneAndUpdate(
        atomicFilter,
        { $inc: { usedCount: 1 }, $push: { usedBy: userId } }
      );

      if (!reservedCoupon) {
        return `❌ [${userName}] Áp dụng THẤT BẠI: Mã giảm giá đã hết lượt!`;
      }
      return `✅ [${userName}] Áp dụng THÀNH CÔNG: Đã giành được mã giảm giá cuối cùng!`;
    };

    const couponResults = await Promise.all([
      applyCoupon(user1._id, 'Khách hàng 1'),
      applyCoupon(user2._id, 'Khách hàng 2')
    ]);

    const finalCoupon = await Coupon.findById(dummyCoupon._id);
    console.log('--- Kết quả xử lý ---');
    console.log(couponResults.join('\n'));
    console.log(`\n🎟️ Số lượt đã dùng mã: ${finalCoupon.usedCount}/${finalCoupon.usageLimit}`);
    if (finalCoupon.usedCount === 1) {
      console.log('🎉 KẾT QUẢ TEST 5: PASS - Chặn thành công lỗi thủng Mã giảm giá.\n');
    } else {
      console.log(`💥 KẾT QUẢ TEST 5: FAILED - Mã giảm giá bị lạm dụng!\n`);
    }

    // =======================================================
    // TEST 6: Tích điểm & Thăng Hạng Thành Viên
    // =======================================================
    console.log('⏳ KỊCH BẢN 6: Khách hàng mua hàng và thăng hạng thành viên (Loyalty Points)');
    
    // Giả lập Admin xác nhận giao hàng thành công (Logic trong admin.controller.js)
    // Hạng mặc định: Bronze (1x). Lên Silver cần 5.000.000đ (1.5x). Lên Gold cần 20.000.000đ (2x).
    
    const calcTier = (spent) => {
      if (spent >= 50000000) return 'platinum';
      if (spent >= 20000000) return 'gold';
      if (spent >= 5000000) return 'silver';
      return 'bronze';
    };
    const TIER_MULTIPLIER = { bronze: 1, silver: 1.5, gold: 2, platinum: 3 };

    let testPointUser = await User.create({ name: 'VIP', email: `vip_${Date.now()}@test.com`, password: '123' });
    
    const deliverOrder = async (orderTotal) => {
      // Logic tích điểm khi giao hàng thành công
      const userBefore = await User.findById(testPointUser._id).select('memberTier').lean();
      const multiplier = TIER_MULTIPLIER[userBefore?.memberTier || 'bronze'] ?? 1;
      const pointsEarned = Math.floor((orderTotal / 1000) * multiplier);
      
      const updatedUser = await User.findByIdAndUpdate(
        testPointUser._id,
        { $inc: { loyaltyPoints: pointsEarned, totalSpent: orderTotal } },
        { new: true }
      ).select('totalSpent memberTier loyaltyPoints');
      
      const newTier = calcTier(updatedUser.totalSpent);
      if (newTier !== updatedUser.memberTier) {
        await User.findByIdAndUpdate(testPointUser._id, { memberTier: newTier });
        updatedUser.memberTier = newTier; // sync local
      }
      return { orderTotal, pointsEarned, newTier: updatedUser.memberTier, totalSpent: updatedUser.totalSpent, totalPoints: updatedUser.loyaltyPoints };
    };

    console.log('--- Kết quả xử lý ---');
    // Mua Đơn 1: 5.000.000đ -> Hạng cũ Bronze (x1) -> Được 5000 điểm. Nâng cấp lên Silver.
    const res1 = await deliverOrder(5000000);
    console.log(`🛒 Đơn 1 (${res1.orderTotal.toLocaleString()}đ): +${res1.pointsEarned} điểm (Hệ số Bronze x1)`);
    console.log(`   👉 Hiện tại: Tổng chi tiêu ${res1.totalSpent.toLocaleString()}đ -> Hạng: ${res1.newTier.toUpperCase()}`);

    // Mua Đơn 2: 2.000.000đ -> Hạng cũ Silver (x1.5) -> Được 3000 điểm. Tổng: 8000.
    const res2 = await deliverOrder(2000000);
    console.log(`🛒 Đơn 2 (${res2.orderTotal.toLocaleString()}đ): +${res2.pointsEarned} điểm (Hệ số Silver x1.5)`);
    console.log(`   👉 Hiện tại: Tổng chi tiêu ${res2.totalSpent.toLocaleString()}đ -> Tổng điểm: ${res2.totalPoints}`);

    if (res1.pointsEarned === 5000 && res2.pointsEarned === 3000 && res1.newTier === 'silver') {
      console.log('🎉 KẾT QUẢ TEST 6: PASS - Tính điểm và thăng hạng chính xác!\n');
    } else {
      console.log('💥 KẾT QUẢ TEST 6: FAILED - Logic tính điểm sai lệch.\n');
    }

    // Dọn dẹp Test 6
    await Coupon.findByIdAndDelete(dummyCoupon._id);
    await User.deleteMany({ _id: { $in: [user1._id, user2._id, testPointUser._id] } });

    // =======================================================
    // TEST 7: Hủy Đơn Hàng & Hoàn Tiền (Cancel Auto-Refund Race Condition)
    // =======================================================
    console.log('⏳ KỊCH BẢN 7: 2 Khách hàng cùng lúc spam bấm "Hủy Đơn Hàng" đã thanh toán (Test Hoàn tiền kép)');
    
    // Tạo 1 User có ví rỗng
    const refundTestUser = await User.create({ name: 'Khách Hàng Hủy', email: `cancel_${Date.now()}@test.com`, password: '123', walletBalance: 0 });
    
    // Tạo 1 Đơn hàng ĐÃ THANH TOÁN trị giá 1.000.000đ
    const dummyOrder = await Order.create({
      orderCode: `ORD_${Date.now()}`,
      userId: refundTestUser._id,
      items: [],
      subtotal: 1000000,
      totalPrice: 1000000,
      paymentMethod: 'vnpay',
      paymentStatus: 'paid', // Đã thanh toán
      status: 'pending', // Có thể hủy
      shippingAddress: {
        fullName: 'Test User',
        phone: '0123456789',
        address: '123 Test',
        city: 'City',
        district: 'District'
      }
    });

    const cancelAndRefund = async (processName) => {
      // Giả lập logic trong cancelOrder của order.controller.js
      // 1. Khóa đơn hàng bằng Atomic Update
      const lockedOrder = await Order.findOneAndUpdate(
        { _id: dummyOrder._id, status: 'pending' },
        { status: 'cancelled' },
        { new: true }
      );

      if (!lockedOrder) {
        return `❌ [${processName}] Hủy thất bại: Đơn hàng không còn ở trạng thái Chờ xử lý!`;
      }

      // 2. Chỉ tiến trình nào khóa thành công mới được cộng tiền hoàn trả
      if (lockedOrder.paymentStatus === 'paid') {
        await User.findByIdAndUpdate(refundTestUser._id, { $inc: { walletBalance: lockedOrder.totalPrice } });
        return `✅ [${processName}] Hủy THÀNH CÔNG: Đã hoàn lại ${lockedOrder.totalPrice.toLocaleString()}đ vào ví!`;
      }
      return `✅ [${processName}] Hủy thành công nhưng không hoàn tiền vì chưa thanh toán.`;
    };

    // Spam 2 request Hủy đơn cùng 1 mili-giây
    const cancelResults = await Promise.all([
      cancelAndRefund('Request 1'),
      cancelAndRefund('Request 2')
    ]);

    const finalUserWallet = await User.findById(refundTestUser._id);
    console.log('--- Kết quả xử lý ---');
    console.log(cancelResults.join('\n'));
    console.log(`\n💰 Số dư ví khách hàng TRƯỚC HỦY: 0đ`);
    console.log(`💰 Số dư ví khách hàng SAU HỦY: ${finalUserWallet.walletBalance.toLocaleString()}đ`);
    
    if (finalUserWallet.walletBalance === 1000000) {
      console.log('🎉 KẾT QUẢ TEST 7: PASS - Chặn thành công lỗi Hoàn Tiền Kép. Khách chỉ nhận được đúng 1 triệu tiền hoàn.\n');
    } else {
      console.log(`💥 KẾT QUẢ TEST 7: FAILED - Hệ thống đã bị lạm dụng Hoàn Tiền!\n`);
    }

    // Dọn dẹp Test 7
    await Order.findByIdAndDelete(dummyOrder._id);
    await User.findByIdAndDelete(refundTestUser._id);

  } catch (error) {
    console.error('Lỗi khi chạy test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🏁 KẾT THÚC TEST.');
  }
};

runConcurrencyTest();
