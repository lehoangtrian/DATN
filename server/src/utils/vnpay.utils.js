const crypto = require('crypto');

const VNPAY_URL = process.env.VNPAY_URL;
const TMN_CODE = process.env.VNPAY_TMN_CODE;
const HASH_SECRET = process.env.VNPAY_HASH_SECRET;
const RETURN_URL = process.env.VNPAY_RETURN_URL;

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => { acc[key] = obj[key]; return acc; }, {});
}

function hmac512(data) {
  return crypto.createHmac('sha512', HASH_SECRET).update(data).digest('hex');
}

function createPaymentUrl({ txnRef, amount, orderInfo, ipAddr, locale = 'vn' }) {
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: TMN_CODE,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
    vnp_ReturnUrl: RETURN_URL,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: formatDate(new Date()),
  };

  const sorted = sortObject(params);
  // VNPay yêu cầu chuỗi ký không được URL-encode, dùng raw join
  const signData = Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join('&');
  const secureHash = hmac512(signData);

  sorted.vnp_SecureHash = secureHash;
  // URL cuối cùng dùng URLSearchParams để encode đúng
  return `${VNPAY_URL}?${new URLSearchParams(sorted).toString()}`;
}

function verifySignature(query) {
  const secureHash = query.vnp_SecureHash;
  if (!secureHash) return false;

  const params = { ...query };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sorted = sortObject(params);
  const signData = Object.entries(sorted).map(([k, v]) => `${k}=${v}`).join('&');
  const checkHash = hmac512(signData);

  return secureHash === checkHash;
}

module.exports = { createPaymentUrl, verifySignature };
