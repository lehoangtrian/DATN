const success = (res, data = {}, message = 'Thành công', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, ...data });

const error = (res, message = 'Lỗi server', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

const paginate = (res, data, total, page, limit) =>
  res.json({
    success: true,
    data,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  });

module.exports = { success, error, paginate };
