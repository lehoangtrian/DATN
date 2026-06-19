import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, GitCompare, Heart, Zap } from 'lucide-react';
import { formatPrice, discountPercent } from '../../utils/formatPrice';
import { useCart } from '../../context/CartContext';
import { useCompare } from '../../context/CompareContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { addToWishlist, removeFromWishlist } from '../../api/wishlist';

const BADGE_COLORS = {
  New: 'bg-blue-500',
  Hot: 'bg-orange-500',
  Sale: 'bg-red-600',
  'Best Seller': 'bg-green-600',
};

export default function PhoneCard({ phone, categoryFlashSale = null }) {
  const { addItem, fetchCart } = useCart();
  const { toggle, has, list } = useCompare();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [buyingNow, setBuyingNow] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const variant = phone.cheapestVariant || phone.variants?.[0];

  const handleWishlist = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/products/${phone.slug}` } });
      return;
    }
    setWishlistLoading(true);
    try {
      if (isWishlisted) {
        await removeFromWishlist(phone._id);
        setIsWishlisted(false);
        showToast({ message: 'Đã xóa khỏi danh sách yêu thích', type: 'info' });
      } else {
        await addToWishlist(phone._id);
        setIsWishlisted(true);
        showToast({ message: 'Đã thêm vào danh sách yêu thích', type: 'success' });
      }
    } catch {
      showToast({ message: 'Không thể cập nhật danh sách yêu thích', type: 'error' });
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleBuyNow = async (e) => {
    e.preventDefault();
    if (!variant || variant.stock === 0) return;
    if (!user) {
      navigate('/login', { state: { from: `/products/${phone.slug}` } });
      return;
    }
    setBuyingNow(true);
    try {
      await addItem(phone, variant, 1);
      navigate('/checkout', { state: { selectedVariantIds: [variant._id] } });
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể thực hiện mua ngay', type: 'error' });
      navigate(`/products/${phone.slug}`);
    } finally {
      setBuyingNow(false);
    }
  };
  const price = variant?.salePrice || variant?.price || 0;
  const originalPrice = variant?.salePrice ? variant.price : null;
  const image = phone.images?.[0] || 'https://placehold.co/300x300?text=No+Image';
  const inCompare = has(phone._id);
  const compareFull = list.length >= 3 && !inCompare;

  const specLine = [
    variant?.storage,
    variant?.ram ? `RAM ${variant.ram}` : null,
    phone.specs?.display,
  ].filter(Boolean).slice(0, 2).join(' · ');

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 rounded-3xl shadow-soft hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative flex flex-col overflow-hidden">
      {/* Badges */}
      {categoryFlashSale ? (
        <span className="absolute top-3 left-3 z-10 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-0.5 shadow-soft">
          <Zap size={9} /> FLASH SALE
        </span>
      ) : phone.badge ? (
        <span className={`absolute top-3 left-3 z-10 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-soft ${BADGE_COLORS[phone.badge]}`}>
          {phone.badge}
        </span>
      ) : null}
      {originalPrice && (
        <span className="absolute top-3 right-3 z-10 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow-soft">
          -{discountPercent(originalPrice, price)}%
        </span>
      )}

      {/* Wishlist button (hover) */}
      <button
        className="absolute top-11 right-3 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-soft flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 disabled:cursor-not-allowed"
        onClick={handleWishlist}
        disabled={wishlistLoading}
        aria-label="Yêu thích"
      >
        <Heart
          size={14}
          className={isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-500 transition-colors'}
        />
      </button>

      {/* Image */}
      <Link to={`/products/${phone.slug}`} className="block overflow-hidden bg-gray-50 dark:bg-zinc-800">
        <img
          src={image}
          alt={phone.name}
          loading="lazy"
          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {/* Name */}
        <Link
          to={`/products/${phone.slug}`}
          className="text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 line-clamp-2 leading-tight mb-1"
        >
          {phone.name}
        </Link>

        {/* Specs */}
        {specLine && (
          <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{specLine}</p>
        )}

        {/* Rating */}
        <div className="flex items-center gap-1 text-xs text-amber-500 mb-2">
          <Star size={11} fill="currentColor" />
          <span className="text-gray-500 dark:text-gray-400">{phone.rating != null ? phone.rating.toFixed(1) : '—'}</span>
          <span className="text-gray-400">({phone.reviewCount || 0})</span>
        </div>

        {/* Price */}
        <div className="mt-auto">
          <div className="font-display text-blue-600 font-bold text-lg leading-tight">
            {price ? formatPrice(price) : 'Liên hệ'}
          </div>
          {originalPrice && (
            <div className="text-gray-400 text-xs line-through">{formatPrice(originalPrice)}</div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={handleBuyNow}
            disabled={!variant || variant.stock === 0 || buyingNow}
            className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-glow text-white text-xs font-semibold py-2.5 rounded-full transition-all disabled:bg-gray-200 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {buyingNow
              ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              : <Zap size={13} />}
            {variant?.stock === 0 ? 'Hết hàng' : 'Mua ngay'}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); variant && addItem(phone, variant); }}
            disabled={!variant || variant.stock === 0}
            title="Thêm vào giỏ"
            className="w-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={14} />
          </button>
        </div>

        <button
          onClick={() => !compareFull && toggle(phone)}
          title={compareFull ? 'Đã đủ 3 sản phẩm so sánh' : inCompare ? 'Bỏ khỏi so sánh' : 'So sánh'}
          className={`mt-1.5 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-full border transition-colors ${
            inCompare
              ? 'bg-blue-50 border-blue-300 text-blue-600'
              : compareFull
              ? 'border-gray-100 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <GitCompare size={12} />
          {inCompare ? 'Đang so sánh' : 'So sánh'}
        </button>
      </div>
    </div>
  );
}
