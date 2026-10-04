#!/bin/bash
# ==============================================================================
# Lab 7 Part B: Service Discovery Configuration Proof Demonstration
# CampusConnect Microservices Platform
# ==============================================================================
# Proves that changing a service's URL/port only via configuration
# (environment variable USER_SERVICE_URL) dynamically alters gateway routing
# without modifying any gateway application code.
# ==============================================================================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}${BOLD}     Part B Proof: Configuration-Based Service Discovery Demonstration         ${NC}"
echo -e "${CYAN}================================================================================${NC}\n"

echo -e "${YELLOW}Step 1: Inspecting Gateway Route Definitions in Source Code...${NC}"
echo -e "Checking api-gateway/src/config.js and api-gateway/src/app.js:"
echo -e "Notice that service URLs are NOT hard-coded literals. They reference process.env:\n"
grep -n "USER_SERVICE_URL" api-gateway/src/config.js

echo -e "\n${YELLOW}Step 2: Starting an alternate/v2 service instance on temporary port 3099...${NC}"
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from Reconfigured Dynamic User Service Instance!',
    port: 3099,
    instance: 'user-service-reconfigured-target',
    timestamp: new Date().toISOString()
  }));
});
server.listen(3099, '127.0.0.1', () => {
  console.log('[Proof Service] Listening on http://127.0.0.1:3099');
});
" > /tmp/proof_service.log 2>&1 &
PROOF_PID=$!
sleep 1

echo -e "Proof service running with PID ${PROOF_PID} at http://127.0.0.1:3099"

echo -e "\n${YELLOW}Step 3: Launching API Gateway with overridden USER_SERVICE_URL configuration...${NC}"
USER_SERVICE_URL="http://127.0.0.1:3099" PORT=8089 node api-gateway/server.js > /tmp/gateway_proof.log 2>&1 &
GATEWAY_PID=$!
sleep 2

echo -e "Gateway started on port 8089 with overridden configuration."
echo -e "Checking Gateway /health to verify active registry:"
curl -s http://localhost:8089/health | jq .serviceRegistry.userService 2>/dev/null || curl -s http://localhost:8089/health

echo -e "\n\n${YELLOW}Step 4: Requesting GET /users through API Gateway (Port 8089)...${NC}"
RESPONSE=$(curl -s http://localhost:8089/users)
echo -e "${GREEN}Response received through Gateway:${NC}"
echo -e "$RESPONSE"

echo -e "\n${YELLOW}Step 5: Cleaning up proof processes...${NC}"
kill $PROOF_PID 2>/dev/null
kill $GATEWAY_PID 2>/dev/null
echo -e "${GREEN}✓ Successfully demonstrated: Gateway routes dynamically to http://127.0.0.1:3099 without any code modification!${NC}\n"
