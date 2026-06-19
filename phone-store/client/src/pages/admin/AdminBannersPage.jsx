import { useEffect, useState } from 'react';
import {
  getAdminBannersByType, createBanner, updateBanner, deleteBanner,
  getAdminServiceBadges, createServiceBadge, updateServiceBadge, deleteServiceBadge,
} from '../../api/banners';
import { useToast } from '../../context/ToastContext';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Truck, Shield, RotateCcw, Tag, CreditCard, Gift, Star, Zap, Headphones, CheckCircle } from 'lucide-react';

const ICON_MAP = {
  'truck': Truck, 'shield': Shield, 'rotate-ccw': RotateCcw, 'tag': Tag,
  'credit-card': CreditCard, 'gift': Gift, 'star': Star, 'zap': Zap,
  'headphones': Headphones, 'check-circle': CheckCircle,
};

const GRADIENTS = [
  { label: 'Đỏ',       bg: 'linear-gradient(135deg, #E53E3E 0%, #C53030 100%)' },
  { label: 'Navy',     bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
  { label: 'Xanh',    bg: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' },
  { label: 'Tím',      bg: 'linear-gradient(135deg, #6B21A8 0%, #4C1D95 100%)' },
  { label: 'Xanh lá', bg: 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)' },
  { label: 'Cam',      bg: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' },
];
const ACCENTS = [
  { label: 'Vàng',     bg: 'bg-yellow-400', text: 'text-red-700' },
  { label: 'Xanh',    bg: 'bg-blue-400',   text: 'text-blue-900' },
  { label: 'Cyan',    bg: 'bg-cyan-400',   text: 'text-blue-900' },
  { label: 'Trắng',   bg: 'bg-white',      text: 'text-gray-800' },
  { label: 'Xanh lá', bg: 'bg-green-400',  text: 'text-green-900' },
];
const ICON_OPTIONS = [
  { name: 'truck',       label: 'Giao hàng' },
  { name: 'shield',      label: 'Bảo hành' },
  { name: 'rotate-ccw',  label: 'Đổi trả' },
  { name: 'tag',         label: 'Giảm giá' },
  { name: 'credit-card', label: 'Thanh toán' },
  { name: 'gift',        label: 'Quà tặng' },
  { name: 'star',        label: 'Đánh giá' },
  { name: 'zap',         label: 'Flash sale' },
  { name: 'headphones',  label: 'Phụ kiện' },
  { name: 'check-circle',label: 'Xác nhận' },
];
const COLOR_SCHEMES = [
  { label: 'Xanh dương', iconColor: 'text-blue-500',   bgColor: 'bg-blue-50' },
  { label: 'Xanh lá',   iconColor: 'text-green-500',  bgColor: 'bg-green-50' },
  { label: 'Cam',        iconColor: 'text-orange-500', bgColor: 'bg-orange-50' },
  { label: 'Tím',        iconColor: 'text-purple-500', bgColor: 'bg-purple-50' },
  { label: 'Đỏ',        iconColor: 'text-red-500',    bgColor: 'bg-red-50' },
  { label: 'Xanh nhạt', iconColor: 'text-teal-500',   bgColor: 'bg-teal-50' },
];

const EMPTY_BANNER = {
  tag: '', title: '', description: '', cta: 'Xem ngay', link: '/products',
  bg: GRADIENTS[0].bg, imageUrl: '', emoji: '📱',
  accentBg: 'bg-yellow-400', accentText: 'text-red-700',
  isActive: true, order: 0,
};
const EMPTY_BADGE = {
  iconName: 'truck', iconColor: 'text-blue-500', bgColor: 'bg-blue-50',
  title: '', description: '', order: 0, isActive: true,
};

const TABS = ['Banner trang chủ', 'Banner quảng cáo', 'Dịch vụ nổi bật'];

export default function AdminBannersPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);
  const [banners, setBanners] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_BANNER);
  const [badgeForm, setBadgeForm] = useState(EMPTY_BADGE);
  const [bannerType, setBannerType] = useState('gradient');
  const [saving, setSaving] = useState(false);

  const bannerApiType = tab === 0 ? 'slide' : 'promo';

  const loadBanners = (type) => {
    setLoading(true);
    getAdminBannersByType(type).then(r => setBanners(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  const loadBadges = () => {
    setLoading(true);
    getAdminServiceBadges().then(r => setBadges(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 2) loadBadges();
    else loadBanners(tab === 0 ? 'slide' : 'promo');
  }, [tab]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setB = (k, v) => setBadgeForm(f => ({ ...f, [k]: v }));

  const openCreateBanner = () => {
    setEditId(null);
    setForm({ ...EMPTY_BANNER, type: bannerApiType });
    setBannerType('gradient');
    setShowModal(true);
  };
  const openEditBanner = (b) => {
    setEditId(b._id);
    setForm({
      tag: b.tag || '', title: b.title || '', description: b.description || '',
      cta: b.cta || 'Xem ngay', link: b.link || '/products',
      bg: b.bg || GRADIENTS[0].bg, imageUrl: b.imageUrl || '',
      emoji: b.emoji || '📱', accentBg: b.accentBg || 'bg-yellow-400',
      accentText: b.accentText || 'text-red-700',
      isActive: b.isActive !== false, order: b.order || 0,
    });
    setBannerType(b.imageUrl ? 'image' : 'gradient');
    setShowModal(true);
  };
  const openCreateBadge = () => { setEditId(null); setBadgeForm(EMPTY_BADGE); setShowModal(true); };
  const openEditBadge = (b) => {
    setEditId(b._id);
    setBadgeForm({ iconName: b.iconName, iconColor: b.iconColor, bgColor: b.bgColor, title: b.title, description: b.description || '', order: b.order || 0, isActive: b.isActive !== false });
    setShowModal(true);
  };

  const handleSaveBanner = async () => {
    if (!form.title.trim()) { showToast({ message: 'Vui lòng nhập tiêu đề', type: 'error' }); return; }
    if (bannerType === 'image' && !form.imageUrl.trim()) { showToast({ message: 'Vui lòng nhập URL hình ảnh', type: 'error' }); return; }
    setSaving(true);
    const payload = {
      ...form,
      type: bannerApiType,
      imageUrl: bannerType === 'image' ? form.imageUrl : '',
      bg: bannerType === 'gradient' ? form.bg : '',
      emoji: bannerType === 'gradient' ? form.emoji : '',
    };
    try {
      if (editId) {
        const r = await updateBanner(editId, payload);
        setBanners(prev => prev.map(b => b._id === editId ? r.data.data : b));
        showToast({ message: 'Đã cập nhật banner', type: 'success' });
      } else {
        const r = await createBanner(payload);
        setBanners(prev => [...prev, r.data.data]);
        showToast({ message: 'Đã tạo banner', type: 'success' });
      }
      setShowModal(false);
    } catch (err) { showToast({ message: err.response?.data?.message || 'Lỗi', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleSaveBadge = async () => {
    if (!badgeForm.title.trim()) { showToast({ message: 'Vui lòng nhập tiêu đề', type: 'error' }); return; }
    setSaving(true);
    try {
      if (editId) {
        const r = await updateServiceBadge(editId, badgeForm);
        setBadges(prev => prev.map(b => b._id === editId ? r.data.data : b));
        showToast({ message: 'Đã cập nhật', type: 'success' });
      } else {
        const r = await createServiceBadge(badgeForm);
        setBadges(prev => [...prev, r.data.data]);
        showToast({ message: 'Đã tạo', type: 'success' });
      }
      setShowModal(false);
    } catch (err) { showToast({ message: err.response?.data?.message || 'Lỗi', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleToggleBanner = async (b) => {
    try {
      const r = await updateBanner(b._id, { isActive: !b.isActive });
      setBanners(prev => prev.map(x => x._id === b._id ? r.data.data : x));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };
  const handleDeleteBanner = async (id) => {
    if (!confirm('Xóa banner này?')) return;
    try { await deleteBanner(id); setBanners(prev => prev.filter(b => b._id !== id)); showToast({ message: 'Đã xóa', type: 'success' }); }
    catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };
  const handleToggleBadge = async (b) => {
    try {
      const r = await updateServiceBadge(b._id, { isActive: !b.isActive });
      setBadges(prev => prev.map(x => x._id === b._id ? r.data.data : x));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };
  const handleDeleteBadge = async (id) => {
    if (!confirm('Xóa mục này?')) return;
    try { await deleteServiceBadge(id); setBadges(prev => prev.filter(b => b._id !== id)); showToast({ message: 'Đã xóa', type: 'success' }); }
    catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Trang chủ</h1>
        <button onClick={tab === 2 ? openCreateBadge : openCreateBanner}
          className="btn-primary px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === i ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Banner table */}
      {tab !== 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Preview', 'Tiêu đề', 'Link', 'Thứ tự', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : !banners.length ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có banner nào</td></tr>
              ) : banners.map(b => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="w-24 h-14 rounded-lg overflow-hidden"
                      style={b.imageUrl ? { backgroundImage: `url(${b.imageUrl})`, backgroundSize: 'cover' } : { background: b.bg || '#E53E3E' }}>
                      {!b.imageUrl && b.emoji && <div className="w-full h-full flex items-center justify-center text-2xl">{b.emoji}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><p className="font-medium text-gray-800 line-clamp-1">{b.title}</p>{b.tag && <p className="text-xs text-gray-400">{b.tag}</p>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.link}</td>
                  <td className="px-4 py-3 text-gray-600">{b.order}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.isActive ? 'Hiển thị' : 'Ẩn'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleBanner(b)} className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-1">
                        {b.isActive ? <EyeOff size={13} /> : <Eye size={13} />}{b.isActive ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button onClick={() => openEditBanner(b)} className="text-xs px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center gap-1"><Pencil size={13} />Sửa</button>
                      <button onClick={() => handleDeleteBanner(b._id)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 flex items-center gap-1"><Trash2 size={13} />Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Service badges table */}
      {tab === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Icon', 'Tiêu đề', 'Mô tả', 'Thứ tự', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : !badges.length ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có dịch vụ nào</td></tr>
              ) : badges.map(b => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className={`w-10 h-10 rounded-full ${b.bgColor} flex items-center justify-center`}>
                      {(() => { const Icon = ICON_MAP[b.iconName] || Tag; return <Icon size={18} className={b.iconColor} />; })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{b.title}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{b.description}</td>
                  <td className="px-4 py-3 text-gray-600">{b.order}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.isActive ? 'Hiển thị' : 'Ẩn'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleBadge(b)} className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-1">
                        {b.isActive ? <EyeOff size={13} /> : <Eye size={13} />}{b.isActive ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button onClick={() => openEditBadge(b)} className="text-xs px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center gap-1"><Pencil size={13} />Sửa</button>
                      <button onClick={() => handleDeleteBadge(b._id)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 flex items-center gap-1"><Trash2 size={13} />Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for banners */}
      {showModal && tab !== 2 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-lg">{editId ? 'Sửa Banner' : 'Thêm Banner'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Loại nền</p>
                <div className="flex gap-3">
                  {[{ v: 'gradient', label: 'Gradient' }, { v: 'image', label: 'Ảnh URL' }].map(({ v, label }) => (
                    <label key={v} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-sm ${bannerType === v ? 'border-red-500 bg-red-50 text-red-600 font-medium' : 'border-gray-200 text-gray-600'}`}>
                      <input type="radio" checked={bannerType === v} onChange={() => setBannerType(v)} className="accent-red-600" />{label}
                    </label>
                  ))}
                </div>
              </div>
              {bannerType === 'gradient' && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Màu nền</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {GRADIENTS.map(g => (
                      <button key={g.label} onClick={() => set('bg', g.bg)}
                        className={`w-10 h-8 rounded-lg border-2 ${form.bg === g.bg ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ background: g.bg }} title={g.label} />
                    ))}
                  </div>
                  <input value={form.bg} onChange={e => set('bg', e.target.value)} placeholder="Hoặc nhập CSS gradient..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-400" />
                </div>
              )}
              {bannerType === 'image' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">URL ảnh *</label>
                  <input value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                  {form.imageUrl && <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-full object-cover rounded-lg" onError={e => e.target.style.display='none'} />}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tiêu đề *</label>
                <textarea value={form.title} onChange={e => set('title', e.target.value)} rows={2} placeholder="Nhập tiêu đề banner..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tag badge</label>
                  <input value={form.tag} onChange={e => set('tag', e.target.value)} placeholder="VD: FLAGSHIP 2024"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
                {bannerType === 'gradient' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Emoji</label>
                    <input value={form.emoji} onChange={e => set('emoji', e.target.value)} placeholder="📱"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                  </div>
                )}
              </div>
              {form.tag && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Màu badge</p>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map(a => (
                      <button key={a.label} onClick={() => { set('accentBg', a.bg); set('accentText', a.text); }}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${a.bg} ${a.text} ${form.accentBg === a.bg ? 'border-gray-700' : 'border-transparent'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Mô tả ngắn..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nút CTA</label>
                  <input value={form.cta} onChange={e => set('cta', e.target.value)} placeholder="Mua ngay"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Link đích</label>
                  <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="/products"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Thứ tự</label>
                  <input type="number" value={form.order} onChange={e => set('order', Number(e.target.value))} min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="w-4 h-4 accent-red-600" />
                  <span className="text-sm font-medium text-gray-700">Hiển thị</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Hủy</button>
              <button onClick={handleSaveBanner} disabled={saving} className="flex-1 btn-primary py-2.5 rounded-xl text-sm disabled:opacity-60">
                {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Tạo banner')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for service badges */}
      {showModal && tab === 2 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md my-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-lg">{editId ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tiêu đề *</label>
                <input value={badgeForm.title} onChange={e => setB('title', e.target.value)} placeholder="VD: Giao hàng nhanh"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả</label>
                <input value={badgeForm.description} onChange={e => setB('description', e.target.value)} placeholder="VD: Nội thành trong ngày"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map(ic => (
                    <button key={ic.name} onClick={() => setB('iconName', ic.name)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${badgeForm.iconName === ic.name ? 'border-red-500 bg-red-50 text-red-600 font-medium' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
                      {ic.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Màu sắc</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SCHEMES.map(cs => (
                    <button key={cs.label} onClick={() => { setB('iconColor', cs.iconColor); setB('bgColor', cs.bgColor); }}
                      className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-colors ${badgeForm.bgColor === cs.bgColor ? 'border-gray-700' : 'border-transparent border border-gray-200'} ${cs.bgColor} ${cs.iconColor}`}>
                      {cs.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Thứ tự</label>
                  <input type="number" value={badgeForm.order} onChange={e => setB('order', Number(e.target.value))} min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input type="checkbox" checked={badgeForm.isActive} onChange={e => setB('isActive', e.target.checked)} className="w-4 h-4 accent-red-600" />
                  <span className="text-sm font-medium text-gray-700">Hiển thị</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Hủy</button>
              <button onClick={handleSaveBadge} disabled={saving} className="flex-1 btn-primary py-2.5 rounded-xl text-sm disabled:opacity-60">
                {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Tạo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
