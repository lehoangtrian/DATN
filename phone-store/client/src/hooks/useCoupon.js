import { useState, useEffect } from 'react';
import { validateCoupon } from '../api/coupons';

export function useCoupon(cartTotal) {
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  // Khi cartTotal thay đổi: invalidate nếu dưới minOrderValue, hoặc tái tính discountAmount cho percent coupon
  useEffect(() => {
    if (!coupon) return;
    if (coupon.minOrderValue > 0 && cartTotal < coupon.minOrderValue) {
      setCoupon(null);
      setCouponError(
        `Đơn hàng tối thiểu ${coupon.minOrderValue.toLocaleString('vi-VN')}đ để dùng mã này`
      );
      return;
    }
    if (coupon.type === 'percent') {
      const newDiscount = Math.min(
        Math.round((cartTotal * coupon.value) / 100),
        coupon.maxDiscountAmount || Infinity
      );
      if (newDiscount !== coupon.discountAmount) {
        setCoupon((prev) => ({ ...prev, discountAmount: newDiscount }));
      }
    }
  }, [cartTotal, coupon]);

  const handleApply = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError('');
    try {
      const res = await validateCoupon(couponCode.trim(), cartTotal);
      if (res.data?.data) {
        setCoupon(res.data.data);
      } else {
        setCouponError('Mã giảm giá không hợp lệ');
        setCoupon(null);
      }
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Mã không hợp lệ');
      setCoupon(null);
    } finally { setApplying(false); }
  };

  const handleRemove = () => {
    setCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  return { couponCode, setCouponCode, coupon, couponError, applying, handleApply, handleRemove };
}
