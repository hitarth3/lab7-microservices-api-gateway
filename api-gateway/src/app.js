// ==============================================================================
// CampusConnect API Gateway - Express Application Specification
// ==============================================================================
// Centralized single entry point for all client requests.
// Handles service discovery, request routing, structured logging, and error handling.
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { loadConfig } = require('./config');
const { createGatewayLogger } = require('./logger');
const { createServiceProxy } = require('./proxy');

function createApp() {
  const config = loadConfig();
  const app = express();

  // Enable Cross-Origin Resource Sharing
  app.use(cors());

  // Parse JSON payloads (re-streamed to microservices via fixRequestBody)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Gateway-wide structured request logging
  app.use(createGatewayLogger());

  // ----------------------------------------------------------------------------
  // 1. Gateway Health Check Endpoint (No Proxying)
  // ----------------------------------------------------------------------------
  app.get('/health', (req, res) => {
    req.targetServiceName = 'api-gateway';
    req.targetServiceUrl = 'self';

    res.status(200).json({
      status: 'UP',
      service: 'api-gateway',
      role: 'Single Entry Point & Reverse Proxy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      port: config.port,
      serviceRegistry: {
        userService: {
          route: `${config.services.users.prefix}/*`,
          target: config.services.users.target,
          description: config.services.users.description
        },
        productService: {
          route: `${config.services.products.prefix}/*`,
          target: config.services.products.target,
          description: config.services.products.description
        },
        orderService: {
          route: `${config.services.orders.prefix}/*`,
          target: config.services.orders.target,
          description: config.services.orders.description
        }
      }
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Dynamic Service Discovery & Route Registration
  // ----------------------------------------------------------------------------
  // Routes are built dynamically from config without hard-coded service URLs
  console.log('[API Gateway] Initializing dynamic routing table:');
  Object.values(config.services).forEach((service) => {
    console.log(
      `  ➡️  Routing ${service.prefix.padEnd(10)} -> ${service.target} (${service.name})`
    );
    app.use(createServiceProxy(service));
  });

  // ----------------------------------------------------------------------------
  // 3. Fallback for Unmatched Gateway Routes (404)
  // ----------------------------------------------------------------------------
  app.use((req, res) => {
    req.targetServiceName = 'Gateway Fallback';
    res.status(404).json({
      error: 'Not Found',
      statusCode: 404,
      message: `No microservice route configured on API Gateway for path: ${req.originalUrl}`,
      availableEndpoints: [
        'GET  /health',
        'ALL  /users/*',
        'ALL  /products/*',
        'ALL  /orders/*'
      ],
      timestamp: new Date().toISOString()
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Centralized Gateway Exception Handler
  // ----------------------------------------------------------------------------
  app.use((err, req, res, _next) => {
    console.error('[API Gateway Fatal Exception]', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Gateway Error',
        statusCode: 500,
        message: err.message || 'An unexpected gateway error occurred.',
        timestamp: new Date().toISOString()
      });
    }
  });

  return { app, config };
}

module.exports = {
  createApp
};
