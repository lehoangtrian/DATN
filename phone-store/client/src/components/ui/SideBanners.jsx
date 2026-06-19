import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Zap, Sparkles } from 'lucide-react';

const ADS = [
  {
    side: 'left',
    to: '/products?sort=popular',
    icon: Zap,
    tag: 'Flash Sale',
    title: 'Giảm đến 50%',
    desc: 'Hàng nghìn deal hot mỗi ngày',
    cta: 'Mua ngay',
    className: 'bg-gradient-to-br from-blue-600 to-cyan-500',
  },
  {
    side: 'right',
    to: '/products?sort=newest',
    icon: Sparkles,
    tag: 'Mới về',
    title: 'Hàng mới mỗi ngày',
    desc: 'Cập nhật model mới nhất',
    cta: 'Khám phá',
    className: 'bg-gradient-to-br from-zinc-900 to-zinc-700',
  },
];

export default function SideBanners() {
  const [dismissed, setDismissed] = useState({});

  return (
    <>
      {ADS.filter((ad) => !dismissed[ad.side]).map((ad) => (
        <div
          key={ad.side}
          className={`hidden min-[1300px]:flex fixed top-36 bottom-6 z-10 w-64 flex-col justify-between gap-4 p-7 rounded-3xl text-white shadow-lg animate-fade-up ${ad.className} ${ad.side === 'left' ? 'left-5' : 'right-5'}`}
        >
          <button
            onClick={() => setDismissed((d) => ({ ...d, [ad.side]: true }))}
            aria-label="Đóng quảng cáo"
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          <ad.icon size={28} className="text-white/90" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70 mb-2">{ad.tag}</p>
            <p className="font-display font-bold text-2xl leading-snug">{ad.title}</p>
            <p className="text-sm text-white/70 mt-2">{ad.desc}</p>
          </div>
          <Link
            to={ad.to}
            className="mt-1 bg-white text-gray-900 text-sm font-bold px-4 py-2.5 rounded-full text-center hover:shadow-glow transition-all"
          >
            {ad.cta} →
          </Link>
        </div>
      ))}
    </>
  );
}
