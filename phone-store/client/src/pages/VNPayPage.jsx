import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { ExternalLink, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { formatPrice } from '../utils/formatPrice';

const TIMEOUT_SEC = 15 * 60;

function buildQrImageUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(text)}`;
}

export default function VNPayPage() {
  const { state } = useLocation();
  const paymentUrl = state?.paymentUrl;
  const order      = state?.order;

  const [seconds, setSeconds]     = useState(TIMEOUT_SEC);
  const [qrError, setQrError]     = useState(false);
  const [qrKey, setQrKey]         = useState(0); // dùng để reload QR

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timer); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!paymentUrl || !order) return <Navigate to="/" replace />;

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const isExpired = seconds === 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <img
          src="https://vnpay.vn/s1/statics/deployed/build/deploy/pc/img/logo-icon/icon-vnpay.jpg"
          alt="VNPay"
          className="w-10 h-10 rounded-xl object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h1 className="text-2xl font-bold text-gray-800">Thanh toán VNPay</h1>
      </div>
      <p className="text-center text-gray-500 text-sm mb-6">
        Quét mã QR bằng app ngân hàng hoặc ví điện tử hỗ trợ VNPay QR
      </p>

      {/* Countdown */}
      <div className={`flex items-center justify-center gap-2 mb-5 text-sm font-medium ${isExpired ? 'text-red-500' : 'text-orange-500'}`}>
        <Clock size={16} />
        {isExpired
          ? 'Đã hết thời gian thanh toán'
          : <> Mã QR hết hạn sau: <span className="font-mono font-bold text-base ml-1">{mm}:{ss}</span></>
        }
      </div>

      <div className="card p-6 space-y-5">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          {!qrError ? (
            <div className="border-2 border-blue-100 rounded-2xl p-2 bg-white shadow-sm relative">
              <img
                key={qrKey}
                src={buildQrImageUrl(paymentUrl)}
                alt="VNPay QR"
                className="w-56 h-56 object-contain"
                onError={() => setQrError(true)}
              />
              {isExpired && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-xl">
                  <p className="text-red-500 font-semibold text-sm mb-2">Mã QR đã hết hạn</p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-56 h-56 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <p className="text-xs text-gray-400 text-center px-4">Không tải được QR<br />Vui lòng dùng nút bên dưới</p>
              <button onClick={() => { setQrError(false); setQrKey(k => k + 1); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <RefreshCw size={12} /> Thử lại
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Dùng app <strong>VNPay</strong>, <strong>MoMo</strong>, hoặc app ngân hàng<br />hỗ trợ VietQR / VNPay QR để quét
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Mã đơn hàng</span>
            <span className="font-semibold text-gray-800 font-mono">{order.orderCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Số tiền</span>
            <span className="font-bold text-red-600 text-base">{formatPrice(order.totalPrice)}</span>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
          <ShieldCheck size={16} className="shrink-0 mt-0.5" />
          <span>Giao dịch được bảo mật bởi VNPay. Không chia sẻ mã QR với người khác.</span>
        </div>

        {/* Button to VNPay website */}
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-colors ${isExpired ? 'bg-gray-300 pointer-events-none' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <ExternalLink size={18} />
          Mở trang thanh toán VNPay
        </a>
      </div>
    </div>
  );
}
