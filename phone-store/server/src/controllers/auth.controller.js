const { User, OTP } = require('../models/index');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.utils');
const { generateOTP, sendOTPEmail } = require('../utils/otp.utils');
const { success, error } = require('../utils/response.utils');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const buildUserPayload = (user) => ({
  _id: user._id, name: user.name, email: user.email,
  phone: user.phone, role: user.role, avatar: user.avatar,
  memberTier: user.memberTier, loyaltyPoints: user.loyaltyPoints,
});

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists && exists.isVerified) {
      return error(res, 'Email đã được sử dụng', 400);
    }

    let user = exists || new User({ name, email, password, phone });
    if (!exists) await user.save();

    // Tạo OTP verify email
    await OTP.deleteMany({ contact: email, type: 'verify_email' });
    const code = generateOTP();
    await OTP.create({
      userId: user._id,
      contact: email,
      code,
      type: 'verify_email',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 phút
    });

    await sendOTPEmail(email, code, 'verify_email');

    const devData = process.env.NODE_ENV === 'development' ? { otp: code } : {};
    return success(res, devData, 'Đăng ký thành công, kiểm tra email để xác thực OTP', 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res, next) => {
  try {
    const { email, code, type } = req.body;

    // Kiểm tra nhanh trước (attempts, expiry) để tiết kiệm DB write
    const otp = await OTP.findOne({ contact: email, type, isUsed: false });
    if (!otp) return error(res, 'OTP không tồn tại hoặc đã được sử dụng', 400);
    if (otp.expiresAt <= new Date()) return error(res, 'OTP đã hết hạn', 400);
    if (otp.attempts >= 5) return error(res, 'Quá nhiều lần nhập sai, yêu cầu OTP mới', 429);
    if (otp.code !== code) {
      await OTP.findByIdAndUpdate(otp._id, { $inc: { attempts: 1 } });
      return error(res, `OTP không đúng (còn ${4 - otp.attempts} lần)`, 400);
    }

    // Atomic: đánh dấu isUsed = true chỉ khi chưa dùng — tránh race condition 2 request cùng verify
    const claimed = await OTP.findOneAndUpdate(
      { _id: otp._id, isUsed: false },
      { isUsed: true },
      { new: false }
    );
    if (!claimed) return error(res, 'OTP không tồn tại hoặc đã được sử dụng', 400);

    if (type === 'verify_email') {
      const user = await User.findByIdAndUpdate(otp.userId, { isVerified: true }, { new: true });
      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);
      return success(res, { data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken } }, 'Xác thực thành công');
    }

    return success(res, {}, 'OTP hợp lệ');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/resend-otp
const resendOTP = async (req, res, next) => {
  try {
    const { email, type } = req.body;

    const user = await User.findOne({ email });
    if (!user) return error(res, 'Email không tồn tại', 404);

    const recentOtp = await OTP.findOne({
      contact: email, type,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }, // 1 phút
    });
    if (recentOtp) return error(res, 'Vui lòng chờ 1 phút trước khi gửi lại', 429);

    await OTP.deleteMany({ contact: email, type });
    const code = generateOTP();
    await OTP.create({ userId: user._id, contact: email, code, type, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    await sendOTPEmail(email, code, type);

    const devData = process.env.NODE_ENV === 'development' ? { otp: code } : {};
    return success(res, devData, 'OTP đã được gửi lại');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return error(res, 'Email hoặc mật khẩu không đúng', 401);
    }
    if (!user.isActive) return error(res, 'Tài khoản đã bị khóa', 403);
    if (!user.isVerified) return error(res, 'Tài khoản chưa xác thực email', 403);

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    return success(res, {
      data: {
        user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, memberTier: user.memberTier, loyaltyPoints: user.loyaltyPoints },
        accessToken,
        refreshToken,
      }
    }, 'Đăng nhập thành công');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return error(res, 'Refresh token là bắt buộc', 400);

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) return error(res, 'Token không hợp lệ', 401);

    const accessToken = generateAccessToken(user._id);
    return success(res, { data: { accessToken } }, 'Token đã được làm mới');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Luôn trả về success để tránh lộ email tồn tại
    if (!user) return success(res, {}, 'Nếu email tồn tại, OTP sẽ được gửi');

    await OTP.deleteMany({ contact: email, type: 'reset_password' });
    const code = generateOTP();
    await OTP.create({ userId: user._id, contact: email, code, type: 'reset_password', expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOTPEmail(email, code, 'reset_password');

    const devData = process.env.NODE_ENV === 'development' ? { otp: code } : {};
    return success(res, devData, 'Nếu email tồn tại, OTP sẽ được gửi');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    const otp = await OTP.findOne({ contact: email, type: 'reset_password', isUsed: false });
    if (!otp || otp.expiresAt <= new Date() || otp.code !== code) {
      return error(res, 'OTP không hợp lệ hoặc đã hết hạn', 400);
    }

    const user = await User.findById(otp.userId);
    if (!user) return error(res, 'Tài khoản không còn tồn tại', 404);

    // Đánh dấu OTP đã dùng sau khi xác nhận user hợp lệ — tránh tiêu tốn OTP oan
    const claimed = await OTP.findOneAndUpdate(
      { _id: otp._id, isUsed: false },
      { isUsed: true },
      { new: false }
    );
    if (!claimed) return error(res, 'OTP không hợp lệ hoặc đã được sử dụng', 400);

    user.password = newPassword;
    await user.save();

    return success(res, {}, 'Đặt lại mật khẩu thành công');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  success(res, { data: req.user });
};

// POST /api/auth/google
const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return error(res, 'Google credential là bắt buộc', 400);

    // Verify ID token bằng google-auth-library (chuẩn cho GoogleLogin component)
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();
    if (!email) return error(res, 'Không lấy được email từ Google', 400);

    // Find user by googleId hoặc email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (!user.isActive) return error(res, 'Tài khoản đã bị khóa', 403);
      // Liên kết googleId nếu user đăng ký local cùng email
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar && picture) user.avatar = picture;
        if (user.authProvider === 'local') user.authProvider = 'google';
        await user.save();
      }
    } else {
      user = await User.create({
        name, email, avatar: picture,
        googleId, authProvider: 'google',
        isVerified: true, isActive: true,
      });
    }

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    const jwtAccess = generateAccessToken(user._id);
    const jwtRefresh = generateRefreshToken(user._id);

    return success(res, { data: { user: buildUserPayload(user), accessToken: jwtAccess, refreshToken: jwtRefresh } }, 'Đăng nhập Google thành công');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/facebook
const facebookAuth = async (req, res, next) => {
  try {
    const { accessToken: fbToken, userId } = req.body;
    if (!fbToken || !userId) return error(res, 'Facebook accessToken và userId là bắt buộc', 400);

    // Xác thực token với Facebook debug_token endpoint
    const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${fbToken}&access_token=${encodeURIComponent(appToken)}`
    );
    const debugData = await debugRes.json();

    if (!debugData.data?.is_valid || debugData.data.user_id !== userId) {
      return error(res, 'Facebook token không hợp lệ', 401);
    }

    // Lấy thông tin user từ Graph API
    const infoRes = await fetch(
      `https://graph.facebook.com/${userId}?fields=id,name,email,picture.type(large)&access_token=${fbToken}`
    );
    const fbUser = await infoRes.json();

    if (!fbUser.email) {
      return error(res, 'Tài khoản Facebook không có email. Vui lòng cấp quyền email hoặc đăng ký thông thường.', 400);
    }

    let user = await User.findOne({ $or: [{ facebookId: userId }, { email: fbUser.email }] });

    if (user) {
      if (!user.isActive) return error(res, 'Tài khoản đã bị khóa', 403);
      if (!user.facebookId) {
        user.facebookId = userId;
        if (!user.avatar && fbUser.picture?.data?.url) user.avatar = fbUser.picture.data.url;
        if (user.authProvider === 'local') user.authProvider = 'facebook';
        await user.save();
      }
    } else {
      user = await User.create({
        name: fbUser.name, email: fbUser.email,
        avatar: fbUser.picture?.data?.url,
        facebookId: userId, authProvider: 'facebook',
        isVerified: true, isActive: true,
      });
    }

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    const fbJwtAccess = generateAccessToken(user._id);
    const fbJwtRefresh = generateRefreshToken(user._id);

    return success(res, { data: { user: buildUserPayload(user), accessToken: fbJwtAccess, refreshToken: fbJwtRefresh } }, 'Đăng nhập Facebook thành công');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, verifyOTP, resendOTP, login, refreshToken, forgotPassword, resetPassword, getMe, googleAuth, facebookAuth };
