import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import {
  getCart as apiGetCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart as apiClearCart,
} from '../api/cart';

const CartContext = createContext(null);

// Map cart items từ server sang format dùng trong frontend
const mapItems = (serverItems = []) =>
  serverItems.map((item) => ({
    variantId: item.variantId?._id || item.variantId,
    productId: item.productId?._id || item.productId,
    name: item.productId?.name || '',
    slug: item.productId?.slug || '',
    image: item.productId?.images?.[0] || '',
    color: item.variantId?.color || '',
    storage: item.variantId?.storage || '',
    price: item.effectivePrice || item.price || 0,
    quantity: item.quantity,
    stock: item.variantId?.stock ?? Infinity,
  }));

export const CartProvider = ({ children }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setCartLoading(true);
    try {
      const res = await apiGetCart();
      setItems(mapItems(res.data.data?.items || []));
    } catch {
      setItems([]);
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  // Load cart từ server mỗi khi user thay đổi (login / logout)
  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addItem = async (product, variant, qty = 1, flashSalePrice = null) => {
    if (!user) {
      showToast({ message: 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng', type: 'error' });
      navigate('/login');
      return;
    }
    if (!variant) return;

    const key = variant._id;
    const price = flashSalePrice ?? variant.salePrice ?? variant.price;
    const maxStock = variant.stock ?? Infinity;

    // Kiểm tra giới hạn tồn kho trước khi gọi API
    const existing = items.find((i) => i.variantId === key);
    if (existing && existing.quantity >= maxStock) {
      showToast({ message: `"${product.name}" đã đạt giới hạn tồn kho (${maxStock})`, type: 'error' });
      return;
    }

    // Optimistic update — UI phản hồi ngay lập tức
    setItems((prev) => {
      const ex = prev.find((i) => i.variantId === key);
      if (ex) {
        return prev.map((i) =>
          i.variantId === key ? { ...i, quantity: Math.min(i.quantity + qty, maxStock) } : i
        );
      }
      return [...prev, {
        variantId: key,
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0] || '',
        color: variant.color,
        storage: variant.storage,
        price,
        quantity: Math.min(qty, maxStock),
        stock: maxStock,
      }];
    });

    try {
      await addCartItem(key, qty);
      showToast({ message: `Đã thêm "${product.name}" vào giỏ hàng`, type: 'success', image: product.images?.[0] || null });
    } catch (err) {
      // Rollback nếu server từ chối
      fetchCart();
      showToast({ message: err.response?.data?.message || 'Không thể thêm vào giỏ hàng', type: 'error' });
    }
  };

  const removeItem = async (variantId) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
    try {
      await removeCartItem(variantId);
    } catch (err) {
      fetchCart();
      showToast({ message: err.response?.data?.message || 'Không thể xóa sản phẩm khỏi giỏ hàng', type: 'error' });
    }
  };

  const updateQty = async (variantId, quantity) => {
    if (quantity < 1) return removeItem(variantId);
    setItems((prev) => prev.map((i) => {
      if (i.variantId !== variantId) return i;
      return { ...i, quantity: Math.min(quantity, i.stock ?? Infinity) };
    }));
    try {
      await updateCartItem(variantId, quantity);
    } catch (err) {
      fetchCart();
      showToast({ message: err.response?.data?.message || 'Không thể cập nhật số lượng', type: 'error' });
    }
  };

  const clearCart = async () => {
    setItems([]);
    try { await apiClearCart(); } catch { /* cart đã clear local, bỏ qua lỗi server */ }
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, itemCount, cartLoading, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
