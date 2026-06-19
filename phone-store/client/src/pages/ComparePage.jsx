import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import Breadcrumb from '../components/ui/Breadcrumb';
import { compareProducts } from '../api/products';
import { formatPrice } from '../utils/formatPrice';
import { ShoppingCart, X, Star, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';

const SPEC_LABELS = [
  { key: 'display',     label: 'Màn hình' },
  { key: 'chip',        label: 'Chip' },
  { key: 'ram',         label: 'RAM' },
  { key: 'battery',     label: 'Pin' },
  { key: 'camera',      label: 'Camera' },
  { key: 'os',          label: 'Hệ điều hành' },
  { key: 'sim',         label: 'SIM' },
  { key: 'connectivity',label: 'Kết nối' },
];

export default function ComparePage() {
  const { list, remove, clear } = useCompare();
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (list.length === 0) { setProducts([]); return; }
    setLoading(true);
    compareProducts(list.map((p) => p._id))
      .then((res) => setProducts(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [list.map((p) => p._id).join(',')]);

  if (list.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 text-lg mb-4">Chưa có sản phẩm nào để so sánh.</p>
        <Link to="/products" className="inline-block bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700">
          Xem tất cả sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'So sánh sản phẩm' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">So sánh sản phẩm</h1>
        <button onClick={clear} className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1">
          <X size={14} /> Xóa tất cả
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <colgroup>
              <col className="w-36" />
              {products.map((p) => <col key={p._id} />)}
              {list.length < 3 && <col />}
            </colgroup>

            {/* Product cards row */}
            <thead>
              <tr>
                <th className="p-3" />
                {products.map((phone) => {
                  const variant = phone.variants?.[0];
                  const price = variant?.salePrice || variant?.price;
                  return (
                    <th key={phone._id} className="p-3 align-top">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 relative">
                        <button
                          onClick={() => remove(phone._id)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                        <Link to={`/products/${phone.slug}`}>
                          <img
                            src={phone.images?.[0] || 'https://placehold.co/200x200?text=?'}
                            alt={phone.name}
                            className="w-full aspect-square object-contain rounded-lg mb-3"
                          />
                        </Link>
                        <Link to={`/products/${phone.slug}`}
                          className="text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-red-600 line-clamp-2 block mb-1">
                          {phone.name}
                        </Link>
                        <p className="text-red-600 font-bold text-base mb-3">
                          {price ? formatPrice(price) : 'Liên hệ'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-yellow-500 mb-3">
                          <Star size={12} fill="currentColor" />
                          <span className="text-gray-500">{phone.rating} ({phone.reviewCount})</span>
                        </div>
                        <button
                          onClick={() => variant && addItem(phone, variant)}
                          disabled={!variant || variant.stock === 0}
                          className="w-full flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                        >
                          <ShoppingCart size={13} />
                          {variant?.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
                        </button>
                      </div>
                    </th>
                  );
                })}
                {/* Placeholder để thêm sản phẩm thứ 3 */}
                {list.length < 3 && (
                  <th className="p-3 align-top">
                    <Link to="/products"
                      className="flex flex-col items-center justify-center gap-2 h-full min-h-[280px] bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-red-300 transition-colors text-gray-400 hover:text-red-500">
                      <Plus size={28} />
                      <span className="text-sm font-medium">Thêm sản phẩm</span>
                    </Link>
                  </th>
                )}
              </tr>
            </thead>

            {/* Specs rows */}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {SPEC_LABELS.map(({ key, label }) => (
                <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-l-lg">
                    {label}
                  </td>
                  {products.map((phone) => (
                    <td key={phone._id} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-center">
                      {phone.specs?.[key] || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  {list.length < 3 && <td />}
                </tr>
              ))}

              {/* Variants row */}
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-l-lg">
                  Phiên bản
                </td>
                {products.map((phone) => (
                  <td key={phone._id} className="px-4 py-3 text-center">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {phone.variants?.map((v) => (
                        <span key={v._id}
                          className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-0.5 text-gray-600 dark:text-gray-400">
                          {v.storage}
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
                {list.length < 3 && <td />}
              </tr>

              {/* Warranty row */}
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-l-lg">
                  Bảo hành
                </td>
                {products.map((phone) => (
                  <td key={phone._id} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-center">
                    {phone.warrantyMonths ? `${phone.warrantyMonths} tháng` : '12 tháng'}
                  </td>
                ))}
                {list.length < 3 && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
