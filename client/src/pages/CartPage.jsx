import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCoupon } from '../hooks/useCoupon';
import Breadcrumb from '../components/ui/Breadcrumb';
import CartEmpty from '../components/cart/CartEmpty';
import CartItem from '../components/cart/CartItem';
import CouponInput from '../components/cart/CouponInput';
import OrderSummary from '../components/cart/OrderSummary';

export default function CartPage() {
  const { items, removeItem, updateQty } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState(() => new Set(items.map(i => i.variantId)));
  const selectAllRef = useRef(null);

  // Sync selection when items are added/removed:
  // - remove IDs no longer in cart
  // - auto-select only newly added items (preserve user's manual deselection)
  useEffect(() => {
    setSelectedIds(prev => {
      const currentIds = new Set(items.map(i => i.variantId));
      const next = new Set([...prev].filter(id => currentIds.has(id)));
      for (const id of currentIds) {
        if (!prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [items]);

  // Indeterminate state for "chọn tất cả"
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < items.length;
    }
  }, [selectedIds.size, items.length]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.variantId)));

  const toggleOne = (variantId) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(variantId) ? next.delete(variantId) : next.add(variantId);
      return next;
    });

  const selectedItems = items.filter(i => selectedIds.has(i.variantId));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingFee = selectedTotal > 0 ? (selectedTotal >= 5000000 ? 0 : 30000) : 0;

  const { couponCode, setCouponCode, coupon, couponError, applying, handleApply, handleRemove } = useCoupon(selectedTotal);
  const grandTotal = selectedTotal + shippingFee - (coupon?.discountAmount || 0);

  const handleCheckout = () => {
    if (!selectedIds.size) return;
    if (!user) navigate('/login', { state: { from: '/checkout' } });
    else navigate('/checkout', { state: { coupon, selectedVariantIds: [...selectedIds] } });
  };

  if (!items.length) return <CartEmpty />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Giỏ hàng' }]} />
      <h1 className="section-title text-2xl mb-6">
        Giỏ hàng <span className="text-gray-400 font-normal text-lg">({items.length} sản phẩm)</span>
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {/* Chọn tất cả */}
          <div className="card px-4 py-3 flex items-center gap-3">
            <input
              type="checkbox"
              ref={selectAllRef}
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
            <span className="text-sm text-gray-600 flex-1">Chọn tất cả ({items.length} sản phẩm)</span>
            {selectedIds.size > 0 && selectedIds.size < items.length && (
              <span className="text-xs text-gray-400">Đã chọn {selectedIds.size}</span>
            )}
          </div>

          {items.map((item) => (
            <CartItem
              key={item.variantId}
              item={item}
              selected={selectedIds.has(item.variantId)}
              onToggle={toggleOne}
              onUpdateQty={updateQty}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="space-y-4">
          <CouponInput
            coupon={coupon}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
            couponError={couponError}
            applying={applying}
            onApply={handleApply}
            onRemove={handleRemove}
          />
          <OrderSummary
            selectedItems={selectedItems}
            total={selectedTotal}
            coupon={coupon}
            shippingFee={shippingFee}
            grandTotal={grandTotal}
            user={user}
            onCheckout={handleCheckout}
          />
        </div>
      </div>
    </div>
  );
}
