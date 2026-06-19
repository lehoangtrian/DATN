import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProducts, getProducts } from '../api/products';
import { getActiveFlashSales, getActiveCategoryFlashSales } from '../api/flashsale';
import { getBanners, getPromoBanners, getServiceBadges } from '../api/banners';
import PhoneCard from '../components/phone/PhoneCard';
import PhoneGrid from '../components/phone/PhoneGrid';
import SideBanners from '../components/ui/SideBanners';
import { formatPrice, discountPercent } from '../utils/formatPrice';
import { ChevronRight, ChevronLeft, Flame, Sparkles, Tag, Headphones, Zap, Shield, RotateCcw, Truck, CreditCard, Gift, Star, CheckCircle } from 'lucide-react';

const ICON_MAP = {
  'truck': Truck,
  'shield': Shield,
  'rotate-ccw': RotateCcw,
  'tag': Tag,
  'credit-card': CreditCard,
  'gift': Gift,
  'star': Star,
  'zap': Zap,
  'headphones': Headphones,
  'check-circle': CheckCircle,
};

function useCountdown(endTime) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) return;
    const tick = () => setRemaining(Math.max(0, new Date(endTime) - new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, done: remaining === 0 };
}

function CountdownBox({ value }) {
  return (
    <div className="bg-zinc-900 text-blue-400 text-base font-bold w-9 h-9 rounded-xl flex items-center justify-center tabular-nums shadow-soft border border-blue-500/30">
      {String(value).padStart(2, '0')}
    </div>
  );
}

/* Brand data with colors */
const BRANDS = [
  { name: 'Apple',   slug: 'apple',   bg: '#000000', text: '#ffffff', initial: 'A' },
  { name: 'Samsung', slug: 'samsung', bg: '#1428A0', text: '#ffffff', initial: 'S' },
  { name: 'Xiaomi',  slug: 'xiaomi',  bg: '#FF6900', text: '#ffffff', initial: 'Mi' },
  { name: 'OPPO',    slug: 'oppo',    bg: '#1D8348', text: '#ffffff', initial: 'O' },
  { name: 'Vivo',    slug: 'vivo',    bg: '#415FFF', text: '#ffffff', initial: 'V' },
  { name: 'Realme',  slug: 'realme',  bg: '#FFCB05', text: '#1A1A1A', initial: 'R' },
];

const SLIDES = [
  {
    tag: 'Bán chạy nhất 2024',
    title: 'Điện Thoại Chính Hãng\nGiá Tốt Nhất',
    desc: 'Bảo hành 12 tháng · Giao hàng toàn quốc · Trả góp 0%',
    cta: 'Mua ngay',
    link: '/products',
    bg: 'linear-gradient(135deg, #1E40AF 0%, #1428A0 100%)',
    accentBg: 'bg-yellow-400',
    accentText: 'text-blue-900',
    emoji: '📱',
  },
  {
    tag: 'iPhone Series',
    title: 'iPhone 15 & 16\nSiêu Khuyến Mãi',
    desc: 'Giảm đến 2 triệu · Tặng AirPods · Bảo hiểm miễn phí 1 năm',
    cta: 'Xem iPhone',
    link: '/brand/apple',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    accentBg: 'bg-blue-400',
    accentText: 'text-blue-900',
    emoji: '🍎',
  },
  {
    tag: 'Samsung Galaxy',
    title: 'Galaxy S24 Series\nƯu Đãi Đặc Biệt',
    desc: 'Giảm đến 3 triệu · Tặng Galaxy Buds · Đổi máy cũ lấy mới',
    cta: 'Xem Samsung',
    link: '/brand/samsung',
    bg: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
    accentBg: 'bg-cyan-400',
    accentText: 'text-blue-900',
    emoji: '🌌',
  },
];

const ACCENT_GRADIENTS = {
  'bg-blue-600': 'from-blue-600 to-cyan-400',
  'bg-orange-500': 'from-orange-500 to-amber-300',
  'bg-purple-500': 'from-purple-500 to-pink-300',
  'bg-blue-500': 'from-blue-500 to-cyan-300',
};

function SectionHeader({ icon: Icon, iconColor, title, link, accentColor = 'bg-blue-600' }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="section-title text-xl flex items-center gap-2">
          {Icon && <Icon size={20} className={iconColor} />}
          {title}
        </h2>
        <div className={`mt-1.5 w-10 h-1 rounded-full bg-gradient-to-r ${ACCENT_GRADIENTS[accentColor] || ACCENT_GRADIENTS['bg-blue-600']}`} />
      </div>
      <Link to={link} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-full font-semibold transition-colors">
        Xem tất cả <ChevronRight size={16} />
      </Link>
    </div>
  );
}

export default function HomePage() {
  const [slide, setSlide] = useState(0);
  const timerRef = useRef(null);
  const [slides, setSlides] = useState(SLIDES);
  const [hot, setHot] = useState([]);
  const [newest, setNewest] = useState([]);
  const [sale, setSale] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [promoBanners, setPromoBanners] = useState([]);
  const [serviceBadges, setServiceBadges] = useState([]);
  const [catFlashSaleMap, setCatFlashSaleMap] = useState({});
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(flashSales[0]?.endTime);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSlide((s) => (s + 1) % slides.length), 4500);
  };
  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [slides.length]);

  const goSlide = (i) => { setSlide(i); startTimer(); };
  const prevSlide = () => goSlide((slide - 1 + slides.length) % slides.length);
  const nextSlide = () => goSlide((slide + 1) % slides.length);

  useEffect(() => {
    getBanners().then(r => { if (r.data.data?.length) setSlides(r.data.data); }).catch(() => {});
    getActiveFlashSales().then((r) => setFlashSales(r.data.data || [])).catch(() => {});
    getActiveCategoryFlashSales().then((r) => {
      const map = {};
      (r.data.data || []).forEach((s) => {
        const catId = s.categoryId?._id || s.categoryId;
        if (catId) map[catId.toString()] = s;
      });
      setCatFlashSaleMap(map);
    }).catch(() => {});
    getPromoBanners().then(r => { if (r.data.data?.length) setPromoBanners(r.data.data); }).catch(() => {});
    getServiceBadges().then(r => { if (r.data.data?.length) setServiceBadges(r.data.data); }).catch(() => {});
    const ACCESSORY_SLUGS = ['tai-nghe', 'sac-nhanh', 'op-lung', 'cap-sac', 'pin-du-phong'];
    Promise.all([
      getFeaturedProducts(),
      getProducts({ sort: 'newest', limit: 8 }),
      // ISSUE #14 FIX: dùng Promise.allSettled để không crash khi slug không tồn tại trong DB
      Promise.allSettled(
        ACCESSORY_SLUGS.map((slug) => getProducts({ sort: 'popular', limit: 4, category: slug }))
      ),
    ]).then(([hotRes, newRes, accResults]) => {
      const hotData = hotRes.data.data || [];
      setHot(hotData);
      setNewest(newRes.data.data || []);
      setSale(hotData.filter((p) => p.cheapestVariant?.salePrice));
      const accItems = accResults
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value.data?.data || []);
      const seen = new Set();
      setAccessories(accItems.filter((p) => {
        if (seen.has(p._id)) return false;
        seen.add(p._id);
        return true;
      }).slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative bg-gray-50 dark:bg-zinc-950 min-h-screen">
      <SideBanners />
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">

        {/* ── Hero Carousel ─────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden select-none shadow-lg">
          <div className="h-52 md:h-72" />
          {slides.map((s, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center px-8 md:px-14 transition-opacity duration-700"
              style={{
                ...(s.imageUrl ? {} : { background: s.bg }),
                opacity: i === slide ? 1 : 0,
                pointerEvents: i === slide ? 'auto' : 'none',
              }}
            >
              {/* Ảnh banner — dùng <img> thay vì background-image để tránh lỗi CORS/hotlink */}
              {s.imageUrl && (
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {s.imageUrl && <div className="absolute inset-0 bg-black/40" />}
              <div className="text-white flex-1 z-10 relative animate-fade-up">
                {s.tag && (
                  <span className={`text-xs font-bold ${s.accentBg} ${s.accentText} px-3 py-1 rounded-full mb-3 inline-block shadow-soft`}>
                    {s.tag}
                  </span>
                )}
                <h1 className="font-display text-2xl md:text-4xl font-extrabold leading-tight mb-3 whitespace-pre-line tracking-tight">
                  {s.title}
                </h1>
                <p className="text-white/80 text-sm mb-5 hidden md:block">{s.description || s.desc}</p>
                {s.cta && s.link && (
                  <Link
                    to={s.link}
                    className="bg-white text-gray-900 font-bold px-6 py-2.5 rounded-full hover:bg-gray-100 hover:shadow-glow transition-all inline-block text-sm"
                  >
                    {s.cta} →
                  </Link>
                )}
              </div>
              {!s.imageUrl && s.emoji && (
                <div className="text-8xl md:text-9xl hidden sm:block select-none">{s.emoji}</div>
              )}
            </div>
          ))}
          <button onClick={prevSlide}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors backdrop-blur-md">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextSlide}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors backdrop-blur-md">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((_, i) => (
              <button key={i} onClick={() => goSlide(i)}
                className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
            ))}
          </div>
        </div>

        {/* ── Dịch vụ nổi bật ─────────────────────── */}
        {serviceBadges.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {serviceBadges.map((badge) => (
              <div key={badge._id} className={`${badge.bgColor} rounded-2xl p-3.5 flex items-center gap-3 shadow-soft hover:shadow-lg transition-shadow`}>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-soft">
                  {(() => { const Icon = ICON_MAP[badge.iconName] || Tag; return <Icon size={18} className={badge.iconColor} />; })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{badge.title}</p>
                  <p className="text-xs text-gray-500">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {serviceBadges.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Truck,     color: 'text-blue-500',   bg: 'bg-blue-50',   title: 'Giao hàng nhanh',    desc: 'Nội thành trong ngày' },
              { icon: Shield,    color: 'text-green-500',  bg: 'bg-green-50',  title: 'Bảo hành chính hãng', desc: '12 tháng toàn quốc' },
              { icon: RotateCcw, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Đổi trả dễ dàng',    desc: '30 ngày không lý do' },
              { icon: Tag,       color: 'text-purple-500', bg: 'bg-purple-50', title: 'Trả góp 0%',         desc: 'Lên đến 24 tháng' },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className={`${bg} rounded-2xl p-3.5 flex items-center gap-3 shadow-soft hover:shadow-lg transition-shadow`}>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-soft">
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Thương hiệu ─────────────────────────── */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-soft">
          <h2 className="section-title text-base mb-4">Thương hiệu nổi bật</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {BRANDS.map((b) => (
              <Link
                key={b.slug}
                to={`/brand/${b.slug}`}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-soft group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: b.bg, color: b.text }}
                >
                  {b.initial}
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">{b.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Flash Sale ──────────────────────────── */}
        {flashSales.length > 0 && !countdown.done && (
          <section className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-soft">
            <div className="bg-zinc-950 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-blue-400 fill-blue-400" />
                <span className="font-display text-white font-bold text-base tracking-wider">FLASH SALE</span>
                <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">HOT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zinc-400 mr-1">Kết thúc sau:</span>
                <CountdownBox value={countdown.h} />
                <span className="text-zinc-500 font-bold">:</span>
                <CountdownBox value={countdown.m} />
                <span className="text-zinc-500 font-bold">:</span>
                <CountdownBox value={countdown.s} />
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {flashSales.slice(0, 4).map((sale) => (
                <Link
                  key={sale._id}
                  to={`/products/${sale.productId?.slug}`}
                  className="group border border-gray-100 dark:border-zinc-800 hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 rounded-2xl p-3 transition-all"
                >
                  <div className="relative overflow-hidden rounded-xl mb-2">
                    <img
                      src={sale.productId?.images?.[0] || 'https://placehold.co/200x200?text=?'}
                      alt={sale.productId?.name}
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                      -{discountPercent(sale.originalPrice, sale.salePrice)}%
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">{sale.productId?.name}</p>
                  <p className="text-xs text-gray-400 mb-1">{sale.variantId?.storage} · {sale.variantId?.color}</p>
                  <p className="text-sm font-bold text-blue-600">{formatPrice(sale.salePrice)}</p>
                  <p className="text-xs text-gray-400 line-through">{formatPrice(sale.originalPrice)}</p>
                  <div className="mt-2 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (sale.sold / sale.quantity) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Đã bán {sale.sold}/{sale.quantity}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Đang giảm giá ───────────────────────── */}
        {(loading || sale.length > 0) && (
          <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-soft">
            <SectionHeader icon={Tag} iconColor="text-orange-500" title="Đang giảm giá" link="/products?sort=popular" accentColor="bg-orange-500" />
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-3xl bg-gray-100 dark:bg-zinc-800 animate-pulse aspect-[3/4]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sale.slice(0, 4).map((p) => {
                  const catId = typeof p.categoryId === 'object' ? p.categoryId?._id : p.categoryId;
                  return <PhoneCard key={p._id} phone={p} categoryFlashSale={catId ? catFlashSaleMap[catId.toString()] || null : null} />;
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Sản phẩm bán chạy ───────────────────── */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-soft">
          <SectionHeader icon={Flame} iconColor="text-red-500" title="Sản phẩm bán chạy" link="/products?sort=popular" />
          <PhoneGrid phones={hot} loading={loading} catFlashSaleMap={catFlashSaleMap} />
        </section>

        {/* ── Banner quảng cáo ────────────────────── */}
        {promoBanners.length > 0 ? (
          <div className={`grid ${promoBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'} gap-4`}>
            {promoBanners.map((b) => (
              <Link key={b._id} to={b.link || '/products'}
                className="relative rounded-3xl overflow-hidden h-36 flex items-center px-6 hover:shadow-lg transition-shadow group"
                style={b.imageUrl ? {} : { background: b.bg }}>
                {b.imageUrl && <img src={b.imageUrl} alt={b.title} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />}
                {b.imageUrl && <div className="absolute inset-0 bg-black/40" />}
                <div className="z-10 relative">
                  {b.tag && <p className={`text-xs font-bold mb-1 ${b.accentBg && b.accentText ? b.accentText.replace('text-', 'text-') : 'text-amber-400'}`}>{b.tag}</p>}
                  <p className="font-display text-white text-xl font-bold">{b.title}</p>
                  {b.description && <p className="text-white/70 text-sm mt-1">{b.description}</p>}
                  {b.cta && <span className="mt-2 inline-block bg-white text-gray-900 text-xs font-bold px-3.5 py-1.5 rounded-full group-hover:shadow-glow transition-all">{b.cta} →</span>}
                </div>
                {!b.imageUrl && b.emoji && <span className="absolute right-6 text-7xl opacity-20 group-hover:opacity-30 transition-opacity select-none">{b.emoji}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <Link to="/brand/apple" className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-700 h-36 flex items-center px-6 hover:shadow-lg transition-shadow group">
              <div className="z-10"><p className="text-amber-400 text-xs font-bold mb-1">CHÍNH HÃNG VN/A</p><p className="font-display text-white text-xl font-bold">iPhone 16 Series</p><p className="text-gray-300 text-sm mt-1">Giảm đến 2 triệu</p><span className="mt-2 inline-block bg-white text-gray-900 text-xs font-bold px-3.5 py-1.5 rounded-full group-hover:shadow-glow transition-all">Mua ngay →</span></div>
              <span className="absolute right-6 text-7xl opacity-20 group-hover:opacity-30 transition-opacity select-none">🍎</span>
            </Link>
            <Link to="/brand/samsung" className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 to-blue-700 h-36 flex items-center px-6 hover:shadow-lg transition-shadow group">
              <div className="z-10"><p className="text-cyan-400 text-xs font-bold mb-1">FLAGSHIP 2024</p><p className="font-display text-white text-xl font-bold">Galaxy S24 Ultra</p><p className="text-blue-200 text-sm mt-1">Trả góp 0% — 24 tháng</p><span className="mt-2 inline-block bg-white text-blue-900 text-xs font-bold px-3.5 py-1.5 rounded-full group-hover:shadow-lg transition-all">Khám phá →</span></div>
              <span className="absolute right-6 text-7xl opacity-20 group-hover:opacity-30 transition-opacity select-none">🌌</span>
            </Link>
          </div>
        )}

        {/* ── Mới ra mắt ──────────────────────────── */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-soft">
          <SectionHeader icon={Sparkles} iconColor="text-purple-500" title="Mới ra mắt" link="/products?sort=newest" accentColor="bg-purple-500" />
          <PhoneGrid phones={newest} loading={loading} catFlashSaleMap={catFlashSaleMap} />
        </section>

        {/* ── Phụ kiện nổi bật ────────────────────── */}
        {(loading || accessories.length > 0) && (
          <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-soft">
            <SectionHeader icon={Headphones} iconColor="text-blue-500" title="Phụ kiện nổi bật" link="/accessories" accentColor="bg-blue-500" />
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-3xl bg-gray-100 dark:bg-zinc-800 animate-pulse aspect-[3/4]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {accessories.slice(0, 4).map((p) => {
                  const catId = typeof p.categoryId === 'object' ? p.categoryId?._id : p.categoryId;
                  return <PhoneCard key={p._id} phone={p} categoryFlashSale={catId ? catFlashSaleMap[catId.toString()] || null : null} />;
                })}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
