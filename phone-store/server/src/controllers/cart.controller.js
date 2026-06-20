const { Cart, ProductVariant } = require('../models/index');
const { success, error } = require('../utils/response.utils');

const HOLD_DURATION_MS = 15 * 60 * 1000; // 15 phút

// "Giữ hàng" (holdStock) trừ THẬT vào ProductVariant.stock (atomic) ngay khi giữ —
// không còn là khóa ảo tính qua tổng holdQuantity. Vì vậy variant.stock luôn phản
// ánh đúng số lượng còn thực sự khả dụng cho người khác, không cần trừ thêm gì nữa.
const getAvailableStock = async (variantId) => {
  const variant = await ProductVariant.findById(variantId).lean();
  return variant ? variant.stock : 0;
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

const isActivelyHeld = (item) => item.holdExpiry && new Date(item.holdExpiry) > new Date();

// Hoàn lại stock thật cho các item đang giữ hàng còn hiệu lực (chưa hết hạn) trước khi
// xóa/sửa khỏi giỏ — vì stock đã bị trừ thật lúc hold, nếu không hoàn sẽ "mất" hàng vĩnh viễn.
const restoreHeldStock = async (items) => {
  const held = items.filter(isActivelyHeld);
  if (!held.length) return;
  await Promise.allSettled(
    held.map((i) => ProductVariant.findByIdAndUpdate(i.variantId, { $inc: { stock: i.quantity } }))
  );
};

// POST /api/cart/items
const addItem = async (req, res, next) => {
  try {
    const { variantId, quantity = 1 } = req.body;

    const variant = await ProductVariant.findById(variantId).populate('productId', 'name slug isActive status');
    if (!variant || !variant.isActive) return error(res, 'Sản phẩm không tồn tại', 404);
    if (variant.productId?.status === 'discontinued') return error(res, 'Sản phẩm đã ngừng kinh doanh', 400);

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

    const existingIdx = cart.items.findIndex((i) => i.variantId.toString() === variantId);
    if (existingIdx >= 0) {
      const existing = cart.items[existingIdx];
      if (isActivelyHeld(existing)) {
        return error(res, 'Sản phẩm đang được giữ để thanh toán, vui lòng hoàn tất hoặc hủy thanh toán trước khi sửa giỏ hàng', 400);
      }
      const available = await getAvailableStock(variantId);
      const newQty = existing.quantity + quantity;
      if (newQty > available) return error(res, `Chỉ còn ${available} sản phẩm trong kho`, 400);
      existing.quantity = newQty;
      existing.price = variant.salePrice || variant.price;
    } else {
      const available = await getAvailableStock(variantId);
      if (available < quantity) return error(res, 'Không đủ hàng trong kho', 400);
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

    const item = cart.items.find((i) => i.variantId.toString() === variantId);
    if (!item) return error(res, 'Sản phẩm không có trong giỏ', 404);
    if (isActivelyHeld(item)) {
      return error(res, 'Sản phẩm đang được giữ để thanh toán, vui lòng hoàn tất hoặc hủy thanh toán trước khi sửa giỏ hàng', 400);
    }

    if (quantity === 0) {
      cart.items = cart.items.filter((i) => i.variantId.toString() !== variantId);
    } else {
      if (quantity < 1) return error(res, 'Số lượng không hợp lệ', 400);
      const available = await getAvailableStock(variantId);
      if (quantity > available) return error(res, `Chỉ còn ${available} sản phẩm`, 400);
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

    const target = cart.items.find((i) => i.variantId.toString() === req.params.variantId);
    if (target) await restoreHeldStock([target]);

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
    const cart = await Cart.findOne({ userId: req.user._id });
    if (cart?.items?.length) await restoreHeldStock(cart.items);

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

    // Bỏ qua item đã đang giữ hàng còn hiệu lực — tránh trừ kho 2 lần nếu user gọi
    // /cart/hold nhiều lần (vd refresh trang, retry sau lỗi mạng) cho cùng 1 item.
    const needHold = itemsToHold.filter((i) => !isActivelyHeld(i));

    // Trừ THẬT vào kho — atomic per-item, có rollback nếu giữa đường thiếu hàng.
    // Đây là điểm mấu chốt chống race condition: 2 request /cart/hold cùng lúc cho
    // cùng 1 sản phẩm sẽ không thể cùng "pass" vì $gte là điều kiện atomic ở tầng DB,
    // không phải kiểm tra rồi mới ghi (check-then-act) như cách cũ.
    const reservations = [];
    for (const item of needHold) {
      const updated = await ProductVariant.findOneAndUpdate(
        { _id: item.variantId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        // Rollback các item đã trừ thành công trong batch này trước khi báo lỗi
        await Promise.allSettled(
          reservations.map((r) => ProductVariant.findByIdAndUpdate(r.variantId, { $inc: { stock: r.quantity } }))
        );
        const variant = await ProductVariant.findById(item.variantId).populate('productId', 'name').lean();
        const fresh = await ProductVariant.findById(item.variantId).select('stock').lean();
        return res.status(400).json({
          success: false,
          message: 'Một số sản phẩm không đủ hàng',
          failures: [{
            variantId: item.variantId,
            name: variant?.productId?.name,
            available: fresh?.stock ?? 0,
            requested: item.quantity,
          }],
        });
      }
      reservations.push({ variantId: item.variantId, quantity: item.quantity });
    }

    // Đặt/refresh holdExpiry cho toàn bộ items được chọn (gồm cả item đã hold từ trước)
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

// POST /api/cart/release — giải phóng hold sớm (hủy checkout) — phải hoàn lại đúng
// số lượng đã trừ thật lúc hold, không chỉ unset cờ holdExpiry như trước.
const releaseHold = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (cart?.items?.length) await restoreHeldStock(cart.items);

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
