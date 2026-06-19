import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'admin' && user.role !== 'staff') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function PermissionRoute({ perm, children }) {
  const { user, hasPermission } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== 'admin' && user.role !== 'staff') {
    return <Navigate to="/" replace />;
  }
  if (!hasPermission(perm)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
