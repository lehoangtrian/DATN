import { useEffect, useState } from 'react';
import { getAdminOrders, updateOrderStatus } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { useToast } from '../../context/ToastContext';
import { X, Truck } from 'lucide-react';

const STATUSES = ['', 'pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'];
const STATUS_MAP = {
  pending:          { text: 'Chờ xác nhận',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed:        { text: 'Đã xác nhận',   color: 'bg-blue-100 text-blue-700' },
  preparing:        { text: 'Đang chuẩn bị', color: 'bg-purple-100 text-purple-700' },
  shipping:         { text: 'Đang giao',     color: 'bg-orange-100 text-orange-700' },
  delivered:        { text: 'Đã giao',       color: 'bg-green-100 text-green-700' },
  cancelled:        { text: 'Đã hủy',        color: 'bg-red-100 text-red-600' },
  return_requested: { text: 'Yêu cầu trả',  color: 'bg-pink-100 text-pink-700' },
  returned:         { text: 'Đã hoàn hàng', color: 'bg-gray-100 text-gray-600' },
};

// Các trạng thái admin có thể chuyển tới từ trạng thái hiện tại
const TRANSITIONS = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipping'],
  shipping:  ['delivered'],
};

export default function AdminOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [shippingModal, setShippingModal] = useState(null); // { orderId, orderCode }
  const [trackingInput, setTrackingInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    getAdminOrders({ status: filter || undefined, q: q || undefined })
      .then((res) => setOrders(res.data.data || []))
      .catch((err) => {
        const status = err.response?.status;
        setLoadError(status === 401 || status === 403
          ? 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
          : 'Không thể tải đơn hàng. Kiểm tra server có đang chạy không.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const doStatusChange = async (id, newStatus, extra = {}) => {
    const res = await updateOrderStatus(id, { status: newStatus, ...extra });
    setOrders((prev) => prev.map((o) => o._id === id ? res.data.data : o));
    showToast({ message: `Đã chuyển sang: ${STATUS_MAP[newStatus]?.text}`, type: 'success' });
  };

  const handleStatusChange = async (id, newStatus, orderCode) => {
    if (newStatus === 'cancelled' && !confirm('Xác nhận hủy đơn hàng này?')) return;
    if (newStatus === 'shipping') {
      setShippingModal({ orderId: id, orderCode });
      setTrackingInput('');
      return;
    }
    try {
      await doStatusChange(id, newStatus);
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const handleShippingConfirm = async () => {
    setSubmitting(true);
    try {
      await doStatusChange(shippingModal.orderId, 'shipping', trackingInput.trim() ? { trackingCode: trackingInput.trim() } : {});
      setShippingModal(null);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể cập nhật trạng thái', type: 'error' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đơn hàng</h1>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${filter === s ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-200 hover:border-red-300'}`}>
              {s ? STATUS_MAP[s]?.text : 'Tất cả'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Tìm mã đơn..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-red-400 w-44" />
          <button onClick={load} className="btn-primary px-3 py-1.5 text-sm rounded-lg">Tìm</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Mã đơn', 'Khách hàng', 'Sản phẩm', 'Tổng tiền', 'Trạng thái', 'Ngày', 'Hành động'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={7} className="text-center py-10 text-red-500">{loadError}</td></tr>
            ) : !orders.length ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có đơn hàng</td></tr>
            ) : orders.map((o) => (
              <tr key={o._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{o.orderCode}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-800">{o.userId?.name}</p>
                  <p className="text-gray-400 text-xs">{o.userId?.phone}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">{o.items?.length} sản phẩm</td>
                <td className="px-4 py-3 font-semibold text-red-600">{formatPrice(o.totalPrice)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_MAP[o.status]?.color}`}>
                    {STATUS_MAP[o.status]?.text}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3">
                  {TRANSITIONS[o.status] ? (
                    <select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) { handleStatusChange(o._id, e.target.value, o.orderCode); e.target.value = ''; } }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white hover:border-blue-400 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="" disabled>Chuyển sang...</option>
                      {TRANSITIONS[o.status].map((s) => (
                        <option key={s} value={s}>{STATUS_MAP[s]?.text}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal nhập mã vận đơn khi chuyển sang Đang giao */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShippingModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Truck size={18} className="text-orange-500" /> Chuyển sang Đang giao
              </h3>
              <button onClick={() => setShippingModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Đơn hàng <span className="font-semibold text-gray-700">{shippingModal.orderCode}</span>
            </p>
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Mã vận đơn <span className="text-gray-400 font-normal">(tùy chọn)</span>
              </label>
              <input
                autoFocus
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !submitting && handleShippingConfirm()}
                placeholder="VD: GHN12345678"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">Người dùng sẽ thấy link theo dõi đơn hàng từ mã này.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShippingModal(null)} className="flex-1 btn-outline py-2.5 rounded-xl text-sm">Hủy</button>
              <button onClick={handleShippingConfirm} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors text-sm">
                {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Đang cập nhật...' : 'Xác nhận giao hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
