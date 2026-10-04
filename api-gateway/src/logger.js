// ==============================================================================
// CampusConnect API Gateway - Request & Audit Logger Middleware
// ==============================================================================
// Logs incoming request method, path, target microservice, response status,
// and execution latency for complete end-to-end observability.
// ==============================================================================

function createGatewayLogger() {
  return function gatewayLogger(req, res, next) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // When the response has finished sending to the client
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const targetService = req.targetServiceName || 'Gateway Internal';
      const targetUrl = req.targetServiceUrl || 'N/A';
      const statusCode = res.statusCode;

      // Color-coded log format for terminal readability
      const statusIndicator = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
      
      console.log(
        `[API Gateway] ${timestamp} | ${statusIndicator} ${req.method.padEnd(6)} ` +
        `Path: ${req.originalUrl.padEnd(20)} -> Target: ${targetService.padEnd(16)} ` +
        `[${targetUrl}] | Status: ${statusCode} | ${durationMs}ms`
      );
    });

    next();
  };
}

module.exports = {
  createGatewayLogger
};
