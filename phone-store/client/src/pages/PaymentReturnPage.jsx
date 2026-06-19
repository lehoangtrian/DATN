import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ShoppingBag, Home } from 'lucide-react';
import { getPaymentStatus } from '../api/payments';
import { formatPrice } from '../utils/formatPrice';

const VNPAY_CODES = {
  '07': 'Giao dịch bị nghi ngờ gian lận',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking',
  '10': 'Xác thực thông tin thẻ/tài khoản quá 3 lần',
  '11': 'Đã hết hạn chờ thanh toán',
  '12': 'Thẻ/tài khoản bị khóa',
  '13': 'Sai mật khẩu OTP',
  '24': 'Khách hàng hủy giao dịch',
  '51': 'Tài khoản không đủ số dư',
  '65': 'Tài khoản vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng đang bảo trì',
  '79': 'Sai mật khẩu thanh toán quá số lần quy định',
};

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const isSuccess = searchParams.get('success') === 'true';
  const orderId = searchParams.get('orderId');
  const errorCode = searchParams.get('code');
  const reason = searchParams.get('reason');

  useEffect(() => {
    if (!orderId) return;
    setLoadingOrder(true);
    getPaymentStatus(orderId)
      .then((res) => setOrder(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingOrder(false));
  }, [orderId]);

  const errorMsg = VNPAY_CODES[errorCode] || (reason === 'invalid_signature' ? 'Chữ ký không hợp lệ' : 'Thanh toán thất bại hoặc bị hủy');

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {isSuccess ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thành công!</h1>
            <p className="text-gray-500 mb-6">Đơn hàng của bạn đã được xác nhận và đang được xử lý.</p>

            {loadingOrder ? (
              <Loader2 size={20} className="animate-spin mx-auto text-gray-400 mb-6" />
            ) : order && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mã đơn hàng</span>
                  <span className="font-semibold text-gray-800">{order.orderCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tổng thanh toán</span>
                  <span className="font-bold text-red-600">{formatPrice(order.totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trạng thái</span>
                  <span className="text-green-600 font-medium">Đã thanh toán</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thất bại</h1>
            <p className="text-gray-500 mb-6">{errorMsg}</p>
            {orderId && (
              <p className="text-sm text-gray-400 mb-6">
                Đơn hàng vẫn được lưu. Bạn có thể thử thanh toán lại từ trang đơn hàng.
              </p>
            )}
          </>
        )}

        <div className="flex gap-3 justify-center">
          {orderId && (
            <Link to={`/orders/${orderId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors text-sm">
              <ShoppingBag size={16} /> Xem đơn hàng
            </Link>
          )}
          <Link to="/"
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm">
            <Home size={16} /> Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
