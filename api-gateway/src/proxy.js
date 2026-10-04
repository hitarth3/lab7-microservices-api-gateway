// ==============================================================================
// CampusConnect API Gateway - Dynamic Reverse Proxy & Resilient Error Handler
// ==============================================================================
// Dynamically creates reverse proxy middleware for registered microservices.
// Handles request forwarding, body preservation, and centralized 502/503 handling.
// ==============================================================================

const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

function createServiceProxy(service) {
  return createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    pathFilter: service.prefix,
    timeout: 10000,
    proxyTimeout: 10000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Tag request for gateway logger
        req.targetServiceName = service.id;
        req.targetServiceUrl = service.target;

        // Forward request body properly if parsed
        fixRequestBody(proxyReq, req);
      },
      proxyRes: (proxyRes, req, res) => {
        // Tag metadata for logging
        req.targetServiceName = service.id;
        req.targetServiceUrl = service.target;
      },
      error: (err, req, res) => {
        req.targetServiceName = service.id;
        req.targetServiceUrl = service.target;

        console.error(
          `[API Gateway Centralized Error] Connection failure to ${service.id} (${service.target}): ${err.message}`
        );

        if (!res.headersSent) {
          // Unreachable service or connection refused / timeout
          const statusCode = err.code === 'ETIMEDOUT' ? 504 : 502;
          res.status(statusCode).json({
            error: statusCode === 504 ? 'Gateway Timeout' : 'Bad Gateway',
            statusCode,
            message: `Target microservice '${service.id}' is unreachable or failed to respond.`,
            service: service.id,
            targetUrl: service.target,
            path: req.originalUrl,
            method: req.method,
            details: err.code || err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });
}

module.exports = {
  createServiceProxy
};
