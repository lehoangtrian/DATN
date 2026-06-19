import { ShoppingBag } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function CartEmpty() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <EmptyState
        icon={ShoppingBag}
        title="Giỏ hàng trống"
        description="Hãy thêm sản phẩm vào giỏ hàng của bạn"
        actionLabel="Mua sắm ngay"
        actionHref="/products"
      />
    </div>
  );
}
