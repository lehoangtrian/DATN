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

  return (
    <CompareContext.Provider value={{ list, toggle, remove, clear, has }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
