import { useEffect, useState } from 'react';
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const EMPTY = { code: '', type: 'percent', value: 10, description: '', minOrderValue: 0, maxDiscountAmount: '', usageLimit: '', startDate: '', endDate: '', userType: 'all', isActive: true };

const toLocalInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminCouponsPage() {
  const { showToast } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminCoupons().then((res) => setCoupons(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditId(c._id);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      description: c.description || '',
      minOrderValue: c.minOrderValue || 0,
      maxDiscountAmount: c.maxDiscountAmount || '',
      usageLimit: c.usageLimit || '',
      startDate: toLocalInput(c.startDate),
      endDate: toLocalInput(c.endDate),
      userType: c.userType || 'all',
      isActive: c.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) {
      showToast({ message: 'Ngày bắt đầu phải trước ngày kết thúc', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        value: Number(form.value),
        minOrderValue: Number(form.minOrderValue) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        // Convert datetime-local strings (local time) to ISO strings (UTC) so backend stores correct time
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      };
      if (editId) {
        const res = await updateCoupon(editId, payload);
        setCoupons((prev) => prev.map((c) => c._id === editId ? res.data.data : c));
        showToast({ message: 'Đã cập nhật mã giảm giá', type: 'success' });
      } else {
        const res = await createCoupon(payload);
        setCoupons((prev) => [res.data.data, ...prev]);
        showToast({ message: 'Đã tạo mã giảm giá', type: 'success' });
      }
      setShowForm(false);
      setForm(EMPTY);
      setEditId(null);
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      const res = await updateCoupon(id, { isActive: !isActive });
      setCoupons((prev) => prev.map((c) => c._id === id ? res.data.data : c));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Xóa mã "${c.code}"?\nHành động này không thể hoàn tác.`)) return;
    try {
      const res = await deleteCoupon(c._id);
      setCoupons((prev) => prev.filter((x) => x._id !== c._id));
      showToast({ message: res.data.message, type: 'success' });
    } catch (err) { showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' }); }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mã giảm giá</h1>
        <button onClick={openCreate} className="flex items-center gap-2 btn-primary px-4 py-2 rounded-xl text-sm">
          <Plus size={16} /> Tạo mã mới
        </button>
      </div>

      {/* Form tạo coupon */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6 space-y-4">
          <h3 className="font-semibold text-gray-800">{editId ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá mới'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Mã code *</label>
              <input required value={form.code}
                onChange={(e) => !editId && setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={`${inputCls} ${editId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                placeholder="SUMMER20" readOnly={!!editId} />
              {editId && <p className="text-xs text-gray-400 mt-1">Không thể đổi mã code sau khi tạo</p>}
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Loại *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (đ)</option>
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Giá trị *</label><input type="number" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Đơn tối thiểu (đ)</label><input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Giảm tối đa (đ)</label><input type="number" value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })} className={inputCls} placeholder="Không giới hạn" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Giới hạn lượt dùng</label><input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className={inputCls} placeholder="Không giới hạn" /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Ngày bắt đầu *</label><input required type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Ngày kết thúc *</label><input required type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block mb-1">Mô tả</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Mô tả ngắn..." /></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }} className="flex-1 btn-outline py-2 rounded-xl">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-2 rounded-xl disabled:opacity-60">
              {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Tạo mã'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Mã code', 'Loại', 'Giá trị', 'Đơn tối thiểu', 'Lượt dùng', 'Hiệu lực', 'Trạng thái', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">Đang tải...</td></tr>
              : coupons.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-800">{c.code}</td>
                  <td className="px-4 py-3 text-gray-500">{c.type === 'percent' ? '%' : 'đ cố định'}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{c.type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</td>
                  <td className="px-4 py-3 text-gray-500">{c.minOrderValue ? formatPrice(c.minOrderValue) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.usedCount}/{c.usageLimit || '∞'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.endDate).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Đang hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)}
                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Chỉnh sửa">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleToggle(c._id, c.isActive)}
                        className={`text-xs px-2 py-1.5 rounded-lg ${c.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {c.isActive ? 'Tắt' : 'Bật'}
                      </button>
                      <button onClick={() => handleDelete(c)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Xóa mã">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
