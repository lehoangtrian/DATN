import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function usePagination(total, limit = 20) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || 1);
  const totalPages = Math.ceil(total / limit);

  const goPage = useCallback((p) => {
    const safe = Math.max(1, Math.min(p, totalPages || 1));
    const next = new URLSearchParams(searchParams);
    next.set('page', String(safe));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams, totalPages]);

  return { page, totalPages, goPage };
}
