import { createContext, useContext, useState } from 'react';

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [list, setList] = useState([]); // array of { _id, name, slug, images, cheapestVariant }

  const toggle = (phone) => {
    setList((prev) => {
      const exists = prev.find((p) => p._id === phone._id);
      if (exists) return prev.filter((p) => p._id !== phone._id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, phone];
    });
  };

  const remove = (id) => setList((prev) => prev.filter((p) => p._id !== id));
  const clear   = () => setList([]);
  const has     = (id) => list.some((p) => p._id === id);
  // Đặt thẳng danh sách so sánh theo id — dùng khi deep-link từ ngoài vào (vd
  // bot chat trỏ tới /compare?ids=...) thay vì người dùng tự bấm từng sản phẩm.
  const replace = (ids) => setList(ids.slice(0, 3).map((id) => ({ _id: id })));

  return (
    <CompareContext.Provider value={{ list, toggle, remove, clear, has, replace }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
