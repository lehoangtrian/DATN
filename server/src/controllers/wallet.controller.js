const { User, WalletTransaction, TopupRequest, WithdrawalRequest } = require('../models/index');
const { success, error, paginate } = require('../utils/response.utils');

const BANK_ID      = process.env.BANK_ID      || 'MB';
const BANK_ACCOUNT = process.env.BANK_ACCOUNT || '0123456789';
const BANK_HOLDER  = process.env.BANK_HOLDER  || 'PHONE STORE';

const buildQrUrl = (amount, ref) => {
  const base = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.png`;
  return `${base}?amount=${amount}&addInfo=${encodeURIComponent(ref)}&accountName=${encodeURIComponent(BANK_HOLDER)}`;
};

// ── BALANCE & HISTORY ─────────────────────────────────────────────────────────

// GET /api/wallet/balance
const getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance').lean();
    const txCount = await WalletTransaction.countDocuments({ userId: req.user._id });
    return success(res, { data: { balance: user?.walletBalance || 0, transactionCount: txCount } });
  } catch (err) { next(err); }
};

// GET /api/wallet/transactions
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const [total, txs] = await Promise.all([
      WalletTransaction.countDocuments({ userId: req.user._id }),
      WalletTransaction.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
    ]);
    return paginate(res, txs, total, page, limit);
  } catch (err) { next(err); }
};

// ── TOP-UP (Nạp tiền) ─────────────────────────────────────────────────────────

// POST /api/wallet/topup/bank
const requestBankTopup = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const MAX_TOPUP = 500_000_000; // 500 triệu VND
    if (!amount || Number(amount) < 10000 || Number(amount) > MAX_TOPUP) {
      return error(res, `Số tiền nạp phải từ 10,000đ đến ${MAX_TOPUP.toLocaleString('vi-VN')}đ`, 400);
    }

    const topupAmount = Number(amount);
    const suffix = req.user._id.toString().slice(-4).toUpperCase();
    const ref = `NAP${suffix}${Date.now()}`;

    const topupReq = await TopupRequest.create({
      userId: req.user._id,
      amount: topupAmount,
      ref,
    });

    const qrUrl = buildQrUrl(topupAmount, ref);

    return success(res, {
      data: {
        id: topupReq._id,
        amount: topupAmount,
        ref,
        qrUrl,
        bankId: BANK_ID,
        bankAccount: BANK_ACCOUNT,
        bankHolder: BANK_HOLDER,
      },
    }, 'Yêu cầu nạp tiền đã được tạo', 201);
  } catch (err) { next(err); }
};

// GET /api/wallet/topups
const getMyTopups = async (req, res, next) => {
  try {
    const topups = await TopupRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return success(res, { data: topups });
  } catch (err) { next(err); }
};

// ── WITHDRAWAL (Rút tiền) ─────────────────────────────────────────────────────

// POST /api/wallet/withdraw
const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankName, accountNumber, accountHolder } = req.body;
    if (!amount || Number(amount) < 10000) return error(res, 'Số tiền rút tối thiểu 10,000đ', 400);
    if (!bankName || !accountNumber || !accountHolder) return error(res, 'Vui lòng nhập đủ thông tin ngân hàng', 400);

    const withdrawAmount = Number(amount);

    // Kiểm tra không có yêu cầu rút đang pending
    const pending = await WithdrawalRequest.findOne({ userId: req.user._id, status: { $in: ['pending', 'processing'] } });
    if (pending) return error(res, 'Bạn đã có yêu cầu rút tiền đang chờ xử lý', 400);

    // Atomic: check số dư + trừ ví trong 1 query — tránh race condition rút âm
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: withdrawAmount } },
      { $inc: { walletBalance: -withdrawAmount } },
      { new: true }
    ).select('walletBalance');
    if (!updatedUser) {
      return error(res, 'Số dư ví không đủ để thực hiện rút tiền', 400);
    }

    // Nếu tạo record thất bại → hoàn tiền lại để tránh mất tiền không có bằng chứng
    let withdrawal;
    try {
      await WalletTransaction.create({
        userId: req.user._id,
        type: 'adjustment',
        amount: -withdrawAmount,
        balanceAfter: updatedUser.walletBalance,
        description: `Chờ rút tiền: ${withdrawAmount.toLocaleString('vi-VN')}đ`,
      });

      withdrawal = await WithdrawalRequest.create({
        userId: req.user._id,
        amount: withdrawAmount,
        bankName,
        accountNumber,
        accountHolder,
      });
    } catch (createErr) {
      // Rollback: hoàn tiền lại ví
      await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: withdrawAmount } });
      throw createErr;
    }

    return success(res, { data: withdrawal }, 'Yêu cầu rút tiền đã được gửi. Admin sẽ xử lý trong 1-2 ngày làm việc.', 201);
  } catch (err) { next(err); }
};

// GET /api/wallet/withdrawals
const getMyWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return success(res, { data: withdrawals });
  } catch (err) { next(err); }
};

// ── ADMIN TOPUP (nạp ví trực tiếp từ admin panel) ────────────────────────────

// POST /api/admin/wallet/topup
const adminTopup = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;
    const topupAmount = Number(amount);
    if (!userId || !amount || isNaN(topupAmount) || topupAmount <= 0) {
      return error(res, 'userId và amount hợp lệ là bắt buộc', 400);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: topupAmount } },
      { new: true }
    ).select('walletBalance name email');
    if (!user) return error(res, 'Không tìm thấy người dùng', 404);

    await WalletTransaction.create({
      userId,
      type: 'topup',
      amount: topupAmount,
      balanceAfter: user.walletBalance,
      description: description || 'Nạp ví bởi admin',
    });

    return success(res, { data: { balance: user.walletBalance } },
      `Đã nạp ${topupAmount.toLocaleString('vi-VN')}đ vào ví của ${user.name}`);
  } catch (err) { next(err); }
};

module.exports = {
  getBalance, getTransactions,
  requestBankTopup, getMyTopups,
  requestWithdrawal, getMyWithdrawals,
  adminTopup,
};
