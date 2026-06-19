import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductBySlug, getRelatedProducts, notifyWhenInStock } from '../api/products';
import { getFlashSaleByVariant } from '../api/flashsale';
import { addToWishlist, removeFromWishlist, checkWishlist } from '../api/wishlist';
import { formatPrice, discountPercent } from '../utils/formatPrice';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ReviewSection from '../components/phone/ReviewSection';
import PhoneCard from '../components/phone/PhoneCard';
import { ShoppingCart, Star, Shield, Truck, ChevronRight, ChevronLeft, Heart, Bell, BellRing, X, Zap } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function PhoneDetailPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [mainImg, setMainImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [notifyRequested, setNotifyRequested] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [flashSale, setFlashSale] = useState(null);
  const { addItem, fetchCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [buyingNow, setBuyingNow] = useState(false);

  useEffect(() => {
    setLoading(true);
    setRelated([]);
    setIsWishlisted(false);
    getProductBySlug(slug)
      .then((res) => {
        const p = res.data.data;
        setProduct(p);
        if (p.variants?.length) {
          setSelectedStorage(p.variants[0].storage || '');
          setSelectedColor(p.variants[0].color || '');
        }
        // Lấy sản phẩm liên quan
        getRelatedProducts(p._id).then((r) => setRelated(r.data.data || [])).catch(() => {});
        // Kiểm tra wishlist
        if (user) checkWishlist(p._id).then((r) => setIsWishlisted(r.data.data.isWishlisted)).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, user]);

  // Danh sách storage unique
  const storages = useMemo(() => {
    if (!product?.variants) return [];
    return [...new Set(product.variants.map((v) => v.storage).filter(Boolean))];
  }, [product]);

  // Màu sắc theo storage đang chọn
  const colors = useMemo(() => {
    if (!product?.variants) return [];
    return product.variants.filter((v) => v.storage === selectedStorage || !selectedStorage);
  }, [product, selectedStorage]);

  // Variant hiện tại
  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    return product.variants.find(
      (v) => v.storage === selectedStorage && v.color === selectedColor
    ) || product.variants[0];
  }, [product, selectedStorage, selectedColor]);

  // Fetch flash sale khi variant thay đổi
  useEffect(() => {
    if (!selectedVariant?._id) { setFlashSale(null); return; }
    getFlashSaleByVariant(selectedVariant._id)
      .then((r) => setFlashSale(r.data.data || null))
      .catch(() => setFlashSale(null));
  }, [selectedVariant?._id]);

  const handleStorageSelect = (storage) => {
    setSelectedStorage(storage);
    const firstColor = product.variants.find((v) => v.storage === storage)?.color || '';
    setSelectedColor(firstColor);
    setQty(1);
    setNotifyRequested(false);
  };

  const handleBuyNow = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/products/${slug}` } });
      return;
    }
    if (!selectedVariant || selectedVariant.stock === 0) return;
    setBuyingNow(true);
    try {
      // Dùng CartContext addItem để optimistic update hiển thị đúng giá flash sale
      await addItem(product, selectedVariant, qty, flashSale?.salePrice ?? null);
      navigate('/checkout', { state: { selectedVariantIds: [selectedVariant._id] } });
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể mua ngay', type: 'error' });
    } finally {
      setBuyingNow(false);
    }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8 animate-pulse">
        <div className="md:w-[45%] space-y-3">
          <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="flex gap-2">
            {[1,2,3,4].map((i) => <div key={i} className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="flex gap-2">{[1,2,3].map((i) => <div key={i} className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}</div>
          <div className="flex gap-2">{[1,2,3].map((i) => <div key={i} className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}</div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-full mt-4" />
        </div>
      </div>
    </div>
  );
  if (!product) return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Không tìm thấy sản phẩm.</div>;

  const price = flashSale?.salePrice ?? selectedVariant?.salePrice ?? selectedVariant?.price ?? 0;
  const originalPrice = flashSale
    ? flashSale.originalPrice
    : (selectedVariant?.salePrice ? selectedVariant.price : null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-blue-600">Trang chủ</Link>
        <ChevronRight size={14} />
        <Link to="/products" className="hover:text-blue-600">Điện thoại</Link>
        <ChevronRight size={14} />
        <span className="text-gray-700">{product.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <div className="bg-gray-50 rounded-2xl overflow-hidden aspect-square mb-3 cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}>
            <img
              src={product.images?.[mainImg] || 'https://placehold.co/600x600?text=No+Image'}
              alt={product.name}
              className="w-full h-full object-contain p-6 hover:scale-105 transition-transform duration-300"
            />
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setMainImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${mainImg === i ? 'border-blue-500' : 'border-transparent'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-sm text-gray-400 mb-1">{product.brandId?.name}</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2 tracking-tight">{product.name}</h1>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} fill={i < Math.round(product.rating) ? 'currentColor' : 'none'} />
              ))}
            </div>
            <span className="text-sm text-gray-500">{product.reviewCount} đánh giá</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">Đã bán {product.sold?.toLocaleString()}</span>
          </div>

          {/* Giá */}
          <div className="bg-blue-50 dark:bg-zinc-800 rounded-2xl p-4 mb-5">
            {flashSale && (
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Flash Sale</span>
                {flashSale.quantity != null && (
                  <span className="text-xs text-gray-500">
                    Còn {flashSale.quantity - flashSale.sold}/{flashSale.quantity} suất
                  </span>
                )}
              </div>
            )}
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-blue-600">{formatPrice(price)}</span>
              {originalPrice && (
                <>
                  <span className="text-gray-400 line-through text-lg">{formatPrice(originalPrice)}</span>
                  <span className="bg-red-100 text-red-600 text-sm font-semibold px-2 py-0.5 rounded-full">
                    -{discountPercent(originalPrice, price)}%
                  </span>
                </>
              )}
            </div>
            {flashSale && flashSale.quantity != null && (
              <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (flashSale.sold / flashSale.quantity) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Storage */}
          {storages.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Dung lượng:</p>
              <div className="flex flex-wrap gap-2">
                {storages.map((s) => (
                  <button key={s} onClick={() => handleStorageSelect(s)}
                    className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${selectedStorage === s ? 'border-blue-500 text-blue-600 bg-blue-50 font-medium' : 'border-gray-200 dark:border-zinc-700 text-gray-600 hover:border-blue-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color */}
          {colors.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Màu sắc: <span className="font-normal text-gray-500">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((v) => (
                  <button key={v._id} onClick={() => { setSelectedColor(v.color); setQty(1); setNotifyRequested(false); }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors ${selectedColor === v.color ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'}`}>
                    {v.colorHex && (
                      <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                        style={{ backgroundColor: v.colorHex }} />
                    )}
                    {v.color}
                    {v.stock === 0 && <span className="text-xs text-gray-400">(Hết)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chọn số lượng + CTA */}
          <div className="flex gap-3 mb-4">
            {/* Quantity selector */}
            <div className="flex items-center border border-gray-200 dark:border-zinc-700 rounded-full overflow-hidden shrink-0">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium"
              >−</button>
              <span className="w-10 text-center text-sm font-semibold text-gray-800">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(selectedVariant?.stock || 10, q + 1))}
                disabled={qty >= (selectedVariant?.stock || 0)}
                className="w-10 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium disabled:text-gray-300"
              >+</button>
            </div>

            {selectedVariant?.stock === 0 ? (
              user ? (
                <button
                  onClick={async () => {
                    if (notifyRequested) return;
                    setNotifyLoading(true);
                    try {
                      await notifyWhenInStock(selectedVariant._id);
                      setNotifyRequested(true);
                      showToast({ message: 'Sẽ thông báo khi có hàng trở lại!', type: 'success' });
                    } catch (err) {
                      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
                    } finally { setNotifyLoading(false); }
                  }}
                  disabled={notifyRequested || notifyLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold transition-colors ${notifyRequested ? 'bg-green-50 text-green-600 border border-green-300 cursor-default' : 'bg-orange-50 text-orange-600 border border-orange-300 hover:bg-orange-100'}`}
                >
                  {notifyRequested ? <BellRing size={20} /> : <Bell size={20} />}
                  {notifyLoading ? 'Đang đăng ký...' : notifyRequested ? 'Đã đăng ký thông báo' : 'Thông báo khi có hàng'}
                </button>
              ) : (
                <Link to="/login"
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-50 text-orange-600 border border-orange-300 hover:bg-orange-100 py-3 rounded-full font-semibold transition-colors">
                  <Bell size={20} /> Đăng nhập để nhận thông báo
                </Link>
              )
            ) : (
              <button
                onClick={() => { addItem(product, selectedVariant, qty, flashSale?.salePrice ?? null); setQty(1); }}
                disabled={!selectedVariant}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-full font-semibold hover:bg-blue-700 hover:shadow-glow transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <ShoppingCart size={20} />
                {flashSale ? 'Mua Flash Sale' : 'Thêm vào giỏ'}
              </button>
            )}
            {user && (
              <button
                onClick={async () => {
                  try {
                    if (isWishlisted) {
                      await removeFromWishlist(product._id);
                    } else {
                      await addToWishlist(product._id);
                    }
                    setIsWishlisted(!isWishlisted);
                  } catch {}
                }}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${isWishlisted ? 'border-red-500 bg-red-50 text-red-500' : 'border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-red-300'}`}
                title={isWishlisted ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

          {selectedVariant?.stock > 0 && (
            <button
              onClick={handleBuyNow}
              disabled={buyingNow || !selectedVariant}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-glow text-white py-3 rounded-full font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-4"
            >
              {buyingNow
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Zap size={18} />}
              {buyingNow ? 'Đang xử lý...' : 'Mua ngay'}
            </button>
          )}

          {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
            <p className="text-orange-500 text-sm text-center mb-4">Chỉ còn {selectedVariant.stock} sản phẩm!</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2"><Shield size={16} className="text-green-500" /> Bảo hành {product.warrantyMonths} tháng</div>
            <div className="flex items-center gap-2"><Truck size={16} className="text-blue-500" /> Giao hàng toàn quốc</div>
          </div>

          {/* Specs */}
          {product.specs && (
            <div className="mt-6 border-t pt-5">
              <h3 className="font-semibold text-gray-800 mb-3">Thông số kỹ thuật</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Màn hình', product.specs.display],
                    ['Chip xử lý', product.specs.chip],
                    ['RAM', product.specs.ram],
                    ['Pin', product.specs.battery],
                    ['Camera', product.specs.camera],
                    ['Hệ điều hành', product.specs.os],
                    ['SIM', product.specs.sim],
                    ['Kết nối', product.specs.connectivity],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="py-2 text-gray-500 w-2/5">{label}</td>
                      <td className="py-2 text-gray-800">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* Reviews section */}
      <ReviewSection productId={product._id} />

      {/* Sản phẩm liên quan */}
      {related.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Sản phẩm liên quan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.slice(0, 4).map((p) => <PhoneCard key={p._id} phone={p} />)}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && product.images?.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={28} />
          </button>
          {product.images.length > 1 && (
            <button
              className="absolute left-4 text-white/70 hover:text-white p-3 bg-white/10 rounded-full"
              onClick={(e) => { e.stopPropagation(); setMainImg((mainImg - 1 + product.images.length) % product.images.length); }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <img
            src={product.images[mainImg]}
            alt={product.name}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          {product.images.length > 1 && (
            <button
              className="absolute right-4 text-white/70 hover:text-white p-3 bg-white/10 rounded-full"
              onClick={(e) => { e.stopPropagation(); setMainImg((mainImg + 1) % product.images.length); }}
            >
              <ChevronRight size={24} />
            </button>
          )}
          <div className="absolute bottom-4 flex gap-1.5">
            {product.images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setMainImg(i); }}
                className={`w-2 h-2 rounded-full transition-all ${i === mainImg ? 'bg-white w-4' : 'bg-white/40'}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
