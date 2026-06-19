const { Wishlist, Product, ProductVariant } = require('../models/index');
const { success, error } = require('../utils/response.utils');
const { getCheapestVariantMap, attachCheapestVariant } = require('../utils/variant.utils');

// GET /api/wishlist
const getWishlist = async (req, res, next) => {
  try {
    const items = await Wishlist.find({ userId: req.user._id })
      .populate({ path: 'productId', match: { isActive: true }, populate: { path: 'brandId', select: 'name slug' } })
      .sort({ createdAt: -1 })
      .lean();

    // Lọc bỏ item có productId null (sản phẩm đã ẩn)
    const products = items.map((i) => i.productId).filter(Boolean);
    const ids = products.map((p) => p._id);
    const variants = await ProductVariant.find({ productId: { $in: ids }, isActive: true })
      .select('productId price salePrice color storage stock').lean();
    const variantMap = getCheapestVariantMap(variants);
    const result = attachCheapestVariant(products, variantMap);

    return success(res, { data: result, total: result.length });
  } catch (err) { next(err); }
};

// POST /api/wishlist/:productId
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return error(res, 'Không tìm thấy sản phẩm', 404);

    const exists = await Wishlist.findOne({ userId: req.user._id, productId });
    if (exists) return error(res, 'Sản phẩm đã có trong danh sách yêu thích', 400);

    await Wishlist.create({ userId: req.user._id, productId });
    return success(res, {}, 'Đã thêm vào yêu thích', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Sản phẩm đã có trong danh sách yêu thích', 400);
    next(err);
  }
};

// DELETE /api/wishlist/:productId
const removeFromWishlist = async (req, res, next) => {
  try {
    const result = await Wishlist.findOneAndDelete({ userId: req.user._id, productId: req.params.productId });
    if (!result) return error(res, 'Không tìm thấy trong danh sách yêu thích', 404);
    return success(res, {}, 'Đã xóa khỏi yêu thích');
  } catch (err) { next(err); }
};

// GET /api/wishlist/check/:productId
const checkWishlist = async (req, res, next) => {
  try {
    const item = await Wishlist.findOne({ userId: req.user._id, productId: req.params.productId });
    return success(res, { data: { isWishlisted: !!item } });
  } catch (err) { next(err); }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist, checkWishlist };
