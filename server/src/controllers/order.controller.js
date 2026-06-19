const { Order, Cart, Product, ProductVariant, StockLog, User, WalletTransaction, Coupon, FlashSale } = require('../models/index');
const { success, error } = require('../utils/response.utils');
const { computeCategorySalePrice } = require('../utils/flashsale.utils');

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

// POST /api/orders
const createOrder = async (req, res, next) => {
  // Khai báo ngoài try để catch block có thể rollback đầy đủ
  let paymentMethod = 'cod';
  let flashSaleReservations = [];
  let stockReservations = [];
  let walletBalanceAfter = null;
  let totalPrice = 0;
  let couponDoc = null;
  let couponReserved = false;
  let order = null;

  try {
    const { shippingAddress, note, couponCode, selectedVariantIds } = req.body;
    paymentMethod = req.body.paymentMethod || 'cod';

    // 1. Load + validate cart
    const cart = await Cart.findOne({ userId: req.user._id })
      .populate('items.variantId', 'color storage stock price salePrice')
      .populate('items.productId', 'name images isActive categoryId brandId');

    if (!cart || !cart.items.length) return error(res, 'Giỏ hàng trống', 400);

    const allCartItems = cart.items;
    const orderableItems = selectedVariantIds?.length
      ? allCartItems.filter(i => selectedVariantIds.includes(i.variantId._id.toString()))
      : allCartItems;
    if (!orderableItems.length) return error(res, 'Không có sản phẩm nào được chọn', 400);

    // Kiểm tra holdExpiry — đảm bảo giữ hàng còn hạn
    const now = new Date();
    const expiredHolds = orderableItems.filter(
      (i) => i.holdExpiry && new Date(i.holdExpiry) < now
    );
    if (expiredHolds.length) {
      return error(res, 'Thời gian giữ hàng đã hết, vui lòng cập nhật giỏ hàng và thử lại', 400);
    }

    const stockErrors = [];
    for (const item of orderableItems) {
      const variant = item.variantId;
      const product = item.productId;
      if (!variant || !product || !product.isActive) {
        stockErrors.push(`Sản phẩm "${product?.name || 'không xác định'}" không còn tồn tại`);
        continue;
      }
      if (variant.stock < item.quantity) {
        stockErrors.push(`"${product.name}" chỉ còn ${variant.stock} sản phẩm`);
      }
    }
    if (stockErrors.length) {
      return res.status(400).json({ success: false, message: stockErrors[0], errors: stockErrors });
    }

    // 1b. Load coupon sớm để validate brand/category trước khi reserve flash sales
    if (couponCode) {
      couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    }

    // 2. Reserve flash sales — atomic check+increment để tránh race condition
    const flashSaleByVariant = {};
    for (const item of orderableItems) {
      // Variant-level flash sale (backward compat: type may not exist on old docs)
      let activeFlashSale = await FlashSale.findOne({
        type: { $ne: 'category' },
        variantId: item.variantId._id,
        isActive: true,
        startTime: { $lte: now },
        endTime:   { $gte: now },
      });

      if (!activeFlashSale) {
        // Category-level flash sale fallback
        const categoryId = item.productId.categoryId;
        if (categoryId) {
          const catSale = await FlashSale.findOne({
            type: 'category',
            categoryId,
            isActive: true,
            startTime: { $lte: now },
            endTime:   { $gte: now },
          });
          if (catSale) {
            const basePrice = item.variantId.price;
            const salePrice = computeCategorySalePrice(basePrice, catSale.discountType, catSale.discountValue);
            activeFlashSale = { ...catSale.toObject(), salePrice, originalPrice: basePrice };
          }
        }
      }

      if (!activeFlashSale) continue;
      flashSaleByVariant[item.variantId._id.toString()] = activeFlashSale;

      // Kiểm tra giới hạn mua theo user
      if (activeFlashSale.limitPerUser > 0) {
        let alreadyQty = 0;
        if (activeFlashSale.type === 'category') {
          const agg = await Order.aggregate([
            { $match: {
                userId: req.user._id,
                status: { $nin: ['cancelled'] },
                createdAt: { $gte: activeFlashSale.startTime, $lte: activeFlashSale.endTime },
            }},
            { $unwind: '$items' },
            { $match: { 'items.flashSaleId': activeFlashSale._id } },
            { $group: { _id: null, totalQty: { $sum: '$items.quantity' } } },
          ]);
          alreadyQty = agg[0]?.totalQty || 0;
        } else {
          const agg = await Order.aggregate([
            { $match: { userId: req.user._id, status: { $nin: ['cancelled'] }, 'items.flashSaleId': activeFlashSale._id } },
            { $unwind: '$items' },
            { $match: { 'items.flashSaleId': activeFlashSale._id } },
            { $group: { _id: null, totalQty: { $sum: '$items.quantity' } } },
          ]);
          alreadyQty = agg[0]?.totalQty || 0;
        }
        if (alreadyQty + item.quantity > activeFlashSale.limitPerUser) {
          await Promise.allSettled(flashSaleReservations.map((r) =>
            FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
          ));
          return error(res, `Bạn đã đạt giới hạn mua flash sale cho "${item.productId.name}"`, 400);
        }
      }

      // Atomic check + increment sold
      if (activeFlashSale.quantity !== null) {
        // Limited quantity: atomic guard chống oversell
        const reserved = await FlashSale.findOneAndUpdate(
          { _id: activeFlashSale._id, $expr: { $lte: [{ $add: ['$sold', item.quantity] }, '$quantity'] } },
          { $inc: { sold: item.quantity } },
          { new: true }
        );
        if (!reserved) {
          await Promise.allSettled(flashSaleReservations.map((r) =>
            FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
          ));
          return error(res, `Flash sale cho "${item.productId.name}" đã hết số lượng`, 400);
        }
      } else {
        // Unlimited quantity: chỉ tăng sold để tracking
        await FlashSale.findByIdAndUpdate(activeFlashSale._id, { $inc: { sold: item.quantity } });
      }
      flashSaleReservations.push({ id: activeFlashSale._id, quantity: item.quantity });
    }

    // 3. Recompute giá — dùng flash sale đã cache, không query lại DB
    for (const item of orderableItems) {
      const variant = item.variantId;
      const cachedFlashSale = flashSaleByVariant[variant._id.toString()];
      item.price = cachedFlashSale
        ? cachedFlashSale.salePrice
        : (variant.salePrice || variant.price);
    }
    const subtotal = orderableItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shippingFee = subtotal >= 5000000 ? 0 : 30000;

    // 4. Coupon validation — atomic reserve để tránh race condition usageLimit + userUsageLimit
    let discountAmount = 0;
    if (couponDoc) {
      const nowMs = Date.now();
      const dateValid = nowMs >= couponDoc.startDate.getTime() && nowMs <= couponDoc.endDate.getTime();
      const minValid = subtotal >= (couponDoc.minOrderValue || 0);

      if (dateValid && minValid) {
        // Kiểm tra coupon giới hạn danh mục sản phẩm
        if (couponDoc.applicableCategories?.length > 0) {
          const itemCatIds = orderableItems
            .map(i => i.productId.categoryId?.toString())
            .filter(Boolean);
          const couponCatIds = couponDoc.applicableCategories.map(id => id.toString());
          if (!itemCatIds.some(id => couponCatIds.includes(id))) {
            await Promise.allSettled(flashSaleReservations.map(r =>
              FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
            ));
            return error(res, 'Mã giảm giá không áp dụng cho danh mục sản phẩm trong đơn này', 400);
          }
        }

        // Kiểm tra coupon giới hạn thương hiệu sản phẩm
        if (couponDoc.applicableBrands?.length > 0) {
          const itemBrandIds = orderableItems
            .map(i => i.productId.brandId?.toString())
            .filter(Boolean);
          const couponBrandIds = couponDoc.applicableBrands.map(id => id.toString());
          if (!itemBrandIds.some(id => couponBrandIds.includes(id))) {
            await Promise.allSettled(flashSaleReservations.map(r =>
              FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
            ));
            return error(res, 'Mã giảm giá không áp dụng cho thương hiệu sản phẩm trong đơn này', 400);
          }
        }

        // Atomic check + reserve coupon: gộp cả usageLimit lẫn userUsageLimit vào một operation
        // → chống race condition khi 2 request cùng dùng coupon còn 1 lượt
        const atomicExprs = [];
        if (couponDoc.usageLimit) {
          atomicExprs.push({ $lt: ['$usedCount', couponDoc.usageLimit] });
        }
        if (couponDoc.userUsageLimit > 0) {
          atomicExprs.push({
            $lt: [
              { $size: { $filter: { input: '$usedBy', as: 'u', cond: { $eq: ['$$u', req.user._id] } } } },
              couponDoc.userUsageLimit,
            ],
          });
        }
        const atomicFilter = { _id: couponDoc._id };
        if (atomicExprs.length === 1) atomicFilter.$expr = atomicExprs[0];
        else if (atomicExprs.length > 1) atomicFilter.$expr = { $and: atomicExprs };

        const reservedCoupon = await Coupon.findOneAndUpdate(
          atomicFilter,
          { $inc: { usedCount: 1 }, $push: { usedBy: req.user._id } }
        );

        if (!reservedCoupon) {
          await Promise.allSettled(flashSaleReservations.map(r =>
            FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
          ));
          // Xác định thông báo lỗi phù hợp
          const fresh = await Coupon.findById(couponDoc._id).lean();
          const userQty = (fresh?.usedBy || []).filter(
            id => id.toString() === req.user._id.toString()
          ).length;
          const msg = couponDoc.userUsageLimit > 0 && userQty >= couponDoc.userUsageLimit
            ? 'Bạn đã đạt giới hạn sử dụng mã này'
            : 'Mã giảm giá đã hết lượt sử dụng';
          return error(res, msg, 400);
        }
        couponReserved = true;

        discountAmount = couponDoc.type === 'percent'
          ? Math.round(subtotal * couponDoc.value / 100)
          : couponDoc.value;
        if (couponDoc.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, couponDoc.maxDiscountAmount);
        }
      }
    }

    totalPrice = Math.max(0, subtotal + shippingFee - discountAmount);

    // 5. Trừ ví TRƯỚC khi tạo order (atomic để tránh race condition số dư)
    if (paymentMethod === 'wallet') {
      const updatedUser = await User.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: totalPrice } },
        { $inc: { walletBalance: -totalPrice } },
        { new: true }
      ).select('walletBalance');
      if (!updatedUser) {
        // Rollback flash sales + coupon trước khi trả lỗi
        await Promise.allSettled(flashSaleReservations.map(r =>
          FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
        ));
        if (couponReserved) {
          await Coupon.findByIdAndUpdate(couponDoc._id, {
            $inc: { usedCount: -1 }, $pull: { usedBy: req.user._id },
          }).catch(() => {});
        }
        return error(res,
          `Số dư ví không đủ. Cần thanh toán: ${totalPrice.toLocaleString('vi-VN')}đ`,
          400);
      }
      walletBalanceAfter = updatedUser.walletBalance;
    }

    // 6. Tạo order
    const orderItems = orderableItems.map((i) => ({
      productId: i.productId._id,
      variantId: i.variantId._id,
      name: i.productId.name,
      image: i.productId.images?.[0] || '',
      color: i.variantId.color,
      storage: i.variantId.storage,
      price: i.price,
      quantity: i.quantity,
      flashSaleId: flashSaleByVariant[i.variantId._id.toString()]?._id || null,
    }));

    const deliveryDaysMap = { GHN: 3, GHTK: 5, ViettelPost: 5, store_pickup: 0 };
    const partner = req.body.shippingPartner || 'GHN';
    const deliveryDays = deliveryDaysMap[partner] ?? 4;
    const estimatedDeliveryDate = deliveryDays === 0 ? null : addBusinessDays(new Date(), deliveryDays);

    order = await Order.create({
      userId: req.user._id,
      items: orderItems,
      shippingAddress,
      shippingPartner: partner,
      paymentMethod,
      paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending',
      subtotal,
      shippingFee,
      discountAmount,
      totalPrice,
      couponCode: couponDoc && couponReserved ? couponDoc.code : undefined,
      note,
      estimatedDeliveryDate,
    });

    // 7. Ghi WalletTransaction (sau khi có order._id)
    if (walletBalanceAfter !== null) {
      await WalletTransaction.create({
        userId: req.user._id,
        type: 'payment',
        amount: -totalPrice,
        balanceAfter: walletBalanceAfter,
        orderId: order._id,
        description: `Thanh toán đơn ${order.orderCode}`,
      });
    }

    // 8a. Trừ stock — atomic guard (stock >= quantity) để chống bán âm kho khi
    // nhiều đơn cùng chốt 1 variant gần hết hàng (tương tự pattern flash sale/coupon
    // ở bước 2 & 4). Nếu 1 item không đủ hàng, throw để catch block rollback toàn bộ
    // (bao gồm cả các item đã trừ thành công trong vòng for này — xem stockReservations).
    for (const item of orderableItems) {
      const updated = await ProductVariant.findOneAndUpdate(
        { _id: item.variantId._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: false } // trả về doc TRƯỚC khi trừ để có stockBefore cho StockLog
      );
      if (!updated) {
        throw Object.assign(
          new Error(`"${item.productId.name}" không đủ hàng trong kho`),
          { statusCode: 400 }
        );
      }
      stockReservations.push({
        variantId: item.variantId._id,
        productId: item.productId._id,
        quantity: item.quantity,
        stockBefore: updated.stock,
      });
    }

    // 8b. Side effects còn lại song song: StockLog, tăng sold, xóa cart.
    // Coupon đã được increment atomic ở bước 4 — không update lại ở đây.
    await Promise.all([
      ...stockReservations.map((r) =>
        StockLog.create({
          variantId: r.variantId,
          productId: r.productId,
          type: 'sell',
          quantity: r.quantity,
          stockBefore: r.stockBefore,
          stockAfter: r.stockBefore - r.quantity,
          note: `Đơn hàng ${order.orderCode}`,
          orderId: order._id,
        })
      ),
      ...orderableItems.map((item) =>
        Product.findByIdAndUpdate(item.productId._id, { $inc: { sold: item.quantity } })
      ),
      Cart.findByIdAndUpdate(cart._id, {
        $pull: { items: { variantId: { $in: orderableItems.map(i => i.variantId._id) } } },
        $set: { discountAmount: 0, couponCode: null },
      }),
    ]);

    return success(res, { data: order }, 'Đặt hàng thành công', 201);
  } catch (err) {
    // Rollback stock đã trừ (nếu 1 item giữa đường không đủ hàng hoặc side-effect sau đó lỗi)
    if (stockReservations?.length) {
      await Promise.allSettled(
        stockReservations.map((r) =>
          ProductVariant.findByIdAndUpdate(r.variantId, { $inc: { stock: r.quantity } })
        )
      );
    }
    // Rollback flash sale reservations
    if (flashSaleReservations?.length) {
      await Promise.allSettled(
        flashSaleReservations.map((r) =>
          FlashSale.findByIdAndUpdate(r.id, { $inc: { sold: -r.quantity } })
        )
      );
    }
    // Rollback coupon nếu đã reserve atomic — chỉ xóa 1 occurrence
    if (couponReserved && couponDoc) {
      await Coupon.findOneAndUpdate(
        { _id: couponDoc._id, usedCount: { $gt: 0 } },
        [{ $set: {
          usedCount: { $subtract: ['$usedCount', 1] },
          usedBy: {
            $let: {
              vars: { pos: { $indexOfArray: ['$usedBy', req.user._id] } },
              in: {
                $cond: [
                  { $eq: ['$$pos', -1] },
                  '$usedBy',
                  { $concatArrays: [
                    { $slice: ['$usedBy', '$$pos'] },
                    { $slice: ['$usedBy', { $add: ['$$pos', 1] }, { $size: '$usedBy' }] },
                  ]},
                ],
              },
            },
          },
        }}]
      ).catch(() => {});
    }
    // Rollback ví nếu đã trừ tiền
    if (paymentMethod === 'wallet' && walletBalanceAfter !== null) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: totalPrice } }).catch(() => {});
    }
    // Nếu order đã tạo nhưng side effects thất bại → huỷ order để tránh trạng thái không nhất quán
    if (order) {
      await Order.findByIdAndUpdate(order._id, {
        status: 'cancelled',
        cancelReason: 'Lỗi hệ thống khi xử lý đơn hàng',
      }).catch(() => {});
    }
    next(err);
  }
};

// GET /api/orders
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);
    return success(res, { data: order });
  } catch (err) {
    next(err);
  }
};

// PUT /api/orders/:id/cancel
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);
    if (!['pending', 'confirmed'].includes(order.status)) {
      return error(res, 'Không thể hủy đơn hàng ở trạng thái này', 400);
    }

    order.status = 'cancelled';
    order.cancelReason = req.body.reason || 'Khách hàng hủy';

    // Nếu đã thanh toán bằng ví → hoàn tiền vào ví ngay
    if (order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
      const updatedUser = await User.findByIdAndUpdate(
        order.userId,
        { $inc: { walletBalance: order.totalPrice } },
        { new: true }
      ).select('walletBalance');
      await WalletTransaction.create({
        userId: order.userId,
        type: 'refund',
        amount: order.totalPrice,
        balanceAfter: updatedUser.walletBalance,
        orderId: order._id,
        description: `Hoàn tiền hủy đơn ${order.orderCode}`,
      });
      order.paymentStatus = 'refunded';
    }

    await order.save();

    // Hoàn usedCount + xóa 1 occurrence userId khỏi usedBy (tránh xóa toàn bộ khi userUsageLimit > 1)
    if (order.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: order.couponCode, usedCount: { $gt: 0 } },
        [{ $set: {
          usedCount: { $subtract: ['$usedCount', 1] },
          usedBy: {
            $let: {
              vars: { pos: { $indexOfArray: ['$usedBy', order.userId] } },
              in: {
                $cond: [
                  { $eq: ['$$pos', -1] },
                  '$usedBy',
                  { $concatArrays: [
                    { $slice: ['$usedBy', '$$pos'] },
                    { $slice: ['$usedBy', { $add: ['$$pos', 1] }, { $size: '$usedBy' }] },
                  ]},
                ],
              },
            },
          },
        }}]
      );
    }

    // Hoàn stock + giảm sold + ghi log song song
    const cancelSnapMap = {};
    const cancelSnaps = await ProductVariant.find(
      { _id: { $in: order.items.map((i) => i.variantId) } },
      { stock: 1 }
    ).lean();
    cancelSnaps.forEach((s) => { cancelSnapMap[s._id.toString()] = s.stock; });

    await Promise.all([
      ...order.items.map((item) =>
        ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } })
      ),
      ...order.items.map((item) =>
        Product.findByIdAndUpdate(item.productId, { $inc: { sold: -item.quantity } })
      ),
      // Unified rollback: ưu tiên flashSaleId (cả variant lẫn category), fallback về variantId cho đơn cũ
      ...order.items.map((item) => {
        if (item.flashSaleId) {
          return FlashSale.findOneAndUpdate(
            { _id: item.flashSaleId, isActive: true, $expr: { $gte: ['$sold', item.quantity] } },
            { $inc: { sold: -item.quantity } }
          );
        }
        // Fallback cho đơn hàng cũ không có flashSaleId
        return FlashSale.findOneAndUpdate(
          { type: { $ne: 'category' }, variantId: item.variantId, isActive: true, $expr: { $gte: ['$sold', item.quantity] } },
          { $inc: { sold: -item.quantity } }
        );
      }),
      ...order.items.map((item) => {
        const before = cancelSnapMap[item.variantId.toString()] ?? null;
        return StockLog.create({
          variantId: item.variantId,
          productId: item.productId,
          type: 'return',
          quantity: item.quantity,
          stockBefore: before,
          stockAfter: before !== null ? before + item.quantity : null,
          note: `Hủy đơn ${order.orderCode}`,
          orderId: order._id,
        });
      }),
    ]);

    return success(res, { data: order }, 'Đã hủy đơn hàng');
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, cancelOrder };
