import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, Phone, Package, LogOut, ChevronDown, Heart, LayoutDashboard, UserCircle, Bell, MapPin, Headset, Sun, Moon } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { searchProducts } from '../../api/products';
import { getUnreadCount, getNotifications, markRead, markAllRead } from '../../api/notifications';
import { formatPrice } from '../../utils/formatPrice';
import { useDebounce } from '../../hooks/useDebounce';
import { useSocket } from '../../hooks/useSocket';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Realme'];
const TYPE_ICONS = { order: '📦', system: '🔔', promotion: '🎉', return: '↩️', flash_sale: '⚡' };

export default function Header() {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUnread = useCallback(() => {
    if (!user) return;
    getUnreadCount().then((r) => setUnread(r.data.data?.count || 0)).catch(() => {});
  }, [user]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  useSocket(user?._id, ({ unreadCount, notification }) => {
    setUnread(unreadCount);
    setNotifList((prev) => [notification, ...prev].slice(0, 10));
  });

  const openNotifs = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) {
      getNotifications({ limit: 10 }).then((r) => setNotifList(r.data.data || [])).catch(() => {});
    }
  };

  const handleMarkRead = async (id, link) => {
    await markRead(id).catch(() => {});
    setNotifList((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    setUnread((c) => Math.max(0, c - 1));
    if (link) { setNotifOpen(false); navigate(link); }
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setNotifList((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestLoading(true);
    searchProducts(debouncedQuery.trim(), 6)
      .then((res) => { setSuggestions(res.data.data || []); setShowSuggestions(true); })
      .catch(() => {})
      .finally(() => setSuggestLoading(false));
  }, [debouncedQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (phone) => {
    setShowSuggestions(false);
    setQuery('');
    navigate(`/products/${phone.slug}`);
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Top info bar */}
      <div className="bg-zinc-950 text-zinc-300 text-xs py-1.5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="tel:18006789" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
              <Headset size={12} />
              <span>Hotline: <strong className="text-white">1800 6789</strong> (Miễn phí)</span>
            </a>
            <Link to="/about" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
              <MapPin size={12} />
              <span>Hệ thống cửa hàng</span>
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-4 text-zinc-500">
            <span>Giao hàng toàn quốc</span>
            <span>•</span>
            <span>Bảo hành chính hãng</span>
            <span>•</span>
            <span>Trả góp 0%</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="glass border-b border-gray-100 dark:border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-glow">
                <Phone size={18} className="text-white" />
              </div>
              <span className="font-display font-bold text-xl text-gray-900 dark:text-white hidden sm:block">PhoneStore</span>
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl" ref={searchRef}>
              <div className="relative flex">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowSuggestions(false)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Tìm kiếm điện thoại, phụ kiện..."
                  className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 rounded-l-full py-2.5 pl-5 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-br from-blue-600 to-cyan-500 hover:shadow-glow text-white px-5 rounded-r-full flex items-center justify-center transition-all shrink-0"
                >
                  {suggestLoading ? (
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                </button>

                {/* Autocomplete dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50 animate-scale-in">
                    {suggestions.map((phone) => {
                      const variant = phone.cheapestVariant || phone.variants?.[0];
                      const price = variant?.salePrice || variant?.price;
                      return (
                        <button
                          key={phone._id}
                          type="button"
                          onClick={() => handleSuggestionClick(phone)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors text-left"
                        >
                          <img
                            src={phone.images?.[0] || 'https://placehold.co/40x40?text=?'}
                            alt={phone.name}
                            className="w-10 h-10 object-cover rounded-xl shrink-0 bg-gray-50"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-100 font-medium truncate">{phone.name}</p>
                            <p className="text-xs text-blue-600 font-semibold">{price ? formatPrice(price) : 'Liên hệ'}</p>
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 dark:border-zinc-800 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 font-medium"
                    >
                      <Search size={14} />
                      Xem tất cả kết quả cho "{query}"
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Hotline (desktop) */}
              <a href="tel:18006789" className="hidden lg:flex items-center gap-2 px-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 transition-colors">
                <div className="w-8 h-8 bg-blue-50 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                  <Phone size={15} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 leading-tight">Gọi mua hàng</div>
                  <div className="text-sm font-bold leading-tight">1800 6789</div>
                </div>
              </a>

              {/* Dark / Light mode toggle */}
              <button
                onClick={toggle}
                aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors"
              >
                {isDark ? <Sun size={19} /> : <Moon size={19} />}
              </button>

              {/* Notifications */}
              {user && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={openNotifs}
                    aria-label="Thông báo"
                    className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors"
                  >
                    <Bell size={20} />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 top-11 w-80 glass rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 z-50 overflow-hidden animate-scale-in">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Thông báo</span>
                        {unread > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                            Đọc tất cả
                          </button>
                        )}
                      </div>
                      {notifList.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-8">Chưa có thông báo</p>
                      ) : (
                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800">
                          {notifList.map((n) => (
                            <button
                              key={n._id}
                              onClick={() => handleMarkRead(n._id, n.link)}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${!n.isRead ? 'bg-blue-50/40 dark:bg-zinc-800/40' : ''}`}
                            >
                              <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${n.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{n.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.content}</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {new Date(n.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </p>
                              </div>
                              {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* User */}
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-blue-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                        {user.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="hidden sm:block text-left">
                      <div className="text-[10px] text-gray-400 leading-tight">Tài khoản</div>
                      <div className="text-xs font-semibold leading-tight max-w-[80px] truncate">{user.name}</div>
                    </div>
                    <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-11 w-48 glass rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 py-1 z-50 animate-scale-in">
                      <Link to="/profile" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600">
                        <UserCircle size={15} /> Tài khoản
                      </Link>
                      <Link to="/orders" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600">
                        <Package size={15} /> Đơn hàng của tôi
                      </Link>
                      <Link to="/wishlist" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600">
                        <Heart size={15} /> Yêu thích
                      </Link>
                      {user?.role === 'admin' && (
                        <>
                          <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                          <Link to="/admin" onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 font-medium">
                            <LayoutDashboard size={15} /> Admin Dashboard
                          </Link>
                        </>
                      )}
                      <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
                      <button onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600 w-full text-left">
                        <LogOut size={15} /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 hover:text-blue-600 transition-colors">
                  <div className="w-9 h-9 flex flex-col items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-zinc-800">
                    <User size={18} />
                    <span className="text-[10px] hidden sm:block">Đăng nhập</span>
                  </div>
                </Link>
              )}

              {/* Cart */}
              <Link to="/cart" className="relative flex flex-col items-center px-2 py-1 rounded-full text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors">
                <div className="relative">
                  <ShoppingCart size={22} />
                  {itemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] hidden sm:block">Giỏ hàng</span>
              </Link>
            </div>
          </div>

          {/* Nav bar */}
          <nav className="hidden md:flex items-center gap-1 pb-2.5">
            {BRANDS.map((brand) => (
              <Link
                key={brand}
                to={`/brand/${brand.toLowerCase()}`}
                className="px-3.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-full transition-colors font-medium"
              >
                {brand}
              </Link>
            ))}
            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
            <Link to="/products" className="px-3.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-full transition-colors font-medium">
              Tất cả sản phẩm
            </Link>
            <Link to="/accessories" className="px-3.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-full transition-colors font-medium">
              Phụ kiện
            </Link>
            <Link to="/compare" className="px-3.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-full transition-colors font-medium">
              So sánh
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
