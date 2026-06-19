import { Link } from 'react-router-dom';
import { useCompare } from '../../context/CompareContext';
import { X, GitCompare } from 'lucide-react';

export default function CompareBar() {
  const { list, remove, clear } = useCompare();
  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-gray-200 dark:border-zinc-800 shadow-2xl px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
          So sánh ({list.length}/3):
        </span>

        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {list.map((phone) => (
            <div key={phone._id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full pl-1.5 pr-2.5 py-1.5 shrink-0">
              <img
                src={phone.images?.[0] || 'https://placehold.co/32x32?text=?'}
                alt={phone.name}
                className="w-7 h-7 object-cover rounded-full"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{phone.name}</span>
              <button onClick={() => remove(phone._id)} className="text-gray-300 hover:text-red-500 ml-0.5">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {list.length >= 2 && (
            <Link
              to="/compare"
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm px-4 py-2 rounded-full hover:shadow-glow transition-all font-medium"
            >
              <GitCompare size={15} />
              So sánh ngay
            </Link>
          )}
          <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 px-2 py-2">
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
