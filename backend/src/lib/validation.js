const { z } = require('zod');
const { AppError } = require('./appError');

const formatIssues = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

const validate = (schema, payload) => {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', formatIssues(result.error.issues));
  }

  return result.data;
};

module.exports = {
  z,
  validate,
};
