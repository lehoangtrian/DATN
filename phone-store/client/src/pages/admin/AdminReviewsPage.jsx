import { useEffect, useState } from 'react';
import { getAdminReviews, updateAdminReview, toggleReview, replyReview } from '../../api/admin';
import { Star, CheckCircle, EyeOff, MessageSquare, Send, Pencil, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const Stars = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <button key={i} type="button" onClick={() => onChange?.(i)}>
        <Star size={18} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
      </button>
    ))}
  </div>
);

export default function AdminReviewsPage() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Reply state
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAdminReviews(filter !== '' ? { isApproved: filter === 'true' } : {})
      .then((res) => setReviews(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const handleToggle = async (id) => {
    try {
      const res = await toggleReview(id);
      setReviews((prev) => prev.map((r) => r._id === id ? { ...r, isApproved: res.data.data.isApproved } : r));
    } catch (err) { showToast({ message: err.response?.data?.message, type: 'error' }); }
  };

  const openReply = (r) => {
    setEditingId(null);
    setReplyingId(r._id);
    setReplyText(r.reply || '');
  };

  const handleSaveReply = async (id) => {
    setReplySaving(true);
    try {
      const res = await replyReview(id, replyText);
      setReviews((prev) => prev.map((r) => r._id === id ? { ...r, reply: res.data.data.reply } : r));
      setReplyingId(null);
    } catch (err) { showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' }); }
    finally { setReplySaving(false); }
  };

  const openEdit = (r) => {
    setReplyingId(null);
    setEditingId(r._id);
    setEditForm({ rating: r.rating, comment: r.comment || '' });
  };

  const handleSaveEdit = async (id) => {
    setEditSaving(true);
    try {
      const res = await updateAdminReview(id, editForm);
      setReviews((prev) => prev.map((r) => r._id === id ? { ...r, rating: res.data.data.rating, comment: res.data.data.comment } : r));
      setEditingId(null);
      showToast({ message: 'Đã cập nhật đánh giá', type: 'success' });
    } catch (err) { showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra', type: 'error' }); }
    finally { setEditSaving(false); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đánh giá</h1>
      <div className="flex gap-2 mb-5">
        {[{ label: 'Tất cả', value: '' }, { label: 'Đã duyệt', value: 'true' }, { label: 'Ẩn', value: 'false' }].map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`text-sm px-4 py-1.5 rounded-full border ${filter === f.value ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-gray-400 text-center py-8">Đang tải...</p>
          : !reviews.length ? <p className="text-gray-400 text-center py-8">Không có đánh giá</p>
          : reviews.map((r) => (
            <div key={r._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-medium text-gray-800 text-sm">{r.userId?.name}</p>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                      ))}
                    </div>
                    {r.isVerifiedPurchase && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Đã mua</span>}
                  </div>
                  <p className="text-sm text-gray-500 italic mb-1">"{r.productId?.name}"</p>
                  <p className="text-sm text-gray-700">{r.comment || <span className="text-gray-400">Không có nội dung</span>}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>

                  {/* Edit form */}
                  {editingId === r._id && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">Chỉnh sửa đánh giá</p>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Số sao</p>
                        <Stars value={editForm.rating} onChange={(v) => setEditForm({ ...editForm, rating: v })} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Nội dung</p>
                        <textarea value={editForm.comment} onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                          rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Hủy</button>
                        <button onClick={() => handleSaveEdit(r._id)} disabled={editSaving}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-60">
                          <Pencil size={11} /> {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reply display */}
                  {r.reply && replyingId !== r._id && (
                    <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">Phản hồi của PhoneStore:</p>
                      <p className="text-xs text-blue-800">{r.reply}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  {replyingId === r._id && (
                    <div className="mt-3 space-y-2">
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Nhập phản hồi của cửa hàng..." rows={2}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => setReplyingId(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Hủy</button>
                        <button onClick={() => handleSaveReply(r._id)} disabled={replySaving}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                          <Send size={11} /> {replySaving ? 'Đang lưu...' : 'Lưu phản hồi'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.isApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.isApproved ? 'Đã duyệt' : 'Đã ẩn'}
                  </span>
                  <button onClick={() => handleToggle(r._id)}
                    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium ${r.isApproved ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                    {r.isApproved ? <><EyeOff size={12} /> Ẩn</> : <><CheckCircle size={12} /> Duyệt</>}
                  </button>
                  <button onClick={() => editingId === r._id ? setEditingId(null) : openEdit(r)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 font-medium">
                    <Pencil size={12} /> Sửa đánh giá
                  </button>
                  <button onClick={() => replyingId === r._id ? setReplyingId(null) : openReply(r)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 font-medium">
                    <MessageSquare size={12} /> {r.reply ? 'Sửa phản hồi' : 'Phản hồi'}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
