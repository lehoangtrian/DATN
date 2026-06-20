const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:5173';
const OUT = __dirname;

async function shot(page, file, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 1000);
  await page.screenshot({ path: path.join(OUT, file), fullPage: opts.fullPage ?? false });
  console.log('saved', file);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', '123456');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login')),
    page.locator('button[type="submit"]').filter({ hasText: 'Đăng nhập' }).click(),
  ]);
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await shot(page, '10_admin_dashboard.png', { fullPage: true, wait: 1500 });

  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle' });
  await shot(page, '11_admin_products.png', { fullPage: true, wait: 1500 });

  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' });
  await shot(page, '12_admin_orders.png', { fullPage: true, wait: 1500 });

  await browser.close();
  console.log('DONE');
})();
