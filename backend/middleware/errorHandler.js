// Centralized error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('[SERVER ERROR]:', err);

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    data: null,
    errors: err.errors || []
  };

  res.status(statusCode).json(response);
};

// 404 Not Found handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    data: null,
    errors: [{ field: 'path', message: 'Endpoint does not exist' }]
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
