/**
 * Từ danh sách variants, trả về map { productId → cheapestVariant }
 * Ưu tiên variant có salePrice thấp nhất, fallback về price
 */
const getCheapestVariantMap = (variants) => {
  const map = {};
  // Nhóm variants theo productId, ưu tiên variant còn hàng
  const byProduct = {};
  variants.forEach((v) => {
    const pid = v.productId.toString();
    if (!byProduct[pid]) byProduct[pid] = [];
    byProduct[pid].push(v);
  });
  Object.entries(byProduct).forEach(([pid, list]) => {
    const inStock = list.filter((v) => v.stock > 0);
    const pool = inStock.length > 0 ? inStock : list;
    const cheapest = pool.reduce((min, v) => {
      const ep = v.salePrice || v.price;
      const minEp = min.salePrice || min.price;
      return ep < minEp ? v : min;
    }, pool[0]);
    map[pid] = cheapest;
  });
  return map;
};

/**
 * Gắn cheapestVariant vào mỗi product document
 */
const attachCheapestVariant = (products, variantMap) =>
  products.map((p) => ({ ...p, cheapestVariant: variantMap[p._id.toString()] || null }));

module.exports = { getCheapestVariantMap, attachCheapestVariant };
