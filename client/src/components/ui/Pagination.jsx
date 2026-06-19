import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, loading, onPageChange }) {
  if (loading || totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1 === 7 ? totalPages : i + 1;
    if (page >= totalPages - 3) return i === 0 ? 1 : totalPages - 6 + i;
    const mid = [1, page - 1, page, page + 1, totalPages];
    return mid[i] ?? null;
  });

  return (
    <div className="mt-8 space-y-2">
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) => {
          if (!p) return null;
          const isDots = i > 0 && p - (pages[i - 1] ?? 0) > 1;
          return isDots ? (
            <span key={`dots-${i}`} className="w-9 text-center text-gray-400 text-sm">…</span>
          ) : (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${p === page ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-glow' : 'border border-gray-200 dark:border-zinc-700 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="text-center text-xs text-gray-400">Trang {page} / {totalPages}</p>
    </div>
  );
}
