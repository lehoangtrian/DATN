import { useEffect, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, Clock, Building2, ArrowRight } from 'lucide-react';
import { formatPrice } from '../utils/formatPrice';
import { useToast } from '../context/ToastContext';

const BANK_ID      = import.meta.env.VITE_BANK_ID      || 'MB';
const BANK_ACCOUNT = import.meta.env.VITE_BANK_ACCOUNT || '0123456789';
const BANK_HOLDER  = import.meta.env.VITE_BANK_HOLDER  || 'PHONE STORE';
const TIMEOUT_SEC  = 15 * 60; // 15 phút

function buildQrUrl(amount, description) {
  const base = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.png`;
  const params = new URLSearchParams({
    amount,
    addInfo: description,
    accountName: BANK_HOLDER,
  });
  return `${base}?${params.toString()}`;
}

export default function BankTransferPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const { showToast } = useToast();
  const order = state?.order;

  const [seconds, setSeconds] = useState(TIMEOUT_SEC);
  const [copied, setCopied]   = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (confirmed) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timer); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmed]);

  if (!order) return <Navigate to="/" replace />;

  const description = `${order.orderCode}`;
  const qrUrl = buildQrUrl(order.totalPrice, description);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const isExpired = seconds === 0;

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleConfirmed = () => {
    setConfirmed(true);
    showToast({
      message: 'Cảm ơn! Đơn hàng sẽ được xác nhận sau khi kiểm tra thanh toán.',
      type: 'success',
    });
    setTimeout(() => navigate(`/orders/${order._id}`, { replace: true }), 1500);
  };

  const CopyBtn = ({ text, id }) => (
    <button
      onClick={() => copyText(text, id)}
      className="ml-2 text-gray-400 hover:text-red-600 transition-colors shrink-0"
      title="Sao chép"
    >
      {copied === id ? <CheckCircle size={15} className="text-green-500" /> : <Copy size={15} />}
    </button>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">Thanh toán chuyển khoản</h1>
      <p className="text-center text-gray-500 text-sm mb-6">
        Quét mã QR hoặc chuyển khoản thủ công theo thông tin bên dưới
      </p>

      {/* Countdown */}
      <div className={`flex items-center justify-center gap-2 mb-6 text-sm font-medium ${isExpired ? 'text-red-500' : 'text-orange-500'}`}>
        <Clock size={16} />
        {isExpired
          ? 'Đã hết thời gian — vui lòng đặt lại đơn hàng'
          : <>Thời gian còn lại: <span className="font-mono font-bold text-base">{mm}:{ss}</span></>
        }
      </div>

      <div className="card p-6 space-y-6">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="border-2 border-gray-100 rounded-2xl p-3 bg-white shadow-sm">
            <img
              src={qrUrl}
              alt="QR chuyển khoản"
              className="w-52 h-52 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Building2 size={12} /> Powered by VietQR
          </p>
        </div>

        {/* Bank info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
          <InfoRow label="Ngân hàng"   value={BANK_ID} />
          <InfoRow label="Số tài khoản" value={BANK_ACCOUNT} copyId="account" onCopy={copyText} copied={copied} />
          <InfoRow label="Chủ tài khoản" value={BANK_HOLDER} />
          <InfoRow
            label="Số tiền"
            value={<span className="font-bold text-red-600 text-base">{formatPrice(order.totalPrice)}</span>}
            copyId="amount"
            rawValue={String(order.totalPrice)}
            onCopy={copyText}
            copied={copied}
          />
          <InfoRow
            label="Nội dung CK"
            value={<span className="font-mono font-semibold">{description}</span>}
            copyId="desc"
            rawValue={description}
            onCopy={copyText}
            copied={copied}
          />
        </div>

        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 text-center">
          Nhập chính xác nội dung chuyển khoản <strong>{description}</strong> để đơn hàng được xác nhận tự động.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirmed}
            disabled={isExpired || confirmed}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={18} />
            {confirmed ? 'Đang xử lý...' : 'Tôi đã chuyển khoản'}
          </button>
          <button
            onClick={() => navigate(`/orders/${order._id}`)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Xem chi tiết đơn hàng <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyId, rawValue, onCopy, copied }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0 w-36">{label}</span>
      <div className="flex items-center flex-1 justify-end">
        <span className="text-gray-800 text-right">{value}</span>
        {copyId && onCopy && (
          <button
            onClick={() => onCopy(rawValue ?? String(value), copyId)}
            className="ml-2 text-gray-400 hover:text-red-600 transition-colors shrink-0"
          >
            {copied === copyId
              ? <CheckCircle size={15} className="text-green-500" />
              : <Copy size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}
