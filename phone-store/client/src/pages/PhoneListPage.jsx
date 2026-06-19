import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, getBrands } from '../api/products';
import { getActiveCategoryFlashSales } from '../api/flashsale';
import PhoneGrid from '../components/phone/PhoneGrid';
import Pagination from '../components/ui/Pagination';
import { AlertCircle, SlidersHorizontal, X } from 'lucide-react';
import Breadcrumb from '../components/ui/Breadcrumb';
import { usePagination } from '../hooks/usePagination';

const SORTS = [
  { label: 'Mới nhất',     value: 'newest' },
  { label: 'Giá tăng dần', value: 'price_asc' },
  { label: 'Giá giảm dần', value: 'price_desc' },
  { label: 'Bán chạy',     value: 'popular' },
  { label: 'Đánh giá cao', value: 'rating' },
];

const PRICE_RANGES = [
  { label: 'Dưới 3 triệu',    min: 0,       max: 3000000 },
  { label: '3 – 7 triệu',     min: 3000000, max: 7000000 },
  { label: '7 – 15 triệu',    min: 7000000, max: 15000000 },
  { label: '15 – 25 triệu',   min: 15000000,max: 25000000 },
  { label: 'Trên 25 triệu',   min: 25000000,max: '' },
];

const LIMIT = 20;

export default function PhoneListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [phones, setPhones]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]     = useState(0);
  const [error, setError]     = useState('');
  const [brands, setBrands]   = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [catFlashSaleMap, setCatFlashSaleMap] = useState({});

  // Params từ URL
  const sort     = searchParams.get('sort') || 'newest';
  const brand    = searchParams.get('brand') || '';
  const priceKey = searchParams.get('price') || '';
  const { page, totalPages, goPage } = usePagination(total, LIMIT);

  // Tìm price range từ key
  const priceRange = PRICE_RANGES.find((_, i) => String(i) === priceKey) || null;

  // Load brands + category flash sales một lần
  useEffect(() => {
    getBrands().then((r) => setBrands(r.data.data || [])).catch(() => {});
    getActiveCategoryFlashSales().then((r) => {
      const map = {};
      (r.data.data || []).forEach((s) => {
        const catId = s.categoryId?._id || s.categoryId;
        if (catId) map[catId.toString()] = s;
      });
      setCatFlashSaleMap(map);
    }).catch(() => {});
  }, []);

  // Load products khi params thay đổi
  useEffect(() => {
    setLoading(true);
    setError('');
    const params = { sort, page, limit: LIMIT };
    if (brand) params.brand = brand;
    if (priceRange) {
      if (priceRange.min != null && priceRange.min !== '') params.minPrice = priceRange.min;
      if (priceRange.max != null && priceRange.max !== '') params.maxPrice = priceRange.max;
    }
    getProducts(params)
      .then((res) => { setPhones(res.data.data); setTotal(res.data.pagination?.total || 0); })
      .catch(() => setError('Không thể tải danh sách sản phẩm. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, [sort, page, brand, priceKey]);

  const setParam = useCallback((key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const clearFilters = () => {
    setSearchParams({ sort, page: '1' });
  };

  const hasFilter = brand || priceKey;


  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumb items={[{ label: 'Tất cả điện thoại' }]} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="section-title text-xl">
          Tất cả điện thoại
          <span className="text-gray-400 font-normal text-base ml-2">({total} sản phẩm)</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter toggle (mobile) */}
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="md:hidden flex items-center gap-1.5 text-sm border border-gray-200 dark:border-zinc-700 px-3.5 py-1.5 rounded-full text-gray-600 hover:border-blue-300"
          >
            <SlidersHorizontal size={15} /> Lọc {hasFilter && <span className="text-blue-600 font-semibold">•</span>}
          </button>
          {/* Sort buttons */}
          {SORTS.map((s) => (
            <button key={s.value}
              onClick={() => setParam('sort', s.value)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${sort === s.value ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-glow' : 'text-gray-600 border-gray-200 dark:border-zinc-700 hover:border-blue-300 hover:text-blue-600'}`}>
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
            <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
              {brands.find((b) => b.slug === brand)?.name || brand}
              <button onClick={() => setParam('brand', '')}><X size={11} /></button>
            </span>
          )}
          {priceRange && (
            <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
              {priceRange.label}
              <button onClick={() => setParam('price', '')}><X size={11} /></button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-blue-500 underline">
            Xóa tất cả
          </button>
        </div>
      )}

      <div className="flex gap-6">

        {/* Sidebar filter — desktop luôn hiện, mobile toggle */}
        <aside className={`shrink-0 w-56 space-y-6 ${showFilter ? 'block' : 'hidden'} md:block`}>

          {/* Thương hiệu */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thương hiệu</h3>
            <div className="space-y-2">
              {brands.map((b) => (
                <label key={b._id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="brand"
                    value={b.slug}
                    checked={brand === b.slug}
                    onChange={() => setParam('brand', brand === b.slug ? '' : b.slug)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className={`text-sm transition-colors ${brand === b.slug ? 'text-blue-600 font-medium' : 'text-gray-600 group-hover:text-gray-800'}`}>
                    {b.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Khoảng giá */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Khoảng giá</h3>
            <div className="space-y-2">
              {PRICE_RANGES.map((range, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="price"
                    value={String(i)}
                    checked={priceKey === String(i)}
                    onChange={() => setParam('price', priceKey === String(i) ? '' : String(i))}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className={`text-sm transition-colors ${priceKey === String(i) ? 'text-blue-600 font-medium' : 'text-gray-600 group-hover:text-gray-800'}`}>
                    {range.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {hasFilter && (
            <button onClick={clearFilters}
              className="w-full text-sm text-gray-500 border border-gray-200 dark:border-zinc-700 rounded-full py-2 hover:border-blue-300 hover:text-blue-500 transition-colors">
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
          ) : (
            <>
              <PhoneGrid phones={phones} loading={loading} catFlashSaleMap={catFlashSaleMap} />
              <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={goPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
