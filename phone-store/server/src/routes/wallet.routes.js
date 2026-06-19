const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wallet.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/balance', ctrl.getBalance);
router.get('/transactions', ctrl.getTransactions);

// Top-up
router.post('/topup/bank', ctrl.requestBankTopup);
router.get('/topups', ctrl.getMyTopups);

// Withdrawal
router.post('/withdraw', ctrl.requestWithdrawal);
router.get('/withdrawals', ctrl.getMyWithdrawals);

module.exports = router;
