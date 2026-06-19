import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { login, register, verifyOTP, resendOTP, forgotPassword, resetPassword, authGoogle, authFacebook } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Phone } from 'lucide-react';

const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-400';

// Screens: 'login' | 'register' | 'otp' | 'forgot' | 'reset'
export default function LoginPage() {
  const [screen, setScreen] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ code: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');

  const validatePassword = (pw) => pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);

  const { user, loginUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  if (user) return <Navigate to={redirectTo} replace />;

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(''); };
  const goTo = (s) => { setScreen(s); setError(''); setInfo(''); setForm({ name: '', email: '', password: '' }); };

  // ── OAuth shared handler ─────────────────────────────────────────────────────
  const handleOAuthSuccess = (responseData) => {
    const { user: u, accessToken, refreshToken } = responseData.data;
    loginUser({ ...u, accessToken, refreshToken });
    navigate(redirectTo, { replace: true });
  };

  // ── Google — dùng GoogleLogin component (ID token flow, không deprecated) ───
  const handleGoogleSuccess = async (credentialResponse) => {
    setOauthLoading('google');
    setError('');
    try {
      const { data } = await authGoogle(credentialResponse.credential);
      handleOAuthSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập Google thất bại');
    } finally {
      setOauthLoading('');
    }
  };

  // ── Facebook — FB JS SDK ─────────────────────────────────────────────────────
  const fbSdkReady = useRef(false);

  useEffect(() => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId || appId === 'your_facebook_app_id') return;
    if (fbSdkReady.current) return;
    fbSdkReady.current = true;
    window.fbAsyncInit = () => {
      window.FB.init({ appId, version: 'v19.0', cookie: true, xfbml: false });
    };
    if (!document.getElementById('fb-sdk')) {
      const s = document.createElement('script');
      s.id = 'fb-sdk';
      s.src = 'https://connect.facebook.net/vi_VN/sdk.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  const handleFacebookLogin = () => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId || appId === 'your_facebook_app_id') {
      setError('Facebook chưa được cấu hình. Điền VITE_FACEBOOK_APP_ID vào client/.env');
      return;
    }
    if (!window.FB) {
      setError('Facebook SDK chưa tải xong, thử lại sau giây lát');
      return;
    }
    setOauthLoading('facebook');
    setError('');
    window.FB.login((response) => {
      if (response.authResponse) {
        const { accessToken, userID } = response.authResponse;
        authFacebook(accessToken, userID)
          .then(({ data }) => handleOAuthSuccess(data))
          .catch((err) => setError(err.response?.data?.message || 'Đăng nhập Facebook thất bại'))
          .finally(() => setOauthLoading(''));
      } else {
        setOauthLoading('');
        setError('Đăng nhập Facebook bị hủy');
      }
    }, { scope: 'public_profile,email' });
  };

  // ── ĐĂNG NHẬP ────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await login({ email: form.email, password: form.password });
      const { user: u, accessToken, refreshToken } = data.data;
      loginUser({ ...u, accessToken, refreshToken });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally { setLoading(false); }
  };

  // ── ĐĂNG KÝ ──────────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await register(form);
      setPendingEmail(form.email);
      goTo('otp');
      setInfo(`Mã OTP đã được gửi tới ${form.email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally { setLoading(false); }
  };

  // ── XÁC THỰC OTP (đăng ký) ───────────────────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setError('OTP phải đúng 6 số'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await verifyOTP({ email: pendingEmail, code: otpCode, type: 'verify_email' });
      const { user: u, accessToken, refreshToken } = data.data;
      loginUser({ ...u, accessToken, refreshToken });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'OTP không hợp lệ');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setLoading(true); setError('');
    try {
      await resendOTP({ email: pendingEmail, type: 'verify_email' });
      setInfo('Đã gửi lại OTP mới');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi lại OTP');
    } finally { setLoading(false); }
  };

  // ── QUÊN MẬT KHẨU ────────────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setError('Vui lòng nhập email'); return; }
    setLoading(true); setError('');
    try {
      await forgotPassword({ email: forgotEmail });
      setPendingEmail(forgotEmail);
      goTo('reset');
      setInfo(`Mã OTP đã được gửi tới ${forgotEmail}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Email không tồn tại trong hệ thống');
    } finally { setLoading(false); }
  };

  // ── ĐẶT LẠI MẬT KHẨU ────────────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    if (resetForm.code.length !== 6) { setError('OTP phải đúng 6 số'); return; }
    if (!validatePassword(resetForm.newPassword)) { setError('Mật khẩu phải ít nhất 8 ký tự, gồm cả chữ và số'); return; }
    if (resetForm.newPassword !== resetForm.confirm) { setError('Xác nhận mật khẩu không khớp'); return; }
    setLoading(true); setError('');
    try {
      await resetPassword({ email: pendingEmail, code: resetForm.code, newPassword: resetForm.newPassword });
      showToast({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', type: 'success' });
      goTo('login');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP không hợp lệ hoặc đã hết hạn');
    } finally { setLoading(false); }
  };

  const TITLES = {
    login: 'Đăng nhập tài khoản',
    register: 'Tạo tài khoản mới',
    otp: 'Xác thực email',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt lại mật khẩu',
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-red-600 font-bold text-2xl">
            <Phone size={28} /> PhoneStore
          </Link>
          <h2 className="text-xl font-semibold text-gray-800 mt-4">{TITLES[screen]}</h2>
          {screen === 'otp' && (
            <p className="text-sm text-gray-500 mt-1">
              Nhập mã 6 số được gửi tới <span className="font-medium text-gray-700">{pendingEmail}</span>
            </p>
          )}
          {screen === 'reset' && (
            <p className="text-sm text-gray-500 mt-1">
              Nhập mã OTP đã gửi tới <span className="font-medium text-gray-700">{pendingEmail}</span>
            </p>
          )}
          {screen === 'forgot' && (
            <p className="text-sm text-gray-500 mt-1">Nhập email để nhận mã xác thực đặt lại mật khẩu</p>
          )}
        </div>

        <div className="card p-8">
          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>}
          {info  && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">{info}</p>}

          {/* ── Đăng nhập ── */}
          {screen === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Email" required value={form.email} onChange={set('email')} className={INPUT_CLS} />
              <input type="password" placeholder="Mật khẩu" required value={form.password} onChange={set('password')} className={INPUT_CLS} />
              <div className="text-right">
                <button type="button" onClick={() => goTo('forgot')}
                  className="text-xs text-red-600 hover:underline">Quên mật khẩu?</button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-2.5 font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          )}

          {/* ── Đăng ký ── */}
          {screen === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <input type="text" placeholder="Họ và tên" required value={form.name} onChange={set('name')} className={INPUT_CLS} />
              <input type="email" placeholder="Email" required value={form.email} onChange={set('email')} className={INPUT_CLS} />
              <input type="password" placeholder="Mật khẩu (ít nhất 8 ký tự, gồm cả chữ và số)" required value={form.password} onChange={set('password')} className={INPUT_CLS} />
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-2.5 font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </form>
          )}

          {/* ── OTP xác thực đăng ký ── */}
          {screen === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="Nhập mã 6 số"
                value={otpCode} onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-red-400"
              />
              <button type="submit" disabled={loading || otpCode.length !== 6}
                className="w-full btn-primary py-2.5 font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Đang xác thực...' : 'Xác thực'}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleResend} disabled={loading}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50">Gửi lại mã OTP</button>
              </div>
            </form>
          )}

          {/* ── Quên mật khẩu ── */}
          {screen === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <input type="email" placeholder="Email đã đăng ký" required
                value={forgotEmail} onChange={(e) => { setForgotEmail(e.target.value); setError(''); }}
                className={INPUT_CLS} />
              <button type="submit" disabled={loading}
                className="w-full btn-primary py-2.5 font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => goTo('login')} className="text-sm text-gray-500 hover:text-red-600">
                  ← Quay lại đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* ── Đặt lại mật khẩu ── */}
          {screen === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="Nhập mã OTP 6 số"
                value={resetForm.code}
                onChange={(e) => { setResetForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '') })); setError(''); }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-red-400"
              />
              <input type="password" placeholder="Mật khẩu mới (ít nhất 8 ký tự, gồm cả chữ và số)" required
                value={resetForm.newPassword}
                onChange={(e) => { setResetForm((f) => ({ ...f, newPassword: e.target.value })); setError(''); }}
                className={INPUT_CLS} />
              <input type="password" placeholder="Xác nhận mật khẩu mới" required
                value={resetForm.confirm}
                onChange={(e) => { setResetForm((f) => ({ ...f, confirm: e.target.value })); setError(''); }}
                className={INPUT_CLS} />
              <button type="submit" disabled={loading || resetForm.code.length !== 6}
                className="w-full btn-primary py-2.5 font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => goTo('forgot')} className="text-sm text-gray-500 hover:text-red-600">
                  ← Gửi lại mã OTP
                </button>
              </div>
            </form>
          )}

          {/* ── Link chuyển màn ── */}
          {(screen === 'login' || screen === 'register') && (
            <p className="text-center text-sm text-gray-500 mt-5">
              {screen === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <button onClick={() => goTo(screen === 'login' ? 'register' : 'login')}
                className="text-red-600 font-medium hover:underline">
                {screen === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </p>
          )}

          {/* ── Social login ── */}
          {(screen === 'login' || screen === 'register') && (
            <div className="mt-5">
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">hoặc tiếp tục với</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-3">
                {/* Google — dùng GoogleLogin component chính thức (ID token, không deprecated) */}
                <div className={oauthLoading === 'google' ? 'opacity-60 pointer-events-none' : ''}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Đăng nhập Google thất bại hoặc bị hủy')}
                    useOneTap={false}
                    shape="rectangular"
                    text="continue_with"
                    locale="vi"
                    width="368"
                  />
                </div>

                {/* Facebook — custom button */}
                <button
                  type="button"
                  onClick={handleFacebookLogin}
                  disabled={!!oauthLoading}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {oauthLoading === 'facebook' ? (
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )}
                  Tiếp tục với Facebook
                </button>
              </div>
            </div>
          )}

          {/* Tài khoản test — chỉ hiện ở môi trường development */}
          {screen === 'login' && import.meta.env.DEV && (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs text-gray-400 text-center mb-2">Tài khoản test (chỉ hiện ở dev)</p>
              <div className="grid grid-cols-2 gap-2">
                {[{ email: 'user@test.com', label: 'User test' }, { email: 'admin@test.com', label: 'Admin test' }].map((a) => (
                  <button key={a.email} type="button"
                    onClick={() => { setForm({ ...form, email: a.email, password: '123456' }); setError(''); }}
                    className="text-xs border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors">
                    {a.label}<br />{a.email}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
