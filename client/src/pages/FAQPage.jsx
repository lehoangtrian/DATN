import { useState } from 'react';
import { ChevronDown, Search, Phone } from 'lucide-react';

const FAQ_DATA = [
  {
    group: 'Đặt hàng & Thanh toán',
    items: [
      { q: 'Tôi có thể đặt hàng mà không cần tài khoản không?', a: 'Bạn cần đăng ký tài khoản để đặt hàng, điều này giúp bạn theo dõi đơn hàng và lịch sử mua sắm dễ dàng hơn. Việc đăng ký chỉ mất khoảng 1 phút.' },
      { q: 'PhoneStore chấp nhận những hình thức thanh toán nào?', a: 'Chúng tôi chấp nhận: Thanh toán khi nhận hàng (COD), Chuyển khoản ngân hàng (có QR code), và Thanh toán qua VNPay (ATM, thẻ quốc tế, QR).' },
      { q: 'Tôi có thể hủy đơn hàng sau khi đặt không?', a: 'Bạn có thể hủy đơn hàng khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Vào trang Đơn hàng → chọn đơn → nhấn Hủy đơn hàng.' },
      { q: 'Mã giảm giá (coupon) dùng như thế nào?', a: 'Tại trang Giỏ hàng, nhập mã coupon vào ô "Mã giảm giá" và nhấn Áp dụng. Giảm giá sẽ được trừ trực tiếp vào tổng tiền.' },
      { q: 'Đơn hàng của tôi có hóa đơn VAT không?', a: 'PhoneStore có thể xuất hóa đơn VAT theo yêu cầu. Vui lòng liên hệ hotline 1800 1234 và cung cấp thông tin công ty trong vòng 24 giờ sau khi đặt hàng.' },
    ],
  },
  {
    group: 'Giao hàng & Vận chuyển',
    items: [
      { q: 'Thời gian giao hàng là bao lâu?', a: 'TP.HCM và Hà Nội: giao trong ngày hoặc hôm sau. Các tỉnh thành khác: 1–3 ngày làm việc. Một số khu vực xa có thể 3–5 ngày.' },
      { q: 'Phí giao hàng là bao nhiêu?', a: 'Miễn phí giao hàng cho đơn từ 5.000.000đ. Đơn dưới 5 triệu: phí 30.000đ toàn quốc.' },
      { q: 'Tôi có thể theo dõi đơn hàng không?', a: 'Có. Vào trang Đơn hàng của tôi → chọn đơn → xem trạng thái và mã tracking (nếu đã giao cho đơn vị vận chuyển).' },
      { q: 'Giao hàng vào cuối tuần và ngày lễ không?', a: 'Chúng tôi giao hàng 7 ngày/tuần kể cả thứ 7, Chủ nhật. Ngày lễ lớn có thể chậm 1–2 ngày, chúng tôi sẽ thông báo trước.' },
    ],
  },
  {
    group: 'Đổi trả & Bảo hành',
    items: [
      { q: 'Chính sách đổi trả như thế nào?', a: 'Đổi trả trong 7 ngày nếu sản phẩm bị lỗi kỹ thuật hoặc không đúng mô tả. Sản phẩm phải còn nguyên hộp, phụ kiện đầy đủ, chưa có dấu hiệu sử dụng.' },
      { q: 'Bảo hành bao lâu và bảo hành ở đâu?', a: 'Tất cả sản phẩm được bảo hành 12 tháng chính hãng tại các trung tâm bảo hành ủy quyền của nhà sản xuất trên toàn quốc.' },
      { q: 'Tôi mua điện thoại bị lỗi sau 1 tuần thì sao?', a: 'Trong 30 ngày đầu nếu sản phẩm bị lỗi phần cứng do nhà sản xuất, chúng tôi hỗ trợ đổi máy mới hoặc hoàn tiền 100%. Liên hệ hotline để được hỗ trợ ngay.' },
      { q: 'Những trường hợp nào không được bảo hành?', a: 'Bảo hành không áp dụng cho: màn hình nứt vỡ, vào nước quá mức, tự ý sửa chữa ngoài, tem bảo hành bị bóc, hoặc hư hỏng do tác động vật lý.' },
      { q: 'Làm thế nào để gửi sản phẩm bảo hành?', a: 'Bạn có thể mang trực tiếp đến cửa hàng PhoneStore, hoặc liên hệ hotline 1800 1234 để được hướng dẫn gửi hàng qua bưu điện (PhoneStore hỗ trợ phí ship 2 chiều).' },
    ],
  },
];

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 text-sm text-gray-600 leading-relaxed bg-white border-t border-gray-50">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState('');

  const filtered = FAQ_DATA.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Câu hỏi thường gặp</h1>
        <p className="text-gray-500">Tìm câu trả lời nhanh cho những thắc mắc phổ biến</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm câu hỏi..."
          className="w-full border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-red-400"
        />
      </div>

      {/* FAQ Groups */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium">Không tìm thấy câu hỏi phù hợp</p>
          <p className="text-sm mt-1">Hãy thử từ khóa khác hoặc liên hệ hotline</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map((group) => (
            <div key={group.group}>
              <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block" />
                {group.group}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA hotline */}
      <div className="mt-10 bg-gray-50 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
          <Phone size={22} className="text-red-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">Vẫn còn thắc mắc?</p>
          <p className="text-sm text-gray-500">
            Gọi hotline <a href="tel:18001234" className="font-bold text-red-600 hover:underline">1800 1234</a> (miễn phí) · 8:00 – 22:00 hằng ngày
          </p>
        </div>
      </div>
    </div>
  );
}
