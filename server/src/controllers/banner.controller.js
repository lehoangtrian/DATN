const Banner = require('../models/Banner');
const { success, error } = require('../utils/response.utils');

const ALLOWED_BANNER_FIELDS = [
  'type', 'tag', 'title', 'description', 'cta', 'link', 'bg',
  'imageUrl', 'emoji', 'accentBg', 'accentText', 'isActive', 'order',
];
const pick = (body, fields) => {
  const data = {};
  for (const key of fields) {
    if (key in body) data[key] = body[key];
  }
  return data;
};

const getActiveBanners = async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    else filter.type = 'slide'; // default: only slide banners
    const banners = await Banner.find(filter).sort({ order: 1, createdAt: 1 });
    return success(res, { data: banners });
  } catch (err) { next(err); }
};

const adminGetBanners = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const banners = await Banner.find(filter).sort({ order: 1, createdAt: 1 });
    return success(res, { data: banners });
  } catch (err) { next(err); }
};

const adminCreateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.create(pick(req.body, ALLOWED_BANNER_FIELDS));
    return success(res, { data: banner }, 'Đã tạo banner', 201);
  } catch (err) { next(err); }
};

const adminUpdateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id, pick(req.body, ALLOWED_BANNER_FIELDS), { new: true, runValidators: true }
    );
    if (!banner) return error(res, 'Không tìm thấy banner', 404);
    return success(res, { data: banner });
  } catch (err) { next(err); }
};

const adminDeleteBanner = async (req, res, next) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    return success(res, {}, 'Đã xóa banner');
  } catch (err) { next(err); }
};

const ServiceBadge = require('../models/ServiceBadge');

const ALLOWED_SERVICE_BADGE_FIELDS = [
  'iconName', 'iconColor', 'bgColor', 'title', 'description', 'order', 'isActive',
];

const getActiveServiceBadges = async (req, res, next) => {
  try {
    const badges = await ServiceBadge.find({ isActive: true }).sort({ order: 1 });
    return success(res, { data: badges });
  } catch (err) { next(err); }
};
const adminGetServiceBadges = async (req, res, next) => {
  try {
    const badges = await ServiceBadge.find().sort({ order: 1 });
    return success(res, { data: badges });
  } catch (err) { next(err); }
};
const adminCreateServiceBadge = async (req, res, next) => {
  try {
    const badge = await ServiceBadge.create(pick(req.body, ALLOWED_SERVICE_BADGE_FIELDS));
    return success(res, { data: badge }, 'Đã tạo dịch vụ', 201);
  } catch (err) { next(err); }
};
const adminUpdateServiceBadge = async (req, res, next) => {
  try {
    const badge = await ServiceBadge.findByIdAndUpdate(
      req.params.id, pick(req.body, ALLOWED_SERVICE_BADGE_FIELDS), { new: true, runValidators: true }
    );
    if (!badge) return error(res, 'Không tìm thấy', 404);
    return success(res, { data: badge });
  } catch (err) { next(err); }
};
const adminDeleteServiceBadge = async (req, res, next) => {
  try {
    await ServiceBadge.findByIdAndDelete(req.params.id);
    return success(res, {}, 'Đã xóa');
  } catch (err) { next(err); }
};

module.exports = {
  getActiveBanners, adminGetBanners, adminCreateBanner, adminUpdateBanner, adminDeleteBanner,
  getActiveServiceBadges, adminGetServiceBadges, adminCreateServiceBadge, adminUpdateServiceBadge, adminDeleteServiceBadge,
};
