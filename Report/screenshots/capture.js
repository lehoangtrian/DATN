const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:5173';
const OUT = __dirname;

async function shot(page, file, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 800);
  await page.screenshot({ path: path.join(OUT, file), fullPage: opts.fullPage ?? false });
  console.log('saved', file);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login')),
    page.locator('button[type="submit"]').filter({ hasText: 'Đăng nhập' }).click(),
  ]);
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Trang chủ
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await shot(page, '01_home.png', { fullPage: true });

  // 2. Danh sách sản phẩm
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await shot(page, '02_product_list.png', { fullPage: true });

  // 3. Chi tiết sản phẩm — lấy link sản phẩm đầu tiên từ trang list
  const firstProductHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/products/"]');
    return a ? a.getAttribute('href') : null;
  });
  if (firstProductHref) {
    await page.goto(`${BASE}${firstProductHref}`, { waitUntil: 'networkidle' });
    await shot(page, '03_product_detail.png', { fullPage: true });
  }

  // 4. Đăng nhập (form trống — chụp trước khi login)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot(page, '04_login.png');

  // Đăng nhập user thường
  await login(page, 'user@test.com', '123456');

  // 5. Giỏ hàng — thêm sản phẩm trước nếu trống
  if (firstProductHref) {
    await page.goto(`${BASE}${firstProductHref}`, { waitUntil: 'networkidle' });
    const addBtn = await page.$('button:has-text("Thêm vào giỏ")');
    if (addBtn) { await addBtn.click(); await page.waitForTimeout(1000); }
  }
  await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
  await shot(page, '05_cart.png', { fullPage: true });

  // 6. Checkout
  await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
  await shot(page, '06_checkout.png', { fullPage: true });

  // 7. Hồ sơ / điểm thưởng
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  await shot(page, '07_profile.png', { fullPage: true });

  // 8. Danh sách đơn hàng
  await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
  await shot(page, '08_orders.png', { fullPage: true });

  // 9. Chatbot widget — mở khung chat trên trang chủ (đã đăng nhập user)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  try {
    await page.click('button[aria-label="Chat hỗ trợ"]');
    await page.waitForTimeout(600);
    const input = page.locator('input[placeholder="Nhập tin nhắn..."]');
    await input.fill('Tôi muốn tìm điện thoại giá dưới 10 triệu');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(6000); // chờ bot (LLM) trả lời
  } catch (e) { console.log('chat widget error', e.message); }
  await shot(page, '09_chatbot.png', { wait: 200 });

  // Đăng xuất user, đăng nhập admin
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());

  await login(page, 'admin@test.com', '123456');

  // 10. Admin dashboard
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await shot(page, '10_admin_dashboard.png', { fullPage: true });

  // 11. Admin quản lý sản phẩm
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle' });
  await shot(page, '11_admin_products.png', { fullPage: true });

  // 12. Admin quản lý đơn hàng
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' });
  await shot(page, '12_admin_orders.png', { fullPage: true });

  await browser.close();
  console.log('DONE');
})();
