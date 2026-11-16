import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

const OBJECT_ID_HEX_REGEX = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(id) {
  return (
    typeof id === 'string' &&
    OBJECT_ID_HEX_REGEX.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

/**
 * Validates req.params.id (or a custom route parameter) as a 24-char MongoDB ObjectId.
 * Returns 404 ApiError if invalid per API-06.
 */
export function validateObjectId(req, _res, next) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return next(ApiError.notFound('Invalid ID format'));
  }
  return next();
}

export default validateObjectId;
