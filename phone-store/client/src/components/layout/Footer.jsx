import { Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Realme'];

const SUPPORT_LINKS = [
  { label: 'Giới thiệu', to: '/about' },
  { label: 'Câu hỏi thường gặp', to: '/faq' },
  { label: 'Chính sách', to: '/policy' },
];

const PAYMENT_BADGES = ['COD', 'Chuyển khoản', 'VNPay', 'Visa', 'Mastercard'];

/* ── Social icons: nền màu thương hiệu + icon SVG trắng ── */
const SocialIcon = ({ href, label, bg, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    title={label}
    className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-75 shrink-0"
    style={{ background: bg }}
  >
    {children}
  </a>
);

const SOCIAL = [
  {
    label: 'Facebook',
    href: 'https://facebook.com',
    bg: '#1877F2',
    icon: (
      /* Logo f của Facebook */
      <svg width="10" height="18" viewBox="0 0 10 18" fill="white">
        <path d="M6.5 10.2H9l.5-3H6.5V5.7c0-.85.28-1.6 1.5-1.6H9.6V1.13A18.3 18.3 0 0 0 7.2 1C4.68 1 3 2.53 3 5.4v1.8H.5v3H3V18h3.5V10.2z"/>
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    bg: 'radial-gradient(circle at 30% 110%, #fdf497 0%, #fd5949 45%, #d6249f 70%, #285AEB 100%)',
    icon: (
      /* Camera icon đơn giản */
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    bg: '#FF0000',
    icon: (
      /* Nút play YouTube */
      <svg width="18" height="14" viewBox="0 0 18 14" fill="white">
        <path d="M17.6 2.18A2.26 2.26 0 0 0 16 .55C14.6.17 9 .17 9 .17S3.4.17 2 .55A2.26 2.26 0 0 0 .4 2.18 23.6 23.6 0 0 0 0 7a23.6 23.6 0 0 0 .4 4.82A2.26 2.26 0 0 0 2 13.45C3.4 13.83 9 13.83 9 13.83s5.6 0 7-.38a2.26 2.26 0 0 0 1.6-1.63A23.6 23.6 0 0 0 18 7a23.6 23.6 0 0 0-.4-4.82zM7.2 10V4l4.67 3L7.2 10z"/>
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com',
    bg: '#010101',
    icon: (
      /* Logo TikTok */
      <svg width="14" height="16" viewBox="0 0 24 28" fill="white">
        <path d="M22.5 7.1a8.5 8.5 0 0 1-5.2-1.7V16a7.5 7.5 0 1 1-7.5-7.5c.28 0 .55.02.82.05v4.14a3.5 3.5 0 1 0 2.18 3.31V0h4a8.5 8.5 0 0 0 5.7 7.1v.01z"/>
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-zinc-950 text-zinc-400 mt-16">
      <div className="h-px bg-gradient-to-r from-transparent via-blue-600/60 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">

        {/* Cột 1 — Về chúng tôi */}
        <div>
          <h3 className="font-display text-white font-bold text-xl mb-3 tracking-tight">PhoneStore</h3>
          <p className="text-sm leading-relaxed mb-5">
            Chuyên cung cấp điện thoại chính hãng, giá tốt nhất thị trường. Bảo hành 12 tháng chính hãng.
          </p>
          <div className="flex items-center gap-2.5">
            {SOCIAL.map(({ label, href, bg, icon }) => (
              <SocialIcon key={label} href={href} label={label} bg={bg}>
                {icon}
              </SocialIcon>
            ))}
          </div>
        </div>

        {/* Cột 2 — Thương hiệu */}
        <div>
          <h4 className="text-white font-semibold mb-4">Thương hiệu</h4>
          <ul className="space-y-2 text-sm">
            {BRANDS.map((b) => (
              <li key={b}>
                <Link to={`/brand/${b.toLowerCase()}`} className="hover:text-blue-400 transition-colors">
                  {b}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Cột 3 — Hỗ trợ */}
        <div>
          <h4 className="text-white font-semibold mb-4">Hỗ trợ</h4>
          <ul className="space-y-2 text-sm">
            {SUPPORT_LINKS.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className="hover:text-blue-400 transition-colors">{label}</Link>
              </li>
            ))}
            <li>
              <a href="tel:18001234" className="hover:text-blue-400 transition-colors">Hotline: 1800 1234</a>
            </li>
          </ul>
        </div>

        {/* Cột 4 — Liên hệ & Thanh toán */}
        <div>
          <h4 className="text-white font-semibold mb-4">Liên hệ</h4>
          <ul className="space-y-3 text-sm mb-5">
            <li className="flex items-center gap-2">
              <Phone size={15} className="shrink-0" />
              <span>1800 1234 (miễn phí)</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={15} className="shrink-0" />
              <span>support@phonestore.vn</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin size={15} className="shrink-0 mt-0.5" />
              <span>Số 1 Võ Văn Ngân, Q.Thủ Đức, TP.HCM</span>
            </li>
          </ul>

          <h4 className="text-white font-semibold mb-2 text-sm">Thanh toán</h4>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_BADGES.map((name) => (
              <span key={name}
                className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-800 py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>© 2024 PhoneStore. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/policy" className="hover:text-zinc-300 transition-colors">Chính sách</Link>
            <Link to="/faq" className="hover:text-zinc-300 transition-colors">FAQ</Link>
            <Link to="/about" className="hover:text-zinc-300 transition-colors">Giới thiệu</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
