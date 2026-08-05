"use strict";

/**
 * 统一成功返回
 */
function success(res, data = {}, message = "success") {
  return res.status(200).json({
    code: 0,
    message,
    data
  });
}

/**
 * 统一分页返回
 */
function successPage(res, list, page, pageSize, total) {
  return res.status(200).json({
    code: 0,
    message: "success",
    data: {
      list,
      page: Number(page),
      pageSize: Number(pageSize),
      total: Number(total)
    }
  });
}

/**
 * 统一失败返回
 * @param {number} code 业务或HTTP错误码
 * @param {string} message
 * @param {number} httpStatus HTTP状态码，默认与业务code的HTTP语义映射
 */
function fail(res, code = 500, message = "error", httpStatus) {
  const status = httpStatus || (code >= 1000 ? 200 : code);
  return res.status(status).json({
    code,
    message,
    data: null
  });
}

module.exports = {
  success,
  successPage,
  fail
};
