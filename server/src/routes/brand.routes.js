const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/brand.controller');

router.get('/', ctrl.getAll);
router.get('/:slug', ctrl.getBySlug);

module.exports = router;
