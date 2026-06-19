const { Cart, ProductVariant } = require('../models/index');
const { success, error } = require('../utils/response.utils');

const HOLD_DURATION_MS = 15 * 60 * 1000; // 15 phút

// Tính stock thực tế = stock - tổng holdQuantity chưa hết hạn từ cart khác
const getAvailableStock = async (variantId, excludeUserId = null) => {
  const variant = await ProductVariant.findById(variantId).lean();
  if (!variant) return 0;

  const now = new Date();
  const heldCarts = await Cart.find({
    'items.variantId': variantId,
    'items.holdExpiry': { $gt: now },
    ...(excludeUserId ? { userId: { $ne: excludeUserId } } : {}),
  }).lean();

  let totalHeld = 0;
  heldCarts.forEach((cart) => {
    cart.items.forEach((item) => {
      if (item.variantId.toString() === variantId.toString() && item.holdExpiry > now) {
        totalHeld += item.quantity;
      }
    });
  });

  return variant.stock - totalHeld;
};

// GET /api/cart
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id })
      .populate({ path: 'items.productId', select: 'name slug images badge' })
      .populate({ path: 'items.variantId', select: 'color storage price salePrice stock images' })
      .lean();

    if (!cart) return success(res, { data: { items: [], total: 0 } });

    const items = cart.items.map((item) => ({
      ...item,
      effectivePrice: item.variantId?.salePrice || item.variantId?.price || item.price,
      isHoldExpired: item.holdExpiry ? item.holdExpiry < new Date() : true,
    }));

    const total = items.reduce((sum, i) => sum + (i.effectivePrice || i.price) * i.quantity, 0);
    return success(res, { data: { ...cart, items, total } });
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/items
const addItem = async (req, res, next) => {
  try {
    const { variantId, quantity = 1 } = req.body;

    const variant = await ProductVariant.findById(variantId).populate('productId', 'name slug isActive status');
    if (!variant || !variant.isActive) return error(res, 'Sản phẩm không tồn tại', 404);
    if (variant.productId?.status === 'discontinued') return error(res, 'Sản phẩm đã ngừng kinh doanh', 400);

    const available = await getAvailableStock(variantId, req.user._id);
    if (available < quantity) return error(res, 'Không đủ hàng trong kho', 400);

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

    const existingIdx = cart.items.findIndex((i) => i.variantId.toString() === variantId);
    if (existingIdx >= 0) {
      const newQty = cart.items[existingIdx].quantity + quantity;
      if (newQty > available) return error(res, `Chỉ còn ${available} sản phẩm trong kho`, 400);
      cart.items[existingIdx].quantity = newQty;
      cart.items[existingIdx].price = variant.salePrice || variant.price;
    } else {
      cart.items.push({
        variantId,
        productId: variant.productId._id,
        quantity,
        price: variant.salePrice || variant.price,
      });
    }

    await cart.save();
    return success(res, {}, 'Đã thêm vào giỏ hàng', 201);
  } catch (err) {
    next(err);
  }
};

// PUT /api/cart/items/:variantId
const updateItem = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return error(res, 'Giỏ hàng trống', 404);

    if (quantity === 0) {
      cart.items = cart.items.filter((i) => i.variantId.toString() !== variantId);
    } else {
      if (quantity < 1) return error(res, 'Số lượng không hợp lệ', 400);
      const available = await getAvailableStock(variantId, req.user._id);
      if (quantity > available) return error(res, `Chỉ còn ${available} sản phẩm`, 400);

      const item = cart.items.find((i) => i.variantId.toString() === variantId);
      if (!item) return error(res, 'Sản phẩm không có trong giỏ', 404);
      item.quantity = quantity;
    }

    await cart.save();
    return success(res, {}, 'Đã cập nhật giỏ hàng');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart/items/:variantId
const removeItem = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return error(res, 'Giỏ hàng trống', 404);

    cart.items = cart.items.filter((i) => i.variantId.toString() !== req.params.variantId);
    await cart.save();
    return success(res, {}, 'Đã xóa sản phẩm khỏi giỏ');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart
const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [], couponCode: null, discountAmount: 0 });
    return success(res, {}, 'Đã xóa giỏ hàng');
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/hold  — giữ hàng khi bắt đầu checkout
const holdStock = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || !cart.items.length) return error(res, 'Giỏ hàng trống', 400);

    const { variantIds } = req.body;
    // Nếu có variantIds, chỉ hold những items được chọn (partial checkout)
    const itemsToHold = variantIds?.length
      ? cart.items.filter((i) => variantIds.includes(i.variantId.toString()))
      : cart.items;

    if (!itemsToHold.length) return error(res, 'Không có sản phẩm nào được chọn', 400);

    const holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
    const failures = [];

    // Kiểm tra stock trước khi hold
    for (const item of itemsToHold) {
      const available = await getAvailableStock(item.variantId.toString(), req.user._id);
      if (available < item.quantity) {
        const variant = await ProductVariant.findById(item.variantId)
          .populate('productId', 'name').lean();
        failures.push({
          variantId: item.variantId,
          name: variant?.productId?.name,
          available,
          requested: item.quantity,
        });
      }
    }

    if (failures.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Một số sản phẩm không đủ hàng',
        failures,
      });
    }

    // Chỉ đặt holdExpiry cho các items được chọn
    const holdSet = new Set(itemsToHold.map((i) => i.variantId.toString()));
    cart.items.forEach((item) => {
      if (holdSet.has(item.variantId.toString())) {
        item.holdExpiry = holdExpiry;
      }
    });
    await cart.save();

    return success(res, { data: { holdExpiry } }, 'Đã giữ hàng thành công, thanh toán trong 15 phút');
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/release — giải phóng hold sớm (hủy checkout)
const releaseHold = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { $unset: { 'items.$[].holdExpiry': '' } }
    );
    return success(res, {}, 'Đã giải phóng giữ hàng');
  } catch (err) {
    next(err);
  }
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, holdStock, releaseHold };
