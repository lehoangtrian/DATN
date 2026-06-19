const { User } = require('../models/index');
const { success, error } = require('../utils/response.utils');
const fs = require('fs');
const path = require('path');

// GET /api/profile
const getProfile = async (req, res) => {
  success(res, { data: req.user });
};

// PUT /api/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, birthday } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, birthday },
      { new: true, runValidators: true }
    ).select('-password');
    success(res, { data: user }, 'Cập nhật thông tin thành công');
  } catch (err) { next(err); }
};

// PUT /api/profile/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, 'Vui lòng nhập đầy đủ thông tin', 400);
    if (newPassword.trim().length < 6) return error(res, 'Mật khẩu mới tối thiểu 6 ký tự (không tính khoảng trắng)', 400);

    const user = await User.findById(req.user._id);
    const ok = await user.matchPassword(currentPassword);
    if (!ok) return error(res, 'Mật khẩu hiện tại không đúng', 400);

    user.password = newPassword;
    await user.save();
    success(res, {}, 'Đổi mật khẩu thành công');
  } catch (err) { next(err); }
};

// POST /api/profile/addresses
const addAddress = async (req, res, next) => {
  try {
    const { label, fullName, phone, address, city, district, isDefault } = req.body;
    const user = await User.findById(req.user._id);

    if (isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    user.addresses.push({ label, fullName, phone, address, city, district, isDefault: !!isDefault });
    await user.save();
    success(res, { data: user.addresses }, 'Thêm địa chỉ thành công', 201);
  } catch (err) { next(err); }
};

// PUT /api/profile/addresses/:id
const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) return error(res, 'Không tìm thấy địa chỉ', 404);

    if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    const { label, fullName, phone, address, city, district, isDefault } = req.body;
    Object.assign(addr, { label, fullName, phone, address, city, district, isDefault: !!isDefault });
    await user.save();
    success(res, { data: user.addresses }, 'Cập nhật địa chỉ thành công');
  } catch (err) { next(err); }
};

// DELETE /api/profile/addresses/:id
const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const toDelete = user.addresses.find((a) => a._id.toString() === req.params.id);
    if (!toDelete) return error(res, 'Không tìm thấy địa chỉ', 404);
    user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.id);
    // Nếu vừa xóa địa chỉ mặc định và còn địa chỉ khác → tự động đặt địa chỉ đầu tiên làm mặc định
    if (toDelete.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    success(res, { data: user.addresses }, 'Đã xóa địa chỉ');
  } catch (err) { next(err); }
};

// PUT /api/profile/avatar
const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Không có file ảnh', 400);

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const currentUser = await User.findById(req.user._id).select('avatar');
    const oldAvatarPath = currentUser?.avatar?.startsWith('/uploads/avatars/')
      ? path.join(__dirname, '../../', currentUser.avatar)
      : null;

    // Cập nhật DB trước, sau đó mới xóa file cũ — tránh mất ảnh nếu DB update thất bại
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');

    if (oldAvatarPath) {
      try { if (fs.existsSync(oldAvatarPath)) fs.unlinkSync(oldAvatarPath); } catch (_) {}
    }

    success(res, { data: user }, 'Cập nhật ảnh đại diện thành công');
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, changePassword, addAddress, updateAddress, deleteAddress, updateAvatar };
