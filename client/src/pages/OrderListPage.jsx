import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyOrders } from '../api/orders';
import { addCartItem } from '../api/cart';
import { formatPrice } from '../utils/formatPrice';
import { Package, ChevronRight, ShoppingBag, Search, ShoppingCart } from 'lucide-react';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

const STATUS = {
  pending:          { text: 'Chờ xác nhận',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed:        { text: 'Đã xác nhận',   color: 'bg-blue-100 text-blue-700' },
  preparing:        { text: 'Đang chuẩn bị', color: 'bg-purple-100 text-purple-700' },
  shipping:         { text: 'Đang giao',     color: 'bg-orange-100 text-orange-700' },
  delivered:        { text: 'Đã giao',       color: 'bg-green-100 text-green-700' },
  cancelled:        { text: 'Đã hủy',        color: 'bg-red-100 text-red-600' },
  return_requested: { text: 'Yêu cầu trả',  color: 'bg-pink-100 text-pink-700' },
  returned:         { text: 'Đã trả hàng',  color: 'bg-gray-100 text-gray-600' },
};

const FILTERS = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ xác nhận', value: 'pending' },
  { label: 'Đang giao', value: 'shipping' },
  { label: 'Đã giao', value: 'delivered' },
  { label: 'Đã hủy', value: 'cancelled' },
];

export default function OrderListPage() {
  const navigate = useNavigate();
  const { fetchCart } = useCart();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [buyingAgainId, setBuyingAgainId] = useState(null);

  const handleBuyAgain = async (e, order) => {
    e.preventDefault();
    e.stopPropagation();
    setBuyingAgainId(order._id);
    try {
      const results = await Promise.allSettled(
        order.items.map((item) => addCartItem(item.variantId?._id || item.variantId, item.quantity))
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      await fetchCart();
      if (succeeded === 0) {
        showToast({ message: 'Không thể thêm sản phẩm vào giỏ hàng', type: 'error' });
      } else {
        const msg = failed > 0
          ? `Đã thêm ${succeeded}/${results.length} sản phẩm (${failed} sản phẩm không còn hàng)`
          : 'Đã thêm tất cả sản phẩm vào giỏ hàng';
        showToast({ message: msg, type: succeeded === results.length ? 'success' : 'warning' });
        navigate('/cart');
      }
    } catch {
      showToast({ message: 'Không thể thêm vào giỏ hàng', type: 'error' });
    } finally {
      setBuyingAgainId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getMyOrders(filter ? { status: filter } : {}, { signal: controller.signal })
      .then((res) => setOrders(res.data.data))
      .catch((err) => { if (err.name !== 'CanceledError' && err.name !== 'AbortError') {} })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filter]);

  const filtered = orders.filter((o) =>
    !search || o.orderCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Đơn hàng của tôi' }]} />
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Đơn hàng của tôi</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã đơn hàng..."
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-red-400" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`shrink-0 text-sm px-4 py-1.5 rounded-full border transition-colors ${filter === f.value ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-200 hover:border-red-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-20">
          <ShoppingBag size={56} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium mb-2">Chưa có đơn hàng nào</p>
          <p className="text-gray-400 text-sm mb-6">Hãy mua sắm và quay lại đây để theo dõi đơn hàng</p>
          <Link to="/products" className="btn-primary px-6 py-2.5 rounded-xl">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <div key={order._id} onClick={() => navigate(`/orders/${order._id}`)}
              className="card p-5 block hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Mã đơn hàng</p>
                  <p className="font-bold text-gray-800">{order.orderCode}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS[order.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS[order.status]?.text || order.status}
                  </span>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-red-600 transition-colors" />
                </div>
              </div>

              {/* Items preview */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2">
                  {order.items?.slice(0, 3).map((item, i) => (
                    <img key={i} src={item.image || 'https://placehold.co/40x40?text=📱'} alt={item.name}
                      className="w-10 h-10 object-cover rounded-lg border-2 border-white" />
                  ))}
                  {order.items?.length > 3 && (
                    <div className="w-10 h-10 rounded-lg border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                      +{order.items.length - 3}
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {order.items?.length} sản phẩm
                  {order.items?.[0] && ` · ${order.items[0].name}${order.items.length > 1 ? '...' : ''}`}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  {order.estimatedDeliveryDate && !['delivered', 'cancelled', 'returned', 'return_requested'].includes(order.status) && (
                    <p className="text-xs text-green-600 mt-0.5">
                      Dự kiến: {new Date(order.estimatedDeliveryDate).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {(order.status === 'delivered' || order.status === 'cancelled') && (
                    <button
                      onClick={(e) => handleBuyAgain(e, order)}
                      disabled={buyingAgainId === order._id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors font-medium">
                      {buyingAgainId === order._id
                        ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                        : <ShoppingCart size={12} />}
                      Mua lại
                    </button>
                  )}
                  <span className="font-bold text-red-600">{formatPrice(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
