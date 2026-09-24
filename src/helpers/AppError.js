class AppError extends Error {
  /**
   * @param {string} message - краткое описание (например, "Validation Error")
   * @param {number} statusCode - HTTP код (по умолчанию 500)
   * @param {boolean} isOperational - операционная ошибка (по умолчанию true)
   * @param {string[]} errors - детальные сообщения (массив строк)
   */
  constructor(message, statusCode = 500, isOperational = true, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = Array.isArray(errors)
      ? errors
      : [String(errors || "")].filter(Boolean);
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
