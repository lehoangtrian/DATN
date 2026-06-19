const OTP_LABELS = {
  verify_email:    { subject: 'Xác thực tài khoản PhoneStore', action: 'xác thực tài khoản' },
  reset_password:  { subject: 'Đặt lại mật khẩu PhoneStore',  action: 'đặt lại mật khẩu'  },
  login:           { subject: 'Mã đăng nhập PhoneStore',       action: 'đăng nhập'          },
};

const otpEmail = (code, type) => {
  const { subject, action } = OTP_LABELS[type] || OTP_LABELS.verify_email;
  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#E53E3E;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
              📱 PhoneStore
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;font-weight:700;">
              Mã xác thực của bạn
            </h2>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
              Sử dụng mã bên dưới để ${action}. Mã có hiệu lực trong <strong>5 phút</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background:#FFF5F5;border:2px dashed #E53E3E;border-radius:12px;
                        padding:24px;text-align:center;margin-bottom:28px;">
              <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#E53E3E;
                           font-family:monospace;">
                ${code}
              </span>
            </div>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">
              ⚠️ Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên PhoneStore.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;">
              Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              © 2024 PhoneStore · Hotline: 1800 1234 · support@phonestore.vn
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  };
};

const birthdayEmail = (name, couponCode, expiryDate) => {
  const expiry = new Date(expiryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return {
    subject: '🎂 Chúc mừng sinh nhật từ PhoneStore!',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#E53E3E,#c53030);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:48px;line-height:1;">🎂</p>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
              Chúc mừng sinh nhật!
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">PhoneStore gửi đến bạn một món quà đặc biệt</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;color:#1a1a1a;font-size:16px;line-height:1.6;">
              Xin chào <strong>${name}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
              Nhân dịp sinh nhật của bạn, PhoneStore xin gửi tặng một mã giảm giá đặc biệt
              dành riêng cho bạn. Chúc bạn một ngày sinh nhật thật vui vẻ và hạnh phúc! 🎉
            </p>

            <!-- Coupon Box -->
            <div style="background:#FFF5F5;border:2px dashed #E53E3E;border-radius:12px;
                        padding:28px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Mã quà tặng của bạn</p>
              <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#E53E3E;font-family:monospace;">
                ${couponCode}
              </span>
              <div style="margin-top:16px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
                <span style="background:#E53E3E;color:#fff;font-size:13px;font-weight:600;padding:4px 12px;border-radius:999px;">Giảm 10%</span>
                <span style="background:#f3f4f6;color:#374151;font-size:13px;padding:4px 12px;border-radius:999px;">Tối đa 200.000đ</span>
                <span style="background:#f3f4f6;color:#374151;font-size:13px;padding:4px 12px;border-radius:999px;">Đơn từ 1.000.000đ</span>
              </div>
            </div>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center;">
              ⏳ Hiệu lực đến hết ngày <strong style="color:#374151;">${expiry}</strong>
            </p>

            <div style="text-align:center;margin:28px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/products"
                style="display:inline-block;background:#E53E3E;color:#ffffff;font-weight:700;
                       font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                Mua sắm ngay →
              </a>
            </div>

            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Mã giảm giá chỉ dùng được một lần và không áp dụng cùng các khuyến mãi khác.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              © 2024 PhoneStore · Hotline: 1800 1234 · support@phonestore.vn
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  };
};

module.exports = { otpEmail, birthdayEmail };
