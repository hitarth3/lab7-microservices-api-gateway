// ==============================================================================
// CampusConnect API Gateway - Server Entry Point
// ==============================================================================
// Starts the reverse proxy gateway and prints dynamic routing information.
// ==============================================================================

const { createApp } = require('./src/app');

const { app, config } = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`🌐 [API Gateway] Listening on http://0.0.0.0:${config.port}`);
  console.log('🚀 Role: Public Single Entry Point for CampusConnect Platform');
  console.log('🛡️  Network Isolation: Backend microservices protected from direct internet access');
  console.log('📋 Active Service Discovery Registry:');
  console.log(`   - Users:    ${config.services.users.prefix}/*    -> ${config.services.users.target}`);
  console.log(`   - Products: ${config.services.products.prefix}/* -> ${config.services.products.target}`);
  console.log(`   - Orders:   ${config.services.orders.prefix}/*   -> ${config.services.orders.target}`);
  console.log(`   - Health:   http://0.0.0.0:${config.port}/health`);
  console.log('================================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[API Gateway] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[API Gateway] HTTP server closed');
  });
});
