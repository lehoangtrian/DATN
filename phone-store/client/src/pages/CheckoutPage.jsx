import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { holdStock, releaseHold } from '../api/cart';
import { createOrder } from '../api/orders';
import { formatPrice } from '../utils/formatPrice';
import { getWalletBalance } from '../api/wallet';
import { getMe } from '../api/auth';
import { MapPin, CreditCard, CheckCircle, ChevronRight, Truck, Banknote, Building2, Wallet, Gem } from 'lucide-react';
import Breadcrumb from '../components/ui/Breadcrumb';
import { createVNPayPaymentUrl } from '../api/payments';

const STEPS = ['Địa chỉ', 'Thanh toán', 'Xác nhận'];

export default function CheckoutPage() {
  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [holdInfo, setHoldInfo] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  const { items, clearCart, cartLoading } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const coupon = location.state?.coupon || null;
  const selectedVariantIds = location.state?.selectedVariantIds || null;
  const discountAmount = coupon?.discountAmount || 0;

  const displayItems = selectedVariantIds
    ? items.filter(i => selectedVariantIds.includes(i.variantId))
    : items;
  const total = displayItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm({
    defaultValues: {
      fullName: user?.name || '',
      phone: user?.phone || '',
      address: '',
      city: '',
      district: '',
      note: '',
    },
  });

  useEffect(() => {
    getWalletBalance().then((r) => setWalletBalance(r.data.data?.balance || 0)).catch(() => {});
    getMe().then((r) => setPointsBalance(r.data.data?.loyaltyPoints || 0)).catch(() => {});
  }, []);

  // Release hold khi user rời trang giữa chừng (sau khi đã hold stock ở step 1)
  useEffect(() => {
    return () => {
      if (holdInfo) releaseHold().catch(() => {});
    };
  }, [holdInfo]);

  const shippingFee = total >= 5000000 ? 0 : 30000;
  const totalAfterCoupon = Math.max(0, total + shippingFee - discountAmount);
  // 1 điểm = 1.000đ — không cho dùng quá số điểm đang có lẫn quá phần còn phải trả
  const maxUsablePoints = Math.max(0, Math.min(pointsBalance, Math.floor(totalAfterCoupon / 1000)));
  const pointsUsed = Math.min(pointsToUse, maxUsablePoints);
  const pointsDiscount = pointsUsed * 1000;
  const grandTotal = Math.max(0, totalAfterCoupon - pointsDiscount);

  const PAYMENT_METHODS = [
    { value: 'cod',           label: 'Thanh toán khi nhận hàng (COD)', icon: Banknote,  desc: 'Thanh toán bằng tiền mặt khi nhận hàng' },
    { value: 'wallet',        label: `Ví điện tử`, icon: Wallet, desc: `Số dư: ${formatPrice(walletBalance)}`, badge: walletBalance >= grandTotal ? 'Đủ số dư' : 'Không đủ số dư', disabled: walletBalance < grandTotal },
    { value: 'vnpay',         label: 'Thanh toán qua VNPay', icon: Building2, desc: 'ATM nội địa · Thẻ quốc tế · QR Code', badge: 'Nhanh & An toàn' },
    { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng', icon: CreditCard, desc: 'Chuyển khoản trước, xác nhận sau 1-2 giờ' },
  ];

  // Bước 1 → 2: lưu địa chỉ + hold stock
  const handleAddressNext = async (data) => {
    setLoading(true);
    setError('');
    try {
      const res = await holdStock(selectedVariantIds ? { variantIds: selectedVariantIds } : {});
      setHoldInfo(res.data.data);
      setStep(1);
    } catch (err) {
      const failures = err.response?.data?.failures;
      if (failures?.length) {
        setError(`Sản phẩm "${failures[0].name}" chỉ còn ${failures[0].available} trong kho`);
      } else {
        setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  // Bước 2 → 3
  const handlePaymentNext = () => setStep(2);

  // Bước 3: đặt hàng
  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const addr = getValues();
      const res = await createOrder({
        shippingAddress: {
          fullName: addr.fullName,
          phone: addr.phone,
          address: addr.address,
          city: addr.city,
          district: addr.district,
        },
        paymentMethod,
        shippingPartner: 'GHN',
        note: addr.note,
        couponCode: coupon?.code || undefined,
        pointsUsed: pointsUsed || undefined,
        selectedVariantIds: selectedVariantIds || undefined,
      });

      const order = res.data.data;

      if (paymentMethod === 'vnpay') {
        const payRes = await createVNPayPaymentUrl(order._id);
        clearCart();
        navigate('/payment/vnpay', {
          state: { paymentUrl: payRes.data.data.paymentUrl, order },
          replace: true,
        });
        return;
      }

      if (paymentMethod === 'bank_transfer') {
        clearCart();
        navigate('/payment/bank-transfer', { state: { order }, replace: true });
        return;
      }

      // Ví điện tử hoặc COD → thành công ngay
      clearCart();
      navigate('/orders/success', { state: { order }, replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt hàng thất bại, vui lòng thử lại');
      releaseHold().catch(() => {}); // giải phóng hold để khách có thể thử lại
      setHoldInfo(null);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  // Đợi cart load xong mới redirect — tránh redirect sai khi CartContext chưa có dữ liệu
  if (!cartLoading && !displayItems.length) return <Navigate to="/cart" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Giỏ hàng', href: '/cart' }, { label: 'Thanh toán' }]} />
      <h1 className="section-title text-2xl mb-4">Thanh toán</h1>

      {/* Progress bar */}
      <div className="relative mb-8">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 mx-10" />
        <div className="absolute top-4 left-0 h-0.5 bg-blue-600 mx-10 transition-all duration-300"
          style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        <div className="relative flex justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 z-10 bg-white transition-all ${i < step ? 'bg-blue-600 border-blue-600 text-white' : i === step ? 'border-blue-600 text-blue-600' : 'border-gray-300 text-gray-400'}`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="md:col-span-2">

          {/* STEP 0 — Địa chỉ giao hàng */}
          {step === 0 && (
            <form onSubmit={handleSubmit(handleAddressNext)} className="card p-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-semibold mb-2">
                <MapPin size={18} /> Địa chỉ giao hàng
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Họ và tên *</label>
                  <input {...register('fullName', { required: 'Vui lòng nhập họ tên' })}
                    placeholder="Nguyễn Văn A"
                    className="input-field" />
                  {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Số điện thoại *</label>
                  <input {...register('phone', { required: 'Vui lòng nhập SĐT', pattern: { value: /^(0|\+84)[0-9]{9}$/, message: 'SĐT không hợp lệ' } })}
                    placeholder="0912 345 678"
                    className="input-field" />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Địa chỉ (số nhà, đường) *</label>
                <input {...register('address', { required: 'Vui lòng nhập địa chỉ' })}
                  placeholder="123 Đường Nguyễn Huệ"
                  className="input-field" />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Tỉnh / Thành phố *</label>
                  <input {...register('city', { required: 'Vui lòng nhập tỉnh/TP' })}
                    placeholder="TP. Hồ Chí Minh"
                    className="input-field" />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Quận / Huyện *</label>
                  <input {...register('district', { required: 'Vui lòng nhập quận/huyện' })}
                    placeholder="Quận 1"
                    className="input-field" />
                  {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Ghi chú (tùy chọn)</label>
                <textarea {...register('note')} rows={2}
                  placeholder="Giao giờ hành chính, gọi trước khi giao..."
                  className="input-field resize-none" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full btn-primary py-3 disabled:opacity-60">
                {loading ? 'Đang kiểm tra hàng...' : 'Tiếp tục →'}
              </button>
            </form>
          )}

          {/* STEP 1 — Phương thức thanh toán */}
          {step === 1 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 text-blue-600 font-semibold mb-4">
                <CreditCard size={18} /> Phương thức thanh toán
              </div>

              {holdInfo && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm px-4 py-3 rounded-xl mb-4">
                  Hàng đã được giữ cho bạn. Vui lòng hoàn tất trong{' '}
                  <span className="font-bold">15 phút</span>.
                </div>
              )}

              <div className="space-y-3 mb-6">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m.value}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${m.disabled ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' : 'cursor-pointer ' + (paymentMethod === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}`}>
                    <input type="radio" name="payment" value={m.value}
                      checked={paymentMethod === m.value}
                      disabled={m.disabled}
                      onChange={() => !m.disabled && setPaymentMethod(m.value)}
                      className="accent-blue-600" />
                    <m.icon size={24} className={paymentMethod === m.value ? 'text-blue-600' : 'text-gray-400'} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 text-sm">{m.label}</p>
                        {m.badge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.disabled ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { releaseHold().catch(() => {}); setHoldInfo(null); setStep(0); }} className="flex-1 btn-outline py-3">
                  ← Quay lại
                </button>
                <button onClick={handlePaymentNext} className="flex-1 btn-primary py-3">
                  Xem lại đơn →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Xác nhận đơn hàng */}
          {step === 2 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 text-blue-600 font-semibold mb-4">
                <CheckCircle size={18} /> Xác nhận đơn hàng
              </div>

              {holdInfo && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm px-4 py-3 rounded-xl mb-4">
                  Hàng đã được giữ cho bạn. Vui lòng hoàn tất trong{' '}
                  <span className="font-bold">15 phút</span>.
                </div>
              )}

              {/* Địa chỉ */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm">
                <p className="font-medium text-gray-700 mb-1">Giao đến:</p>
                <p className="text-gray-600">{getValues('fullName')} · {getValues('phone')}</p>
                <p className="text-gray-600">{getValues('address')}, {getValues('district')}, {getValues('city')}</p>
              </div>

              {/* Sản phẩm */}
              <div className="space-y-3 mb-4">
                {displayItems.map((item) => (
                  <div key={item.variantId} className="flex gap-3 items-center">
                    <img src={item.image || 'https://placehold.co/60x60?text=📱'} alt={item.name}
                      className="w-14 h-14 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.color} · {item.storage} · x{item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 shrink-0">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 btn-outline py-3">
                  ← Quay lại
                </button>
                <button onClick={handlePlaceOrder} disabled={loading}
                  className="flex-1 btn-primary py-3 disabled:opacity-60">
                  {loading ? 'Đang đặt hàng...' : '🛒 Đặt hàng ngay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Tóm tắt đơn hàng</h3>
            <div className="space-y-2 text-sm mb-4">
              {displayItems.map((item) => (
                <div key={item.variantId} className="flex justify-between text-gray-600">
                  <span className="line-clamp-1 flex-1 mr-2">{item.name} x{item.quantity}</span>
                  <span className="shrink-0">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1"><Truck size={14} /> Phí ship</span>
                <span className={shippingFee === 0 ? 'text-green-600 font-medium' : ''}>
                  {shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
                </span>
              </div>
              {shippingFee === 0 && (
                <p className="text-xs text-green-600">Miễn phí ship cho đơn từ 5 triệu</p>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Mã giảm giá ({coupon.code})</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Điểm tích lũy ({pointsUsed} điểm)</span>
                  <span>-{formatPrice(pointsDiscount)}</span>
                </div>
              )}
            </div>

            {/* Dùng điểm tích lũy */}
            {pointsBalance > 0 && (
              <div className="border-t mt-3 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Gem size={14} className="text-blue-500" /> Dùng điểm tích lũy
                  </span>
                  <span className="text-xs text-gray-400">Có {pointsBalance.toLocaleString('vi-VN')} điểm</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxUsablePoints}
                    value={pointsToUse || ''}
                    onChange={(e) => setPointsToUse(Math.max(0, Math.min(maxUsablePoints, Number(e.target.value) || 0)))}
                    placeholder="0"
                    className="input-field py-1.5 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setPointsToUse(maxUsablePoints)}
                    className="text-xs text-blue-600 font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 whitespace-nowrap"
                  >
                    Dùng tối đa
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">1 điểm = 1.000đ · tối đa {maxUsablePoints.toLocaleString('vi-VN')} điểm cho đơn này</p>
              </div>
            )}

            <div className="border-t mt-3 pt-3 flex justify-between font-bold text-base">
              <span>Tổng cộng</span>
              <span className="text-blue-600">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          <div className="card p-4 text-sm text-gray-500 space-y-2">
            <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Bảo hành chính hãng 12 tháng</div>
            <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Đổi trả trong 7 ngày</div>
            <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Hỗ trợ 24/7</div>
          </div>
        </div>
      </div>
    </div>
  );
}
