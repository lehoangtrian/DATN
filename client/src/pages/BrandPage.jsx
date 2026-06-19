import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProductsByBrand } from '../api/products';
import PhoneGrid from '../components/phone/PhoneGrid';
import { AlertCircle } from 'lucide-react';

export default function BrandPage() {
  const { brand } = useParams();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const displayName = brand.charAt(0).toUpperCase() + brand.slice(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    getProductsByBrand(brand)
      .then((res) => { setPhones(res.data.data); setTotal(res.data.pagination?.total || 0); })
      .catch(() => setError(`Không thể tải sản phẩm ${displayName}.`))
      .finally(() => setLoading(false));
  }, [brand]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">
        Điện thoại {displayName}
        <span className="text-gray-400 font-normal text-base ml-2">({total} sản phẩm)</span>
      </h1>
      {error ? (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-3 rounded-xl">
          <AlertCircle size={18} /> {error}
        </div>
      ) : (
        <PhoneGrid phones={phones} loading={loading} />
      )}
    </div>
  );
}
