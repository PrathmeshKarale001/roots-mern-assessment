import ApiError from '../utils/ApiError.js';

function formatZodIssues(issues = []) {
  return issues.map((issue) => ({
    field: issue.path && issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

/**
 * Express 5-safe Zod validation middleware.
 * Accepts either a single Zod schema (validating req.body) or an object { body?, query?, params? }.
 * Stores parsed payloads on req.validated = { body, query, params } and NEVER mutates req.query.
 */
export function validate(schemaOrTargetMap) {
  return (req, _res, next) => {
    const isDirectSchema =
      schemaOrTargetMap && typeof schemaOrTargetMap.safeParse === 'function';

    const targetSchemas = isDirectSchema
      ? { body: schemaOrTargetMap }
      : schemaOrTargetMap || {};

    const validated = {
      body: req.validated?.body ?? req.body ?? {},
      query: req.validated?.query ?? { ...req.query },
      params: req.validated?.params ?? { ...req.params },
    };

    const collectedIssues = [];

    if (targetSchemas.params) {
      const result = targetSchemas.params.safeParse(req.params ?? {});
      if (!result.success) {
        collectedIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        validated.params = result.data;
      }
    }

    if (targetSchemas.query) {
      const result = targetSchemas.query.safeParse(req.query ?? {});
      if (!result.success) {
        collectedIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        validated.query = result.data;
      }
    }

    if (targetSchemas.body) {
      const result = targetSchemas.body.safeParse(req.body ?? {});
      if (!result.success) {
        collectedIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        validated.body = result.data;
        req.body = result.data;
      }
    }

    if (collectedIssues.length > 0) {
      const errors = formatZodIssues(collectedIssues);
      const firstMessage = errors[0]?.message
        ? `Validation error: ${errors[0].message}`
        : 'Validation error';
      return next(ApiError.badRequest(firstMessage, errors));
    }

    req.validated = validated;
    return next();
  };
}

export default validate;
