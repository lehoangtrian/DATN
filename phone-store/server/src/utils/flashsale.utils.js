function computeCategorySalePrice(variantPrice, discountType, discountValue) {
  if (discountType === 'percent')
    return Math.round(variantPrice * (1 - discountValue / 100));
  return Math.max(0, variantPrice - discountValue);
}

module.exports = { computeCategorySalePrice };
