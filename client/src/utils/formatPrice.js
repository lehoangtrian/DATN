export const formatPrice = (price) => {
  const n = Number(price);
  if (price == null || !Number.isFinite(n)) return '0₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
};

export const discountPercent = (original, current) => {
  if (!original || original <= 0) return 0;
  return Math.round(((original - current) / original) * 100);
};
