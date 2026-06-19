import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getOrderById, cancelOrder, createReturnRequest, getReturnByOrder } from '../api/orders';
import { addCartItem } from '../api/cart';
import { formatPrice } from '../utils/formatPrice';
import { Package, MapPin, CreditCard, ChevronLeft, X, Phone, Truck, CheckCircle, Clock, RotateCcw, AlertCircle, Banknote, ShoppingCart, ExternalLink } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useCart } from '../context/CartContext';

const STATUS_STEPS = [
  { key: 'pending',   label: 'Chờ xác nhận', icon: Clock },
  { key: 'confirmed', label: 'Đã xác nhận',  icon: CheckCircle },
  { key: 'preparing', label: 'Chuẩn bị',     icon: Package },
  { key: 'shipping',  label: 'Đang giao',    icon: Truck },
  { key: 'delivered', label: 'Đã nhận',      icon: CheckCircle },
];

const STATUS_MAP = {
  pending:          { text: 'Chờ xác nhận',   color: 'bg-yellow-100 text-yellow-700' },
  confirmed:        { text: 'Đã xác nhận',    color: 'bg-blue-100 text-blue-700' },
  preparing:        { text: 'Đang chuẩn bị',  color: 'bg-purple-100 text-purple-700' },
  shipping:         { text: 'Đang giao',      color: 'bg-orange-100 text-orange-700' },
  delivered:        { text: 'Đã giao',        color: 'bg-green-100 text-green-700' },
  cancelled:        { text: 'Đã hủy',         color: 'bg-red-100 text-red-600' },
  return_requested: { text: 'Yêu cầu trả',   color: 'bg-pink-100 text-pink-700' },
  returned:         { text: 'Đã hoàn hàng',  color: 'bg-gray-100 text-gray-600' },
};

const RETURN_REASONS = [
  'Sản phẩm bị lỗi / hư hỏng',
  'Sản phẩm không đúng mô tả',
  'Giao nhầm sản phẩm',
  'Sản phẩm không vừa ý',
  'Lý do khác',
];

const RETURN_STATUS_MAP = {
  pending:    { text: 'Đang chờ xử lý', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  approved:   { text: 'Đã chấp nhận – vui lòng gửi hàng về', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  processing: { text: 'Đang xử lý hoàn tiền', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  completed:  { text: 'Hoàn tiền thành công', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  rejected:   { text: 'Yêu cầu bị từ chối', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const PAYMENT_LABEL = { cod: 'Thanh toán khi nhận hàng (COD)', bank_transfer: 'Chuyển khoản ngân hàng', vnpay: 'VNPay' };

const TRACKING_URL = {
  GHN: (code) => `https://donhang.ghn.vn/?order_code=${code}`,
  GHTK: (code) => `https://i.ghtk.vn/${code}`,
  ViettelPost: (code) => `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?idSearch=${code}`,
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnRequest, setReturnRequest] = useState(null);
  const [showReturn, setShowReturn] = useState(false);
  const [returnForm, setReturnForm] = useState({
    reason: '', description: '',
    bankName: '', accountNumber: '', accountHolder: '',
  });
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [returnError, setReturnError] = useState('');
  const [buyingAgain, setBuyingAgain] = useState(false);
  const { showToast } = useToast();
  const { fetchCart } = useCart();

  useEffect(() => {
    getOrderById(id)
      .then((res) => {
        const o = res.data.data;
        setOrder(o);
        if (['return_requested', 'returned'].includes(o.status)) {
          getReturnByOrder(o._id).then((r) => setReturnRequest(r.data.data)).catch(() => {});
        }
      })
      .catch(() => navigate('/orders'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    setCancelError('');
    try {
      const res = await cancelOrder(id, cancelReason);
      setOrder(res.data.data);
      setShowCancel(false);
      showToast({ message: 'Đã hủy đơn hàng thành công', type: 'success' });
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Không thể hủy đơn hàng');
    } finally { setCancelling(false); }
  };

  const handleReturnSubmit = async () => {
    if (!returnForm.reason) { setReturnError('Vui lòng chọn lý do trả hàng'); return; }
    // COD và wallet: hoàn tiền về ví điện tử, không cần thông tin ngân hàng
    const needsBank = order.paymentMethod !== 'cod' && order.paymentMethod !== 'wallet' && order.paymentStatus === 'paid';
    if (needsBank && (!returnForm.bankName || !returnForm.accountNumber || !returnForm.accountHolder)) {
      setReturnError('Vui lòng nhập thông tin tài khoản ngân hàng để nhận hoàn tiền'); return;
    }
    setSubmittingReturn(true);
    setReturnError('');
    try {
      const payload = {
        orderId: order._id,
        reason: returnForm.reason,
        description: returnForm.description,
        refundBankInfo: needsBank ? {
          bankName: returnForm.bankName,
          accountNumber: returnForm.accountNumber,
          accountHolder: returnForm.accountHolder,
        } : undefined,
      };
      const res = await createReturnRequest(payload);
      setReturnRequest(res.data.data);
      setOrder((o) => ({ ...o, status: 'return_requested' }));
      setShowReturn(false);
      showToast({ message: 'Đã gửi yêu cầu trả hàng', type: 'success' });
    } catch (err) {
      setReturnError(err.response?.data?.message || 'Không thể gửi yêu cầu trả hàng');
    } finally { setSubmittingReturn(false); }
  };

  const handleBuyAgain = async () => {
    setBuyingAgain(true);
    try {
      const results = await Promise.allSettled(
        order.items.map((item) => addCartItem(item.variantId?._id || item.variantId, item.quantity))
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      await fetchCart();
      if (fail > 0) {
        showToast({ message: `Đã thêm ${ok}/${results.length} sản phẩm (${fail} sản phẩm hết hàng)`, type: ok > 0 ? 'success' : 'error' });
      } else {
        showToast({ message: 'Đã thêm sản phẩm vào giỏ hàng', type: 'success' });
      }
      if (ok > 0) navigate('/cart');
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể thêm vào giỏ hàng', type: 'error' });
    } finally {
      setBuyingAgain(false);
    }
  };

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order?.status);
  const isCancelled = order?.status === 'cancelled';
  const isReturned = ['return_requested', 'returned'].includes(order?.status);
  const canCancel = ['pending', 'confirmed'].includes(order?.status);
  const canReturn = order?.status === 'delivered' && !returnRequest;

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="card p-5 animate-pulse h-24" />)}
    </div>
  );
  if (!order) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/orders" className="text-gray-400 hover:text-red-600 transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{order.orderCode}</h1>
          <p className="text-sm text-gray-400">
            {new Date(order.createdAt).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_MAP[order.status]?.color || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_MAP[order.status]?.text || order.status}
        </span>
      </div>

      {/* Timeline trạng thái */}
      {!isCancelled && !isReturned && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200 z-0" />
            <div className="absolute left-0 top-4 h-0.5 bg-red-500 z-0 transition-all duration-500"
              style={{ width: `${Math.max(0, (currentStepIdx / (STATUS_STEPS.length - 1)) * 100)}%` }} />
            {STATUS_STEPS.map((s, i) => {
              const done = i <= currentStepIdx;
              return (
                <div key={s.key} className="flex flex-col items-center gap-1 z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${done ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                    <s.icon size={14} />
                  </div>
                  <span className={`text-xs text-center leading-tight ${done ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thông tin yêu cầu trả hàng */}
      {returnRequest && (
        <div className={`border rounded-xl p-4 mb-4 ${RETURN_STATUS_MAP[returnRequest.status]?.bg}`}>
          <div className="flex items-start gap-3">
            <RotateCcw size={18} className={`shrink-0 mt-0.5 ${RETURN_STATUS_MAP[returnRequest.status]?.color}`} />
            <div className="flex-1">
              <p className={`font-semibold text-sm ${RETURN_STATUS_MAP[returnRequest.status]?.color}`}>
                Yêu cầu trả hàng — {RETURN_STATUS_MAP[returnRequest.status]?.text}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">Lý do: {returnRequest.reason}</p>
              {returnRequest.description && <p className="text-sm text-gray-500 mt-0.5">{returnRequest.description}</p>}
              {returnRequest.adminNote && (
                <p className="text-sm text-gray-600 mt-1 bg-white/60 rounded px-2 py-1">
                  <span className="font-medium">Ghi chú từ cửa hàng:</span> {returnRequest.adminNote}
                </p>
              )}
              {returnRequest.status === 'completed' && (
                <div className="mt-2 flex items-center gap-2 text-green-700">
                  <Banknote size={14} />
                  <span className="text-sm font-medium">
                    Đã hoàn {formatPrice(returnRequest.refundAmount)} qua {returnRequest.refundMethod === 'bank_transfer' ? 'chuyển khoản' : returnRequest.refundMethod}
                    {returnRequest.refundRef ? ` · Mã GD: ${returnRequest.refundRef}` : ''}
                  </span>
                </div>
              )}
              {returnRequest.status === 'approved' && (
                <div className="mt-2 p-2 bg-white/70 rounded-lg text-sm text-blue-700">
                  Vui lòng gửi hàng về địa chỉ cửa hàng. Sau khi nhận hàng chúng tôi sẽ xử lý hoàn tiền trong 3–5 ngày làm việc.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCancelled && order.cancelReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <span className="font-medium">Lý do hủy:</span> {order.cancelReason}
        </div>
      )}

      {/* Sản phẩm */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Package size={16} /> Sản phẩm ({order.items?.length})
        </h3>
        <div className="space-y-4">
          {order.items?.map((item, i) => (
            <div key={i} className="flex gap-3 items-center">
              <img src={item.image || 'https://placehold.co/64x64?text=📱'} alt={item.name} className="w-16 h-16 object-cover rounded-xl" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.color} · {item.storage}</p>
                <p className="text-xs text-gray-500">Số lượng: {item.quantity}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-gray-800 text-sm">{formatPrice(item.price * item.quantity)}</p>
                <p className="text-xs text-gray-400">{formatPrice(item.price)} / cái</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t mt-4 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500"><span>Tạm tính</span><span>{formatPrice(order.subtotal)}</span></div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600"><span>Giảm giá</span><span>-{formatPrice(order.discountAmount)}</span></div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>Phí vận chuyển</span>
            <span>{order.shippingFee === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Tổng cộng</span>
            <span className={`${order.paymentStatus === 'refunded' ? 'line-through text-gray-400' : 'text-red-600'}`}>{formatPrice(order.totalPrice)}</span>
          </div>
          {order.paymentStatus === 'refunded' && (
            <div className="flex justify-between text-green-600 font-semibold">
              <span>Đã hoàn tiền</span>
              <span>{formatPrice(returnRequest?.refundAmount != null ? returnRequest.refundAmount : order.totalPrice)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Địa chỉ + Thanh toán */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm"><MapPin size={14} /> Địa chỉ giao hàng</h3>
          <p className="text-sm text-gray-700 font-medium">{order.shippingAddress?.fullName}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={12} /> {order.shippingAddress?.phone}</p>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            {order.shippingAddress?.address}, {order.shippingAddress?.district}, {order.shippingAddress?.city}
          </p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm"><CreditCard size={14} /> Thanh toán</h3>
          <p className="text-sm text-gray-700">{PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod}</p>
          <p className="text-sm mt-1">
            <span className="text-gray-500">Trạng thái: </span>
            <span className={{
              paid: 'text-green-600 font-medium', pending: 'text-orange-500',
              refunded: 'text-blue-600 font-medium', failed: 'text-red-500',
            }[order.paymentStatus] || 'text-gray-500'}>
              {{ paid: 'Đã thanh toán', pending: 'Chưa thanh toán', refunded: 'Đã hoàn tiền', failed: 'Thất bại' }[order.paymentStatus] || order.paymentStatus}
            </span>
          </p>
          {order.trackingCode && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
              Mã vận đơn:
              {TRACKING_URL[order.shippingPartner] ? (
                <a
                  href={TRACKING_URL[order.shippingPartner](order.trackingCode)}
                  target="_blank" rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {order.trackingCode} <ExternalLink size={12} />
                </a>
              ) : (
                <span className="font-medium text-gray-700">{order.trackingCode}</span>
              )}
            </p>
          )}
          {order.shippingPartner === 'store_pickup' ? (
            <p className="flex items-center gap-1.5 text-sm text-blue-700 font-medium mt-1">
              <Package size={13} /> Nhận tại cửa hàng
            </p>
          ) : order.estimatedDeliveryDate && !['delivered', 'cancelled', 'returned', 'return_requested'].includes(order.status) ? (
            <p className="flex items-center gap-1.5 text-sm text-green-700 font-medium mt-1">
              <Clock size={13} /> Dự kiến giao hàng trước:{' '}
              {new Date(order.estimatedDeliveryDate).toLocaleDateString('vi-VN')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/products" className="flex-1 btn-outline py-3 rounded-xl font-semibold text-center">
          Tiếp tục mua sắm
        </Link>
        {(isCancelled || order.status === 'delivered') && (
          <button onClick={handleBuyAgain} disabled={buyingAgain}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
            {buyingAgain
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <ShoppingCart size={16} />}
            {buyingAgain ? 'Đang thêm...' : 'Mua lại'}
          </button>
        )}
        {canReturn && (
          <button onClick={() => setShowReturn(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-orange-300 text-orange-600 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-colors">
            <RotateCcw size={16} /> Yêu cầu trả hàng
          </button>
        )}
        {canCancel && (
          <button onClick={() => setShowCancel(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-50 transition-colors">
            <X size={16} /> Hủy đơn hàng
          </button>
        )}
      </div>

      {/* ── Modal hủy đơn ── */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-2">Hủy đơn hàng</h3>
            <p className="text-gray-500 text-sm mb-4">Vui lòng cho biết lý do hủy đơn <strong>{order.orderCode}</strong>:</p>
            <div className="space-y-2 mb-4">
              {['Tôi muốn thay đổi địa chỉ giao hàng', 'Tôi muốn thay đổi sản phẩm', 'Tìm được giá tốt hơn', 'Lý do khác'].map((r) => (
                <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${cancelReason === r ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="cancelReason" value={r} checked={cancelReason === r} onChange={() => setCancelReason(r)} className="accent-red-600" />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
            {cancelError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg mb-3">{cancelError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowCancel(false); setCancelError(''); }} className="flex-1 btn-outline py-2.5 rounded-xl">Giữ đơn hàng</button>
              <button onClick={handleCancel} disabled={!cancelReason || cancelling}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {cancelling && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal yêu cầu trả hàng ── */}
      {showReturn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowReturn(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Yêu cầu trả hàng</h3>
              <button onClick={() => setShowReturn(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">Chính sách đổi trả trong <strong>7 ngày</strong> kể từ khi nhận hàng. Hàng phải còn nguyên vẹn, chưa qua sử dụng.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Lý do trả hàng *</label>
                <div className="space-y-2">
                  {RETURN_REASONS.map((r) => (
                    <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${returnForm.reason === r ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="returnReason" checked={returnForm.reason === r} onChange={() => setReturnForm((f) => ({ ...f, reason: r }))} className="accent-orange-500" />
                      <span className="text-sm text-gray-700">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả chi tiết</label>
                <textarea rows={3} value={returnForm.description}
                  onChange={(e) => setReturnForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả cụ thể vấn đề của sản phẩm..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-orange-400" />
              </div>

              {/* Thông tin hoàn tiền — hiện khi đã thanh toán */}
              {order.paymentStatus === 'paid' && (
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Banknote size={15} className="text-green-600" />
                    Thông tin tài khoản nhận hoàn tiền
                  </p>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tên ngân hàng *</label>
                    <input value={returnForm.bankName} onChange={(e) => setReturnForm((f) => ({ ...f, bankName: e.target.value }))}
                      placeholder="VD: Vietcombank, Techcombank..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Số tài khoản *</label>
                    <input value={returnForm.accountNumber} onChange={(e) => setReturnForm((f) => ({ ...f, accountNumber: e.target.value }))}
                      placeholder="Nhập số tài khoản"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tên chủ tài khoản *</label>
                    <input value={returnForm.accountHolder} onChange={(e) => setReturnForm((f) => ({ ...f, accountHolder: e.target.value }))}
                      placeholder="Nhập tên chủ tài khoản (chữ in hoa)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <p className="text-xs text-gray-400">Tiền hoàn sẽ được chuyển trong 3–5 ngày làm việc sau khi cửa hàng nhận lại hàng.</p>
                </div>
              )}
            </div>

            {returnError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg mt-2">{returnError}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowReturn(false); setReturnError(''); }} className="flex-1 btn-outline py-2.5 rounded-xl">Hủy</button>
              <button onClick={handleReturnSubmit} disabled={submittingReturn || !returnForm.reason}
                className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {submittingReturn && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {submittingReturn ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
