const { User, Product, ProductVariant, StockLog, Order, Brand, Category, Coupon, Review, ReturnRequest, Payment, WalletTransaction, TopupRequest, WithdrawalRequest, Cart, Wishlist } = require('../models/index');
const { success, error, paginate } = require('../utils/response.utils');
const { createNotification } = require('./notification.controller');
const { updateProductRating } = require('./review.controller');
const { getCheapestVariantMap, attachCheapestVariant } = require('../utils/variant.utils');
const { escapeRegex } = require('../utils/regex.utils');

const slugify = (str) => str
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers, totalProducts, totalOrders,
      monthOrders, lastMonthOrders,
      pendingOrders, recentOrders,
      topProducts,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ status: 'pending' }),
      Order.find().sort({ createdAt: -1 }).limit(5).lean(),
      Product.find({ isActive: true }).sort({ sold: -1 }).limit(5).select('name images sold rating').lean(),
    ]);

    const thisMonth = monthOrders[0] || { revenue: 0, count: 0 };
    const lastMonth = lastMonthOrders[0] || { revenue: 0, count: 0 };
    const revenueGrowth = lastMonth.revenue
      ? Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100)
      : 0;

    // Doanh thu 7 ngày gần nhất
    const last7Days = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return success(res, {
      data: {
        stats: { totalUsers, totalProducts, totalOrders, pendingOrders },
        thisMonth: { revenue: thisMonth.revenue, orders: thisMonth.count },
        lastMonth: { revenue: lastMonth.revenue, orders: lastMonth.count },
        revenueGrowth,
        last7Days,
        recentOrders,
        topProducts,
      },
    });
  } catch (err) { next(err); }
};

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, brand, status } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
    if (brand) filter.brandId = brand;
    if (status) filter.status = status;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('brandId', 'name')
        .populate('categoryId', 'name_vi')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);

    const ids = products.map((p) => p._id);
    const variants = await ProductVariant.find({ productId: { $in: ids } }).lean();
    const variantsByProduct = {};
    variants.forEach((v) => {
      if (!variantsByProduct[v.productId]) variantsByProduct[v.productId] = [];
      variantsByProduct[v.productId].push(v);
    });

    const result = products.map((p) => ({
      ...p,
      variants: variantsByProduct[p._id.toString()] || [],
      totalStock: (variantsByProduct[p._id.toString()] || []).reduce((s, v) => s + v.stock, 0),
    }));

    return paginate(res, result, total, page, limit);
  } catch (err) { next(err); }
};

const createProduct = async (req, res, next) => {
  try {
    const { variants, ...productData } = req.body;
    const [brandExists, catExists] = await Promise.all([
      Brand.exists({ _id: productData.brandId }),
      Category.exists({ _id: productData.categoryId }),
    ]);
    if (!brandExists) return error(res, 'Thương hiệu không tồn tại', 400);
    if (!catExists) return error(res, 'Danh mục không tồn tại', 400);
    const product = await Product.create(productData);
    if (variants?.length) {
      await ProductVariant.insertMany(variants.map((v) => ({ ...v, productId: product._id })));
    }
    return success(res, { data: product }, 'Tạo sản phẩm thành công', 201);
  } catch (err) { next(err); }
};

const ALLOWED_PRODUCT_FIELDS = ['name', 'slug', 'description', 'images', 'status', 'specs', 'badge', 'warrantyMonths', 'seo', 'tags', 'brandId', 'categoryId', 'isActive', 'relatedProducts'];

const updateProduct = async (req, res, next) => {
  try {
    const update = {};
    for (const key of ALLOWED_PRODUCT_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }
    if (update.brandId) {
      if (!(await Brand.exists({ _id: update.brandId }))) return error(res, 'Thương hiệu không tồn tại', 400);
    }
    if (update.categoryId) {
      if (!(await Category.exists({ _id: update.categoryId }))) return error(res, 'Danh mục không tồn tại', 400);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!product) return error(res, 'Không tìm thấy sản phẩm', 404);
    return success(res, { data: product }, 'Cập nhật sản phẩm thành công');
  } catch (err) { next(err); }
};

const deleteProduct = async (req, res, next) => {
  try {
    const [activeOrder, cartWithProduct] = await Promise.all([
      Order.findOne({
        'items.productId': req.params.id,
        status: { $nin: ['cancelled', 'delivered', 'returned'] },
      }),
      Cart.findOne({ 'items.productId': req.params.id }),
    ]);
    if (activeOrder) return error(res, 'Không thể ẩn sản phẩm đang có trong đơn hàng chưa hoàn thành', 400);
    if (cartWithProduct) return error(res, 'Không thể ẩn sản phẩm đang có trong giỏ hàng của khách', 400);
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    return success(res, {}, 'Đã ẩn sản phẩm');
  } catch (err) { next(err); }
};

const ALLOWED_VARIANT_FIELDS = ['storage', 'color', 'colorHex', 'price', 'salePrice', 'stock', 'sku', 'images', 'isActive'];

const updateVariant = async (req, res, next) => {
  try {
    const update = {};
    for (const key of ALLOWED_VARIANT_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }
    const variant = await ProductVariant.findByIdAndUpdate(
      req.params.variantId, update, { new: true, runValidators: true }
    );
    if (!variant) return error(res, 'Không tìm thấy variant', 404);
    return success(res, { data: variant }, 'Cập nhật variant thành công');
  } catch (err) { next(err); }
};

const createVariant = async (req, res, next) => {
  try {
    if (!(await Product.exists({ _id: req.params.id }))) return error(res, 'Sản phẩm không tồn tại', 404);
    const data = {};
    for (const key of ALLOWED_VARIANT_FIELDS) {
      if (key in req.body) data[key] = req.body[key];
    }
    const variant = await ProductVariant.create({ ...data, productId: req.params.id });
    return success(res, { data: variant }, 'Thêm biến thể thành công', 201);
  } catch (err) { next(err); }
};

const deleteVariant = async (req, res, next) => {
  try {
    const variantId = req.params.variantId;
    const activeOrder = await Order.findOne({
      'items.variantId': variantId,
      status: { $nin: ['cancelled', 'delivered', 'returned'] },
    });
    if (activeOrder) return error(res, 'Không thể xóa biến thể đang có trong đơn hàng chưa hoàn thành', 400);
    const { Cart } = require('../models/index');
    const cartWithVariant = await Cart.findOne({ 'items.variantId': variantId });
    if (cartWithVariant) return error(res, 'Không thể xóa biến thể đang có trong giỏ hàng của khách', 400);
    await ProductVariant.findByIdAndDelete(variantId);
    return success(res, {}, 'Xóa biến thể thành công');
  } catch (err) { next(err); }
};

// ── PRODUCT IMAGE UPLOAD ───────────────────────────────────────────────────────
const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Không có file ảnh', 400);
    return success(res, { data: { url: `/uploads/products/${req.file.filename}` } }, 'Upload ảnh thành công');
  } catch (err) { next(err); }
};

// ── CSV EXPORT ────────────────────────────────────────────────────────────────
const exportProductsCsv = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('brandId', 'name').populate('categoryId', 'name_vi').lean();
    const variantDocs = await ProductVariant.find({ productId: { $in: products.map((p) => p._id) } }).lean();
    const varMap = {};
    variantDocs.forEach((v) => { if (!varMap[v.productId]) varMap[v.productId] = []; varMap[v.productId].push(v); });

    const headers = 'product_name,brand,category,status,badge,warrantyMonths,storage,color,colorHex,price,salePrice,stock,sku';
    const rows = [headers];
    for (const p of products) {
      const pvs = varMap[p._id.toString()] || [];
      const base = [`"${p.name.replace(/"/g, '""')}"`, p.brandId?.name || '', p.categoryId?.name_vi || '', p.status, p.badge || '', p.warrantyMonths];
      if (pvs.length === 0) {
        rows.push([...base, '', '', '', '', '', 0, ''].join(','));
      } else {
        for (const v of pvs) {
          rows.push([...base, v.storage || '', `"${(v.color || '').replace(/"/g, '""')}"`, v.colorHex || '', v.price, v.salePrice || '', v.stock, v.sku || ''].join(','));
        }
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
    res.send('﻿' + rows.join('\n'));
  } catch (err) { next(err); }
};

// ── CSV IMPORT ────────────────────────────────────────────────────────────────
const importProductsCsv = async (req, res, next) => {
  try {
    const { csvText } = req.body;
    if (!csvText?.trim()) return error(res, 'Không có dữ liệu CSV', 400);

    const [brands, categories] = await Promise.all([Brand.find().lean(), Category.find({ isActive: true }).lean()]);
    const brandMap = Object.fromEntries(brands.map((b) => [b.name.toLowerCase(), b._id]));
    const catMap = Object.fromEntries(categories.map((c) => [c.name_vi.toLowerCase(), c._id]));

    const parseRow = (line) => {
      const values = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      values.push(cur.trim());
      return values;
    };

    const lines = csvText.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return error(res, 'File CSV không có dữ liệu', 400);

    const headers = parseRow(lines[0]).map((h) => h.replace(/"/g, '').trim());
    const idx = (h) => headers.indexOf(h);

    let importedVariants = 0;
    const importErrors = [];
    const productCache = {};

    for (let i = 1; i < lines.length; i++) {
      const vals = parseRow(lines[i]);
      const g = (h) => (vals[idx(h)] || '').replace(/"/g, '').trim();
      const productName = g('product_name');
      if (!productName) continue;

      const brandId = brandMap[g('brand').toLowerCase()];
      const categoryId = catMap[g('category').toLowerCase()];
      if (!brandId) { importErrors.push(`Dòng ${i + 1}: Brand "${g('brand')}" không tồn tại`); continue; }
      if (!categoryId) { importErrors.push(`Dòng ${i + 1}: Category "${g('category')}" không tồn tại`); continue; }

      let product = productCache[productName];
      if (!product) {
        const baseSlug = slugify(productName) || 'product';
        const slug = `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        product = await Product.findOneAndUpdate(
          { name: productName },
          { $setOnInsert: { name: productName, slug, brandId, categoryId, status: g('status') || 'selling', warrantyMonths: Number(g('warrantyMonths')) || 12 } },
          { upsert: true, new: true }
        );
        productCache[productName] = product;
      }

      const color = g('color');
      const price = Number(g('price'));
      const salePrice = g('salePrice') ? Number(g('salePrice')) : undefined;
      if (color && price > 0) {
        if (salePrice !== undefined && salePrice >= price) {
          importErrors.push(`Dòng ${i + 1}: salePrice (${salePrice}) phải thấp hơn price (${price})`);
          continue;
        }
        await ProductVariant.findOneAndUpdate(
          { productId: product._id, storage: g('storage'), color },
          { productId: product._id, storage: g('storage'), color, colorHex: g('colorHex') || '', price, salePrice, stock: Number(g('stock')) || 0, sku: g('sku') || undefined },
          { upsert: true, runValidators: true }
        );
        importedVariants++;
      }
    }

    return success(res, { data: { productCount: Object.keys(productCache).length, importedVariants, errors: importErrors } },
      `Import thành công: ${Object.keys(productCache).length} sản phẩm, ${importedVariants} biến thể`);
  } catch (err) { next(err); }
};

// ── CATEGORIES ADMIN ──────────────────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const cats = await Category.find().sort({ sortOrder: 1, name_vi: 1 }).lean();
    return success(res, { data: cats });
  } catch (err) { next(err); }
};

const createCategory = async (req, res, next) => {
  try {
    const { name_vi, name_en, description, sortOrder } = req.body;
    const slug = req.body.slug || slugify(name_en || name_vi) || `category-${Date.now()}`;
    const cat = await Category.create({ name_vi, name_en, slug, description, sortOrder: sortOrder || 0 });
    return success(res, { data: cat }, 'Tạo danh mục thành công', 201);
  } catch (err) { next(err); }
};

const ALLOWED_CATEGORY_FIELDS = ['name_vi', 'name_en', 'slug', 'description', 'image', 'parentId', 'isActive', 'sortOrder'];

const updateCategory = async (req, res, next) => {
  try {
    const update = {};
    for (const key of ALLOWED_CATEGORY_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }
    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!cat) return error(res, 'Không tìm thấy danh mục', 404);
    return success(res, { data: cat }, 'Cập nhật danh mục thành công');
  } catch (err) { next(err); }
};

const deleteCategory = async (req, res, next) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    return success(res, {}, 'Đã ẩn danh mục');
  } catch (err) { next(err); }
};

// ── ORDERS ────────────────────────────────────────────────────────────────────
const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.orderCode = { $regex: escapeRegex(q), $options: 'i' };

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

const TIER_THRESHOLDS = { bronze: 0, silver: 5000000, gold: 20000000, platinum: 50000000 };
// Hệ số nhân điểm tích lũy theo hạng — khớp đúng text đã hiển thị sẵn ở ProfilePage
// ("Tích 1/1.5/2/3 điểm mỗi 1.000đ" theo hạng) — trước đây chỉ là text tĩnh, chưa có
// logic thật đứng sau. Áp dụng lúc đơn được giao (xem updateOrderStatus).
const TIER_POINT_MULTIPLIER = { bronze: 1, silver: 1.5, gold: 2, platinum: 3 };
const calcTier = (totalSpent) => {
  if (totalSpent >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (totalSpent >= TIER_THRESHOLDS.gold) return 'gold';
  if (totalSpent >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
};

const VALID_ORDER_TRANSITIONS = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['preparing', 'cancelled'],
  preparing:        ['shipping'],
  shipping:         ['delivered'],
  delivered:        ['return_requested'],
  return_requested: [],
  returned:         [],
  cancelled:        [],
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingCode } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);

    if (!VALID_ORDER_TRANSITIONS[order.status]?.includes(status)) {
      return error(res, `Không thể chuyển trạng thái từ "${order.status}" sang "${status}"`, 400);
    }

    const update = { status };
    if (trackingCode) update.trackingCode = trackingCode;
    if (status === 'delivered') update.deliveredAt = new Date();

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, status: order.status },
      update,
      { new: true }
    );
    if (!updatedOrder) {
      return error(res, 'Trạng thái đơn hàng đã bị thay đổi, vui lòng tải lại trang', 400);
    }

    // Khi admin hủy đơn: hoàn stock, hoàn ví (nếu đã trả qua ví), rollback coupon
    if (status === 'cancelled') {
      await Promise.allSettled([
        ...order.items.map((item) =>
          ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } })
        ),
        ...order.items.map((item) =>
          Product.findByIdAndUpdate(item.productId, { $inc: { sold: -item.quantity } })
        ),
      ]);
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
      if (order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
        const refundedUser = await User.findByIdAndUpdate(
          order.userId,
          { $inc: { walletBalance: order.totalPrice } },
          { new: true }
        ).select('walletBalance');
        if (refundedUser) {
          await WalletTransaction.create({
            userId: order.userId,
            type: 'refund',
            amount: order.totalPrice,
            balanceAfter: refundedUser.walletBalance,
            orderId: order._id,
            description: `Hoàn tiền đơn bị hủy ${order.orderCode}`,
          });
          await Order.findByIdAndUpdate(order._id, { paymentStatus: 'refunded' });
        }
      }
      // Hoàn lại điểm tích lũy đã dùng để giảm giá đơn này — đơn không thành thì điểm
      // đã dùng phải trả lại, không thì user mất điểm vô lý cho đơn không mua được.
      if (order.pointsUsed > 0) {
        await User.findByIdAndUpdate(order.userId, { $inc: { loyaltyPoints: order.pointsUsed } });
      }
    }

    const updated = await Order.findById(req.params.id).lean();

    // Tích điểm và cập nhật tier khi delivered (chỉ khi trạng thái cũ CHƯA phải delivered)
    if (status === 'delivered' && order.status !== 'delivered' && order.userId) {
      // Hệ số nhân theo hạng HIỆN TẠI của user (trước khi đơn này cộng thêm totalSpent) —
      // dùng hạng đang có để thưởng điểm, không dùng hạng mới (nếu đơn này vừa đủ lên hạng).
      const userBefore = await User.findById(order.userId).select('memberTier').lean();
      const multiplier = TIER_POINT_MULTIPLIER[userBefore?.memberTier || 'bronze'] ?? 1;
      const pointsEarned = Math.floor((order.totalPrice / 1000) * multiplier);
      await Order.findByIdAndUpdate(order._id, { pointsEarned });
      const updatedUser = await User.findByIdAndUpdate(
        order.userId,
        { $inc: { loyaltyPoints: pointsEarned, totalSpent: order.totalPrice } },
        { new: true }
      ).select('totalSpent memberTier');
      if (updatedUser) {
        const newTier = calcTier(updatedUser.totalSpent);
        if (newTier !== updatedUser.memberTier) {
          await User.findByIdAndUpdate(order.userId, { memberTier: newTier });
        }
      }
    }

    // Gửi notification cho khách hàng
    const STATUS_NOTIF = {
      confirmed:  { title: 'Đơn hàng đã xác nhận', content: `Đơn hàng ${order.orderCode} đã được xác nhận và đang được chuẩn bị.` },
      preparing:  { title: 'Đơn hàng đang chuẩn bị', content: `Đơn hàng ${order.orderCode} đang được đóng gói.` },
      shipping:   { title: 'Đơn hàng đang giao', content: `Đơn hàng ${order.orderCode} đang trên đường giao đến bạn!` },
      delivered:  { title: 'Đơn hàng đã giao thành công', content: `Đơn hàng ${order.orderCode} đã được giao. Cảm ơn bạn đã mua hàng!` },
      cancelled:  { title: 'Đơn hàng đã bị hủy', content: `Đơn hàng ${order.orderCode} đã bị hủy.` },
    };
    if (order.userId && STATUS_NOTIF[status]) {
      const n = STATUS_NOTIF[status];
      createNotification({ userId: order.userId, ...n, type: 'order', link: `/orders/${order._id}` });
    }

    return success(res, { data: updated }, 'Cập nhật trạng thái thành công');
  } catch (err) { next(err); }
};

// ── USERS ─────────────────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const filter = {};
    if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { email: { $regex: escapeRegex(q), $options: 'i' } }];

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean(),
    ]);
    return paginate(res, users, total, page, limit);
  } catch (err) { next(err); }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return error(res, 'Không tìm thấy người dùng', 404);
    user.isActive = !user.isActive;
    await user.save();
    return success(res, { data: { isActive: user.isActive } }, `Tài khoản đã được ${user.isActive ? 'mở khóa' : 'khóa'}`);
  } catch (err) { next(err); }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user || user.role === 'admin') return error(res, 'Không tìm thấy người dùng', 404);

    const [orderCount, txCount] = await Promise.all([
      Order.countDocuments({ userId: req.params.id }),
      WalletTransaction.countDocuments({ userId: req.params.id }),
    ]);

    if (orderCount > 0) {
      return error(res, `Không thể xóa: người dùng có ${orderCount} đơn hàng trong hệ thống`, 400);
    }
    if (txCount > 0) {
      return error(res, `Không thể xóa: người dùng có ${txCount} giao dịch ví trong hệ thống`, 400);
    }

    // Cascade xóa dữ liệu liên quan trước khi xóa user
    await Promise.all([
      Cart.deleteMany({ userId: req.params.id }),
      Review.deleteMany({ userId: req.params.id }),
      Wishlist.deleteMany({ userId: req.params.id }),
    ]);

    await User.findByIdAndDelete(req.params.id);
    return success(res, {}, `Đã xóa tài khoản "${user.name}"`);
  } catch (err) { next(err); }
};

// ── COUPONS ───────────────────────────────────────────────────────────────────
const ALLOWED_COUPON_FIELDS = [
  'code', 'description', 'type', 'value', 'minOrderValue', 'maxDiscountAmount',
  'usageLimit', 'userUsageLimit', 'applicableBrands', 'applicableCategories',
  'userType', 'startDate', 'endDate', 'isActive',
];

const validateCouponBody = (body) => {
  const data = {};
  for (const key of ALLOWED_COUPON_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  if (data.type === 'percent' && data.value !== undefined && Number(data.value) > 100) {
    return { err: 'Giá trị coupon phần trăm không được vượt quá 100%' };
  }
  return { data };
};

const createCoupon = async (req, res, next) => {
  try {
    const { data, err } = validateCouponBody(req.body);
    if (err) return error(res, err, 400);
    const coupon = await Coupon.create(data);
    return success(res, { data: coupon }, 'Tạo mã giảm giá thành công', 201);
  } catch (err) { next(err); }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    return success(res, { data: coupons });
  } catch (err) { next(err); }
};

const updateCoupon = async (req, res, next) => {
  try {
    const { data, err } = validateCouponBody(req.body);
    if (err) return error(res, err, 400);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!coupon) return error(res, 'Không tìm thấy mã giảm giá', 404);
    return success(res, { data: coupon });
  } catch (err) { next(err); }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean();
    if (!coupon) return error(res, 'Không tìm thấy mã giảm giá', 404);
    if (coupon.usedCount > 0) {
      return error(res, `Không thể xóa: mã "${coupon.code}" đã được dùng ${coupon.usedCount} lần`, 400);
    }
    await Coupon.findByIdAndDelete(req.params.id);
    return success(res, {}, `Đã xóa mã "${coupon.code}"`);
  } catch (err) { next(err); }
};

// ── REVIEWS ───────────────────────────────────────────────────────────────────
const getReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isApproved } = req.query;
    const filter = {};
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

    const [total, reviews] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .populate('userId', 'name email')
        .populate('productId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, reviews, total, page, limit);
  } catch (err) { next(err); }
};

const toggleReviewApproval = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return error(res, 'Không tìm thấy đánh giá', 404);
    review.isApproved = !review.isApproved;
    await review.save();
    await updateProductRating(review.productId);
    return success(res, { data: review }, `Đánh giá đã được ${review.isApproved ? 'duyệt' : 'ẩn'}`);
  } catch (err) { next(err); }
};

const replyToReview = async (req, res, next) => {
  try {
    const { reply } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { reply: reply || '', repliedAt: reply ? new Date() : null },
      { new: true }
    );
    if (!review) return error(res, 'Không tìm thấy đánh giá', 404);
    return success(res, { data: review }, 'Đã lưu phản hồi');
  } catch (err) { next(err); }
};

const updateAdminReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) return error(res, 'Không tìm thấy đánh giá', 404);

    if (rating !== undefined) review.rating = Math.min(5, Math.max(1, Number(rating)));
    if (comment !== undefined) review.comment = comment;
    await review.save();

    await updateProductRating(review.productId);

    return success(res, { data: review }, 'Đã cập nhật đánh giá');
  } catch (err) { next(err); }
};

// ── RETURNS (ADMIN) ───────────────────────────────────────────────────────────
const getReturnRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [total, returns] = await Promise.all([
      ReturnRequest.countDocuments(filter),
      ReturnRequest.find(filter)
        .populate('userId', 'name email phone')
        .populate('orderId', 'orderCode totalPrice paymentMethod paymentStatus')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, returns, total, page, limit);
  } catch (err) { next(err); }
};

const updateReturnRequest = async (req, res, next) => {
  try {
    const { status, adminNote, refundAmount, refundMethod, refundRef } = req.body;
    let returnReq = await ReturnRequest.findById(req.params.id);
    if (!returnReq) return error(res, 'Không tìm thấy yêu cầu trả hàng', 404);

    // Atomic Guard: Chốt trạng thái trước để chống Double Refund nếu 2 admin cùng click
    if (status && status !== returnReq.status) {
      const locked = await ReturnRequest.findOneAndUpdate(
        { _id: returnReq._id, status: returnReq.status },
        { status }, // Đổi luôn trạng thái để khóa tiến trình khác
        { new: true }
      );
      if (!locked) return error(res, 'Trạng thái đã bị thay đổi bởi người khác, vui lòng tải lại', 400);
      returnReq = locked; // Cập nhật lại bản sao nội bộ
    }

    // Fetch 1 lần, dùng lại cho cả việc cap refundAmount và tính trừ điểm theo tỉ lệ ở dưới
    const orderForCap = await Order.findById(returnReq.orderId).lean();
    if (refundAmount !== undefined) {
      if (!orderForCap) return error(res, 'Không tìm thấy đơn hàng liên quan', 404);
      if (Number(refundAmount) > orderForCap.totalPrice) {
        return error(res, `Số tiền hoàn tối đa là ${orderForCap.totalPrice.toLocaleString('vi-VN')}đ`, 400);
      }
    }

    const update = {};
    if (status)                     update.status = status;
    if (adminNote !== undefined)    update.adminNote = adminNote;
    if (refundAmount !== undefined)  update.refundAmount = Number(refundAmount);
    if (refundMethod)               update.refundMethod = refundMethod;
    if (refundRef)                   update.refundRef = refundRef;

    if (status === 'completed') {
      update.resolvedAt = new Date();
      update.refundMethod = 'wallet';
      // Ưu tiên refundAmount từ request, fallback về giá trị đã lưu, đảm bảo > 0
      const parsedAmount = refundAmount !== undefined && refundAmount !== null
        ? Number(refundAmount)
        : null;
      const actualAmount = parsedAmount !== null ? parsedAmount : (returnReq.refundAmount ?? 0);
      if (actualAmount < 0) return error(res, 'Số tiền hoàn không hợp lệ', 400);

      // Mọi hình thức thanh toán đều hoàn tiền vào ví điện tử
      const updatedUser = await User.findByIdAndUpdate(
        returnReq.userId,
        { $inc: { walletBalance: actualAmount } },
        { new: true }
      ).select('walletBalance');
      await WalletTransaction.create({
        userId: returnReq.userId,
        type: 'refund',
        amount: actualAmount,
        balanceAfter: updatedUser.walletBalance,
        orderId: returnReq.orderId,
        description: `Hoàn tiền trả hàng — đơn ${returnReq.orderId}`,
      });
      await Payment.findOneAndUpdate(
        { orderId: returnReq.orderId },
        { refundStatus: 'completed', refundAmount: actualAmount, refundMethod: 'wallet', refundedAt: new Date(), refundNote: 'Hoàn vào ví điện tử' }
      );

      // Trừ lại điểm tích lũy + totalSpent tương ứng số tiền hoàn — tránh lỗ hổng
      // "mua → nhận hàng (được cộng điểm, có thể đã nhân hệ số theo hạng) → trả hàng hoàn
      // 100% tiền → vẫn giữ điểm/tier". Dùng đúng pointsEarned đã snapshot lúc giao hàng,
      // trừ theo TỈ LỆ số tiền hoàn / tổng đơn — không tính lại từ actualAmount/1000 vì
      // sẽ sai nếu lúc giao đã áp hệ số nhân (vd hạng Gold x1.5) khác với mặc định x1.
      const orderPointsEarned = orderForCap?.pointsEarned || 0;
      const orderTotal = orderForCap?.totalPrice || 0;
      const pointsToDeduct = orderTotal > 0
        ? Math.floor(orderPointsEarned * (actualAmount / orderTotal))
        : 0;
      if (pointsToDeduct > 0) {
        const userBeforeDeduct = await User.findById(returnReq.userId).select('totalSpent loyaltyPoints');
        if (userBeforeDeduct) {
          const newTotalSpent = Math.max(0, (userBeforeDeduct.totalSpent || 0) - actualAmount);
          const newPoints = Math.max(0, (userBeforeDeduct.loyaltyPoints || 0) - pointsToDeduct);
          await User.findByIdAndUpdate(returnReq.userId, {
            loyaltyPoints: newPoints,
            totalSpent: newTotalSpent,
            memberTier: calcTier(newTotalSpent),
          });
        }
      }

      await Order.findByIdAndUpdate(returnReq.orderId, { status: 'returned', paymentStatus: 'refunded' });

      // Hoàn tồn kho từ Order items
      // returnReq.items có thể rỗng (controller tạo không set items) → fallback về toàn bộ order
      const orderDoc = await Order.findById(returnReq.orderId).lean();
      if (orderDoc) {
        const hasItemSpec = returnReq.items?.length > 0;
        const returnQtyMap = hasItemSpec
          ? new Map(returnReq.items.map((ri) => [String(ri.productId), ri.quantity]))
          : null;

        // Snapshot stock trước khi hoàn để StockLog có đủ dữ liệu audit
        const returnVariantIds = orderDoc.items.map((oi) => oi.variantId);
        const returnSnaps = await ProductVariant.find({ _id: { $in: returnVariantIds } }, { stock: 1 }).lean();
        const returnSnapMap = {};
        returnSnaps.forEach((s) => { returnSnapMap[s._id.toString()] = s.stock; });

        const stockRestores = [];
        for (const oi of orderDoc.items) {
          const qty = hasItemSpec
            ? (returnQtyMap.get(String(oi.productId)) || 0)
            : oi.quantity;
          if (qty > 0) {
            const before = returnSnapMap[oi.variantId.toString()] ?? null;
            stockRestores.push(
              ProductVariant.findByIdAndUpdate(oi.variantId, { $inc: { stock: qty } }),
              Product.findByIdAndUpdate(oi.productId, { $inc: { sold: -qty } }),
              StockLog.create({
                variantId: oi.variantId,
                productId: oi.productId,
                type: 'return',
                quantity: qty,
                stockBefore: before,
                stockAfter: before !== null ? before + qty : null,
                note: `Trả hàng — yêu cầu ${returnReq._id}`,
              })
            );
          }
        }
        if (stockRestores.length) await Promise.all(stockRestores);

        // Hoàn coupon usedCount chỉ khi trả TOÀN BỘ đơn hàng (không có item cụ thể → trả tất cả)
        // Partial return không hoàn coupon vì discount đã áp dụng trên toàn đơn
        if (orderDoc.couponCode && !hasItemSpec) {
          await Coupon.findOneAndUpdate(
            { code: orderDoc.couponCode },
            { $inc: { usedCount: -1 }, $pull: { usedBy: returnReq.userId } }
          );
        }
      }
    } else if (status === 'rejected') {
      update.resolvedAt = new Date();
      await Order.findByIdAndUpdate(returnReq.orderId, { status: 'delivered' });
    } else if (status === 'approved') {
      await Order.findByIdAndUpdate(returnReq.orderId, { status: 'return_requested' });
    }

    const updated = await ReturnRequest.findByIdAndUpdate(req.params.id, update, { new: true });
    return success(res, { data: updated }, 'Cập nhật yêu cầu trả hàng thành công');
  } catch (err) { next(err); }
};

// ── WALLET MANAGEMENT (Admin) ─────────────────────────────────────────────────

const getTopupRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const [total, topups] = await Promise.all([
      TopupRequest.countDocuments(filter),
      TopupRequest.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, topups, total, page, limit);
  } catch (err) { next(err); }
};

const confirmTopup = async (req, res, next) => {
  try {
    // Atomic: đổi status từ 'pending' → 'completed' trong 1 query để tránh double-confirm
    const topup = await TopupRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'completed', confirmedAt: new Date() },
      { new: false }
    );
    if (!topup) return error(res, 'Không tìm thấy hoặc yêu cầu đã được xử lý', 400);

    const updatedUser = await User.findByIdAndUpdate(
      topup.userId,
      { $inc: { walletBalance: topup.amount } },
      { new: true }
    ).select('walletBalance name');

    await WalletTransaction.create({
      userId: topup.userId,
      type: 'topup',
      amount: topup.amount,
      balanceAfter: updatedUser.walletBalance,
      description: `Nạp tiền qua chuyển khoản — ${topup.ref}`,
      ref: topup.ref,
    });

    createNotification({
      userId: topup.userId,
      title: 'Nạp tiền thành công',
      content: `Ví của bạn vừa được cộng ${topup.amount.toLocaleString('vi-VN')}đ. Số dư: ${updatedUser.walletBalance.toLocaleString('vi-VN')}đ`,
      type: 'system',
      link: '/profile',
    });

    return success(res, { data: { balance: updatedUser.walletBalance } },
      `Đã xác nhận nạp ${topup.amount.toLocaleString('vi-VN')}đ cho ${updatedUser.name}`);
  } catch (err) { next(err); }
};

const getWithdrawalRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const [total, withdrawals] = await Promise.all([
      WithdrawalRequest.countDocuments(filter),
      WithdrawalRequest.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, withdrawals, total, page, limit);
  } catch (err) { next(err); }
};

const processWithdrawal = async (req, res, next) => {
  try {
    const { status, adminNote, transactionRef } = req.body;
    // Atomic lock: đặt status = 'processing' ngay — chỉ cho qua nếu đang pending
    // (loại trừ cả 'processing' để tránh double-process nếu admin click nhanh)
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['completed', 'rejected', 'processing'] } },
      { status: 'processing' },
      { new: false }
    );
    if (!withdrawal) return error(res, 'Không tìm thấy hoặc yêu cầu đã được xử lý', 400);

    const update = { status, adminNote };

    if (status === 'completed') {
      update.resolvedAt = new Date();
      update.transactionRef = transactionRef;
      // Tạo WalletTransaction xác nhận hoàn thành
      const user = await User.findById(withdrawal.userId).select('walletBalance');
      await WalletTransaction.create({
        userId: withdrawal.userId,
        type: 'adjustment',
        amount: 0, // placeholder — tiền đã trừ khi tạo request
        balanceAfter: user?.walletBalance || 0,
        description: `Rút tiền hoàn thành — ${transactionRef || 'Đã chuyển khoản'}`,
        ref: transactionRef,
      });
    } else if (status === 'rejected') {
      update.resolvedAt = new Date();
      // Hoàn tiền vào ví
      const updatedUser = await User.findByIdAndUpdate(
        withdrawal.userId,
        { $inc: { walletBalance: withdrawal.amount } },
        { new: true }
      ).select('walletBalance');
      await WalletTransaction.create({
        userId: withdrawal.userId,
        type: 'adjustment',
        amount: withdrawal.amount,
        balanceAfter: updatedUser.walletBalance,
        description: `Hoàn tiền rút thất bại — ${adminNote || 'Yêu cầu bị từ chối'}`,
      });
    }

    await WithdrawalRequest.findByIdAndUpdate(withdrawal._id, update);
    return success(res, {}, status === 'completed' ? 'Đã xác nhận rút tiền thành công' : 'Đã từ chối yêu cầu, tiền hoàn về ví');
  } catch (err) { next(err); }
};

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    let startDate, groupExpr;
    const now = new Date();

    if (period === 'month') {
      startDate = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
      groupExpr = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    } else if (period === 'week') {
      startDate = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000);
      groupExpr = {
        $concat: [
          { $toString: { $isoWeekYear: '$createdAt' } },
          '-W',
          {
            $cond: {
              if: { $lt: [{ $isoWeek: '$createdAt' }, 10] },
              then: { $concat: ['0', { $toString: { $isoWeek: '$createdAt' } }] },
              else: { $toString: { $isoWeek: '$createdAt' } },
            },
          },
        ],
      };
    } else {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const [revenueData, topProducts] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
        { $group: { _id: groupExpr, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: { $nin: ['cancelled', 'returned'] } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            sold: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $project: { _id: 1, name: '$product.name', images: '$product.images', revenue: 1, sold: 1 } },
      ]),
    ]);

    return success(res, { data: { revenueData, topProducts } });
  } catch (err) { next(err); }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'staff', 'admin'].includes(role))
      return error(res, 'Role không hợp lệ', 400);
    const update = { role };
    if (role === 'user') update.permissions = [];
    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!updated) return error(res, 'Không tìm thấy user', 404);
    return success(res, { data: updated }, 'Đã cập nhật role');
  } catch (err) { next(err); }
};

const updateUserPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return error(res, 'permissions phải là mảng', 400);
    const { PERMISSIONS } = require('../config/permissions');
    const invalid = permissions.filter((p) => !PERMISSIONS.includes(p));
    if (invalid.length) return error(res, `Permission không hợp lệ: ${invalid.join(', ')}`, 400);
    const updated = await User.findByIdAndUpdate(req.params.id, { permissions }, { new: true }).select('-password');
    if (!updated) return error(res, 'Không tìm thấy user', 404);
    return success(res, { data: updated }, 'Đã cập nhật quyền');
  } catch (err) { next(err); }
};

module.exports = {
  getDashboard, getAnalytics,
  getProducts, createProduct, updateProduct, deleteProduct,
  updateVariant, createVariant, deleteVariant,
  uploadProductImage, exportProductsCsv, importProductsCsv,
  getCategories, createCategory, updateCategory, deleteCategory,
  getOrders, updateOrderStatus,
  getUsers, toggleUserStatus, deleteUser, updateUserRole, updateUserPermissions,
  createCoupon, getCoupons, updateCoupon, deleteCoupon,
  getReviews, toggleReviewApproval, replyToReview, updateAdminReview,
  getReturnRequests, updateReturnRequest,
  getTopupRequests, confirmTopup,
  getWithdrawalRequests, processWithdrawal,
};
