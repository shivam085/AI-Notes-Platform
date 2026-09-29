// Keep unexpected server errors separate from route and controller code.
// Individual controllers still send their expected 400, 401, 404, and 409 responses.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  console.error('API middleware error:', error?.code || error?.name || 'UnknownError');
  return res.status(503).json({
    message: 'The server is temporarily unavailable. Please try again.',
  });
}
