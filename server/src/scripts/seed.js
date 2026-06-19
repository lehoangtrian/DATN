require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { Brand, Category, Product, ProductVariant } = require('../models/index');

// ─── BRANDS ───────────────────────────────────────────────────────────────────
const brandsData = [
  { name: 'Apple',   slug: 'apple',   logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',  sortOrder: 1 },
  { name: 'Samsung', slug: 'samsung', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg',       sortOrder: 2 },
  { name: 'Xiaomi',  slug: 'xiaomi',  logo: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Xiaomi_logo.svg',        sortOrder: 3 },
  { name: 'OPPO',    slug: 'oppo',    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Oppo_logo.svg',          sortOrder: 4 },
  { name: 'Vivo',    slug: 'vivo',    logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Vivo_logo.png',          sortOrder: 5 },
  { name: 'Realme',  slug: 'realme',  logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Realme_logo.svg',        sortOrder: 6 },
];

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const categoriesData = [
  { name_vi: 'Điện thoại iPhone',  name_en: 'iPhone',        slug: 'iphone',       sortOrder: 1 },
  { name_vi: 'Điện thoại Samsung', name_en: 'Samsung Phone', slug: 'samsung-phone', sortOrder: 2 },
  { name_vi: 'Điện thoại Xiaomi',  name_en: 'Xiaomi Phone',  slug: 'xiaomi-phone', sortOrder: 3 },
  { name_vi: 'Điện thoại OPPO',    name_en: 'OPPO Phone',    slug: 'oppo-phone',   sortOrder: 4 },
  { name_vi: 'Điện thoại Vivo',    name_en: 'Vivo Phone',    slug: 'vivo-phone',   sortOrder: 5 },
  { name_vi: 'Điện thoại Realme',  name_en: 'Realme Phone',  slug: 'realme-phone', sortOrder: 6 },
  { name_vi: 'Điện thoại Gaming',  name_en: 'Gaming Phone',  slug: 'gaming-phone', sortOrder: 7 },
  { name_vi: 'Điện thoại Phổ Thông', name_en: 'Budget Phone', slug: 'budget-phone', sortOrder: 8 },
];

// ─── PRODUCTS + VARIANTS ──────────────────────────────────────────────────────
const buildProducts = (brandMap, catMap) => [
  // ── APPLE ──
  {
    product: {
      name: 'iPhone 15 Pro Max',
      slug: 'iphone-15-pro-max',
      brandId: brandMap['apple'],
      categoryId: catMap['iphone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-15-pro-max_1.png'],
      status: 'selling',
      badge: 'Hot',
      specs: { display: '6.7" Super Retina XDR, 120Hz', chip: 'Apple A17 Pro', ram: '8GB', battery: '4422 mAh', camera: '48MP + 12MP + 12MP', os: 'iOS 17', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6E, Bluetooth 5.3' },
      rating: 4.9, reviewCount: 2341, sold: 5200, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Titan Tự Nhiên', colorHex: '#C2B280', price: 29990000, salePrice: 27990000, stock: 15, sku: 'IP15PM-256-TN' },
      { storage: '256GB', color: 'Titan Đen',      colorHex: '#2D2D2D', price: 29990000, salePrice: 27990000, stock: 20, sku: 'IP15PM-256-TD' },
      { storage: '512GB', color: 'Titan Tự Nhiên', colorHex: '#C2B280', price: 34990000, salePrice: 32990000, stock: 10, sku: 'IP15PM-512-TN' },
      { storage: '512GB', color: 'Titan Xanh',     colorHex: '#4A6FA5', price: 34990000, salePrice: 32990000, stock: 8,  sku: 'IP15PM-512-TX' },
      { storage: '1TB',   color: 'Titan Trắng',    colorHex: '#F5F5F0', price: 39990000, salePrice: null,      stock: 5,  sku: 'IP15PM-1TB-TT' },
    ],
  },
  {
    product: {
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      brandId: brandMap['apple'],
      categoryId: catMap['iphone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-15-pro_1.png'],
      status: 'selling',
      badge: 'New',
      specs: { display: '6.1" Super Retina XDR, 120Hz', chip: 'Apple A17 Pro', ram: '8GB', battery: '3274 mAh', camera: '48MP + 12MP + 12MP', os: 'iOS 17', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6E' },
      rating: 4.8, reviewCount: 1654, sold: 3800, warrantyMonths: 12,
    },
    variants: [
      { storage: '128GB', color: 'Titan Tự Nhiên', colorHex: '#C2B280', price: 23990000, salePrice: 22490000, stock: 18, sku: 'IP15P-128-TN' },
      { storage: '128GB', color: 'Titan Đen',      colorHex: '#2D2D2D', price: 23990000, salePrice: 22490000, stock: 22, sku: 'IP15P-128-TD' },
      { storage: '256GB', color: 'Titan Xanh',     colorHex: '#4A6FA5', price: 26990000, salePrice: 25490000, stock: 12, sku: 'IP15P-256-TX' },
      { storage: '512GB', color: 'Titan Trắng',    colorHex: '#F5F5F0', price: 31990000, salePrice: null,      stock: 6,  sku: 'IP15P-512-TT' },
    ],
  },
  {
    product: {
      name: 'iPhone 15',
      slug: 'iphone-15',
      brandId: brandMap['apple'],
      categoryId: catMap['iphone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-15_1.png'],
      status: 'selling',
      badge: 'Sale',
      specs: { display: '6.1" Super Retina XDR, 60Hz', chip: 'Apple A16 Bionic', ram: '6GB', battery: '3877 mAh', camera: '48MP + 12MP', os: 'iOS 17', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6' },
      rating: 4.8, reviewCount: 1890, sold: 4100, warrantyMonths: 12,
    },
    variants: [
      { storage: '128GB', color: 'Hồng',      colorHex: '#F4A7B9', price: 19990000, salePrice: 17990000, stock: 25, sku: 'IP15-128-HG' },
      { storage: '128GB', color: 'Vàng',      colorHex: '#FFD700', price: 19990000, salePrice: 17990000, stock: 20, sku: 'IP15-128-VA' },
      { storage: '128GB', color: 'Xanh',      colorHex: '#5DADE2', price: 19990000, salePrice: 17990000, stock: 18, sku: 'IP15-128-XA' },
      { storage: '128GB', color: 'Đen',       colorHex: '#1C1C1C', price: 19990000, salePrice: 17990000, stock: 30, sku: 'IP15-128-DN' },
      { storage: '256GB', color: 'Hồng',      colorHex: '#F4A7B9', price: 22990000, salePrice: 20990000, stock: 12, sku: 'IP15-256-HG' },
      { storage: '256GB', color: 'Đen',       colorHex: '#1C1C1C', price: 22990000, salePrice: 20990000, stock: 15, sku: 'IP15-256-DN' },
    ],
  },
  {
    product: {
      name: 'iPhone 14',
      slug: 'iphone-14',
      brandId: brandMap['apple'],
      categoryId: catMap['iphone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-14_1.png'],
      status: 'selling',
      badge: 'Sale',
      specs: { display: '6.1" Super Retina XDR, 60Hz', chip: 'Apple A15 Bionic', ram: '6GB', battery: '3279 mAh', camera: '12MP + 12MP', os: 'iOS 17', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6' },
      rating: 4.7, reviewCount: 3200, sold: 7500, warrantyMonths: 12,
    },
    variants: [
      { storage: '128GB', color: 'Đen',       colorHex: '#1C1C1C', price: 16990000, salePrice: 14490000, stock: 35, sku: 'IP14-128-DN' },
      { storage: '128GB', color: 'Tím',       colorHex: '#9B59B6', price: 16990000, salePrice: 14490000, stock: 28, sku: 'IP14-128-TM' },
      { storage: '256GB', color: 'Trắng',     colorHex: '#FFFFFF', price: 19990000, salePrice: 17490000, stock: 20, sku: 'IP14-256-TR' },
    ],
  },
  // ── SAMSUNG ──
  {
    product: {
      name: 'Samsung Galaxy S24 Ultra',
      slug: 'samsung-galaxy-s24-ultra',
      brandId: brandMap['samsung'],
      categoryId: catMap['samsung-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-s24-ultra_2.png'],
      status: 'selling',
      badge: 'New',
      specs: { display: '6.8" Dynamic AMOLED 2X, 120Hz', chip: 'Snapdragon 8 Gen 3', ram: '12GB', battery: '5000 mAh', camera: '200MP + 12MP + 10MP + 50MP', os: 'Android 14 / One UI 6.1', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 7, Bluetooth 5.3' },
      rating: 4.8, reviewCount: 1567, sold: 3200, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Titan Đen',  colorHex: '#1A1A1A', price: 31990000, salePrice: 29990000, stock: 12, sku: 'S24U-256-TD' },
      { storage: '256GB', color: 'Titan Xám',  colorHex: '#808080', price: 31990000, salePrice: 29990000, stock: 10, sku: 'S24U-256-TX' },
      { storage: '512GB', color: 'Titan Vàng', colorHex: '#C5A028', price: 36990000, salePrice: 34990000, stock: 8,  sku: 'S24U-512-TV' },
      { storage: '512GB', color: 'Titan Tím',  colorHex: '#7D3C98', price: 36990000, salePrice: 34990000, stock: 6,  sku: 'S24U-512-TT' },
      { storage: '1TB',   color: 'Titan Đen',  colorHex: '#1A1A1A', price: 41990000, salePrice: null,      stock: 3,  sku: 'S24U-1TB-TD' },
    ],
  },
  {
    product: {
      name: 'Samsung Galaxy S24+',
      slug: 'samsung-galaxy-s24-plus',
      brandId: brandMap['samsung'],
      categoryId: catMap['samsung-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-s24_1.png'],
      status: 'selling',
      badge: 'Hot',
      specs: { display: '6.7" Dynamic AMOLED 2X, 120Hz', chip: 'Snapdragon 8 Gen 3', ram: '12GB', battery: '4900 mAh', camera: '50MP + 12MP + 10MP', os: 'Android 14 / One UI 6.1', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6E' },
      rating: 4.7, reviewCount: 987, sold: 2100, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Onyx Black',     colorHex: '#1A1A1A', price: 23990000, salePrice: 21990000, stock: 15, sku: 'S24P-256-OB' },
      { storage: '256GB', color: 'Marble Gray',    colorHex: '#9E9E9E', price: 23990000, salePrice: 21990000, stock: 12, sku: 'S24P-256-MG' },
      { storage: '512GB', color: 'Cobalt Violet',  colorHex: '#5C3D99', price: 27990000, salePrice: 25990000, stock: 8,  sku: 'S24P-512-CV' },
      { storage: '512GB', color: 'Amber Yellow',   colorHex: '#FFBF00', price: 27990000, salePrice: 25990000, stock: 7,  sku: 'S24P-512-AY' },
    ],
  },
  {
    product: {
      name: 'Samsung Galaxy A55',
      slug: 'samsung-galaxy-a55',
      brandId: brandMap['samsung'],
      categoryId: catMap['samsung-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-a55_1.png'],
      status: 'selling',
      badge: 'Best Seller',
      specs: { display: '6.6" Super AMOLED, 120Hz', chip: 'Exynos 1480', ram: '8GB', battery: '5000 mAh', camera: '50MP + 12MP + 5MP', os: 'Android 14 / One UI 6.1', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6' },
      rating: 4.6, reviewCount: 2100, sold: 5600, warrantyMonths: 12,
    },
    variants: [
      { storage: '128GB', color: 'Xanh dương', colorHex: '#3498DB', price: 10990000, salePrice: 9490000, stock: 30, sku: 'A55-128-XD' },
      { storage: '128GB', color: 'Vàng đồng',  colorHex: '#B8860B', price: 10990000, salePrice: 9490000, stock: 25, sku: 'A55-128-VD' },
      { storage: '256GB', color: 'Đen',         colorHex: '#1A1A1A', price: 12990000, salePrice: 11490000, stock: 20, sku: 'A55-256-DN' },
    ],
  },
  // ── XIAOMI ──
  {
    product: {
      name: 'Xiaomi 14 Ultra',
      slug: 'xiaomi-14-ultra',
      brandId: brandMap['xiaomi'],
      categoryId: catMap['xiaomi-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/x/i/xiaomi-14-ultra_1.png'],
      status: 'selling',
      badge: 'New',
      specs: { display: '6.73" LTPO AMOLED, 120Hz', chip: 'Snapdragon 8 Gen 3', ram: '16GB', battery: '5000 mAh', camera: '50MP Leica x4 + 50MP + 50MP + 50MP', os: 'Android 14 / HyperOS', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 7, Bluetooth 5.4' },
      rating: 4.7, reviewCount: 654, sold: 1200, warrantyMonths: 12,
    },
    variants: [
      { storage: '512GB', color: 'Đen',   colorHex: '#1A1A1A', price: 26990000, salePrice: 24990000, stock: 10, sku: 'X14U-512-DN' },
      { storage: '512GB', color: 'Trắng', colorHex: '#FFFFFF', price: 26990000, salePrice: 24990000, stock: 8,  sku: 'X14U-512-TR' },
      { storage: '1TB',   color: 'Đen',   colorHex: '#1A1A1A', price: 30990000, salePrice: null,      stock: 4,  sku: 'X14U-1TB-DN' },
    ],
  },
  {
    product: {
      name: 'Xiaomi Redmi Note 13 Pro+',
      slug: 'xiaomi-redmi-note-13-pro-plus',
      brandId: brandMap['xiaomi'],
      categoryId: catMap['xiaomi-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/r/e/redmi-note-13-pro-_1.png'],
      status: 'selling',
      badge: 'Best Seller',
      specs: { display: '6.67" AMOLED, 120Hz', chip: 'Dimensity 7200 Ultra', ram: '8GB', battery: '5000 mAh', camera: '200MP + 8MP + 2MP', os: 'Android 13 / MIUI 14', sim: 'Nano SIM', connectivity: '5G, Wi-Fi 6, Bluetooth 5.3' },
      rating: 4.6, reviewCount: 2100, sold: 6800, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Đen',   colorHex: '#1A1A1A', price: 8990000, salePrice: 7990000, stock: 40, sku: 'RN13P-256-DN' },
      { storage: '256GB', color: 'Trắng', colorHex: '#FFFFFF', price: 8990000, salePrice: 7990000, stock: 35, sku: 'RN13P-256-TR' },
      { storage: '256GB', color: 'Tím',   colorHex: '#9B59B6', price: 8990000, salePrice: 7990000, stock: 30, sku: 'RN13P-256-TM' },
      { storage: '256GB', color: 'Xanh',  colorHex: '#2ECC71', price: 8990000, salePrice: 7990000, stock: 25, sku: 'RN13P-256-XA' },
    ],
  },
  {
    product: {
      name: 'Xiaomi Redmi 13C',
      slug: 'xiaomi-redmi-13c',
      brandId: brandMap['xiaomi'],
      categoryId: catMap['budget-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/r/e/redmi-13c_1.png'],
      status: 'selling',
      badge: null,
      specs: { display: '6.74" IPS LCD, 90Hz', chip: 'MediaTek Helio G85', ram: '8GB', battery: '5000 mAh', camera: '50MP + 2MP + AI', os: 'Android 13 / MIUI 14', sim: 'Nano SIM', connectivity: '4G, Wi-Fi 5' },
      rating: 4.3, reviewCount: 1200, sold: 4500, warrantyMonths: 12,
    },
    variants: [
      { storage: '128GB', color: 'Đen',  colorHex: '#1A1A1A', price: 3490000, salePrice: 2990000, stock: 50, sku: 'RD13C-128-DN' },
      { storage: '128GB', color: 'Xanh', colorHex: '#2ECC71', price: 3490000, salePrice: 2990000, stock: 45, sku: 'RD13C-128-XA' },
      { storage: '256GB', color: 'Đen',  colorHex: '#1A1A1A', price: 4490000, salePrice: 3990000, stock: 30, sku: 'RD13C-256-DN' },
    ],
  },
  // ── OPPO ──
  {
    product: {
      name: 'OPPO Reno 11 Pro',
      slug: 'oppo-reno-11-pro',
      brandId: brandMap['oppo'],
      categoryId: catMap['oppo-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/o/p/oppo-reno11-pro_1.png'],
      status: 'selling',
      badge: 'Sale',
      specs: { display: '6.7" AMOLED, 120Hz', chip: 'Dimensity 8200', ram: '12GB', battery: '4600 mAh', camera: '50MP + 32MP + 13MP', os: 'Android 14 / ColorOS 14', sim: 'Nano SIM + eSIM', connectivity: '5G, Wi-Fi 6, Bluetooth 5.3' },
      rating: 4.5, reviewCount: 876, sold: 1900, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Xanh ngọc', colorHex: '#00CED1', price: 13990000, salePrice: 11990000, stock: 18, sku: 'R11P-256-XN' },
      { storage: '256GB', color: 'Đen',        colorHex: '#1A1A1A', price: 13990000, salePrice: 11990000, stock: 20, sku: 'R11P-256-DN' },
    ],
  },
  {
    product: {
      name: 'OPPO A98',
      slug: 'oppo-a98',
      brandId: brandMap['oppo'],
      categoryId: catMap['oppo-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/o/p/oppo-a98_1.png'],
      status: 'selling',
      badge: null,
      specs: { display: '6.72" FHD+ LCD, 120Hz', chip: 'Snapdragon 695', ram: '8GB', battery: '5000 mAh', camera: '64MP + 2MP + 2MP', os: 'Android 13 / ColorOS 13', sim: 'Nano SIM', connectivity: '5G, Wi-Fi 5' },
      rating: 4.3, reviewCount: 540, sold: 1200, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Xanh', colorHex: '#3498DB', price: 6990000, salePrice: 5990000, stock: 25, sku: 'A98-256-XA' },
      { storage: '256GB', color: 'Đen',  colorHex: '#1A1A1A', price: 6990000, salePrice: 5990000, stock: 22, sku: 'A98-256-DN' },
    ],
  },
  // ── VIVO ──
  {
    product: {
      name: 'Vivo V30',
      slug: 'vivo-v30',
      brandId: brandMap['vivo'],
      categoryId: catMap['vivo-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/v/i/vivo-v30_1.png'],
      status: 'selling',
      badge: 'New',
      specs: { display: '6.78" AMOLED, 120Hz', chip: 'Snapdragon 7 Gen 3', ram: '8GB', battery: '5000 mAh', camera: '50MP + 50MP + 8MP', os: 'Android 14 / Funtouch OS 14', sim: 'Nano SIM', connectivity: '5G, Wi-Fi 6, Bluetooth 5.4' },
      rating: 4.5, reviewCount: 543, sold: 980, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Xanh lá',    colorHex: '#2ECC71', price: 9990000, salePrice: 8490000, stock: 20, sku: 'VV30-256-XL' },
      { storage: '256GB', color: 'Đen',         colorHex: '#1A1A1A', price: 9990000, salePrice: 8490000, stock: 18, sku: 'VV30-256-DN' },
      { storage: '256GB', color: 'Vàng hồng',   colorHex: '#FFB6C1', price: 9990000, salePrice: 8490000, stock: 15, sku: 'VV30-256-VH' },
    ],
  },
  // ── REALME ──
  {
    product: {
      name: 'Realme 12 Pro+',
      slug: 'realme-12-pro-plus',
      brandId: brandMap['realme'],
      categoryId: catMap['realme-phone'],
      images: ['https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/r/e/realme-12-pro-plus_1.png'],
      status: 'selling',
      badge: 'New',
      specs: { display: '6.7" AMOLED, 120Hz', chip: 'Snapdragon 7s Gen 2', ram: '12GB', battery: '5000 mAh', camera: '50MP (Perisocope) + 8MP + 50MP', os: 'Android 14 / Realme UI 5.0', sim: 'Nano SIM', connectivity: '5G, Wi-Fi 6, Bluetooth 5.3' },
      rating: 4.4, reviewCount: 320, sold: 750, warrantyMonths: 12,
    },
    variants: [
      { storage: '256GB', color: 'Xanh dương', colorHex: '#3498DB', price: 10490000, salePrice: 8990000, stock: 15, sku: 'RM12P-256-XD' },
      { storage: '256GB', color: 'Vàng cát',   colorHex: '#F5DEB3', price: 10490000, salePrice: 8990000, stock: 12, sku: 'RM12P-256-VC' },
    ],
  },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected:', mongoose.connection.host);

  // Xóa data cũ
  await Promise.all([
    Brand.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    ProductVariant.deleteMany({}),
  ]);
  console.log('Đã xóa data cũ');

  // Insert brands
  const brands = await Brand.insertMany(brandsData);
  const brandMap = Object.fromEntries(brands.map((b) => [b.slug, b._id]));
  console.log(`✅ ${brands.length} brands`);

  // Insert categories
  const cats = await Category.insertMany(categoriesData);
  const catMap = Object.fromEntries(cats.map((c) => [c.slug, c._id]));
  console.log(`✅ ${cats.length} categories`);

  // Insert products + variants
  const productList = buildProducts(brandMap, catMap);
  let totalVariants = 0;

  for (const { product, variants } of productList) {
    const savedProduct = await Product.create(product);
    const variantDocs = variants.map((v) => ({ ...v, productId: savedProduct._id }));
    await ProductVariant.insertMany(variantDocs);
    totalVariants += variantDocs.length;
    console.log(`  📱 ${savedProduct.name} — ${variantDocs.length} variants`);
  }

  console.log(`\n✅ ${productList.length} products, ${totalVariants} variants`);
  console.log('Seed hoàn thành!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
