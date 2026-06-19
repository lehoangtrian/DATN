import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Cuộn lên đầu trang"
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 hover:shadow-glow text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 animate-slide-in"
    >
      <ArrowUp size={18} />
    </button>
  );
}
