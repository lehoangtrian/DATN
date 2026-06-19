import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle size={18} className="text-green-500 shrink-0" />,
  error: <XCircle size={18} className="text-red-500 shrink-0" />,
  info: <AlertCircle size={18} className="text-blue-500 shrink-0" />,
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ message, type = 'success', image, duration = 3000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, image }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — bottom-right */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id}
            className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg rounded-2xl px-4 py-3 min-w-[260px] max-w-[320px] animate-slide-in">
            {t.image
              ? <img src={t.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              : ICONS[t.type]
            }
            <p className="text-sm text-gray-700 dark:text-gray-200 flex-1 leading-tight">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-gray-300 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
