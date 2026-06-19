import { useEffect, useState, useMemo } from 'react';
import { adminGetFlashSales, adminCreateFlashSale, adminUpdateFlashSale, adminDeleteFlashSale } from '../../api/flashsale';
import { getAdminProducts, getAdminCategories } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { Plus, Pencil, Trash2, Zap, X, Tag } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const toLocalInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_LABEL = (sale) => {
  const n = new Date();
  if (!sale.isActive) return { label: 'Tắt', cls: 'bg-gray-100 text-gray-500' };
  if (new Date(sale.startTime) > n) return { label: 'Sắp diễn ra', cls: 'bg-yellow-100 text-yellow-700' };
  if (new Date(sale.endTime) < n) return { label: 'Đã kết thúc', cls: 'bg-red-100 text-red-600' };
  return { label: 'Đang diễn ra', cls: 'bg-green-100 text-green-700' };
};

const EMPTY_VARIANT_FORM = {
  name: '', productId: '', variantId: '', discountType: 'percent',
  discountValue: '', quantity: '', limitPerUser: '1', startTime: '', endTime: '',
};
const EMPTY_CATEGORY_FORM = {
  name: '', categoryId: '', discountType: 'percent',
  discountValue: '', quantity: '', limitPerUser: '1', startTime: '', endTime: '',
};

export default function AdminFlashSalePage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('variant'); // 'variant' | 'category'
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_VARIANT_FORM);
  const [catForm, setCatForm] = useState(EMPTY_CATEGORY_FORM);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);

  const load = () => {
    setLoading(true);
    adminGetFlashSales().then((r) => setSales(r.data.data || [])).catch(() => { }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    getAdminProducts({ limit: 200 }).then((r) => setProducts(r.data.data || [])).catch(() => { });
    getAdminCategories().then((r) => setCategories(r.data.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (!form.productId) { setVariants([]); return; }
    const p = products.find((p) => p._id === form.productId);
    setVariants(p?.variants || []);
  }, [form.productId, products]);

  const variantSales = useMemo(() => sales.filter((s) => s.type === 'variant' || !s.type), [sales]);
  const categorySales = useMemo(() => sales.filter((s) => s.type === 'category'), [sales]);

  const openCreate = () => {
    setEditId(null);
    if (activeTab === 'variant') {
      setForm(EMPTY_VARIANT_FORM);
      setVariants([]);
    } else {
      setCatForm(EMPTY_CATEGORY_FORM);
    }
    setShowModal(true);
  };

  const openEdit = (sale) => {
    setEditId(sale._id);
    if (sale.type === 'category') {
      setActiveTab('category');
      setCatForm({
        name: sale.name,
        categoryId: sale.categoryId?._id || sale.categoryId || '',
        discountType: sale.discountType || 'percent',
        discountValue: String(sale.discountValue ?? ''),
        quantity: sale.quantity != null ? String(sale.quantity) : '',
        limitPerUser: String(sale.limitPerUser ?? 1),
        startTime: toLocalInput(sale.startTime),
        endTime: toLocalInput(sale.endTime),
      });
    } else {
      setActiveTab('variant');
      const savedType = sale.discountType || 'percent';
      const savedValue = sale.discountValue != null
        ? String(sale.discountValue)
        : sale.originalPrice
          ? String(Math.round((1 - sale.salePrice / sale.originalPrice) * 100))
          : '';
      setForm({
        name: sale.name,
        productId: sale.productId?._id || sale.productId || '',
        variantId: sale.variantId?._id || sale.variantId || '',
        discountType: savedType,
        discountValue: savedValue,
        quantity: String(sale.quantity ?? ''),
        limitPerUser: String(sale.limitPerUser ?? 1),
        startTime: toLocalInput(sale.startTime),
        endTime: toLocalInput(sale.endTime),
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'category') {
        if (!catForm.name || !catForm.categoryId || !catForm.discountValue || !catForm.startTime || !catForm.endTime) {
          showToast({ message: 'Vui lòng điền đầy đủ thông tin', type: 'error' }); return;
        }
        if (new Date(catForm.startTime) >= new Date(catForm.endTime)) {
          showToast({ message: 'Thời gian bắt đầu phải trước thời gian kết thúc', type: 'error' }); return;
        }
        const payload = {
          type: 'category',
          name: catForm.name,
          categoryId: catForm.categoryId,
          discountType: catForm.discountType,
          discountValue: Number(catForm.discountValue),
          quantity: catForm.quantity ? Number(catForm.quantity) : null,
          limitPerUser: Number(catForm.limitPerUser) || 1,
          startTime: new Date(catForm.startTime).toISOString(),
          endTime: new Date(catForm.endTime).toISOString(),
        };
        if (editId) {
          await adminUpdateFlashSale(editId, payload);
        } else {
          await adminCreateFlashSale(payload);
        }
      } else {
        if (!form.name || !form.productId || !form.variantId || !form.discountValue || !form.quantity || !form.startTime || !form.endTime) {
          showToast({ message: 'Vui lòng điền đầy đủ thông tin', type: 'error' }); return;
        }
        if (!computedSalePrice || computedSalePrice <= 0) {
          showToast({ message: 'Giá sau giảm phải lớn hơn 0', type: 'error' }); return;
        }
        if (new Date(form.startTime) >= new Date(form.endTime)) {
          showToast({ message: 'Thời gian bắt đầu phải trước thời gian kết thúc', type: 'error' }); return;
        }
        const payload = {
          type: 'variant',
          ...form,
          salePrice: computedSalePrice,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        };
        if (editId) {
          await adminUpdateFlashSale(editId, payload);
        } else {
          await adminCreateFlashSale(payload);
        }
      }
      setShowModal(false);
      load();
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa flash sale này?')) return;
    try { await adminDeleteFlashSale(id); load(); }
    catch (err) { showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' }); }
  };

  const handleToggle = async (sale) => {
    try {
      await adminUpdateFlashSale(sale._id, { isActive: !sale.isActive });
      load();
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const selectedVariant = variants.find((v) => v._id === form.variantId);

  const computedSalePrice = useMemo(() => {
    const base = selectedVariant?.price;
    const val = Number(form.discountValue);
    if (!base || !val || val <= 0) return null;
    if (form.discountType === 'percent') {
      if (val >= 100) return null;
      return Math.round(base * (1 - val / 100));
    }
    return base - val;
  }, [form.discountType, form.discountValue, selectedVariant]);

  const currentForm = activeTab === 'category' ? catForm : form;
  const setCurrentForm = activeTab === 'category' ? setCatForm : setForm;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Zap size={22} className="text-yellow-500" /> Flash Sale
        </h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700">
          <Plus size={16} /> Tạo Flash Sale
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('variant')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'variant' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Zap size={14} /> Theo Sản Phẩm
          {variantSales.length > 0 && <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{variantSales.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('category')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'category' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Tag size={14} /> Theo Danh Mục
          {categorySales.length > 0 && <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{categorySales.length}</span>}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Đang tải...</p>
      ) : activeTab === 'variant' ? (
        /* ── Bảng Variant Flash Sales ── */
        variantSales.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Chưa có flash sale theo sản phẩm nào</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Tên', 'Sản phẩm', 'Giá gốc', 'Giá Flash', 'SL / Đã bán', 'Thời gian', 'Trạng thái', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {variantSales.map((sale) => {
                  const status = STATUS_LABEL(sale);
                  return (
                    <tr key={sale._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{sale.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <img src={sale.productId?.images?.[0]} alt="" className="w-8 h-8 object-cover rounded" />
                          <div>
                            <p className="text-xs font-medium">{sale.productId?.name}</p>
                            <p className="text-xs text-gray-400">{sale.variantId?.storage} · {sale.variantId?.color}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 line-through text-xs">{formatPrice(sale.originalPrice)}</td>
                      <td className="px-4 py-3 text-red-600 font-bold">{formatPrice(sale.salePrice)}</td>
                      <td className="px-4 py-3 text-gray-600">{sale.sold}/{sale.quantity}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <p>{new Date(sale.startTime).toLocaleString('vi-VN')}</p>
                        <p>→ {new Date(sale.endTime).toLocaleString('vi-VN')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => handleToggle(sale)}
                            className={`text-xs px-2 py-1.5 rounded-lg ${sale.isActive ? 'text-gray-500 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}>
                            {sale.isActive ? 'Tắt' : 'Bật'}
                          </button>
                          <button onClick={() => openEdit(sale)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(sale._id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Bảng Category Flash Sales ── */
        categorySales.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Chưa có flash sale theo danh mục nào</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Tên', 'Danh mục', 'Mức giảm', 'Đã bán / Tổng', 'Thời gian', 'Trạng thái', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {categorySales.map((sale) => {
                  const status = STATUS_LABEL(sale);
                  return (
                    <tr key={sale._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{sale.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                          <Tag size={10} /> {sale.categoryId?.name_vi || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-red-600 font-bold">
                        {sale.discountType === 'percent'
                          ? `-${sale.discountValue}%`
                          : `-${formatPrice(sale.discountValue)}`}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {sale.sold} / {sale.quantity != null ? sale.quantity : '∞'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <p>{new Date(sale.startTime).toLocaleString('vi-VN')}</p>
                        <p>→ {new Date(sale.endTime).toLocaleString('vi-VN')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => handleToggle(sale)}
                            className={`text-xs px-2 py-1.5 rounded-lg ${sale.isActive ? 'text-gray-500 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}>
                            {sale.isActive ? 'Tắt' : 'Bật'}
                          </button>
                          <button onClick={() => openEdit(sale)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(sale._id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">
                {editId ? 'Sửa Flash Sale' : activeTab === 'category' ? 'Tạo Flash Sale Danh Mục' : 'Tạo Flash Sale Sản Phẩm'}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            {activeTab === 'category' ? (
              /* ── Category Flash Sale Form ── */
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tên Flash Sale *</label>
                  <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="VD: Sale Tất Cả iPhone" className="input-field" />
                </div>

                {!editId && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục *</label>
                    <select value={catForm.categoryId} onChange={(e) => setCatForm({ ...catForm, categoryId: e.target.value })}
                      className="input-field">
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>{c.name_vi}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Mức giảm giá *</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-2">
                    {[{ value: 'percent', label: '% Giảm' }, { value: 'amount', label: 'Số tiền giảm (đ)' }].map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setCatForm({ ...catForm, discountType: opt.value, discountValue: '' })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${catForm.discountType === opt.value ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number" min={0}
                      max={catForm.discountType === 'percent' ? 99 : undefined}
                      value={catForm.discountValue}
                      onChange={(e) => setCatForm({ ...catForm, discountValue: e.target.value })}
                      placeholder={catForm.discountType === 'percent' ? 'VD: 15 (%)' : 'VD: 500000 (đ)'}
                      className="input-field pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                      {catForm.discountType === 'percent' ? '%' : 'đ'}
                    </span>
                  </div>
                  {catForm.discountValue && (
                    <p className="text-xs text-blue-600 mt-1">
                      Áp dụng giảm {catForm.discountType === 'percent' ? `${catForm.discountValue}%` : formatPrice(Number(catForm.discountValue))} cho tất cả sản phẩm trong danh mục đã chọn.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Số lượng tổng</label>
                    <input type="number" value={catForm.quantity} onChange={(e) => setCatForm({ ...catForm, quantity: e.target.value })}
                      placeholder="Để trống = không giới hạn" className="input-field" />
                    <p className="text-xs text-gray-400 mt-1">Để trống = không giới hạn</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Giới hạn / người</label>
                    <input type="number" value={catForm.limitPerUser} onChange={(e) => setCatForm({ ...catForm, limitPerUser: e.target.value })}
                      placeholder="1" className="input-field" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bắt đầu *</label>
                    <input type="datetime-local" value={catForm.startTime} onChange={(e) => setCatForm({ ...catForm, startTime: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Kết thúc *</label>
                    <input type="datetime-local" value={catForm.endTime} onChange={(e) => setCatForm({ ...catForm, endTime: e.target.value })}
                      className="input-field" />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Variant Flash Sale Form ── */
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tên Flash Sale *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Sale Thứ Sáu" className="input-field" />
                </div>

                {!editId && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Sản phẩm *</label>
                      <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantId: '' })}
                        className="input-field">
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Phiên bản (variant) *</label>
                      <select value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}
                        className="input-field" disabled={!form.productId}>
                        <option value="">-- Chọn variant --</option>
                        {variants.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.storage} · {v.color} — {formatPrice(v.price)} (Tồn: {v.stock})
                          </option>
                        ))}
                      </select>
                      {selectedVariant && (
                        <p className="text-xs text-gray-400 mt-1">Giá gốc: {formatPrice(selectedVariant.price)}</p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Mức giảm giá *</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-2">
                    {[{ value: 'percent', label: '% Giảm' }, { value: 'amount', label: 'Số tiền giảm (đ)' }].map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm({ ...form, discountType: opt.value, discountValue: '' })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${form.discountType === opt.value ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number" min={0}
                      max={form.discountType === 'percent' ? 99 : undefined}
                      value={form.discountValue}
                      onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                      placeholder={form.discountType === 'percent' ? 'VD: 20 (%)' : 'VD: 500000 (đ)'}
                      className="input-field pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                      {form.discountType === 'percent' ? '%' : 'đ'}
                    </span>
                  </div>
                  {computedSalePrice !== null && selectedVariant && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-sm flex items-center justify-between ${computedSalePrice > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <span className="text-gray-500">Giá sau Flash Sale:</span>
                      {computedSalePrice > 0 ? (
                        <span className="font-bold text-red-600">{formatPrice(computedSalePrice)}</span>
                      ) : (
                        <span className="font-medium text-red-500">Không hợp lệ</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Số lượng *</label>
                    <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="0" className="input-field" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Giới hạn / người</label>
                    <input type="number" value={form.limitPerUser} onChange={(e) => setForm({ ...form, limitPerUser: e.target.value })}
                      placeholder="1" className="input-field" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bắt đầu *</label>
                    <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Kết thúc *</label>
                    <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="input-field" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                <Zap size={15} /> {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Tạo Flash Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
