const express = require('express');
const router = express.Router();
const { getActiveBanners, getActiveServiceBadges } = require('../controllers/banner.controller');
router.get('/', getActiveBanners);
router.get('/service-badges', getActiveServiceBadges);
module.exports = router;
