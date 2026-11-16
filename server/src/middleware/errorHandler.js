import ApiError from '../utils/ApiError.js';

/**
 * Central Express 4-argument error handling middleware.
 * Maps ApiError, ZodError, MongoDB E11000 duplicate keys, and Mongoose errors
 * to clean, structured JSON responses without leaking internal stack traces.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      errors: err.errors || [],
    });
  }

  if (err?.name === 'ZodError') {
    const rawIssues = err.issues || err.errors || [];
    const errors = rawIssues.map((issue) => ({
      field: issue.path && issue.path.length > 0 ? issue.path.join('.') : 'root',
      message: issue.message,
    }));
    return res.status(400).json({
      success: false,
      message: errors[0]?.message ? `Validation failed: ${errors[0].message}` : 'Validation failed',
      errors,
    });
  }

  if (err?.code === 11000) {
    const duplicateFields = Object.keys(err.keyPattern || err.keyValue || {});
    const fieldLabel = duplicateFields.length > 0 ? duplicateFields.join(', ') : 'unique field';
    return res.status(409).json({
      success: false,
      message: `Duplicate field value entered: ${fieldLabel} already exists`,
      code: 'DUPLICATE_KEY',
      errors: duplicateFields.map((field) => ({
        field,
        message: `${field} already exists`,
      })),
    });
  }

  if (err?.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((subErr) => subErr.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'Database validation error',
      errors,
    });
  }

  if (err?.name === 'CastError') {
    if (err.path === '_id') {
      return res.status(404).json({
        success: false,
        message: 'Invalid ID format',
        errors: [],
      });
    }
    return res.status(400).json({
      success: false,
      message: `Invalid value provided for ${err.path}`,
      errors: [],
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON request body',
      errors: [],
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[ErrorHandler]', err);
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
  });
}

export default errorHandler;
