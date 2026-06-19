import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, getBrands, getFeaturedProducts } from '../api/products';
import PhoneGrid from '../components/phone/PhoneGrid';
import Pagination from '../components/ui/Pagination';
import { AlertCircle, SlidersHorizontal, X } from 'lucide-react';
import Breadcrumb from '../components/ui/Breadcrumb';
import { usePagination } from '../hooks/usePagination';

const SORTS = [
  { label: 'Liên quan',    value: 'newest' },
  { label: 'Giá tăng dần', value: 'price_asc' },
  { label: 'Giá giảm dần', value: 'price_desc' },
  { label: 'Bán chạy',     value: 'popular' },
  { label: 'Đánh giá cao', value: 'rating' },
];

const PRICE_RANGES = [
  { label: 'Dưới 3 triệu',   min: 0,        max: 3000000 },
  { label: '3 – 7 triệu',    min: 3000000,  max: 7000000 },
  { label: '7 – 15 triệu',   min: 7000000,  max: 15000000 },
  { label: '15 – 25 triệu',  min: 15000000, max: 25000000 },
  { label: 'Trên 25 triệu',  min: 25000000, max: '' },
];

const LIMIT = 20;

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q        = searchParams.get('q') || '';
  const sort     = searchParams.get('sort') || 'newest';
  const brand    = searchParams.get('brand') || '';
  const priceKey = searchParams.get('price') || '';

  const [phones, setPhones]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);
  const [error, setError]         = useState('');
  const [brands, setBrands]       = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [showFilter, setShowFilter] = useState(false);

  const { page, totalPages, goPage } = usePagination(total, LIMIT);
  const priceRange = PRICE_RANGES.find((_, i) => String(i) === priceKey) || null;
  const hasFilter  = brand || priceKey;

  useEffect(() => {
    getBrands().then((r) => setBrands(r.data.data || [])).catch(() => {});
    getFeaturedProducts().then((r) => setSuggested(r.data.data?.slice(0, 4) || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setError('');
    const params = { q, sort, page, limit: LIMIT };
    if (brand) params.brand = brand;
    if (priceRange?.min != null && priceRange.min !== '') params.minPrice = priceRange.min;
    if (priceRange?.max != null && priceRange.max !== '') params.maxPrice = priceRange.max;

    getProducts(params)
      .then((res) => {
        setPhones(res.data.data);
        setTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setError('Có lỗi khi tìm kiếm. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, [q, sort, page, brand, priceKey]);

  const setParam = useCallback((key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set('q', q);
    next.set('sort', sort);
    setSearchParams(next);
  };

  if (!q) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 text-lg">Nhập từ khóa vào ô tìm kiếm để bắt đầu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumb items={[{ label: `Kết quả: "${q}"` }]} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Kết quả cho: "<span className="text-red-600">{q}</span>"
          {!loading && !error && (
            <span className="text-gray-400 font-normal text-base ml-2">({total} sản phẩm)</span>
          )}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="md:hidden flex items-center gap-1.5 text-sm border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:border-red-300"
          >
            <SlidersHorizontal size={15} /> Lọc {hasFilter && <span className="text-red-600 font-semibold">•</span>}
          </button>
          {SORTS.map((s) => (
            <button key={s.value}
              onClick={() => setParam('sort', s.value)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${sort === s.value ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-red-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active filters */}
      {hasFilter && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500">Đang lọc:</span>
          {brand && (
            <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">
              {brands.find((b) => b.slug === brand)?.name || brand}
              <button onClick={() => setParam('brand', '')}><X size={11} /></button>
            </span>
          )}
          {priceRange && (
            <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">
              {priceRange.label}
              <button onClick={() => setParam('price', '')}><X size={11} /></button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 underline">
            Xóa tất cả
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className={`shrink-0 w-52 space-y-6 ${showFilter ? 'block' : 'hidden'} md:block`}>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Thương hiệu</h3>
            <div className="space-y-2">
              {brands.map((b) => (
                <label key={b._id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="brand"
                    checked={brand === b.slug}
                    onChange={() => setParam('brand', brand === b.slug ? '' : b.slug)}
                    className="accent-red-600 w-4 h-4"
                  />
                  <span className={`text-sm transition-colors ${brand === b.slug ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-800'}`}>
                    {b.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Khoảng giá</h3>
            <div className="space-y-2">
              {PRICE_RANGES.map((range, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="price"
                    checked={priceKey === String(i)}
                    onChange={() => setParam('price', priceKey === String(i) ? '' : String(i))}
                    className="accent-red-600 w-4 h-4"
                  />
                  <span className={`text-sm transition-colors ${priceKey === String(i) ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-800'}`}>
                    {range.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {hasFilter && (
            <button onClick={clearFilters}
              className="w-full text-sm text-gray-500 border border-gray-200 dark:border-gray-600 rounded-lg py-2 hover:border-red-300 hover:text-red-500 transition-colors">
              Xóa bộ lọc
            </button>
          )}
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {error ? (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={18} /> {error}
            </div>
          ) : !loading && phones.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-base mb-1">Không tìm thấy kết quả cho "<span className="text-gray-600 dark:text-gray-300 font-medium">{q}</span>"</p>
              <p className="text-sm text-gray-400 mb-8">Hãy thử tên khác hoặc xem các sản phẩm nổi bật bên dưới</p>
              {suggested.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Có thể bạn quan tâm</p>
                  <PhoneGrid phones={suggested} loading={false} />
                </>
              )}
            </div>
          ) : (
            <>
              <PhoneGrid phones={phones} loading={loading} />
              <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={goPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
