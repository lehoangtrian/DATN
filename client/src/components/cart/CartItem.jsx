import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';

export default function CartItem({ item, selected, onToggle, onUpdateQty, onRemove }) {
  return (
    <div className={`card p-4 flex gap-3 items-center transition-opacity ${!selected ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(item.variantId)}
        className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
      />

      <Link to={`/products/${item.slug}`} className="shrink-0">
        <img
          src={item.image || 'https://placehold.co/80x80?text=📱'}
          alt={item.name}
          className="w-20 h-20 object-cover rounded-xl"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link to={`/products/${item.slug}`}
          className="font-medium text-gray-800 hover:text-blue-600 line-clamp-2 text-sm">
          {item.name}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">{item.color} · {item.storage}</p>
        <p className="text-blue-600 font-semibold mt-1 text-sm">{formatPrice(item.price)}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onUpdateQty(item.variantId, item.quantity - 1)}
          className="w-8 h-8 rounded-full border border-gray-200 dark:border-zinc-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Minus size={13} />
        </button>
        <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
        <button
          onClick={() => onUpdateQty(item.variantId, item.quantity + 1)}
          className="w-8 h-8 rounded-full border border-gray-200 dark:border-zinc-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="text-right shrink-0">
        <p className="font-bold text-gray-800 text-sm">{formatPrice(item.price * item.quantity)}</p>
        <button
          onClick={() => onRemove(item.variantId)}
          className="text-gray-300 hover:text-red-500 transition-colors mt-1"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
