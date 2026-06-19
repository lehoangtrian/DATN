import { useEffect, useState, useCallback } from 'react';
import { getAdminReturns, updateAdminReturn } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import { RotateCcw, X, CheckCircle, XCircle, Banknote, Wallet, Info, DollarSign } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const STATUS_LABEL = {
  pending:    { text: 'Chờ xử lý',      color: 'bg-yellow-100 text-yellow-700' },
  approved:   { text: 'Đã chấp nhận',   color: 'bg-blue-100 text-blue-700' },
  processing: { text: 'Đang xử lý',     color: 'bg-purple-100 text-purple-700' },
  completed:  { text: 'Hoàn tiền xong', color: 'bg-green-100 text-green-700' },
  rejected:   { text: 'Đã từ chối',     color: 'bg-red-100 text-red-600' },
};


const PAYMENT_LABEL = { cod: 'COD', bank_transfer: 'Chuyển khoản', vnpay: 'VNPay' };

export default function AdminReturnsPage() {
  const { showToast } = useToast();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ status: '', adminNote: '', refundAmount: '', refundMethod: 'wallet', refundRef: '' });
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refunding, setRefunding] = useState(false);

  const load = useCallback((p = 1) => {
    setLoading(true);
    getAdminReturns({ status: statusFilter || undefined, page: p, limit: 15 })
      .then((res) => { setReturns(res.data.data || []); setTotalPages(res.data.pagination?.pages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(1); setPage(1); }, [statusFilter]);

  const openDetail = (r) => {
    setSelected(r);
    setForm({
      status: r.status,
      adminNote: r.adminNote || '',
      refundAmount: r.refundAmount || r.orderId?.totalPrice || '',
      refundMethod: 'wallet',
      refundRef: '',
    });
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await updateAdminReturn(selected._id, form);
      setReturns((prev) => prev.map((r) => r._id === selected._id ? { ...r, ...res.data.data } : r));
      setSelected(null);
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally { setProcessing(false); }
  };

  const quickAction = async (id, status, extra = {}) => {
    try {
      const res = await updateAdminReturn(id, { status, ...extra });
      setReturns((prev) => prev.map((r) => r._id === id ? { ...r, ...res.data.data } : r));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const openRefund = (r) => {
    setRefundTarget(r);
    setRefundAmount(String(r.refundAmount || r.orderId?.totalPrice || ''));
  };

  const handleQuickRefund = async () => {
    if (!refundAmount || Number(refundAmount) <= 0) {
      showToast({ message: 'Vui lòng nhập số tiền hoàn hợp lệ', type: 'error' }); return;
    }
    setRefunding(true);
    try {
      const res = await updateAdminReturn(refundTarget._id, {
        status: 'completed',
        refundAmount: Number(refundAmount),
        refundMethod: 'wallet',
      });
      setReturns((prev) => prev.map((r) => r._id === refundTarget._id ? { ...r, ...res.data.data } : r));
      setRefundTarget(null);
      showToast({ message: `Đã hoàn ${Number(refundAmount).toLocaleString('vi-VN')}đ vào ví của ${refundTarget.userId?.name}`, type: 'success' });
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' });
    } finally { setRefunding(false); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <RotateCcw size={22} className="text-orange-500" /> Quản lý trả hàng & Hoàn tiền
        </h1>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['', 'Tất cả'], ...Object.entries(STATUS_LABEL).map(([k, v]) => [k, v.text])].map(([val, lbl]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${statusFilter === val ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Đơn hàng', 'Khách hàng', 'Lý do', 'Số tiền', 'Thanh toán', 'Trạng thái', 'Hành động'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : returns.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có yêu cầu trả hàng</td></tr>
            ) : returns.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.orderId?.orderCode}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{r.userId?.name}</p>
                  <p className="text-xs text-gray-400">{r.userId?.phone || r.userId?.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                  <p className="line-clamp-2 text-xs">{r.reason}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-red-600">{formatPrice(r.refundAmount)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{PAYMENT_LABEL[r.orderId?.paymentMethod] || r.orderId?.paymentMethod}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABEL[r.status]?.color}`}>
                    {STATUS_LABEL[r.status]?.text}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openDetail(r)}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-200">
                      Chi tiết
                    </button>
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => quickAction(r._id, 'approved')}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                          <CheckCircle size={11} /> Duyệt
                        </button>
                        <button onClick={() => quickAction(r._id, 'rejected')}
                          className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-100 flex items-center gap-1">
                          <XCircle size={11} /> Từ chối
                        </button>
                      </>
                    )}
                    {['approved', 'processing'].includes(r.status) && (
                      <button onClick={() => openRefund(r)}
                        className="text-xs bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1 font-medium">
                        <Wallet size={11} /> Hoàn tiền
                      </button>
                    )}
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
          <div className="flex justify-center gap-1.5 mt-4">
            <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }} disabled={page === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Trước</button>
            {start > 1 && <>
              <button onClick={() => { setPage(1); load(1); }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200">1</button>
              {start > 2 && <span className="px-1 text-gray-400">...</span>}
            </>}
            {pages.map((p) => (
              <button key={p} onClick={() => { setPage(p); load(p); }}
                className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-red-600 text-white border-red-600' : 'border-gray-200'}`}>{p}</button>
            ))}
            {end < totalPages && <>
              {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
              <button onClick={() => { setPage(totalPages); load(totalPages); }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200">{totalPages}</button>
            </>}
            <button onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p); }} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Sau</button>
          </div>
        );
      })()}

      {/* ── Modal hoàn tiền nhanh ── */}
      {refundTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRefundTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Wallet size={18} className="text-green-600" /> Hoàn tiền vào ví
              </h3>
              <button onClick={() => setRefundTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
              <p className="text-gray-500">Khách hàng: <span className="font-semibold text-gray-800">{refundTarget.userId?.name}</span></p>
              <p className="text-gray-500">Đơn hàng: <span className="font-semibold text-gray-800">{refundTarget.orderId?.orderCode}</span></p>
              <p className="text-gray-500">Tổng đơn: <span className="font-semibold text-red-600">{formatPrice(refundTarget.orderId?.totalPrice)}</span></p>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền hoàn vào ví (VND)</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="Nhập số tiền..."
                min={1}
                max={refundTarget?.orderId?.totalPrice || refundTarget?.refundAmount}
              />
              {refundAmount && Number(refundAmount) > 0 && (
                <p className="text-xs text-green-600 mt-1">= {Number(refundAmount).toLocaleString('vi-VN')}đ</p>
              )}
            </div>

            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-5">
              <Info size={13} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">Tiền sẽ được cộng ngay vào ví điện tử của khách và đơn trả hàng chuyển sang <strong>Hoàn tiền xong</strong>.</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setRefundTarget(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleQuickRefund} disabled={refunding || !refundAmount || Number(refundAmount) <= 0}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Wallet size={15} />
                {refunding ? 'Đang hoàn...' : 'Xác nhận hoàn tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal chi tiết & xử lý ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800">Xử lý trả hàng – {selected.orderId?.orderCode}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info khách hàng */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                <p><span className="text-gray-500 w-32 inline-block">Khách hàng:</span> <span className="font-medium">{selected.userId?.name}</span></p>
                <p><span className="text-gray-500 w-32 inline-block">SĐT:</span> {selected.userId?.phone || '—'}</p>
                <p><span className="text-gray-500 w-32 inline-block">Email:</span> {selected.userId?.email}</p>
                <p><span className="text-gray-500 w-32 inline-block">Đơn hàng:</span> {selected.orderId?.orderCode}</p>
                <p><span className="text-gray-500 w-32 inline-block">Tổng tiền:</span>
                  <span className="font-semibold text-red-600">{formatPrice(selected.orderId?.totalPrice)}</span>
                </p>
                <p><span className="text-gray-500 w-32 inline-block">Thanh toán:</span> {PAYMENT_LABEL[selected.orderId?.paymentMethod] || selected.orderId?.paymentMethod}</p>
              </div>

              {/* Lý do */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Lý do khách hàng:</p>
                <p className="text-sm text-gray-600 bg-orange-50 rounded-xl px-3 py-2">{selected.reason}</p>
                {selected.description && <p className="text-xs text-gray-500 mt-1 px-1">{selected.description}</p>}
              </div>

              {/* Thông tin ngân hàng của khách */}
              {selected.refundBankInfo?.accountNumber && (
                <div className="border border-green-100 bg-green-50 rounded-xl p-3 text-sm">
                  <p className="font-medium text-green-700 mb-1 flex items-center gap-1.5"><Banknote size={14} /> Tài khoản nhận hoàn tiền:</p>
                  <p className="text-gray-700">Ngân hàng: <span className="font-medium">{selected.refundBankInfo.bankName}</span></p>
                  <p className="text-gray-700">Số TK: <span className="font-mono font-semibold">{selected.refundBankInfo.accountNumber}</span></p>
                  <p className="text-gray-700">Tên TK: <span className="font-medium">{selected.refundBankInfo.accountHolder}</span></p>
                </div>
              )}

              <hr />

              {/* Form xử lý */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Cập nhật trạng thái</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
                    {Object.entries(STATUS_LABEL).map(([v, info]) => (
                      <option key={v} value={v}>{info.text}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Ghi chú cho khách</label>
                  <textarea rows={2} value={form.adminNote} onChange={(e) => setForm((f) => ({ ...f, adminNote: e.target.value }))}
                    placeholder="VD: Vui lòng gửi hàng về địa chỉ... trong vòng 5 ngày"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400" />
                </div>

                {/* Thông tin hoàn tiền */}
                {form.status !== 'rejected' && (
                  <div className="border border-green-100 rounded-xl p-3 space-y-3 bg-green-50">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Wallet size={14} className="text-green-600" /> Hoàn tiền vào ví điện tử
                    </p>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Số tiền hoàn (VND)</label>
                      <input type="number" value={form.refundAmount}
                        onChange={(e) => setForm((f) => ({ ...f, refundAmount: e.target.value }))}
                        placeholder={selected.orderId?.totalPrice}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                    </div>
                    <div className="flex items-start gap-2 bg-white border border-green-200 rounded-xl px-3 py-2.5">
                      <Info size={14} className="text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700">
                        Khi chuyển sang <strong>Hoàn tiền xong</strong>, hệ thống tự động cộng{' '}
                        <strong>{form.refundAmount ? Number(form.refundAmount).toLocaleString('vi-VN') + 'đ' : '...'}</strong>{' '}
                        vào ví của <strong>{selected.userId?.name}</strong> — bất kể phương thức thanh toán ban đầu.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setSelected(null)} className="flex-1 border border-gray-200 py-2 rounded-xl text-gray-600 text-sm hover:bg-gray-100">
                Đóng
              </button>
              <button onClick={handleUpdate} disabled={processing}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {processing ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
