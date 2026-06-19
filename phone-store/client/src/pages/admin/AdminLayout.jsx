import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Package, ShoppingBag, Users, Tag, Star, LogOut, Phone, FolderOpen, RotateCcw, Wallet, Zap, Image, MessageSquare } from 'lucide-react';

const NAV = [
  { to: '/admin',             label: 'Dashboard',    icon: LayoutDashboard, end: true, perm: null },
  { to: '/admin/banners',     label: 'Banner',        icon: Image,           perm: 'manage_banners' },
  { to: '/admin/products',    label: 'Sản phẩm',      icon: Package,         perm: 'manage_products' },
  { to: '/admin/categories',  label: 'Danh mục',      icon: FolderOpen,      perm: 'manage_products' },
  { to: '/admin/orders',      label: 'Đơn hàng',      icon: ShoppingBag,     perm: 'manage_orders' },
  { to: '/admin/returns',     label: 'Trả hàng',      icon: RotateCcw,       perm: 'manage_returns' },
  { to: '/admin/flash-sales', label: 'Flash Sale',    icon: Zap,             perm: 'manage_flash_sales' },
  { to: '/admin/wallet',      label: 'Quản lý Ví',    icon: Wallet,          perm: null, adminOnly: true },
  { to: '/admin/users',       label: 'Người dùng',    icon: Users,           perm: 'manage_users' },
  { to: '/admin/coupons',     label: 'Mã giảm giá',   icon: Tag,             perm: 'manage_coupons' },
  { to: '/admin/reviews',     label: 'Đánh giá',      icon: Star,            perm: 'manage_reviews' },
  { to: '/admin/chat',        label: 'Chat hỗ trợ',   icon: MessageSquare,   perm: null },
];

export default function AdminLayout() {
  const { user, logout, hasPermission } = useAuth();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) return <Navigate to="/" replace />;

  const visibleNav = NAV.filter((item) => {
    if (item.adminOnly) return user.role === 'admin';
    if (!item.perm) return true;
    return hasPermission(item.perm);
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-950 text-zinc-400 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-glow">
            <Phone size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-lg tracking-tight">PhoneStore</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-glow' : 'hover:bg-zinc-800 hover:text-white'}`
              }>
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1 truncate">{user.email}</p>
          <p className="text-xs text-zinc-600 mb-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${user.role === 'admin' ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'}`}>
              {user.role.toUpperCase()}
            </span>
          </p>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
