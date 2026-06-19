import { useEffect, useState } from 'react';
import { getAdminUsers, toggleUserStatus, deleteAdminUser, updateUserRole, updateUserPermissions } from '../../api/admin';
import { adminTopupWallet } from '../../api/wallet';
import { formatPrice } from '../../utils/formatPrice';
import { Wallet, X, Trash2, Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../config/permissions';

const ROLE_BADGE = {
  admin: 'bg-red-100 text-red-700',
  staff: 'bg-yellow-100 text-yellow-700',
  user:  'bg-gray-100 text-gray-600',
};

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [topupTarget, setTopupTarget] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDesc, setTopupDesc] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Permission modal state
  const [permTarget, setPermTarget] = useState(null);
  const [permRole, setPermRole] = useState('user');
  const [permList, setPermList] = useState([]);
  const [permLoading, setPermLoading] = useState(false);

  const load = (query = '') => {
    setLoading(true);
    setLoadError('');
    getAdminUsers({ q: query || undefined })
      .then((res) => setUsers(res.data.data || []))
      .catch((err) => {
        const status = err.response?.status;
        setLoadError(status === 401 || status === 403
          ? 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
          : 'Không thể tải dữ liệu. Kiểm tra server có đang chạy không.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await deleteAdminUser(deleteTarget._id);
      setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id));
      setDeleteTarget(null);
      showToast({ message: res.data.message, type: 'success' });
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally { setDeleteLoading(false); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleUserStatus(id);
      setUsers((prev) => prev.map((u) => u._id === id ? { ...u, isActive: res.data.data.isActive } : u));
    } catch (err) { showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' }); }
  };

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) { showToast({ message: 'Vui lòng nhập số tiền hợp lệ', type: 'error' }); return; }
    setTopupLoading(true);
    try {
      const res = await adminTopupWallet({ userId: topupTarget._id, amount, description: topupDesc || undefined });
      showToast({ message: res.data.message, type: 'success' });
      setTopupTarget(null);
      setTopupAmount('');
      setTopupDesc('');
      load(q);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally { setTopupLoading(false); }
  };

  const openPermModal = (u) => {
    setPermTarget(u);
    setPermRole(u.role || 'user');
    setPermList(u.permissions || []);
  };

  const togglePerm = (key) => {
    setPermList((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSavePerm = async () => {
    setPermLoading(true);
    try {
      const roleRes = await updateUserRole(permTarget._id, permRole);
      const permsToSave = permRole === 'staff' ? permList : [];
      const permRes = await updateUserPermissions(permTarget._id, permsToSave);
      const updatedUser = permRes.data.data;
      setUsers((prev) => prev.map((u) => u._id === permTarget._id ? { ...u, role: updatedUser.role, permissions: updatedUser.permissions } : u));
      showToast({ message: `Đã cập nhật quyền cho ${permTarget.name}`, type: 'success' });
      setPermTarget(null);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally { setPermLoading(false); }
  };

  const TIER_COLOR = { bronze: 'text-orange-600 bg-orange-50', silver: 'text-gray-600 bg-gray-100', gold: 'text-yellow-600 bg-yellow-50', platinum: 'text-blue-600 bg-blue-50' };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý người dùng</h1>
      <div className="flex gap-3 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(q)}
          placeholder="Tìm tên hoặc email..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
        <button onClick={() => load(q)} className="btn-primary px-4 py-2 text-sm rounded-lg">Tìm</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Người dùng', 'Email', 'SĐT', 'Hạng', 'Số dư ví', 'Role', 'Trạng thái', 'Hành động'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={8} className="text-center py-10 text-red-500">{loadError}</td></tr>
            ) : !users.length ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có người dùng</td></tr>
            ) : users.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[u.memberTier] || ''}`}>
                    {u.memberTier?.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-green-600">{formatPrice(u.walletBalance || 0)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_BADGE[u.role] || ROLE_BADGE.user}`}>
                    {u.role?.toUpperCase() || 'USER'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => { setTopupTarget(u); setTopupAmount(''); setTopupDesc(''); }}
                      className="text-xs bg-green-50 text-green-600 px-2 py-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1">
                      <Wallet size={11} /> Nạp ví
                    </button>
                    <button onClick={() => openPermModal(u)}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                      <Shield size={11} /> Quyền
                    </button>
                    <button onClick={() => handleToggle(u._id)}
                      className={`text-xs px-2 py-1.5 rounded-lg font-medium transition-colors ${u.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {u.isActive ? 'Khóa' : 'Mở khóa'}
                    </button>
                    <button onClick={() => setDeleteTarget(u)}
                      title="Xóa tài khoản (chỉ khi chưa phát sinh giao dịch)"
                      className="text-xs bg-gray-50 text-gray-500 px-2 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 flex items-center gap-1 transition-colors">
                      <Trash2 size={11} /> Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Phân quyền */}
      {permTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPermTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Shield size={18} className="text-blue-600" /> Phân quyền — {permTarget.name}
              </h3>
              <button onClick={() => setPermTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Role</label>
                <select value={permRole} onChange={(e) => { setPermRole(e.target.value); if (e.target.value !== 'staff') setPermList([]); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  <option value="user">User (khách hàng)</option>
                  <option value="staff">Staff (nhân viên)</option>
                  <option value="admin">Admin (toàn quyền)</option>
                </select>
              </div>

              {permRole === 'staff' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Quyền truy cập</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISSIONS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                        <input type="checkbox" checked={permList.includes(key)} onChange={() => togglePerm(key)}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {permRole === 'admin' && (
                <p className="text-sm text-gray-500 bg-red-50 rounded-lg p-3">
                  Admin có toàn quyền truy cập tất cả module, không cần cấu hình thêm.
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setPermTarget(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleSavePerm} disabled={permLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {permLoading ? 'Đang lưu...' : 'Lưu quyền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Trash2 size={18} className="text-red-600" /> Xóa tài khoản
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="bg-red-50 rounded-xl p-3 mb-4 text-sm">
              <p className="text-gray-600">Bạn sắp xóa tài khoản:</p>
              <p className="font-semibold text-gray-800 mt-1">{deleteTarget.name}</p>
              <p className="text-gray-500">{deleteTarget.email}</p>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Hành động này <span className="font-semibold text-red-600">không thể hoàn tác</span>. Chỉ xóa được nếu tài khoản chưa có đơn hàng hoặc giao dịch ví.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nạp ví */}
      {topupTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setTopupTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Wallet size={18} className="text-green-600" /> Nạp tiền vào ví
              </h3>
              <button onClick={() => setTopupTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <p className="text-gray-500">Người dùng: <span className="font-medium text-gray-800">{topupTarget.name}</span></p>
              <p className="text-gray-500">Số dư hiện tại: <span className="font-medium text-green-600">{formatPrice(topupTarget.walletBalance || 0)}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền nạp (VND) *</label>
                <input type="number" min={1000} value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="VD: 100000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                {topupAmount && Number(topupAmount) > 0 && (
                  <p className="text-xs text-green-600 mt-1">= {formatPrice(Number(topupAmount))}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ghi chú (tùy chọn)</label>
                <input value={topupDesc} onChange={(e) => setTopupDesc(e.target.value)}
                  placeholder="VD: Bồi thường sự cố, thưởng khách hàng..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setTopupTarget(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleTopup} disabled={topupLoading || !topupAmount}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {topupLoading ? 'Đang nạp...' : 'Nạp tiền'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
