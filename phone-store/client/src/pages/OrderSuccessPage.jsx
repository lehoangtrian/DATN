import { useLocation, Link, Navigate } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Phone, Clock } from 'lucide-react';
import { formatPrice } from '../utils/formatPrice';

const STATUS_LABEL = {
  pending:   { text: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { text: 'Đã xác nhận',  color: 'bg-blue-100 text-blue-700' },
};

export default function OrderSuccessPage() {
  const { state } = useLocation();
  const order = state?.order;

  if (!order) return <Navigate to="/" replace />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={48} className="text-green-500" />
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Đặt hàng thành công!</h1>
      <p className="text-gray-500 mb-8">Cảm ơn bạn đã mua hàng. Đơn hàng của bạn đang được xử lý.</p>

      {/* Order info */}
      <div className="card p-6 text-left mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Mã đơn hàng</p>
            <p className="font-bold text-gray-800 text-lg tracking-wide">{order.orderCode}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_LABEL[order.status]?.color || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[order.status]?.text || order.status}
          </span>
        </div>

        {/* Items */}
        <div className="space-y-3 mb-4 border-t pt-4">
          {order.items?.map((item, i) => (
            <div key={i} className="flex gap-3 items-center">
              <img src={item.image || 'https://placehold.co/56x56?text=📱'} alt={item.name}
                className="w-14 h-14 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.name}</p>
                <p className="text-xs text-gray-500">{item.color} · {item.storage} · x{item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-gray-800">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tạm tính</span><span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Giảm giá (mã coupon)</span><span>-{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>Phí ship</span>
            <span>{order.shippingFee === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
            <span>Tổng cộng</span>
            <span className="text-red-600">{formatPrice(order.totalPrice)}</span>
          </div>
        </div>

        {/* Địa chỉ */}
        <div className="border-t mt-4 pt-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Package size={14} /> Giao đến
          </p>
          <p>{order.shippingAddress?.fullName} · {order.shippingAddress?.phone}</p>
          <p>{order.shippingAddress?.address}, {order.shippingAddress?.district}, {order.shippingAddress?.city}</p>
          {order.shippingPartner === 'store_pickup' ? (
            <p className="flex items-center gap-1.5 mt-2 text-sm text-blue-700 font-medium">
              <Package size={14} /> Nhận tại cửa hàng
            </p>
          ) : order.estimatedDeliveryDate ? (
            <p className="flex items-center gap-1.5 mt-2 text-sm text-green-700 font-medium">
              <Clock size={14} /> Dự kiến giao hàng trước:{' '}
              {new Date(order.estimatedDeliveryDate).toLocaleDateString('vi-VN')}
            </p>
          ) : null}
        </div>

        {/* Phương thức thanh toán */}
        <div className="border-t mt-4 pt-4 text-sm">
          <span className="text-gray-500">Thanh toán: </span>
          <span className="font-medium text-gray-700">
            {{ cod: 'Thanh toán khi nhận hàng (COD)', vnpay: 'VNPay', bank_transfer: 'Chuyển khoản ngân hàng' }[order.paymentMethod] || order.paymentMethod}
          </span>
        </div>
      </div>

      {/* Hotline */}
      <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3 mb-8 text-left">
        <Phone size={20} className="text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-800">Cần hỗ trợ?</p>
          <p className="text-sm text-gray-500">Gọi hotline <span className="font-bold text-red-600">1800 1234</span> · Miễn phí · 8:00 - 22:00</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to={`/orders/${order._id}`}
          className="flex items-center justify-center gap-2 btn-primary px-6 py-3 rounded-xl font-semibold">
          Xem chi tiết đơn hàng <ArrowRight size={16} />
        </Link>
        <Link to="/" className="flex items-center justify-center gap-2 btn-outline px-6 py-3 rounded-xl font-semibold">
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}
