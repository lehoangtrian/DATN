import { useEffect, useState } from 'react';
import { getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../../api/admin';
import { Plus, Edit2, EyeOff, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { name_vi: '', name_en: '', slug: '', description: '', sortOrder: 0 };

const autoSlug = (str) => str.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminCategories()
      .then((res) => setCategories(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugEdited(false);
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name_vi: cat.name_vi, name_en: cat.name_en || '', slug: cat.slug, description: cat.description || '', sortOrder: cat.sortOrder || 0 });
    setSlugEdited(true);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name_vi.trim()) { showToast({ message: 'Vui lòng nhập tên danh mục', type: 'error' }); return; }
    setSaving(true);
    try {
      const payload = { ...form, slug: form.slug || autoSlug(form.name_en || form.name_vi) };
      if (editing) {
        const res = await updateAdminCategory(editing._id, payload);
        setCategories((prev) => prev.map((c) => c._id === editing._id ? res.data.data : c));
      } else {
        const res = await createAdminCategory(payload);
        setCategories((prev) => [...prev, res.data.data]);
      }
      setShowForm(false);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleHide = async (id) => {
    if (!confirm('Ẩn danh mục này?')) return;
    try {
      await deleteAdminCategory(id);
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý danh mục</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700">
          <Plus size={15} /> Thêm danh mục
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Tên danh mục', 'Slug', 'Mô tả', 'Thứ tự', 'Trạng thái', 'Hành động'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có danh mục nào</td></tr>
            ) : categories.map((cat) => (
              <tr key={cat._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{cat.name_vi}</p>
                  {cat.name_en && <p className="text-xs text-gray-400">{cat.name_en}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{cat.slug}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{cat.description || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{cat.sortOrder ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.isActive ? 'Hiển thị' : 'Ẩn'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(cat)}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                      <Edit2 size={12} /> Sửa
                    </button>
                    {cat.isActive && (
                      <button onClick={() => handleHide(cat._id)}
                        className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-100 flex items-center gap-1">
                        <EyeOff size={12} /> Ẩn
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">{editing ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tên tiếng Việt *</label>
                <input value={form.name_vi}
                  onChange={(e) => {
                    const name_vi = e.target.value;
                    setForm((f) => ({ ...f, name_vi, slug: slugEdited ? f.slug : autoSlug(name_vi) }));
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tên tiếng Anh</label>
                <input value={form.name_en} onChange={(e) => setF('name_en', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Slug <span className="text-gray-400 font-normal text-xs">(tự động tạo từ tên)</span></label>
                <input value={form.slug}
                  onChange={(e) => { setF('slug', e.target.value); setSlugEdited(true); }}
                  placeholder="vd: dien-thoai"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả</label>
                <textarea rows={2} value={form.description} onChange={(e) => setF('description', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Thứ tự hiển thị</label>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setF('sortOrder', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
