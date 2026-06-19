import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
      <Link to="/" className="flex items-center gap-1 hover:text-red-600 transition-colors shrink-0">
        <Home size={14} /> Trang chủ
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 shrink-0">
          <ChevronRight size={13} className="text-gray-300 dark:text-gray-600" />
          {item.href ? (
            <Link to={item.href} className="hover:text-red-600 transition-colors">{item.label}</Link>
          ) : (
            <span className="text-gray-800 dark:text-gray-200 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
