const { FlashSale, Product, ProductVariant } = require('../models/index');
const { success, error, paginate } = require('../utils/response.utils');
const { computeCategorySalePrice } = require('../utils/flashsale.utils');

const now = () => new Date();

// GET /api/flash-sales — active variant flash sales for customers
const getActiveFlashSales = async (req, res, next) => {
  try {
    const sales = await FlashSale.find({
      type: 'variant',
      isActive: true,
      startTime: { $lte: now() },
      endTime:   { $gte: now() },
    })
      .populate('productId', 'name slug images')
      .populate('variantId', 'storage color colorHex price salePrice stock')
      .sort({ endTime: 1 })
      .lean();

    return success(res, { data: sales });
  } catch (err) { next(err); }
};

// GET /api/flash-sales/active-categories — category flash sales (for badge display on product lists)
const getActiveCategoryFlashSales = async (req, res, next) => {
  try {
    const sales = await FlashSale.find({
      type: 'category',
      isActive: true,
      startTime: { $lte: now() },
      endTime:   { $gte: now() },
    })
      .select('categoryId discountType discountValue name endTime sold quantity')
      .populate('categoryId', 'name_vi slug')
      .lean();
    return success(res, { data: sales });
  } catch (err) { next(err); }
};

// GET /api/flash-sales/variant/:variantId — check flash sale for a variant (variant-level first, then category fallback)
const getFlashSaleByVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const activeFilter = {
      isActive: true,
      startTime: { $lte: now() },
      endTime:   { $gte: now() },
    };

    // 1. Variant-level sale (existing behavior)
    const variantSale = await FlashSale.findOne({ type: 'variant', variantId, ...activeFilter }).lean();
    if (variantSale) return success(res, { data: variantSale });

    // 2. Category-level fallback
    const variant = await ProductVariant.findById(variantId).select('productId price salePrice').lean();
    if (!variant) return success(res, { data: null });

    const product = await Product.findById(variant.productId).select('categoryId').lean();
    if (!product?.categoryId) return success(res, { data: null });

    const catSale = await FlashSale.findOne({ type: 'category', categoryId: product.categoryId, ...activeFilter }).lean();
    if (!catSale) return success(res, { data: null });

    const basePrice = variant.price;
    const salePrice = computeCategorySalePrice(basePrice, catSale.discountType, catSale.discountValue);

    return success(res, {
      data: {
        ...catSale,
        originalPrice: basePrice,
        salePrice,
      },
    });
  } catch (err) { next(err); }
};

// ── ADMIN ──────────────────────────────────────────────────────────────────────

// GET /api/admin/flash-sales
const adminGetFlashSales = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [total, sales] = await Promise.all([
      FlashSale.countDocuments(),
      FlashSale.find()
        .populate('productId', 'name slug images')
        .populate('variantId', 'storage color price salePrice stock')
        .populate('categoryId', 'name_vi slug')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, sales, total, page, limit);
  } catch (err) { next(err); }
};

// POST /api/admin/flash-sales
const adminCreateFlashSale = async (req, res, next) => {
  try {
    const {
      type = 'variant',
      name,
      categoryId,
      productId, variantId, salePrice,
      quantity, limitPerUser,
      startTime, endTime,
      discountType = 'percent', discountValue,
    } = req.body;

    if (!name || !startTime || !endTime || !discountType || !discountValue)
      return error(res, 'Thiếu thông tin bắt buộc', 400);

    if (new Date(endTime) <= new Date(startTime))
      return error(res, 'Thời gian kết thúc phải sau thời gian bắt đầu', 400);

    if (type === 'category') {
      if (!categoryId) return error(res, 'Thiếu danh mục', 400);

      const overlapping = await FlashSale.findOne({
        type: 'category',
        categoryId,
        startTime: { $lt: new Date(endTime) },
        endTime:   { $gt: new Date(startTime) },
      });
      if (overlapping) return error(res, 'Danh mục này đã có flash sale trong khung giờ trùng lặp', 400);

      const sale = await FlashSale.create({
        type: 'category',
        name,
        categoryId,
        discountType,
        discountValue: Number(discountValue),
        quantity: quantity ? Number(quantity) : null,
        limitPerUser: Number(limitPerUser) || 1,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      });
      return success(res, { data: sale }, 'Đã tạo flash sale danh mục', 201);
    }

    // variant type — existing logic
    if (!name || !productId || !variantId || !salePrice || !quantity || !startTime || !endTime)
      return error(res, 'Thiếu thông tin bắt buộc', 400);

    const variant = await ProductVariant.findById(variantId).lean();
    if (!variant) return error(res, 'Không tìm thấy variant', 404);

    if (Number(salePrice) >= variant.price)
      return error(res, `Giá flash (${Number(salePrice).toLocaleString('vi-VN')}đ) phải thấp hơn giá gốc (${variant.price.toLocaleString('vi-VN')}đ)`, 400);
    if (Number(quantity) <= 0)
      return error(res, 'Số lượng phải lớn hơn 0', 400);
    if (Number(quantity) > variant.stock)
      return error(res, `Số lượng flash sale (${quantity}) không được vượt quá tồn kho hiện tại (${variant.stock})`, 400);

    const overlapping = await FlashSale.findOne({
      type: 'variant',
      variantId,
      startTime: { $lt: new Date(endTime) },
      endTime:   { $gt: new Date(startTime) },
    });
    if (overlapping) return error(res, 'Variant này đã có flash sale trong khung giờ trùng lặp', 400);

    const sale = await FlashSale.create({
      type: 'variant',
      name,
      productId,
      variantId,
      originalPrice: variant.price,
      salePrice: Number(salePrice),
      discountType,
      discountValue: discountValue !== undefined ? Number(discountValue) : undefined,
      quantity: Number(quantity),
      limitPerUser: Number(limitPerUser) || 1,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    return success(res, { data: sale }, 'Đã tạo flash sale', 201);
  } catch (err) { next(err); }
};

// PUT /api/admin/flash-sales/:id
const adminUpdateFlashSale = async (req, res, next) => {
  try {
    const { name, salePrice, quantity, limitPerUser, startTime, endTime, isActive, discountType, discountValue } = req.body;

    const sale = await FlashSale.findById(req.params.id);
    if (!sale) return error(res, 'Không tìm thấy flash sale', 404);

    const newStart = startTime ? new Date(startTime) : sale.startTime;
    const newEnd   = endTime   ? new Date(endTime)   : sale.endTime;

    if (startTime || endTime) {
      if (newStart >= newEnd)
        return error(res, 'Thời gian kết thúc phải sau thời gian bắt đầu', 400);

      const overlapping = await FlashSale.findOne({
        _id: { $ne: req.params.id },
        type: sale.type,
        ...(sale.type === 'variant' ? { variantId: sale.variantId } : { categoryId: sale.categoryId }),
        startTime: { $lt: newEnd },
        endTime:   { $gt: newStart },
      });
      if (overlapping) return error(res, `${sale.type === 'category' ? 'Danh mục' : 'Variant'} này đã có flash sale trong khung giờ trùng lặp`, 400);
    }

    if (sale.type === 'variant') {
      if (salePrice !== undefined && Number(salePrice) >= sale.originalPrice)
        return error(res, `Giá flash phải thấp hơn giá gốc (${sale.originalPrice.toLocaleString('vi-VN')}đ)`, 400);

      if (quantity !== undefined) {
        const variant = await ProductVariant.findById(sale.variantId).lean();
        if (variant && Number(quantity) > variant.stock)
          return error(res, `Số lượng flash sale (${quantity}) không được vượt quá tồn kho hiện tại (${variant.stock})`, 400);
      }
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (salePrice !== undefined && sale.type === 'variant') update.salePrice = Number(salePrice);
    if (quantity !== undefined) update.quantity = quantity === '' || quantity === null ? null : Number(quantity);
    if (limitPerUser !== undefined) update.limitPerUser = Number(limitPerUser);
    if (startTime !== undefined) update.startTime = new Date(startTime);
    if (endTime !== undefined) update.endTime = new Date(endTime);
    if (isActive !== undefined) update.isActive = isActive;
    if (discountType !== undefined) update.discountType = discountType;
    if (discountValue !== undefined) update.discountValue = Number(discountValue);

    const updated = await FlashSale.findByIdAndUpdate(req.params.id, update, { new: true });
    return success(res, { data: updated }, 'Đã cập nhật flash sale');
  } catch (err) { next(err); }
};

// DELETE /api/admin/flash-sales/:id
const adminDeleteFlashSale = async (req, res, next) => {
  try {
    const sale = await FlashSale.findByIdAndDelete(req.params.id);
    if (!sale) return error(res, 'Không tìm thấy flash sale', 404);
    return success(res, {}, 'Đã xóa flash sale');
  } catch (err) { next(err); }
};

module.exports = {
  getActiveFlashSales,
  getActiveCategoryFlashSales,
  getFlashSaleByVariant,
  adminGetFlashSales,
  adminCreateFlashSale,
  adminUpdateFlashSale,
  adminDeleteFlashSale,
  computeCategorySalePrice,
};
