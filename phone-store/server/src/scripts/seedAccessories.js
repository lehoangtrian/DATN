require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { Brand, Category, Product, ProductVariant } = require('../models/index');

const ACC_BRANDS = [
  { name: 'Anker',   slug: 'anker',   logo: '', sortOrder: 10, type: 'accessory' },
  { name: 'Baseus',  slug: 'baseus',  logo: '', sortOrder: 11, type: 'accessory' },
  { name: 'Spigen',  slug: 'spigen',  logo: '', sortOrder: 12, type: 'accessory' },
];

const ACC_CATEGORIES = [
  { name_vi: 'Tai nghe',          name_en: 'Headphones',       slug: 'tai-nghe',       sortOrder: 20, type: 'accessory' },
  { name_vi: 'Sạc nhanh',         name_en: 'Fast Charger',     slug: 'sac-nhanh',      sortOrder: 21, type: 'accessory' },
  { name_vi: 'Sạc không dây',     name_en: 'Wireless Charger', slug: 'sac-khong-day',  sortOrder: 22, type: 'accessory' },
  { name_vi: 'Ốp lưng',           name_en: 'Phone Case',       slug: 'op-lung',        sortOrder: 23, type: 'accessory' },
  { name_vi: 'Cáp sạc',           name_en: 'Charging Cable',   slug: 'cap-sac',        sortOrder: 24, type: 'accessory' },
];

const IMG = {
  airpods:   'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=400&hei=400&fmt=jpeg',
  baseus_h:  'https://placehold.co/400x400/1a1a2e/ffffff?text=Baseus+H40',
  anker_h:   'https://placehold.co/400x400/333/ffffff?text=Anker+Q20i',
  anker_65:  'https://placehold.co/400x400/e53e3e/ffffff?text=Anker+65W',
  apple_20:  'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MHJA3?wid=400&hei=400&fmt=jpeg',
  anker_wl:  'https://placehold.co/400x400/2d3748/ffffff?text=Anker+15W',
  magsafe:   'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MHXH3?wid=400&hei=400&fmt=jpeg',
  spigen_uh: 'https://placehold.co/400x400/4a5568/ffffff?text=Spigen+Case',
  apple_case:'https://placehold.co/400x400/718096/ffffff?text=Apple+Case',
  anker_cab: 'https://placehold.co/400x400/2d3748/ffffff?text=Anker+Cable',
  baseus_cab:'https://placehold.co/400x400/c53030/ffffff?text=Baseus+Cable',
};

const buildAccessories = (brandMap, catMap) => [
  // ── TAI NGHE ──────────────────────────────────────────────────────
  {
    product: {
      name: 'Apple AirPods Pro 2',
      slug: 'apple-airpods-pro-2',
      brandId: brandMap['apple'],
      categoryId: catMap['tai-nghe'],
      images: [IMG.airpods],
      status: 'selling', badge: 'Hot',
      specs: {
        chip: 'Apple H2',
        battery: 'ANC 6h, Case 30h',
        connectivity: 'Bluetooth 5.3, MagSafe, Lightning / USB-C',
        display: 'Chống nước IPX4',
      },
      rating: 4.9, reviewCount: 1240, sold: 3200, warrantyMonths: 12,
    },
    variants: [
      { color: 'Trắng', colorHex: '#FFFFFF', price: 6490000, salePrice: 5990000, stock: 30, sku: 'APP2-WHITE' },
    ],
  },
  {
    product: {
      name: 'Baseus Bowie H40 ANC',
      slug: 'baseus-bowie-h40-anc',
      brandId: brandMap['baseus'],
      categoryId: catMap['tai-nghe'],
      images: [IMG.baseus_h],
      status: 'selling', badge: 'Sale',
      specs: {
        chip: 'Driver 40mm',
        battery: '70 giờ nghe nhạc',
        connectivity: 'Bluetooth 5.2, USB-C sạc',
        display: 'Chống ồn ANC chủ động',
      },
      rating: 4.6, reviewCount: 530, sold: 1200, warrantyMonths: 12,
    },
    variants: [
      { color: 'Đen', colorHex: '#1a1a1a', price: 790000, salePrice: 650000, stock: 50, sku: 'BSH40-BLK' },
      { color: 'Trắng', colorHex: '#f5f5f5', price: 790000, salePrice: 650000, stock: 40, sku: 'BSH40-WHT' },
    ],
  },
  {
    product: {
      name: 'Anker Soundcore Q20i',
      slug: 'anker-soundcore-q20i',
      brandId: brandMap['anker'],
      categoryId: catMap['tai-nghe'],
      images: [IMG.anker_h],
      status: 'selling', badge: 'Best Seller',
      specs: {
        chip: 'Driver 40mm',
        battery: '60 giờ nghe nhạc',
        connectivity: 'Bluetooth 5.0, AUX 3.5mm',
        display: 'Chống ồn ANC hybrid',
      },
      rating: 4.5, reviewCount: 890, sold: 2100, warrantyMonths: 18,
    },
    variants: [
      { color: 'Đen', colorHex: '#2d2d2d', price: 690000, salePrice: 590000, stock: 60, sku: 'AKQ20I-BLK' },
      { color: 'Xanh Navy', colorHex: '#1B2A4A', price: 690000, salePrice: 590000, stock: 35, sku: 'AKQ20I-NVY' },
    ],
  },
  // ── SẠC NHANH ─────────────────────────────────────────────────────
  {
    product: {
      name: 'Anker 65W GaN II Sạc Nhanh',
      slug: 'anker-65w-gan-ii-sac-nhanh',
      brandId: brandMap['anker'],
      categoryId: catMap['sac-nhanh'],
      images: [IMG.anker_65],
      status: 'selling', badge: 'Hot',
      specs: {
        display: 'Công suất 65W GaN II',
        chip: 'PPS, PD 3.0, QC 4+',
        connectivity: 'USB-C x2, USB-A x1',
        battery: '3 thiết bị cùng lúc',
      },
      rating: 4.8, reviewCount: 760, sold: 1850, warrantyMonths: 18,
    },
    variants: [
      { color: 'Đen', colorHex: '#2d2d2d', price: 890000, salePrice: 750000, stock: 45, sku: 'AK65W-BLK' },
      { color: 'Trắng', colorHex: '#f5f5f5', price: 890000, salePrice: 750000, stock: 30, sku: 'AK65W-WHT' },
    ],
  },
  {
    product: {
      name: 'Apple USB-C 20W MagSafe',
      slug: 'apple-usbc-20w-magsafe',
      brandId: brandMap['apple'],
      categoryId: catMap['sac-nhanh'],
      images: [IMG.apple_20],
      status: 'selling', badge: 'New',
      specs: {
        display: 'Công suất 20W',
        chip: 'USB Power Delivery 2.0',
        connectivity: 'USB-C',
        battery: 'Tương thích iPhone 8 trở lên',
      },
      rating: 4.7, reviewCount: 2100, sold: 4500, warrantyMonths: 12,
    },
    variants: [
      { color: 'Trắng', colorHex: '#FFFFFF', price: 490000, salePrice: null, stock: 80, sku: 'APL20W-WHT' },
    ],
  },
  // ── SẠC KHÔNG DÂY ─────────────────────────────────────────────────
  {
    product: {
      name: 'Anker 15W Wireless Pad',
      slug: 'anker-15w-wireless-pad',
      brandId: brandMap['anker'],
      categoryId: catMap['sac-khong-day'],
      images: [IMG.anker_wl],
      status: 'selling', badge: 'Sale',
      specs: {
        display: 'Sạc không dây 15W Qi',
        chip: 'Qi, Fast Charge',
        connectivity: 'USB-C Input',
        battery: 'Tương thích iPhone, Samsung, Xiaomi',
      },
      rating: 4.6, reviewCount: 420, sold: 980, warrantyMonths: 18,
    },
    variants: [
      { color: 'Đen', colorHex: '#1a1a1a', price: 490000, salePrice: 390000, stock: 55, sku: 'AK15WP-BLK' },
    ],
  },
  {
    product: {
      name: 'Apple MagSafe Charger 15W',
      slug: 'apple-magsafe-charger-15w',
      brandId: brandMap['apple'],
      categoryId: catMap['sac-khong-day'],
      images: [IMG.magsafe],
      status: 'selling', badge: 'Hot',
      specs: {
        display: 'Sạc MagSafe 15W',
        chip: 'MagSafe, Qi 7.5W',
        connectivity: 'USB-C, 1m',
        battery: 'Chỉ dành cho iPhone 12 trở lên',
      },
      rating: 4.8, reviewCount: 1560, sold: 3100, warrantyMonths: 12,
    },
    variants: [
      { color: 'Trắng', colorHex: '#FFFFFF', price: 1090000, salePrice: 950000, stock: 40, sku: 'APLMGS-WHT' },
    ],
  },
  // ── ỐP LƯNG ───────────────────────────────────────────────────────
  {
    product: {
      name: 'Spigen Ultra Hybrid iPhone 15',
      slug: 'spigen-ultra-hybrid-iphone-15',
      brandId: brandMap['spigen'],
      categoryId: catMap['op-lung'],
      images: [IMG.spigen_uh],
      status: 'selling', badge: 'Best Seller',
      specs: {
        display: 'Polycarbonate + TPU',
        chip: 'Chống sốc Military Grade',
        connectivity: 'iPhone 15 / 15 Pro / 15 Pro Max',
        battery: 'Hỗ trợ MagSafe',
      },
      rating: 4.8, reviewCount: 3400, sold: 8200, warrantyMonths: 6,
    },
    variants: [
      { color: 'Trong suốt', colorHex: '#transparent', price: 390000, salePrice: 320000, stock: 100, sku: 'SPG-UH-IP15-CLR' },
      { color: 'Đen Mờ',     colorHex: '#2d2d2d',       price: 390000, salePrice: 320000, stock: 80,  sku: 'SPG-UH-IP15-BLK' },
    ],
  },
  {
    product: {
      name: 'Apple Clear Case iPhone 15 Pro',
      slug: 'apple-clear-case-iphone-15-pro',
      brandId: brandMap['apple'],
      categoryId: catMap['op-lung'],
      images: [IMG.apple_case],
      status: 'selling', badge: 'New',
      specs: {
        display: 'Silicone cao cấp',
        chip: 'Chống vàng ố, chống xước',
        connectivity: 'iPhone 15 Pro',
        battery: 'Hỗ trợ MagSafe & sạc không dây',
      },
      rating: 4.5, reviewCount: 890, sold: 2100, warrantyMonths: 6,
    },
    variants: [
      { color: 'Trong suốt', colorHex: '#f0f0f0', price: 1290000, salePrice: null, stock: 60, sku: 'APL-CC-IP15PRO' },
    ],
  },
  // ── CÁP SẠC ───────────────────────────────────────────────────────
  {
    product: {
      name: 'Anker USB-C to USB-C 100W',
      slug: 'anker-usbc-usbc-100w',
      brandId: brandMap['anker'],
      categoryId: catMap['cap-sac'],
      images: [IMG.anker_cab],
      status: 'selling', badge: 'Hot',
      specs: {
        display: '100W USB-C to USB-C',
        chip: 'USB 2.0, PD 3.0, QC',
        connectivity: 'Dài 1.8m, bọc nylon chống rối',
        battery: 'Tương thích laptop, điện thoại, tablet',
      },
      rating: 4.7, reviewCount: 1200, sold: 3600, warrantyMonths: 18,
    },
    variants: [
      { color: 'Đen', colorHex: '#1a1a1a', price: 290000, salePrice: 240000, stock: 120, sku: 'AK100W-18-BLK' },
      { color: 'Trắng', colorHex: '#f5f5f5', price: 290000, salePrice: 240000, stock: 80, sku: 'AK100W-18-WHT' },
    ],
  },
  {
    product: {
      name: 'Baseus Superior USB-C Lightning 20W',
      slug: 'baseus-usbc-lightning-20w',
      brandId: brandMap['baseus'],
      categoryId: catMap['cap-sac'],
      images: [IMG.baseus_cab],
      status: 'selling', badge: 'Sale',
      specs: {
        display: '20W USB-C to Lightning',
        chip: 'PD 3.0, fast charge',
        connectivity: 'Dài 1m, bọc nylon',
        battery: 'Dành cho iPhone, iPad',
      },
      rating: 4.5, reviewCount: 680, sold: 2200, warrantyMonths: 12,
    },
    variants: [
      { color: 'Đỏ', colorHex: '#E53E3E', price: 190000, salePrice: 149000, stock: 150, sku: 'BS-UCL20-RED' },
      { color: 'Đen', colorHex: '#1a1a1a', price: 190000, salePrice: 149000, stock: 100, sku: 'BS-UCL20-BLK' },
    ],
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Upsert brands
  for (const b of ACC_BRANDS) {
    await Brand.findOneAndUpdate({ slug: b.slug }, b, { upsert: true, new: true });
  }
  console.log(`✅ Upserted ${ACC_BRANDS.length} accessory brands`);

  // Upsert categories
  for (const c of ACC_CATEGORIES) {
    await Category.findOneAndUpdate({ slug: c.slug }, c, { upsert: true, new: true });
  }
  console.log(`✅ Upserted ${ACC_CATEGORIES.length} accessory categories`);

  // Build maps
  const brands = await Brand.find({}).lean();
  const cats   = await Category.find({}).lean();
  const brandMap = Object.fromEntries(brands.map((b) => [b.slug, b._id]));
  const catMap   = Object.fromEntries(cats.map((c) => [c.slug, c._id]));

  // Seed products + variants
  const accessories = buildAccessories(brandMap, catMap);
  let created = 0;

  for (const { product, variants } of accessories) {
    const existing = await Product.findOne({ slug: product.slug });
    if (existing) { console.log(`  skip (exists): ${product.name}`); continue; }

    const newProduct = await Product.create(product);
    const variantDocs = variants.map((v) => ({ ...v, productId: newProduct._id }));
    await ProductVariant.insertMany(variantDocs);
    console.log(`  + ${newProduct.name} (${variantDocs.length} variants)`);
    created++;
  }

  console.log(`\n✅ Done! Created ${created} accessory products.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
