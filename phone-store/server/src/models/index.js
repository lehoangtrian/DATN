const User = require('./User');
const OTP = require('./OTP');
const Banner = require('./Banner');
const ServiceBadge = require('./ServiceBadge');
const Category = require('./Category');
const Brand = require('./Brand');
const Product = require('./Product');
const ProductVariant = require('./ProductVariant');
const { Cart } = require('./Cart');
const { Order } = require('./Order');
const Payment = require('./Payment');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const Coupon = require('./Coupon');
const ReturnRequest = require('./ReturnRequest');
const Notification = require('./Notification');
const StockLog = require('./StockLog');
const FlashSale = require('./FlashSale');
const WalletTransaction = require('./WalletTransaction');
const TopupRequest = require('./TopupRequest');
const WithdrawalRequest = require('./WithdrawalRequest');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');

module.exports = {
  User, OTP, Category, Brand,
  Product, ProductVariant,
  Cart, Order,
  Payment, Review, Wishlist, Coupon,
  ReturnRequest, Notification,
  StockLog, FlashSale,
  WalletTransaction, TopupRequest, WithdrawalRequest,
  Banner, ServiceBadge,
  ChatSession, ChatMessage,
};
