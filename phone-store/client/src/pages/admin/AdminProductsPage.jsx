import { useEffect, useState, useCallback } from 'react';
import {
  getAdminProducts, createAdminProduct, updateAdminProduct, deleteAdminProduct,
  createAdminVariant, deleteAdminVariant, updateVariant,
  uploadAdminProductImage, exportAdminProductsCsv, importAdminProductsCsv,
  getAdminCategories,
} from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { Plus, Edit2, EyeOff, Download, Upload, X, Trash2, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

const TABS = ['Thông tin', 'Thông số', 'Biến thể', 'Hình ảnh & SEO'];
const STATUS_LABEL = { selling: 'Đang bán', coming_soon: 'Sắp ra', discontinued: 'Ngừng bán' };
const STATUS_COLOR = { selling: 'bg-green-100 text-green-700', coming_soon: 'bg-yellow-100 text-yellow-700', discontinued: 'bg-gray-100 text-gray-500' };
const BADGES = ['', 'New', 'Hot', 'Sale', 'Best Seller'];
const LIMIT = 15;

const EMPTY_FORM = {
  name: '', brandId: '', categoryId: '', status: 'selling', badge: '', warrantyMonths: 12,
  description: '', tags: '',
  specs: { display: '', chip: '', ram: '', battery: '', camera: '', os: '', sim: '', connectivity: '' },
  images: [],
  seo: { metaTitle: '', metaDescription: '', keywords: '' },
};
const EMPTY_VARIANT = { storage: '', color: '', colorHex: '#000000', price: '', salePrice: '', stock: 0, sku: '' };

const toSlug = (str) => str.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AdminProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([]);
  const [newVariant, setNewVariant] = useState(EMPTY_VARIANT);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback((p = 1) => {
    setLoading(true);
    setApiError('');
    getAdminProducts({ q: q || undefined, status: statusFilter || undefined, page: p, limit: LIMIT })
      .then((res) => { setProducts(res.data.data || []); setTotalPages(res.data.pagination?.pages || 1); })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401 || status === 403) setApiError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại với tài khoản admin.');
        else setApiError('Không thể tải danh sách sản phẩm. Kiểm tra server có đang chạy không.');
      })
      .finally(() => setLoading(false));
  }, [q, statusFilter]);

  useEffect(() => { load(1); setPage(1); }, [statusFilter]);

  useEffect(() => {
    Promise.all([api.get('/brands'), getAdminCategories()])
      .then(([b, c]) => { setBrands(b.data.data || []); setCategories(c.data.data || []); })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setVariants([]);
    setNewVariant(EMPTY_VARIANT);
    setActiveTab(0);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name || '',
      brandId: p.brandId?._id || p.brandId || '',
      categoryId: p.categoryId?._id || p.categoryId || '',
      status: p.status || 'selling',
      badge: p.badge || '',
      warrantyMonths: p.warrantyMonths || 12,
      description: p.description || '',
      tags: (p.tags || []).join(', '),
      specs: { display: '', chip: '', ram: '', battery: '', camera: '', os: '', sim: '', connectivity: '', ...(p.specs || {}) },
      images: p.images || [],
      seo: {
        metaTitle: p.seo?.metaTitle || '',
        metaDescription: p.seo?.metaDescription || '',
        keywords: (p.seo?.keywords || []).join(', '),
      },
    });
    setVariants(p.variants || []);
    setNewVariant(EMPTY_VARIANT);
    setActiveTab(0);
    setShowForm(true);
  };

  const buildPayload = () => ({
    name: form.name,
    brandId: form.brandId,
    categoryId: form.categoryId,
    status: form.status,
    badge: form.badge || undefined,
    warrantyMonths: Number(form.warrantyMonths),
    description: form.description,
    tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    specs: form.specs,
    images: form.images,
    seo: {
      metaTitle: form.seo.metaTitle,
      metaDescription: form.seo.metaDescription,
      keywords: form.seo.keywords ? form.seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
    },
  });

  const handleSave = async () => {
    if (!form.name || !form.brandId || !form.categoryId) {
      showToast({ message: 'Vui lòng điền đủ: Tên sản phẩm, Thương hiệu, Danh mục', type: 'error' });
      setActiveTab(0);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingProduct) {
        const res = await updateAdminProduct(editingProduct._id, payload);
        setProducts((prev) => prev.map((p) => p._id === editingProduct._id ? { ...p, ...res.data.data } : p));
      } else {
        const slug = `${toSlug(form.name) || 'product'}-${Date.now()}`;
        const variantPayload = variants.map((v) => ({
          ...v, price: Number(v.price), salePrice: v.salePrice ? Number(v.salePrice) : undefined, stock: Number(v.stock),
        }));
        await createAdminProduct({ ...payload, slug, variants: variantPayload });
        load(page);
      }
      setShowForm(false);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleHide = async (id) => {
    if (!confirm('Ẩn sản phẩm này?')) return;
    try {
      await deleteAdminProduct(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const handleAddVariant = async () => {
    if (!newVariant.color || !newVariant.price) { showToast({ message: 'Cần nhập màu sắc và giá', type: 'error' }); return; }
    const varData = { ...newVariant, price: Number(newVariant.price), salePrice: newVariant.salePrice ? Number(newVariant.salePrice) : undefined, stock: Number(newVariant.stock) };
    if (editingProduct) {
      try {
        const res = await createAdminVariant(editingProduct._id, varData);
        setVariants((prev) => [...prev, res.data.data]);
        setNewVariant(EMPTY_VARIANT);
      } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
    } else {
      setVariants((prev) => [...prev, { ...varData, _id: `tmp_${Date.now()}` }]);
      setNewVariant(EMPTY_VARIANT);
    }
  };

  const handleDeleteVariant = async (v) => {
    if (v._id.startsWith('tmp_')) { setVariants((prev) => prev.filter((x) => x._id !== v._id)); return; }
    if (!confirm('Xóa biến thể này?')) return;
    try {
      await deleteAdminVariant(editingProduct._id, v._id);
      setVariants((prev) => prev.filter((x) => x._id !== v._id));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const handleUpdateStock = async (v, stock) => {
    if (v._id.startsWith('tmp_')) { setVariants((prev) => prev.map((x) => x._id === v._id ? { ...x, stock: Number(stock) } : x)); return; }
    const prevStock = v.stock;
    setVariants((prev) => prev.map((x) => x._id === v._id ? { ...x, stock: Number(stock) } : x));
    try {
      await updateVariant(editingProduct._id, v._id, { stock: Number(stock) });
    } catch (err) {
      setVariants((prev) => prev.map((x) => x._id === v._id ? { ...x, stock: prevStock } : x));
      showToast({ message: err.response?.data?.message || 'Cập nhật tồn kho thất bại', type: 'error' });
    }
  };

  const handleImageUpload = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await uploadAdminProductImage(fd);
      setForm((f) => ({ ...f, images: [...f.images, res.data.data.url] }));
    } catch { showToast({ message: 'Upload ảnh thất bại', type: 'error' }); }
  };

  const handleExport = async () => {
    try {
      const res = await exportAdminProductsCsv();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a'); a.href = url; a.download = 'products_export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast({ message: 'Export thất bại', type: 'error' }); }
  };

  const handleImport = (file) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await importAdminProductsCsv({ csvText: e.target.result });
        const { data } = res.data;
        showToast({ message: `Import thành công! ${data.productCount} sản phẩm, ${data.importedVariants} biến thể`, type: 'success' });
        load(1); setPage(1);
      } catch (err) {
        showToast({ message: err.response?.data?.message || 'Import thất bại', type: 'error' });
      } finally { setImporting(false); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const setSpec = (key, val) => setForm((f) => ({ ...f, specs: { ...f.specs, [key]: val } }));
  const setSeo = (key, val) => setForm((f) => ({ ...f, seo: { ...f.seo, [key]: val } }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý sản phẩm</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50">
            <Download size={15} /> Export CSV
          </button>
          <label className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload size={15} /> {importing ? 'Đang import...' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files[0]) { handleImport(e.target.files[0]); e.target.value = ''; } }} />
          </label>
          <button onClick={openCreate} className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700">
            <Plus size={15} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
          placeholder="Tìm tên sản phẩm..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
        <button onClick={() => { setPage(1); load(1); }} className="bg-red-600 text-white px-4 py-2 text-sm rounded-lg">Tìm</button>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tất cả</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Sản phẩm', 'Thương hiệu / Danh mục', 'Trạng thái', 'Tồn kho', 'Đã bán', 'Hành động'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : apiError ? (
              <tr><td colSpan={6} className="text-center py-10 text-red-500">{apiError}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không tìm thấy sản phẩm</td></tr>
            ) : products.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.images?.[0] || 'https://placehold.co/40x40?text=?'} alt={p.name}
                      className="w-10 h-10 object-cover rounded-lg bg-gray-100 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800 line-clamp-1 max-w-[200px]">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.variants?.length || 0} biến thể</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{p.brandId?.name}</p>
                  <p className="text-xs text-gray-400">{p.categoryId?.name_vi}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  {p.badge && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{p.badge}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={p.totalStock === 0 ? 'text-red-500 font-semibold' : 'text-gray-700'}>{p.totalStock ?? 0}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.sold?.toLocaleString() ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(p)}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                      <Edit2 size={12} /> Sửa
                    </button>
                    <button onClick={() => handleHide(p._id)}
                      className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-100 flex items-center gap-1">
                      <EyeOff size={12} /> Ẩn
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (() => {
        const delta = 2;
        const start = Math.max(1, Math.min(page - delta, totalPages - delta * 2));
        const end = Math.min(totalPages, start + delta * 2);
        const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        return (
          <div className="flex justify-center items-center gap-1.5 mt-4">
            <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }} disabled={page === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Trước</button>
            {start > 1 && <>
              <button onClick={() => { setPage(1); load(1); }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">1</button>
              {start > 2 && <span className="px-1 text-gray-400">...</span>}
            </>}
            {pages.map((p) => (
              <button key={p} onClick={() => { setPage(p); load(p); }}
                className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
            ))}
            {end < totalPages && <>
              {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
              <button onClick={() => { setPage(totalPages); load(totalPages); }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">{totalPages}</button>
            </>}
            <button onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p); }} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Sau</button>
          </div>
        );
      })()}

      {/* ── Product Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800 text-lg">
                {editingProduct ? `Sửa: ${editingProduct.name}` : 'Thêm sản phẩm mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-6 overflow-x-auto">
              {TABS.map((t, i) => (
                <button key={t} onClick={() => setActiveTab(i)}
                  className={`py-3 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 max-h-[58vh] overflow-y-auto">

              {/* ── Tab 0: Thông tin ── */}
              {activeTab === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Tên sản phẩm *</label>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" placeholder="VD: iPhone 16 Pro Max" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Thương hiệu *</label>
                      <select value={form.brandId} onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
                        <option value="">-- Chọn thương hiệu --</option>
                        {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục *</label>
                      <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map((c) => <option key={c._id} value={c._id}>{c.name_vi}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Trạng thái</label>
                      <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Badge</label>
                      <select value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {BADGES.map((b) => <option key={b} value={b}>{b || 'Không có'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Bảo hành (tháng)</label>
                      <input type="number" min={0} value={form.warrantyMonths} onChange={(e) => setForm((f) => ({ ...f, warrantyMonths: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả sản phẩm</label>
                    <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Tags <span className="text-gray-400 font-normal">(phân cách bằng dấu phẩy)</span></label>
                    <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="iphone, apple, flagship"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              {/* ── Tab 1: Thông số ── */}
              {activeTab === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  {[['display', 'Màn hình'], ['chip', 'Chip xử lý'], ['ram', 'RAM'], ['battery', 'Pin'],
                    ['camera', 'Camera'], ['os', 'Hệ điều hành'], ['sim', 'SIM'], ['connectivity', 'Kết nối']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                      <input value={form.specs[key]} onChange={(e) => setSpec(key, e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Tab 2: Biến thể ── */}
              {activeTab === 2 && (
                <div>
                  {variants.length > 0 ? (
                    <table className="w-full text-xs mb-5 border border-gray-100 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Bộ nhớ', 'Màu', 'Giá', 'Giá sale', 'Tồn kho', 'SKU', ''].map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {variants.map((v) => (
                          <tr key={v._id}>
                            <td className="py-2 px-3">{v.storage || '—'}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                {v.colorHex && <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: v.colorHex }} />}
                                {v.color}
                              </div>
                            </td>
                            <td className="py-2 px-3">{formatPrice(v.price)}</td>
                            <td className="py-2 px-3">{v.salePrice ? formatPrice(v.salePrice) : '—'}</td>
                            <td className="py-2 px-3">
                              <input type="number" defaultValue={v.stock} min={0}
                                onBlur={(e) => handleUpdateStock(v, e.target.value)}
                                className="w-16 border border-gray-200 rounded px-1.5 py-1 text-center focus:outline-none focus:border-red-400" />
                            </td>
                            <td className="py-2 px-3 text-gray-400">{v.sku || '—'}</td>
                            <td className="py-2 px-3">
                              <button onClick={() => handleDeleteVariant(v)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4 mb-4">Chưa có biến thể nào</p>
                  )}

                  {/* Add new variant */}
                  <div className="border border-dashed border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Thêm biến thể mới</p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input placeholder="Bộ nhớ (128GB)" value={newVariant.storage}
                        onChange={(e) => setNewVariant((v) => ({ ...v, storage: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-red-400" />
                      <input placeholder="Màu sắc *" value={newVariant.color}
                        onChange={(e) => setNewVariant((v) => ({ ...v, color: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-red-400" />
                      <div className="flex items-center gap-2">
                        <input type="color" value={newVariant.colorHex}
                          onChange={(e) => setNewVariant((v) => ({ ...v, colorHex: e.target.value }))}
                          className="w-8 h-8 rounded border cursor-pointer p-0.5" />
                        <span className="text-xs text-gray-500 font-mono">{newVariant.colorHex}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <input placeholder="Giá *" type="number" value={newVariant.price}
                        onChange={(e) => setNewVariant((v) => ({ ...v, price: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-red-400" />
                      <input placeholder="Giá sale" type="number" value={newVariant.salePrice}
                        onChange={(e) => setNewVariant((v) => ({ ...v, salePrice: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                      <input placeholder="Tồn kho" type="number" value={newVariant.stock}
                        onChange={(e) => setNewVariant((v) => ({ ...v, stock: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                      <input placeholder="SKU" value={newVariant.sku}
                        onChange={(e) => setNewVariant((v) => ({ ...v, sku: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    </div>
                    <button onClick={handleAddVariant}
                      className="flex items-center gap-1 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                      <Plus size={12} /> Thêm biến thể
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab 3: Hình ảnh & SEO ── */}
              {activeTab === 3 && (
                <div className="space-y-6">
                  {/* Images */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Hình ảnh sản phẩm</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {form.images.map((img, i) => (
                        <div key={i} className="relative group w-20 h-20">
                          <img src={img} alt="" className="w-full h-full object-cover rounded-lg border border-gray-100" />
                          <button onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-300 text-gray-400 hover:text-red-400 transition-colors">
                        <ImageIcon size={18} />
                        <span className="text-xs mt-1">Upload</span>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { if (e.target.files[0]) { handleImageUpload(e.target.files[0]); e.target.value = ''; } }} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input id="imgUrl" placeholder="Hoặc nhập URL ảnh rồi nhấn Enter..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            setForm((f) => ({ ...f, images: [...f.images, e.target.value.trim()] }));
                            e.target.value = '';
                          }
                        }} />
                    </div>
                  </div>

                  {/* SEO */}
                  <div className="border-t pt-5">
                    <p className="text-sm font-medium text-gray-700 mb-3">SEO</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Meta Title <span className="text-gray-400">(tối đa 60 ký tự)</span></label>
                        <input value={form.seo.metaTitle} onChange={(e) => setSeo('metaTitle', e.target.value)} maxLength={60}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                        <p className="text-xs text-gray-400 text-right mt-0.5">{form.seo.metaTitle.length}/60</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Meta Description <span className="text-gray-400">(tối đa 160 ký tự)</span></label>
                        <textarea rows={2} value={form.seo.metaDescription} onChange={(e) => setSeo('metaDescription', e.target.value)} maxLength={160}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400" />
                        <p className="text-xs text-gray-400 text-right mt-0.5">{form.seo.metaDescription.length}/160</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Keywords <span className="text-gray-400">(phân cách bằng dấu phẩy)</span></label>
                        <input value={form.seo.keywords} onChange={(e) => setSeo('keywords', e.target.value)}
                          placeholder="iphone, apple, điện thoại cao cấp"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <div className="flex gap-1 mr-auto">
                {TABS.map((_, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === activeTab ? 'bg-red-500' : 'bg-gray-300'}`} />
                ))}
              </div>
              {activeTab > 0 && (
                <button onClick={() => setActiveTab((t) => t - 1)}
                  className="flex items-center gap-1 text-sm border border-gray-200 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100">
                  <ChevronLeft size={14} /> Trước
                </button>
              )}
              {activeTab < TABS.length - 1 ? (
                <button onClick={() => setActiveTab((t) => t + 1)}
                  className="flex items-center gap-1 text-sm bg-gray-800 text-white px-4 py-2 rounded-xl hover:bg-gray-700">
                  Tiếp <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="text-sm bg-red-600 text-white px-5 py-2 rounded-xl hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Đang lưu...' : editingProduct ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
