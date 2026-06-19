const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
  }
  next();
};

const requirePermission = (perm) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'staff' && req.user.permissions?.includes(perm)) return next();
  return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
};

module.exports = { requireRole, requirePermission };
