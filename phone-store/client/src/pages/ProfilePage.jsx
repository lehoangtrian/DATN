import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword, addAddress, updateAddress, deleteAddress, uploadAvatar } from '../api/profile';
import { getWalletBalance, getWalletTransactions, requestBankTopup, requestWithdrawal } from '../api/wallet';
import { redeemPointsToCoupon } from '../api/loyalty';
import { formatPrice } from '../utils/formatPrice';
import { User, Lock, MapPin, Plus, Trash2, CheckCircle, Camera, Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Copy, X, Award, Pencil, Gem } from 'lucide-react';
import Breadcrumb from '../components/ui/Breadcrumb';

// multiplier phải khớp TIER_POINT_MULTIPLIER ở server/src/controllers/admin.controller.js
// (chỉ dùng để hiển thị — số điểm thật được server tính khi đơn giao thành công)
const TIERS = [
  { id: 'bronze',   label: 'Bronze',   min: 0,          max: 5000000,   cls: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', multiplier: 1 },
  { id: 'silver',   label: 'Silver',   min: 5000000,    max: 20000000,  cls: 'bg-gray-100 text-gray-600',    bar: 'bg-gray-400',   multiplier: 1.5 },
  { id: 'gold',     label: 'Gold',     min: 20000000,   max: 50000000,  cls: 'bg-yellow-100 text-yellow-700',bar: 'bg-yellow-400', multiplier: 2 },
  { id: 'platinum', label: 'Platinum', min: 50000000,   max: null,      cls: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-400',   multiplier: 3 },
];

const MIN_REDEEM_POINTS = 50; // khớp MIN_REDEEM_POINTS ở server/src/controllers/loyalty.controller.js

const TABS = [
  { id: 'info',      label: 'Thông tin',    icon: User },
  { id: 'password',  label: 'Đổi mật khẩu', icon: Lock },
  { id: 'addresses', label: 'Địa chỉ',      icon: MapPin },
  { id: 'wallet',    label: 'Ví',           icon: Wallet },
];

export default function ProfilePage() {
  const { user, loginUser } = useAuth();
  const [tab, setTab] = useState('info');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Đổi điểm sang mã giảm giá
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(MIN_REDEEM_POINTS);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState(null);
  const [redeemError, setRedeemError] = useState('');

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  // Info form
  const [info, setInfo] = useState({ name: '', phone: '', birthday: '' });
  // Password form
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  // Address form
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editAddrId, setEditAddrId] = useState(null);
  const [addr, setAddr] = useState({ label: 'Nhà', fullName: '', phone: '', address: '', city: '', district: '', isDefault: false });

  // Wallet state
  const [wallet, setWallet] = useState({ balance: 0, transactionCount: 0 });
  const [walletTxs, setWalletTxs] = useState([]);
  const [walletPage, setWalletPage] = useState(1);
  const [walletTotalPages, setWalletTotalPages] = useState(1);
  const [walletLoading, setWalletLoading] = useState(false);

  // Topup modal
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupResult, setTopupResult] = useState(null); // { ref, qrUrl, amount, bankId, bankAccount, bankHolder }
  const [topupLoading, setTopupLoading] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // Withdraw modal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bankName: '', accountNumber: '', accountHolder: '' });
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    getProfile().then((res) => {
      const p = res.data.data;
      setProfile(p);
      setInfo({ name: p.name || '', phone: p.phone || '', birthday: p.birthday ? p.birthday.slice(0, 10) : '' });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'wallet') return;
    setWalletLoading(true);
    Promise.all([
      getWalletBalance(),
      getWalletTransactions({ page: walletPage, limit: 8 }),
    ]).then(([b, t]) => {
      setWallet(b.data.data);
      setWalletTxs(t.data.data || []);
      setWalletTotalPages(t.data.pagination?.pages || 1);
    }).catch(() => {}).finally(() => setWalletLoading(false));
  }, [tab, walletPage]);

  const handleTopupSubmit = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 10000) { notify('error', 'Số tiền tối thiểu 10,000đ'); return; }
    setTopupLoading(true);
    try {
      const res = await requestBankTopup({ amount });
      setTopupResult(res.data.data);
    } catch (err) {
      notify('error', err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setTopupLoading(false); }
  };

  const handleWithdrawSubmit = async () => {
    const amount = Number(withdrawForm.amount);
    if (!amount || amount < 10000) { notify('error', 'Số tiền tối thiểu 10,000đ'); return; }
    if (amount > (wallet?.balance || 0)) { notify('error', `Số dư ví không đủ (${formatPrice(wallet?.balance || 0)})`); return; }
    if (!withdrawForm.bankName || !withdrawForm.accountNumber || !withdrawForm.accountHolder) {
      notify('error', 'Vui lòng nhập đủ thông tin ngân hàng'); return;
    }
    setWithdrawLoading(true);
    try {
      await requestWithdrawal({ ...withdrawForm, amount });
      notify('success', 'Yêu cầu rút tiền đã được gửi. Admin sẽ xử lý trong 1-2 ngày làm việc.');
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', bankName: '', accountNumber: '', accountHolder: '' });
      // Refresh balance
      getWalletBalance().then((r) => setWallet(r.data.data)).catch(() => {});
      getWalletTransactions({ page: 1, limit: 8 }).then((r) => { setWalletTxs(r.data.data || []); }).catch(() => {});
    } catch (err) {
      notify('error', err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setWithdrawLoading(false); }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return notify('error', 'Ảnh tối đa 2MB');
    setPendingAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
    // reset input để có thể chọn lại cùng file
    e.target.value = '';
  };

  const notify = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 3000);
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let newAvatar = user?.avatar;

      // Upload avatar trước nếu có file đang chờ
      if (pendingAvatarFile) {
        const formData = new FormData();
        formData.append('avatar', pendingAvatarFile);
        const avatarRes = await uploadAvatar(formData);
        newAvatar = avatarRes.data.data.avatar;
        setProfile((p) => ({ ...p, avatar: newAvatar }));
        setPendingAvatarFile(null);
        setAvatarPreview(null);
      }

      const res = await updateProfile(info);
      loginUser({ ...user, name: res.data.data.name, phone: res.data.data.phone, avatar: newAvatar });
      setProfile(res.data.data);

      notify('success', newAvatar !== user?.avatar
        ? 'Cập nhật ảnh đại diện và thông tin thành công'
        : 'Cập nhật thông tin thành công');
    } catch (err) {
      notify('error', err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirm) return notify('error', 'Mật khẩu xác nhận không khớp');
    setLoading(true);
    try {
      await changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      notify('success', 'Đổi mật khẩu thành công');
    } catch (err) {
      notify('error', err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const openEditAddr = (a) => {
    setEditAddrId(a._id);
    setAddr({ label: a.label, fullName: a.fullName, phone: a.phone, address: a.address, city: a.city, district: a.district, isDefault: a.isDefault });
    setShowAddrForm(true);
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (editAddrId) {
        res = await updateAddress(editAddrId, addr);
      } else {
        res = await addAddress(addr);
      }
      setProfile((p) => ({ ...p, addresses: res.data.data }));
      setShowAddrForm(false);
      setEditAddrId(null);
      setAddr({ label: 'Nhà', fullName: '', phone: '', address: '', city: '', district: '', isDefault: false });
      notify('success', editAddrId ? 'Đã cập nhật địa chỉ' : 'Thêm địa chỉ thành công');
    } catch (err) {
      notify('error', err.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const handleDeleteAddress = async (id) => {
    if (!confirm('Xóa địa chỉ này?')) return;
    try {
      const res = await deleteAddress(id);
      setProfile((p) => ({ ...p, addresses: res.data.data }));
      notify('success', 'Đã xóa địa chỉ');
    } catch (err) { notify('error', 'Có lỗi xảy ra'); }
  };

  const handleRedeemPoints = async () => {
    setRedeeming(true);
    setRedeemError('');
    try {
      const res = await redeemPointsToCoupon(redeemPoints);
      setRedeemResult(res.data.data);
      setProfile((p) => ({ ...p, loyaltyPoints: res.data.data.remainingPoints }));
    } catch (err) {
      setRedeemError(err.response?.data?.message || 'Đổi điểm thất bại, vui lòng thử lại');
    } finally {
      setRedeeming(false);
    }
  };

  const closeRedeemModal = () => {
    setShowRedeemModal(false);
    setRedeemResult(null);
    setRedeemError('');
    setRedeemPoints(MIN_REDEEM_POINTS);
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Tài khoản' }]} />
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tài khoản của tôi</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Notification */}
      {msg.text && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.type === 'success' && <CheckCircle size={16} />} {msg.text}
        </div>
      )}

      {/* Tab: Thông tin */}
      {tab === 'info' && (
        <form onSubmit={handleUpdateInfo} className="card p-6 space-y-4">
          <div className="flex items-center gap-4 mb-2">
            {/* Avatar upload */}
            <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
              {avatarPreview || profile?.avatar ? (
                <img
                  src={avatarPreview || profile.avatar}
                  alt="Avatar"
                  className={`w-16 h-16 rounded-full object-cover border-2 ${avatarPreview ? 'border-orange-400' : 'border-red-100'}`}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-2xl font-bold text-red-600">
                  {profile?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{profile?.name}</p>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile?.memberTier === 'gold' ? 'bg-yellow-100 text-yellow-700' : profile?.memberTier === 'silver' ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-600'}`}>
                {profile?.memberTier?.toUpperCase()}
              </span>
              {avatarPreview ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-orange-500 font-medium">Ảnh mới — chưa lưu</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAvatarPreview(null); setPendingAvatarFile(null); }}
                    className="text-xs text-gray-400 hover:text-red-500 underline">Hủy</button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Nhấn vào ảnh để thay đổi</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Họ và tên</label>
            <input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={inputCls} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Số điện thoại</label>
            <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} className={inputCls} placeholder="0912 345 678" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Ngày sinh</label>
            <input type="date" value={info.birthday} onChange={(e) => setInfo({ ...info, birthday: e.target.value })} className={inputCls} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary px-6 py-2.5 rounded-xl font-semibold disabled:opacity-60">
            {loading ? 'Đang lưu...' : pendingAvatarFile ? 'Lưu thay đổi (có ảnh mới)' : 'Lưu thay đổi'}
          </button>
        </form>
      )}

      {/* Loyalty Section — shown inside info tab */}
      {tab === 'info' && profile && (
        <div className="card p-6">
          {(() => {
            const tier = TIERS.find((t) => t.id === (profile.memberTier || 'bronze')) || TIERS[0];
            const nextTier = TIERS[TIERS.indexOf(tier) + 1];
            const spent = profile.totalSpent || 0;
            const points = profile.loyaltyPoints || 0;
            const progress = nextTier
              ? Math.min(100, ((spent - tier.min) / (nextTier.min - tier.min)) * 100)
              : 100;

            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Award size={18} className="text-yellow-500" /> Hạng thành viên
                  </h3>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${tier.cls}`}>
                    {tier.label.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Điểm tích lũy</p>
                    <p className="text-lg font-bold text-gray-800">{points.toLocaleString('vi-VN')}</p>
                    <p className="text-xs text-gray-400 mb-1.5">≈ {formatPrice(points * 1000)}</p>
                    <button
                      onClick={() => setShowRedeemModal(true)}
                      disabled={points < MIN_REDEEM_POINTS}
                      className="text-xs text-blue-600 font-medium underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      Đổi sang mã giảm giá
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Tổng chi tiêu</p>
                    <p className="text-lg font-bold text-gray-800">{formatPrice(spent)}</p>
                  </div>
                </div>

                {nextTier && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{tier.label}</span>
                      <span className="font-medium">{formatPrice(nextTier.min - spent)} nữa lên {nextTier.label}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${tier.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
                {!nextTier && (
                  <p className="text-sm text-blue-600 font-medium text-center py-1">
                    🏆 Bạn đang ở hạng cao nhất — Platinum!
                  </p>
                )}

                <div className="mt-4 border-t pt-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Quyền lợi hạng {tier.label}:</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                    {tier.id === 'bronze' && <><span>• Tích 1 điểm / 1,000đ</span><span>• Ưu đãi sinh nhật</span></>}
                    {tier.id === 'silver' && <><span>• Tích 1.5 điểm / 1,000đ</span><span>• Freeship đơn từ 3M</span><span>• Ưu đãi sinh nhật x2</span></>}
                    {tier.id === 'gold'   && <><span>• Tích 2 điểm / 1,000đ</span><span>• Freeship mọi đơn</span><span>• Hỗ trợ ưu tiên</span><span>• Sinh nhật x3</span></>}
                    {tier.id === 'platinum' && <><span>• Tích 3 điểm / 1,000đ</span><span>• Freeship + gói quà</span><span>• Hotline riêng 24/7</span><span>• Sinh nhật x5</span></>}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Tab: Đổi mật khẩu */}
      {tab === 'password' && (
        <form onSubmit={handleChangePassword} className="card p-6 space-y-4">
          {[
            { label: 'Mật khẩu hiện tại', key: 'currentPassword' },
            { label: 'Mật khẩu mới', key: 'newPassword' },
            { label: 'Xác nhận mật khẩu mới', key: 'confirm' },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              <input type="password" value={pwd[f.key]} onChange={(e) => setPwd({ ...pwd, [f.key]: e.target.value })} className={inputCls} required minLength={6} />
            </div>
          ))}
          <button type="submit" disabled={loading} className="btn-primary px-6 py-2.5 rounded-xl font-semibold disabled:opacity-60">
            {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
          </button>
        </form>
      )}

      {/* Tab: Ví điện tử */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          {/* Số dư + actions */}
          <div className="card p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <div className="flex items-center gap-2 mb-1 opacity-80">
              <Wallet size={18} /> <span className="text-sm font-medium">Số dư ví</span>
            </div>
            <p className="text-4xl font-bold tracking-tight">{formatPrice(wallet.balance)}</p>
            <p className="text-sm opacity-70 mt-1 mb-4">{wallet.transactionCount} giao dịch</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowTopup(true); setTopupResult(null); setTopupAmount(''); }}
                className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium py-2 rounded-xl transition-colors">
                <ArrowDownCircle size={16} /> Nạp tiền
              </button>
              <button onClick={() => setShowWithdraw(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium py-2 rounded-xl transition-colors">
                <ArrowUpCircle size={16} /> Rút tiền
              </button>
            </div>
          </div>

          {/* Lịch sử giao dịch */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ArrowUpCircle size={16} className="text-green-500" /> Lịch sử giao dịch
            </h3>
            {walletLoading ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : walletTxs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Chưa có giao dịch nào</div>
            ) : (
              <div className="space-y-2">
                {walletTxs.map((tx) => {
                  const isCredit = tx.amount > 0;
                  const typeInfo = {
                    topup:      { label: 'Nạp tiền',    icon: TrendingUp,   color: 'text-green-600', bg: 'bg-green-50' },
                    refund:     { label: 'Hoàn tiền',   icon: TrendingUp,   color: 'text-blue-600',  bg: 'bg-blue-50' },
                    payment:    { label: 'Thanh toán',  icon: TrendingDown, color: 'text-red-500',   bg: 'bg-red-50' },
                    adjustment: { label: 'Điều chỉnh',  icon: ArrowUpCircle,color: 'text-gray-600',  bg: 'bg-gray-50' },
                  }[tx.type] || { label: tx.type, icon: ArrowUpCircle, color: 'text-gray-600', bg: 'bg-gray-50' };
                  const TxIcon = typeInfo.icon;
                  return (
                    <div key={tx._id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                      <div className={`w-9 h-9 rounded-full ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                        <TxIcon size={16} className={typeInfo.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{typeInfo.label}</p>
                        {tx.description && <p className="text-xs text-gray-400 truncate">{tx.description}</p>}
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                          {isCredit ? '+' : ''}{formatPrice(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-400">Còn: {formatPrice(tx.balanceAfter)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {walletTotalPages > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {Array.from({ length: walletTotalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setWalletPage(p)}
                    className={`w-8 h-8 text-sm rounded-lg border ${p === walletPage ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600'}`}>{p}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Nạp tiền ── */}
      {showTopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowTopup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowDownCircle size={18} className="text-green-600" /> Nạp tiền vào ví</h3>
              <button onClick={() => setShowTopup(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="p-5">
              {!topupResult ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Chuyển khoản ngân hàng → tiền vào ví sau khi admin xác nhận (thường trong 15 phút)</p>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền nạp *</label>
                    <input type="number" min={10000} step={10000} value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="Tối thiểu 10,000đ"
                      className={inputCls} />
                    {topupAmount && Number(topupAmount) >= 10000 && (
                      <p className="text-xs text-green-600 mt-1">= {formatPrice(Number(topupAmount))}</p>
                    )}
                  </div>
                  <button onClick={handleTopupSubmit} disabled={topupLoading}
                    className="w-full btn-primary py-2.5 rounded-xl font-semibold disabled:opacity-60">
                    {topupLoading ? 'Đang tạo...' : 'Tạo lệnh nạp tiền'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">QR chuyển khoản</p>
                    <img src={topupResult.qrUrl} alt="QR" className="mx-auto w-48 h-48 rounded-xl border" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
                    {[
                      { label: 'Ngân hàng', value: topupResult.bankId, field: 'bank' },
                      { label: 'Số tài khoản', value: topupResult.bankAccount, field: 'account' },
                      { label: 'Chủ tài khoản', value: topupResult.bankHolder, field: 'holder' },
                      { label: 'Số tiền', value: formatPrice(topupResult.amount), field: 'amount' },
                      { label: 'Nội dung CK', value: topupResult.ref, field: 'ref', highlight: true },
                    ].map(({ label, value, field, highlight }) => (
                      <div key={field} className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 shrink-0">{label}:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-medium truncate ${highlight ? 'text-green-700 font-mono' : 'text-gray-800'}`}>{value}</span>
                          <button onClick={() => copyToClipboard(value, field)} className="shrink-0 text-gray-400 hover:text-green-600">
                            {copiedField === field ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                    <strong>Quan trọng:</strong> Nhập đúng nội dung chuyển khoản <strong>{topupResult.ref}</strong> để được xác nhận tự động.
                  </div>
                  <button onClick={() => { setShowTopup(false); setTopupResult(null); }}
                    className="w-full btn-outline py-2 rounded-xl text-sm">Đóng — Tôi đã chuyển khoản</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Rút tiền ── */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowWithdraw(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowUpCircle size={18} className="text-orange-500" /> Rút tiền về ngân hàng</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-green-50 rounded-xl px-3 py-2 text-sm text-green-700">
                Số dư khả dụng: <span className="font-bold">{formatPrice(wallet.balance)}</span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền rút *</label>
                <input type="number" min={10000} value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Tối thiểu 10,000đ"
                  className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tên ngân hàng *</label>
                <input value={withdrawForm.bankName}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, bankName: e.target.value }))}
                  placeholder="VD: Vietcombank, Techcombank..."
                  className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tài khoản *</label>
                <input value={withdrawForm.accountNumber}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="Nhập số tài khoản"
                  className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tên chủ tài khoản *</label>
                <input value={withdrawForm.accountHolder}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, accountHolder: e.target.value }))}
                  placeholder="Chữ in hoa, đúng tên ngân hàng"
                  className={inputCls} />
              </div>
              <p className="text-xs text-gray-400">Tiền sẽ được trừ khỏi ví ngay. Admin xử lý trong 1-2 ngày làm việc.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowWithdraw(false)} className="flex-1 btn-outline py-2 rounded-xl text-sm">Hủy</button>
                <button onClick={handleWithdrawSubmit} disabled={withdrawLoading}
                  className="flex-1 bg-orange-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                  {withdrawLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Địa chỉ */}
      {tab === 'addresses' && (
        <div className="space-y-3">
          {profile?.addresses?.map((a) => (
            <div key={a._id} className="card p-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{a.fullName}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a.label}</span>
                  {a.isDefault && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Mặc định</span>}
                </div>
                <p className="text-sm text-gray-500">{a.phone}</p>
                <p className="text-sm text-gray-500">{a.address}, {a.district}, {a.city}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEditAddr(a)} className="text-gray-300 hover:text-blue-500 transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDeleteAddress(a._id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {!showAddrForm ? (
            <button onClick={() => { setEditAddrId(null); setAddr({ label: 'Nhà', fullName: '', phone: '', address: '', city: '', district: '', isDefault: false }); setShowAddrForm(true); }}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors">
              <Plus size={18} /> Thêm địa chỉ mới
            </button>
          ) : (
            <form onSubmit={handleAddAddress} className="card p-5 space-y-3">
              <h3 className="font-semibold text-gray-800">{editAddrId ? 'Sửa địa chỉ' : 'Địa chỉ mới'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Nhãn</label>
                  <select value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} className={inputCls}>
                    {['Nhà', 'Công ty', 'Khác'].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Họ tên *</label>
                  <input value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} className={inputCls} required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Số điện thoại *</label>
                <input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} className={inputCls} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Địa chỉ *</label>
                <input value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tỉnh/Thành phố *</label>
                  <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className={inputCls} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Quận/Huyện *</label>
                  <input value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} className={inputCls} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={addr.isDefault} onChange={(e) => setAddr({ ...addr, isDefault: e.target.checked })} className="accent-red-600" />
                Đặt làm địa chỉ mặc định
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowAddrForm(false); setEditAddrId(null); }} className="flex-1 btn-outline py-2 rounded-xl">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary py-2 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Đang lưu...' : editAddrId ? 'Cập nhật' : 'Lưu địa chỉ'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Modal Đổi điểm sang mã giảm giá ── */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={closeRedeemModal}>
          <div className="bg-white rounded-2xl w-full max-w-sm my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Gem size={18} className="text-blue-600" /> Đổi điểm sang mã giảm giá</h3>
              <button onClick={closeRedeemModal} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="p-5">
              {!redeemResult ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Đang có <strong>{(profile?.loyaltyPoints || 0).toLocaleString('vi-VN')}</strong> điểm.
                    Tỉ lệ đổi: 1 điểm = 1.000đ. Tối thiểu {MIN_REDEEM_POINTS} điểm/lần, mã có hiệu lực 30 ngày.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Số điểm muốn đổi *</label>
                    <input type="number" min={MIN_REDEEM_POINTS} max={profile?.loyaltyPoints || 0} step={1}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Number(e.target.value) || 0)}
                      className={inputCls} />
                    {redeemPoints >= MIN_REDEEM_POINTS && (
                      <p className="text-xs text-green-600 mt-1">= mã giảm {formatPrice(redeemPoints * 1000)}</p>
                    )}
                  </div>
                  {redeemError && <p className="text-sm text-red-500">{redeemError}</p>}
                  <button onClick={handleRedeemPoints}
                    disabled={redeeming || redeemPoints < MIN_REDEEM_POINTS || redeemPoints > (profile?.loyaltyPoints || 0)}
                    className="w-full btn-primary py-2.5 rounded-xl font-semibold disabled:opacity-60">
                    {redeeming ? 'Đang đổi...' : 'Đổi ngay'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <CheckCircle size={40} className="text-green-500 mx-auto" />
                  <p className="text-sm text-gray-600">Đổi điểm thành công! Mã giảm giá của bạn:</p>
                  <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl py-3 px-4">
                    <span className="font-mono font-bold text-lg text-blue-600">{redeemResult.code}</span>
                    <button onClick={() => copyToClipboard(redeemResult.code, 'redeemCode')} className="text-gray-400 hover:text-blue-600">
                      {copiedField === 'redeemCode' ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">Giảm {formatPrice(redeemResult.value)} · Còn lại {(redeemResult.remainingPoints || 0).toLocaleString('vi-VN')} điểm</p>
                  <button onClick={closeRedeemModal} className="w-full btn-outline py-2 rounded-xl text-sm">Đóng</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
