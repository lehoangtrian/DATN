import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { CompareProvider } from './context/CompareContext';
import BackToTop from './components/ui/BackToTop';
import ScrollToTop from './components/ui/ScrollToTop';
import CompareBar from './components/ui/CompareBar';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ProtectedRoute, { AdminRoute, PermissionRoute } from './components/ui/ProtectedRoute';
import ChatWidget from './components/chat/ChatWidget';

// Pages
import HomePage from './pages/HomePage';
import PhoneListPage from './pages/PhoneListPage';
import PhoneDetailPage from './pages/PhoneDetailPage';
import BrandPage from './pages/BrandPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import WishlistPage from './pages/WishlistPage';
import PaymentReturnPage from './pages/PaymentReturnPage';
import BankTransferPage from './pages/BankTransferPage';
import VNPayPage from './pages/VNPayPage';
import AboutPage from './pages/AboutPage';
import AccessoriesPage from './pages/AccessoriesPage';
import FAQPage from './pages/FAQPage';
import PolicyPage from './pages/PolicyPage';
import ComparePage from './pages/ComparePage';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCouponsPage from './pages/admin/AdminCouponsPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminReturnsPage from './pages/admin/AdminReturnsPage';
import AdminWalletPage from './pages/admin/AdminWalletPage';
import AdminFlashSalePage from './pages/admin/AdminFlashSalePage';
import AdminBannersPage from './pages/admin/AdminBannersPage';
import AdminChatPage from './pages/admin/AdminChatPage';

const MainLayout = ({ children }) => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
    <CompareBar />
    <ChatWidget />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <CompareProvider>
          <ErrorBoundary>
          <Routes>
            {/* Admin routes — không có Header/Footer, yêu cầu role=admin hoặc staff */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="products"    element={<PermissionRoute perm="manage_products"><AdminProductsPage /></PermissionRoute>} />
              <Route path="categories"  element={<PermissionRoute perm="manage_products"><AdminCategoriesPage /></PermissionRoute>} />
              <Route path="orders"      element={<PermissionRoute perm="manage_orders"><AdminOrdersPage /></PermissionRoute>} />
              <Route path="users"       element={<PermissionRoute perm="manage_users"><AdminUsersPage /></PermissionRoute>} />
              <Route path="coupons"     element={<PermissionRoute perm="manage_coupons"><AdminCouponsPage /></PermissionRoute>} />
              <Route path="reviews"     element={<PermissionRoute perm="manage_reviews"><AdminReviewsPage /></PermissionRoute>} />
              <Route path="returns"     element={<PermissionRoute perm="manage_returns"><AdminReturnsPage /></PermissionRoute>} />
              <Route path="wallet"      element={<AdminRoute><AdminWalletPage /></AdminRoute>} />
              <Route path="flash-sales" element={<PermissionRoute perm="manage_flash_sales"><AdminFlashSalePage /></PermissionRoute>} />
              <Route path="banners"     element={<PermissionRoute perm="manage_banners"><AdminBannersPage /></PermissionRoute>} />
              <Route path="chat"        element={<AdminRoute><AdminChatPage /></AdminRoute>} />
            </Route>

            {/* Public routes — có Header/Footer */}
            <Route path="/*" element={
              <MainLayout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<PhoneListPage />} />
                  <Route path="/products/:slug" element={<PhoneDetailPage />} />
                  <Route path="/brand/:brand" element={<BrandPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />

                  <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                  <Route path="/orders/success" element={<ProtectedRoute><OrderSuccessPage /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><OrderListPage /></ProtectedRoute>} />
                  <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
                  <Route path="/payment/result" element={<PaymentReturnPage />} />
                  <Route path="/payment/bank-transfer" element={<BankTransferPage />} />
                  <Route path="/payment/vnpay" element={<VNPayPage />} />
                  <Route path="/accessories" element={<AccessoriesPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/policy" element={<PolicyPage />} />
                </Routes>
              </MainLayout>
            } />
          </Routes>
          </ErrorBoundary>
          </CompareProvider>
        </CartProvider>
      </AuthProvider>
      <BackToTop />
      </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
