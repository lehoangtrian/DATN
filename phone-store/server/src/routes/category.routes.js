const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/category.controller');

router.get('/', ctrl.getAll);
router.get('/:slug', ctrl.getBySlug);

module.exports = router;
