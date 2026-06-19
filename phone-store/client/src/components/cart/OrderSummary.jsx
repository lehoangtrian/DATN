import { ArrowRight } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';

export default function OrderSummary({ selectedItems, total, coupon, shippingFee, grandTotal, user, onCheckout }) {
  const discount = coupon?.discountAmount || 0;
  const hasSelected = selectedItems.length > 0;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Tóm tắt đơn hàng</h3>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex justify-between">
            <span>Tạm tính ({selectedItems.length} sản phẩm)</span>
            <span>{formatPrice(total)}</span>
          </div>
          {coupon && (
            <div className="flex justify-between text-green-600 font-medium">
              <span>Giảm giá ({coupon.code})</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Phí vận chuyển</span>
            <span className={shippingFee === 0 && hasSelected ? 'text-green-600 font-medium' : ''}>
              {!hasSelected ? '—' : shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
            </span>
          </div>
          {hasSelected && shippingFee > 0 && (
            <p className="text-xs text-gray-400">Miễn phí ship cho đơn từ 5 triệu</p>
          )}
        </div>
        <div className="border-t pt-3 flex justify-between font-bold text-base mb-4">
          <span>Tổng cộng</span>
          <span className="text-blue-600">{hasSelected ? formatPrice(grandTotal) : '—'}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={!hasSelected}
          className="w-full flex items-center justify-center gap-2 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasSelected
            ? (user ? `Đặt hàng (${selectedItems.length} sản phẩm)` : 'Đăng nhập để thanh toán')
            : 'Vui lòng chọn sản phẩm'}
          {hasSelected && <ArrowRight size={16} />}
        </button>
      </div>

      <div className="card p-4 text-xs text-gray-500 space-y-1.5">
        <p>✅ Bảo hành chính hãng 12 tháng</p>
        <p>✅ Đổi trả miễn phí trong 7 ngày</p>
        <p>✅ Giao hàng toàn quốc</p>
      </div>
    </div>
  );
}
