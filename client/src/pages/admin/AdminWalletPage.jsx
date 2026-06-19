import { useEffect, useState, useCallback } from 'react';
import {
  getAdminTopups, confirmAdminTopup,
  getAdminWithdrawals, processAdminWithdrawal,
} from '../../api/wallet';
import { formatPrice } from '../../utils/formatPrice';
import { Wallet, CheckCircle, XCircle, X, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const TOPUP_STATUS = {
  pending:   { text: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
  completed: { text: 'Đã xác nhận',  color: 'bg-green-100 text-green-700' },
  failed:    { text: 'Thất bại',     color: 'bg-red-100 text-red-600' },
};

const WITHDRAW_STATUS = {
  pending:    { text: 'Chờ xử lý',   color: 'bg-yellow-100 text-yellow-700' },
  processing: { text: 'Đang xử lý',  color: 'bg-blue-100 text-blue-700' },
  completed:  { text: 'Hoàn thành',  color: 'bg-green-100 text-green-700' },
  rejected:   { text: 'Từ chối',     color: 'bg-red-100 text-red-600' },
};

export default function AdminWalletPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('topup');
  const [topups, setTopups] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topupStatus, setTopupStatus] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState('');

  // Withdrawal processing modal
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [processForm, setProcessForm] = useState({ status: 'completed', adminNote: '', transactionRef: '' });
  const [processing, setProcessing] = useState(false);

  const loadTopups = useCallback(() => {
    setLoading(true);
    getAdminTopups({ status: topupStatus || undefined, limit: 30 })
      .then((r) => setTopups(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topupStatus]);

  const loadWithdrawals = useCallback(() => {
    setLoading(true);
    getAdminWithdrawals({ status: withdrawStatus || undefined, limit: 30 })
      .then((r) => setWithdrawals(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [withdrawStatus]);

  useEffect(() => { if (activeTab === 'topup') loadTopups(); }, [activeTab, topupStatus]);
  useEffect(() => { if (activeTab === 'withdraw') loadWithdrawals(); }, [activeTab, withdrawStatus]);

  const handleConfirmTopup = async (id) => {
    if (!confirm('Xác nhận đã nhận được tiền chuyển khoản?')) return;
    try {
      const res = await confirmAdminTopup(id);
      showToast({ message: res.data.message, type: 'success' });
      loadTopups();
    } catch (err) { showToast({ message: err.response?.data?.message || 'Lỗi', type: 'error' }); }
  };

  const openProcessModal = (w) => {
    setSelectedWithdrawal(w);
    setProcessForm({ status: 'completed', adminNote: '', transactionRef: '' });
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await processAdminWithdrawal(selectedWithdrawal._id, processForm);
      showToast({ message: res.data.message, type: 'success' });
      setSelectedWithdrawal(null);
      loadWithdrawals();
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Lỗi xử lý', type: 'error' });
    } finally { setProcessing(false); }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet size={22} className="text-green-600" /> Quản lý Ví điện tử
        </h1>
        <button
          onClick={() => activeTab === 'topup' ? loadTopups() : loadWithdrawals()}
          className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        <button onClick={() => setActiveTab('topup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'topup' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <ArrowDownCircle size={15} /> Yêu cầu nạp tiền
        </button>
        <button onClick={() => setActiveTab('withdraw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'withdraw' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <ArrowUpCircle size={15} /> Yêu cầu rút tiền
        </button>
      </div>

      {/* ── TAB: NẠP TIỀN ── */}
      {activeTab === 'topup' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[['', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['completed', 'Đã xác nhận'], ['failed', 'Thất bại']].map(([val, lbl]) => (
              <button key={val} onClick={() => setTopupStatus(val)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${topupStatus === val ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Thời gian', 'Khách hàng', 'Mã tham chiếu', 'Số tiền', 'Trạng thái', 'Hành động'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                ) : topups.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có yêu cầu nạp tiền</td></tr>
                ) : topups.map((t) => (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{t.userId?.name}</p>
                      <p className="text-xs text-gray-400">{t.userId?.phone || t.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-green-700 font-semibold">{t.ref}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{formatPrice(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TOPUP_STATUS[t.status]?.color}`}>
                        {TOPUP_STATUS[t.status]?.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.status === 'pending' && (
                        <button onClick={() => handleConfirmTopup(t._id)}
                          className="text-xs bg-green-50 text-green-600 px-2 py-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1">
                          <CheckCircle size={12} /> Xác nhận đã nhận tiền
                        </button>
                      )}
                      {t.status !== 'pending' && <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Khi khách chuyển khoản với đúng nội dung, bạn sẽ thấy giao dịch trong ngân hàng. Xác nhận để tự động cộng tiền vào ví khách.
          </p>
        </>
      )}

      {/* ── TAB: RÚT TIỀN ── */}
      {activeTab === 'withdraw' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[['', 'Tất cả'], ['pending', 'Chờ xử lý'], ['processing', 'Đang xử lý'], ['completed', 'Hoàn thành'], ['rejected', 'Từ chối']].map(([val, lbl]) => (
              <button key={val} onClick={() => setWithdrawStatus(val)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${withdrawStatus === val ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Thời gian', 'Khách hàng', 'Số tiền', 'Ngân hàng', 'Trạng thái', 'Hành động'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
                ) : withdrawals.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có yêu cầu rút tiền</td></tr>
                ) : withdrawals.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(w.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{w.userId?.name}</p>
                      <p className="text-xs text-gray-400">{w.userId?.phone || w.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-orange-600">{formatPrice(w.amount)}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 text-xs">{w.bankName}</p>
                      <p className="font-mono text-xs text-gray-600">{w.accountNumber}</p>
                      <p className="text-xs text-gray-500">{w.accountHolder}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${WITHDRAW_STATUS[w.status]?.color}`}>
                        {WITHDRAW_STATUS[w.status]?.text}
                      </span>
                      {w.transactionRef && <p className="text-xs text-gray-400 mt-0.5">Mã GD: {w.transactionRef}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {['pending', 'processing'].includes(w.status) && (
                        <button onClick={() => openProcessModal(w)}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100">
                          Xử lý
                        </button>
                      )}
                      {!['pending', 'processing'].includes(w.status) && <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Tiền đã được trừ khỏi ví khách khi tạo yêu cầu. Nếu từ chối, tiền tự động hoàn lại vào ví.
          </p>
        </>
      )}

      {/* ── Modal xử lý rút tiền ── */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedWithdrawal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Xử lý yêu cầu rút tiền</h3>
              <button onClick={() => setSelectedWithdrawal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4 text-sm space-y-1.5">
              <p><span className="text-gray-500 w-28 inline-block">Khách hàng:</span> <span className="font-medium">{selectedWithdrawal.userId?.name}</span></p>
              <p><span className="text-gray-500 w-28 inline-block">Số tiền:</span> <span className="font-bold text-orange-600">{formatPrice(selectedWithdrawal.amount)}</span></p>
              <p><span className="text-gray-500 w-28 inline-block">Ngân hàng:</span> <span className="font-medium">{selectedWithdrawal.bankName}</span></p>
              <p><span className="text-gray-500 w-28 inline-block">Số TK:</span> <span className="font-mono font-semibold">{selectedWithdrawal.accountNumber}</span></p>
              <p><span className="text-gray-500 w-28 inline-block">Tên TK:</span> <span className="font-medium">{selectedWithdrawal.accountHolder}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kết quả xử lý</label>
                <div className="flex gap-2">
                  {[['completed', 'Đã chuyển tiền', 'bg-green-600'], ['rejected', 'Từ chối', 'bg-red-500']].map(([val, lbl, cls]) => (
                    <button key={val} onClick={() => setProcessForm((f) => ({ ...f, status: val }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium text-white transition-opacity ${cls} ${processForm.status === val ? 'opacity-100' : 'opacity-30'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {processForm.status === 'completed' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Mã giao dịch ngân hàng *</label>
                  <input value={processForm.transactionRef}
                    onChange={(e) => setProcessForm((f) => ({ ...f, transactionRef: e.target.value }))}
                    placeholder="Nhập mã GD từ ngân hàng..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ghi chú cho khách {processForm.status === 'rejected' ? '*' : '(tùy chọn)'}</label>
                <input value={processForm.adminNote}
                  onChange={(e) => setProcessForm((f) => ({ ...f, adminNote: e.target.value }))}
                  placeholder={processForm.status === 'rejected' ? 'Lý do từ chối...' : 'Ghi chú thêm...'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setSelectedWithdrawal(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleProcess} disabled={processing}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {processing ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
