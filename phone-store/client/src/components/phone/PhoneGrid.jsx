import PhoneCard from './PhoneCard';

function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse flex flex-col">
      <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
      <div className="p-4 flex flex-col gap-2">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="flex gap-1 mt-0.5">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 ml-1" />
        </div>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mt-1" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-full mt-1" />
      </div>
    </div>
  );
}

export default function PhoneGrid({ phones, loading, catFlashSaleMap = {} }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!phones?.length) {
    return <p className="text-center text-gray-400 dark:text-gray-500 py-16">Không tìm thấy sản phẩm nào.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {phones.map((phone) => {
        const catId = phone.categoryId?._id ?? phone.categoryId ?? null;
        const catFlashSale = catId ? catFlashSaleMap[catId.toString()] || null : null;
        return <PhoneCard key={phone._id} phone={phone} categoryFlashSale={catFlashSale} />;
      })}
    </div>
  );
}
