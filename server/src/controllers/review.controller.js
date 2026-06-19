const mongoose = require('mongoose');
const { Review, Product, Order } = require('../models/index');
const { success, error, paginate } = require('../utils/response.utils');

// GET /api/reviews/product/:productId
const getProductReviews = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return error(res, 'productId không hợp lệ', 400);
    }

    const productOid = new mongoose.Types.ObjectId(req.params.productId);
    const { page = 1, limit = 10, rating } = req.query;
    const filter = { productId: req.params.productId, isApproved: true };
    if (rating) filter.rating = Number(rating);

    const [total, reviews, stats] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .populate('userId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Review.aggregate([
        { $match: { productId: productOid, isApproved: true } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);

    const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.forEach((s) => { ratingMap[s._id] = s.count; });

    return res.json({
      success: true,
      data: reviews,
      ratingMap,
      pagination: {
        total, page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
};

// POST /api/reviews
const createReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment, images } = req.body;
    if (!productId || !rating) return error(res, 'productId và rating là bắt buộc', 400);

    // Kiểm tra đã review chưa
    const exists = await Review.findOne({ userId: req.user._id, productId });
    if (exists) return error(res, 'Bạn đã đánh giá sản phẩm này rồi', 400);

    // Kiểm tra đã mua hàng chưa (nếu có orderId)
    let isVerifiedPurchase = false;
    if (orderId) {
      // Phải verify cả orderId lẫn productId trong đơn — tránh fake isVerifiedPurchase bằng orderId của đơn khác
      const order = await Order.findOne({ _id: orderId, userId: req.user._id, status: 'delivered', 'items.productId': productId });
      isVerifiedPurchase = !!order;
    } else {
      const order = await Order.findOne({
        userId: req.user._id,
        status: 'delivered',
        'items.productId': productId,
      });
      isVerifiedPurchase = !!order;
    }

    const review = await Review.create({
      userId: req.user._id,
      productId,
      orderId,
      rating,
      comment,
      images,
      isVerifiedPurchase,
    });

    // Cập nhật rating trung bình của sản phẩm
    await updateProductRating(productId);

    const populated = await review.populate('userId', 'name avatar');
    return success(res, { data: populated }, 'Đánh giá thành công', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Bạn đã đánh giá sản phẩm này rồi', 400);
    next(err);
  }
};

// PUT /api/reviews/:id
const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, userId: req.user._id });
    if (!review) return error(res, 'Không tìm thấy đánh giá', 404);

    const { rating, comment, images } = req.body;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) return error(res, 'Rating phải từ 1 đến 5', 400);
      review.rating = Number(rating);
    }
    if (comment !== undefined) review.comment = comment;
    if (images) review.images = images;
    await review.save();

    await updateProductRating(review.productId);
    return success(res, { data: review }, 'Cập nhật đánh giá thành công');
  } catch (err) { next(err); }
};

// DELETE /api/reviews/:id
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!review) return error(res, 'Không tìm thấy đánh giá', 404);
    await updateProductRating(review.productId);
    return success(res, {}, 'Đã xóa đánh giá');
  } catch (err) { next(err); }
};

// Helper: tính lại rating trung bình
const updateProductRating = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) return;
  const result = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), isApproved: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = result[0]?.avg || 0;
  const count = result[0]?.count || 0;
  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
};

module.exports = { getProductReviews, createReview, updateReview, deleteReview, updateProductRating };
