const { Category } = require('../models/index');
const { success, error } = require('../utils/response.utils');

const getAll = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name_vi: 1 })
      .lean();
    return success(res, { data: categories });
  } catch (err) {
    next(err);
  }
};

const getBySlug = async (req, res, next) => {
  try {
    const cat = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!cat) return error(res, 'Không tìm thấy danh mục', 404);
    return success(res, { data: cat });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getBySlug };
