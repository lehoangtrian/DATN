import { useState } from 'react';

const TABS = [
  { id: 'shipping', label: 'Vận chuyển' },
  { id: 'return', label: 'Đổi trả' },
  { id: 'warranty', label: 'Bảo hành' },
  { id: 'privacy', label: 'Bảo mật' },
];

const CONTENT = {
  shipping: {
    title: 'Chính sách vận chuyển',
    sections: [
      {
        heading: 'Thời gian giao hàng',
        items: [
          'TP.HCM & Hà Nội: giao trong ngày hoặc hôm sau (đặt trước 14:00)',
          'Các tỉnh thành khác: 1–3 ngày làm việc',
          'Khu vực hải đảo, vùng sâu: 3–7 ngày làm việc',
          'Thứ 7, Chủ nhật vẫn giao hàng bình thường',
        ],
      },
      {
        heading: 'Phí vận chuyển',
        items: [
          'Miễn phí giao hàng toàn quốc cho đơn từ 5.000.000đ',
          'Đơn dưới 5 triệu: phí cố định 30.000đ',
          'Hỗ trợ phí ship 2 chiều khi bảo hành, đổi trả trong 30 ngày',
        ],
      },
      {
        heading: 'Đơn vị vận chuyển',
        items: [
          'Giao Hàng Nhanh (GHN) — giao hàng nội thành',
          'Giao Hàng Tiết Kiệm (GHTK) — giao hàng toàn quốc',
          'Viettel Post — khu vực vùng sâu, hải đảo',
          'Có thể chọn nhận tại cửa hàng (miễn phí)',
        ],
      },
    ],
  },
  return: {
    title: 'Chính sách đổi trả',
    sections: [
      {
        heading: 'Điều kiện đổi trả trong 7 ngày',
        items: [
          'Sản phẩm bị lỗi kỹ thuật do nhà sản xuất',
          'Sản phẩm không đúng mô tả (màu sắc, dung lượng, model)',
          'Còn nguyên hộp, đầy đủ phụ kiện, tem niêm phong còn nguyên',
          'Chưa có dấu hiệu sử dụng, không có trầy xước, vết nứt',
        ],
      },
      {
        heading: 'Quy trình đổi trả',
        items: [
          'Bước 1: Liên hệ hotline 1800 1234 hoặc email để thông báo',
          'Bước 2: Chụp ảnh/video lỗi và gửi qua email support@phonestore.vn',
          'Bước 3: Nhận hướng dẫn gửi hàng hoặc mang đến cửa hàng',
          'Bước 4: Kiểm tra và xử lý trong 1–3 ngày làm việc',
          'Bước 5: Đổi máy mới hoặc hoàn tiền theo thỏa thuận',
        ],
      },
      {
        heading: 'Trường hợp không được đổi trả',
        items: [
          'Đã quá 7 ngày kể từ ngày nhận hàng',
          'Màn hình nứt, vỡ do tác động vật lý',
          'Đã tự ý sửa chữa ngoài trung tâm ủy quyền',
          'Tem bảo hành bị bóc, số IMEI bị xóa hoặc thay đổi',
          'Vào nước, ẩm ướt do sử dụng không đúng cách',
        ],
      },
    ],
  },
  warranty: {
    title: 'Chính sách bảo hành',
    sections: [
      {
        heading: 'Thời hạn bảo hành',
        items: [
          'Tất cả sản phẩm: 12 tháng bảo hành chính hãng',
          'Phụ kiện kèm theo (cáp, sạc): 3 tháng bảo hành',
          'Điện thoại tân trang (refurbished): 6 tháng bảo hành',
          'Gia hạn bảo hành thêm 12 tháng với gói PhoneStore Care',
        ],
      },
      {
        heading: 'Phạm vi bảo hành',
        items: [
          'Lỗi phần cứng do nhà sản xuất (màn hình, pin, camera, loa...)',
          'Lỗi phần mềm không thể tự khắc phục (brick, bootloop...)',
          'Thay thế linh kiện miễn phí trong thời gian bảo hành',
          'Bảo hành tại hơn 200 trung tâm ủy quyền toàn quốc',
        ],
      },
      {
        heading: 'Không áp dụng bảo hành',
        items: [
          'Hư hỏng do vật lý: rơi, va đập, nứt vỡ màn hình',
          'Vào nước, ẩm ướt quá mức cho phép',
          'Tự sửa chữa hoặc nâng cấp phần cứng không được ủy quyền',
          'Tem bảo hành bị bóc hoặc hư hại',
          'Sử dụng nguồn điện, phụ kiện không tương thích',
        ],
      },
    ],
  },
  privacy: {
    title: 'Chính sách bảo mật',
    sections: [
      {
        heading: 'Thông tin chúng tôi thu thập',
        items: [
          'Thông tin cá nhân: họ tên, email, số điện thoại, địa chỉ',
          'Thông tin đơn hàng: sản phẩm mua, lịch sử giao dịch',
          'Thông tin thiết bị: loại trình duyệt, IP (cho bảo mật)',
          'Không thu thập thông tin thẻ ngân hàng — thanh toán qua cổng bảo mật',
        ],
      },
      {
        heading: 'Mục đích sử dụng',
        items: [
          'Xử lý đơn hàng và giao hàng đến bạn',
          'Gửi thông báo trạng thái đơn hàng qua email/SMS',
          'Cải thiện trải nghiệm mua sắm và dịch vụ chăm sóc khách hàng',
          'Phòng chống gian lận và bảo mật tài khoản',
        ],
      },
      {
        heading: 'Quyền của bạn',
        items: [
          'Quyền truy cập: xem lại thông tin cá nhân đã cung cấp',
          'Quyền chỉnh sửa: cập nhật thông tin trong trang Tài khoản',
          'Quyền xóa: yêu cầu xóa tài khoản qua email',
          'Quyền từ chối: hủy đăng ký nhận email marketing bất kỳ lúc nào',
          'Chúng tôi không bán thông tin cá nhân cho bên thứ ba',
        ],
      },
    ],
  },
};

export default function PolicyPage() {
  const [activeTab, setActiveTab] = useState('shipping');
  const content = CONTENT[activeTab];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Chính sách</h1>
        <p className="text-gray-500">Cam kết minh bạch trong mọi giao dịch</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.id ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card p-6 md:p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">{content.title}</h2>
        <div className="space-y-6">
          {content.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-600 rounded-full inline-block" />
                {section.heading}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-red-400 mt-1 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Cập nhật lần cuối: Tháng 1, 2024 · Mọi thắc mắc liên hệ{' '}
        <a href="mailto:support@phonestore.vn" className="text-red-600 hover:underline">
          support@phonestore.vn
        </a>
      </p>
    </div>
  );
}
