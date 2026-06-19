import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../api/wishlist';
import { formatPrice } from '../utils/formatPrice';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Breadcrumb from '../components/ui/Breadcrumb';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    getWishlist()
      .then((res) => setItems(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (productId) => {
    try {
      await removeFromWishlist(productId);
      setItems((prev) => prev.filter((p) => p._id !== productId));
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể xóa khỏi danh sách yêu thích', type: 'error' });
    }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="card animate-pulse aspect-square" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Danh sách yêu thích' }]} />
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Heart size={24} className="text-red-500 fill-red-500" />
        Sản phẩm yêu thích
        <span className="text-gray-400 font-normal text-lg">({items.length})</span>
      </h1>

      {!items.length ? (
        <div className="text-center py-20">
          <Heart size={64} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium mb-2">Chưa có sản phẩm yêu thích</p>
          <p className="text-gray-400 text-sm mb-6">Nhấn vào icon ❤️ trên sản phẩm để lưu lại</p>
          <Link to="/products" className="btn-primary px-6 py-2.5 rounded-xl">Khám phá ngay</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((product) => {
            const variant = product.cheapestVariant;
            const price = variant?.salePrice || variant?.price || 0;
            return (
              <div key={product._id} className="card group relative flex flex-col">
                <button onClick={() => handleRemove(product._id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>

                <Link to={`/products/${product.slug}`} className="block overflow-hidden rounded-t-xl">
                  <img src={product.images?.[0] || 'https://placehold.co/300x300?text=📱'}
                    alt={product.name} loading="lazy"
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
                </Link>

                <div className="p-3 flex flex-col flex-1">
                  <Link to={`/products/${product.slug}`}
                    className="text-sm font-medium text-gray-800 hover:text-red-600 line-clamp-2 mb-2">
                    {product.name}
                  </Link>
                  <div className="mt-auto">
                    <p className="text-red-600 font-bold">{price ? formatPrice(price) : 'Liên hệ'}</p>
                    {variant?.salePrice && (
                      <p className="text-gray-400 text-xs line-through">{formatPrice(variant.price)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => variant && addItem(product, variant)}
                    disabled={!variant || variant.stock === 0}
                    className="mt-3 w-full flex items-center justify-center gap-1 bg-red-600 text-white text-sm py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {variant?.stock !== 0 && <ShoppingCart size={14} />}
                    {!variant || variant.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
