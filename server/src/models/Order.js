const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  name: String,
  image: String,
  storage: String,
  color: String,
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  flashSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashSale', default: null },
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderCode: { type: String, unique: true },
  items: [orderItemSchema],
  shippingAddress: {
    fullName: String,
    phone: String,
    address: String,
    city: String,
    district: String,
  },
  shippingFee: { type: Number, default: 0 },
  shippingPartner: { type: String, enum: ['GHN', 'GHTK', 'ViettelPost', 'store_pickup'], default: 'GHN' },
  trackingCode: { type: String },
  estimatedDeliveryDate: { type: Date },
  paymentMethod: { type: String, enum: ['cod', 'bank_transfer', 'momo', 'zalopay', 'vnpay', 'wallet'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  couponCode: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled', 'return_requested', 'returned'],
    default: 'pending',
  },
  autoExpiry: { type: Date }, // tự hủy nếu chưa confirm
  note: { type: String },
  cancelReason: { type: String },
  deliveredAt: { type: Date },
}, { timestamps: true });

orderSchema.pre('save', function (next) {
  if (!this.orderCode) {
    this.orderCode = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  if (!this.autoExpiry) {
    this.autoExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 phút
  }
  next();
});

orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ orderCode: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
// Cron autoExpire query: { status: 'pending', autoExpiry: { $lt: now } }
orderSchema.index({ status: 1, autoExpiry: 1 });

module.exports = {
  Order: mongoose.model('Order', orderSchema),
};
