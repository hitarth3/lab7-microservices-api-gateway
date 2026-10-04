// ==============================================================================
// CampusConnect API Gateway - Service Registry & Configuration Loader
// ==============================================================================
// Externalizes service locations into environment variables so route mappings
// are dynamically discovered at runtime rather than hard-coded.
// ==============================================================================

require('dotenv').config();

function loadConfig() {
  const port = parseInt(process.env.PORT || process.env.GATEWAY_PORT || '8080', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Dynamic Service Registry
  // Reads URLs from environment variables; defaults to Docker Compose DNS names
  const services = {
    users: {
      id: 'user-service',
      name: 'User Management Service',
      prefix: '/users',
      target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
      description: 'User profiles, academic roles, and identity accounts'
    },
    products: {
      id: 'product-service',
      name: 'Product Catalog Service',
      prefix: '/products',
      target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
      description: 'Campus bookstore inventory, merchandise, and textbook catalog'
    },
    orders: {
      id: 'order-service',
      name: 'Order Processing Service',
      prefix: '/orders',
      target: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
      description: 'Order placement and inter-service transaction orchestration'
    }
  };

  return {
    port,
    nodeEnv,
    services
  };
}

module.exports = {
  loadConfig
};
