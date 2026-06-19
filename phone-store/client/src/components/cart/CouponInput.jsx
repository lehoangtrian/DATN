import { Tag, X } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';

export default function CouponInput({ coupon, couponCode, setCouponCode, couponError, applying, onApply, onRemove }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Tag size={16} className="text-blue-500" /> Mã giảm giá
      </h3>

      {coupon ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <div>
            <p className="text-sm font-bold text-green-700 font-mono">{coupon.code}</p>
            <p className="text-xs text-green-600">Giảm {formatPrice(coupon.discountAmount)}</p>
          </div>
          <button onClick={onRemove} className="text-green-500 hover:text-red-500 transition-colors">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value.trim().toUpperCase()); }}
              onKeyDown={(e) => e.key === 'Enter' && onApply()}
              placeholder="Nhập mã..."
              className="input-field flex-1 uppercase"
            />
            <button
              onClick={onApply}
              disabled={applying || !couponCode.trim()}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-60 shrink-0"
            >
              {applying ? '...' : 'Áp dụng'}
            </button>
          </div>
          {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
        </div>
      )}
    </div>
  );
}
