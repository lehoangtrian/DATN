import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, HeadphonesIcon, Tag } from 'lucide-react';

const STATS = [
  { value: '500+', label: 'Sản phẩm chính hãng' },
  { value: '10.000+', label: 'Khách hàng tin dùng' },
  { value: '12 tháng', label: 'Bảo hành chính hãng' },
];

const COMMITMENTS = [
  { icon: ShieldCheck, title: 'Hàng chính hãng 100%', desc: 'Tất cả sản phẩm được nhập khẩu trực tiếp từ nhà sản xuất, có tem chống hàng giả đầy đủ.' },
  { icon: Tag, title: 'Giá tốt nhất thị trường', desc: 'Cam kết hoàn tiền chênh lệch nếu bạn tìm thấy nơi bán rẻ hơn trong vòng 7 ngày.' },
  { icon: Truck, title: 'Giao hàng nhanh toàn quốc', desc: 'Giao hàng trong ngày tại TP.HCM và Hà Nội. Toàn quốc 1–3 ngày làm việc.' },
  { icon: HeadphonesIcon, title: 'Hỗ trợ 24/7', desc: 'Đội ngũ tư vấn sẵn sàng hỗ trợ qua hotline, chat và email bất kỳ lúc nào.' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">📱</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Về PhoneStore</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Điểm đến tin cậy cho người yêu công nghệ — chính hãng, giá tốt, dịch vụ tận tâm.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-14">
        {STATS.map(({ value, label }) => (
          <div key={label} className="card p-6 text-center">
            <p className="text-3xl font-bold text-red-600 mb-1">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Story */}
      <div className="card p-8 mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Câu chuyện của chúng tôi</h2>
        <div className="space-y-4 text-gray-600 leading-relaxed text-sm">
          <p>
            PhoneStore được thành lập năm 2020 với sứ mệnh đơn giản: giúp người Việt tiếp cận những
            chiếc điện thoại chính hãng tốt nhất với mức giá hợp lý nhất. Chúng tôi bắt đầu từ một
            cửa hàng nhỏ tại TP.HCM, nay đã phục vụ hàng chục nghìn khách hàng trên toàn quốc.
          </p>
          <p>
            Với đội ngũ hơn 50 nhân viên am hiểu công nghệ, chúng tôi không chỉ bán sản phẩm — chúng
            tôi tư vấn để bạn chọn được chiếc điện thoại phù hợp nhất với nhu cầu và ngân sách. Mỗi
            sản phẩm tại PhoneStore đều được kiểm tra kỹ lưỡng trước khi đến tay khách hàng.
          </p>
          <p>
            Chúng tôi là đại lý ủy quyền chính thức của Apple, Samsung, Xiaomi, OPPO, Vivo và Realme
            tại Việt Nam. Điều đó có nghĩa là bạn luôn được đảm bảo sản phẩm thật, bảo hành đúng hạn,
            và trải nghiệm mua sắm an toàn tuyệt đối.
          </p>
        </div>
      </div>

      {/* Commitments */}
      <h2 className="text-xl font-bold text-gray-800 mb-5">Cam kết của chúng tôi</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {COMMITMENTS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card p-5 flex gap-4">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={20} className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1 text-sm">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center bg-red-50 rounded-2xl p-8">
        <p className="text-gray-700 font-medium mb-4">Sẵn sàng tìm chiếc điện thoại hoàn hảo?</p>
        <Link to="/products" className="btn-primary px-8 py-3 rounded-xl font-semibold inline-block">
          Khám phá sản phẩm
        </Link>
      </div>
    </div>
  );
}
