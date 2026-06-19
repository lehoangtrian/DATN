const { Brand } = require('../models/index');
const { success, error } = require('../utils/response.utils');

const getAll = async (req, res, next) => {
  try {
    const brands = await Brand.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    return success(res, { data: brands });
  } catch (err) {
    next(err);
  }
};

const getBySlug = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ slug: req.params.slug, isActive: true });
    if (!brand) return error(res, 'Không tìm thấy thương hiệu', 404);
    return success(res, { data: brand });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getBySlug };
