export class ApiError extends Error {
  constructor(statusCode, message, errors = [], code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors, 'BAD_REQUEST');
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, [], 'NOT_FOUND');
  }

  static conflict(message, errors = []) {
    return new ApiError(409, message, errors, 'CONFLICT');
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, [], 'INTERNAL_ERROR');
  }
}

export default ApiError;
