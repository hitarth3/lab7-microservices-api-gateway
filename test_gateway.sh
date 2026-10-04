#!/bin/bash
# ==============================================================================
# Lab 7: API Gateway, Service Discovery & Cloud Verification Script
# CampusConnect Microservices Platform
# ==============================================================================
# Usage:
#   ./test_gateway.sh                        # Test local Docker Compose (port 8080)
#   ./test_gateway.sh https://cloud-url.com  # Test public cloud deployment
# ==============================================================================

BASE_URL="${1:-http://localhost:8080}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}${BOLD}     CampusConnect Lab 7: API Gateway & Service Discovery Verification         ${NC}"
echo -e "${CYAN}================================================================================${NC}"
echo -e "Target Gateway Base URL: ${YELLOW}${BASE_URL}${NC}\n"

print_result() {
  local title="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"

  echo -e "${YELLOW}>> Test: ${title}${NC}"
  echo -e "   Expected Status: ${expected} | Actual Status: ${actual}"
  if [ "$expected" == "$actual" ]; then
    echo -e "   ${GREEN}✓ PASSED${NC}"
    ((PASSED_TESTS++))
  else
    echo -e "   ${RED}✗ FAILED${NC}"
    ((FAILED_TESTS++))
  fi
  echo -e "   Response Payload:"
  echo -e "   ${body}\n"
}

# ------------------------------------------------------------------------------
# STEP 1: Verify Host Port Isolation (Only Gateway Port Exposed)
# ------------------------------------------------------------------------------
if [[ "$BASE_URL" == *"localhost"* || "$BASE_URL" == *"127.0.0.1"* ]]; then
  echo -e "${CYAN}--- Step 1: External Port Isolation Verification ---${NC}"
  echo -e "Verifying backend microservice ports are NOT directly exposed to the host machine..."
  
  DIRECT_USER=$(curl -s --connect-timeout 1 http://localhost:3001/health 2>&1)
  if [[ "$DIRECT_USER" == *"Failed to connect"* || "$DIRECT_USER" == *"refused"* || -z "$DIRECT_USER" ]]; then
    print_result "Port 3001 (User Service) Blocked Directly from Host" "BLOCKED" "BLOCKED" "Connection actively refused by host - port strictly internal to Docker network."
  else
    print_result "Port 3001 (User Service) Blocked Directly from Host" "BLOCKED" "EXPOSED" "$DIRECT_USER"
  fi

  DIRECT_PROD=$(curl -s --connect-timeout 1 http://localhost:3002/health 2>&1)
  if [[ "$DIRECT_PROD" == *"Failed to connect"* || "$DIRECT_PROD" == *"refused"* || -z "$DIRECT_PROD" ]]; then
    print_result "Port 3002 (Product Service) Blocked Directly from Host" "BLOCKED" "BLOCKED" "Connection actively refused by host - port strictly internal to Docker network."
  else
    print_result "Port 3002 (Product Service) Blocked Directly from Host" "BLOCKED" "EXPOSED" "$DIRECT_PROD"
  fi

  DIRECT_ORDER=$(curl -s --connect-timeout 1 http://localhost:3003/health 2>&1)
  if [[ "$DIRECT_ORDER" == *"Failed to connect"* || "$DIRECT_ORDER" == *"refused"* || -z "$DIRECT_ORDER" ]]; then
    print_result "Port 3003 (Order Service) Blocked Directly from Host" "BLOCKED" "BLOCKED" "Connection actively refused by host - port strictly internal to Docker network."
  else
    print_result "Port 3003 (Order Service) Blocked Directly from Host" "BLOCKED" "EXPOSED" "$DIRECT_ORDER"
  fi
fi

# ------------------------------------------------------------------------------
# STEP 2: Gateway Health Check & Service Registry
# ------------------------------------------------------------------------------
echo -e "${CYAN}--- Step 2: Gateway Health Check & Service Registry ---${NC}"
HEALTH_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
HEALTH_BODY=$(echo "$HEALTH_RES" | sed '$d')
HEALTH_CODE=$(echo "$HEALTH_RES" | tail -n 1)
print_result "GET /health (API Gateway Status & Active Service Discovery Registry)" "200" "$HEALTH_CODE" "$HEALTH_BODY"

# ------------------------------------------------------------------------------
# STEP 3: Fallback Handling for Non-Existent Routes (404)
# ------------------------------------------------------------------------------
echo -e "${CYAN}--- Step 3: Gateway Unmatched Route Handling ---${NC}"
NOTFOUND_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/unknown-service-path")
NOTFOUND_BODY=$(echo "$NOTFOUND_RES" | sed '$d')
NOTFOUND_CODE=$(echo "$NOTFOUND_RES" | tail -n 1)
print_result "GET /unknown-service-path (Gateway Centralized 404 Fallback)" "404" "$NOTFOUND_CODE" "$NOTFOUND_BODY"

# ------------------------------------------------------------------------------
# STEP 4: User Service Proxy Routing (/users)
# ------------------------------------------------------------------------------
echo -e "${CYAN}--- Step 4: User Service Routing via Gateway ---${NC}"

USERS_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users")
USERS_BODY=$(echo "$USERS_RES" | sed '$d')
USERS_CODE=$(echo "$USERS_RES" | tail -n 1)
print_result "GET /users (List All Users via Gateway)" "200" "$USERS_CODE" "$USERS_BODY"

USER_101_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/101")
USER_101_BODY=$(echo "$USER_101_RES" | sed '$d')
USER_101_CODE=$(echo "$USER_101_RES" | tail -n 1)
print_result "GET /users/101 (Get User 101 via Gateway)" "200" "$USER_101_CODE" "$USER_101_BODY"

NEW_USER_RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/users" \
  -H "Content-Type: application/json" \
  -d '{"id": 105, "name": "Emma Watson", "email": "emma.watson@campus.edu", "department": "Robotics", "role": "researcher"}')
NEW_USER_BODY=$(echo "$NEW_USER_RES" | sed '$d')
NEW_USER_CODE=$(echo "$NEW_USER_RES" | tail -n 1)
# 201 Created or 409 if already created in previous run
if [ "$NEW_USER_CODE" == "201" ] || [ "$NEW_USER_CODE" == "409" ]; then
  print_result "POST /users (Create New User via Gateway)" "$NEW_USER_CODE" "$NEW_USER_CODE" "$NEW_USER_BODY"
else
  print_result "POST /users (Create New User via Gateway)" "201" "$NEW_USER_CODE" "$NEW_USER_BODY"
fi

# ------------------------------------------------------------------------------
# STEP 5: Product Service Proxy Routing (/products)
# ------------------------------------------------------------------------------
echo -e "${CYAN}--- Step 5: Product Service Routing via Gateway ---${NC}"

PRODS_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/products")
PRODS_BODY=$(echo "$PRODS_RES" | sed '$d')
PRODS_CODE=$(echo "$PRODS_RES" | tail -n 1)
print_result "GET /products (List All Products via Gateway)" "200" "$PRODS_CODE" "$PRODS_BODY"

PROD_501_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/products/501")
PROD_501_BODY=$(echo "$PROD_501_RES" | sed '$d')
PROD_501_CODE=$(echo "$PROD_501_RES" | tail -n 1)
print_result "GET /products/501 (Get Product 501 via Gateway)" "200" "$PROD_501_CODE" "$PROD_501_BODY"

# ------------------------------------------------------------------------------
# STEP 6: Order Service Routing & Inter-Service Flow (/orders)
# ------------------------------------------------------------------------------
echo -e "${CYAN}--- Step 6: Order Service Routing & Inter-Service Transaction Flow ---${NC}"

ORDER_POST_RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/orders" \
  -H "Content-Type: application/json" \
  -d '{"userId": 101, "productId": 501, "quantity": 1}')
ORDER_POST_BODY=$(echo "$ORDER_POST_RES" | sed '$d')
ORDER_POST_CODE=$(echo "$ORDER_POST_RES" | tail -n 1)
print_result "POST /orders (Gateway -> Order Service -> User & Product Services -> DB)" "201" "$ORDER_POST_CODE" "$ORDER_POST_BODY"

ORDERS_LIST_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/orders")
ORDERS_LIST_BODY=$(echo "$ORDERS_LIST_RES" | sed '$d')
ORDERS_LIST_CODE=$(echo "$ORDERS_LIST_RES" | tail -n 1)
print_result "GET /orders (List All Verified Orders via Gateway)" "200" "$ORDERS_LIST_CODE" "$ORDERS_LIST_BODY"

INVALID_USER_RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/orders" \
  -H "Content-Type: application/json" \
  -d '{"userId": 99999, "productId": 501, "quantity": 1}')
INVALID_USER_BODY=$(echo "$INVALID_USER_RES" | sed '$d')
INVALID_USER_CODE=$(echo "$INVALID_USER_RES" | tail -n 1)
print_result "POST /orders with Invalid User (404 Domain Validation via Gateway)" "404" "$INVALID_USER_CODE" "$INVALID_USER_BODY"

# ------------------------------------------------------------------------------
# STEP 7: Centralized Error Handling Test (502 Bad Gateway)
# ------------------------------------------------------------------------------
if [[ "$BASE_URL" == *"localhost"* || "$BASE_URL" == *"127.0.0.1"* ]] && command -v docker &> /dev/null; then
  echo -e "${CYAN}--- Step 7: Gateway Centralized Error Handling & Resilience (502 Bad Gateway) ---${NC}"
  echo -e "${YELLOW}Stopping user-service container to simulate service crash...${NC}"
  docker stop user-service > /dev/null 2>&1
  sleep 1

  DOWN_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users")
  DOWN_BODY=$(echo "$DOWN_RES" | sed '$d')
  DOWN_CODE=$(echo "$DOWN_RES" | tail -n 1)
  print_result "GET /users when User Service is down (502 Bad Gateway Expected)" "502" "$DOWN_CODE" "$DOWN_BODY"

  echo -e "${YELLOW}Restarting user-service container...${NC}"
  docker start user-service > /dev/null 2>&1
  echo -e "${YELLOW}Waiting for user-service to reconnect...${NC}"
  sleep 2

  RECOVER_RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users")
  RECOVER_BODY=$(echo "$RECOVER_RES" | sed '$d')
  RECOVER_CODE=$(echo "$RECOVER_RES" | tail -n 1)
  print_result "GET /users after Service Recovery (200 OK Expected)" "200" "$RECOVER_CODE" "$RECOVER_BODY"
fi

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
echo -e "${CYAN}================================================================================${NC}"
echo -e "${BOLD}Verification Summary: ${GREEN}${PASSED_TESTS} Passed${NC} | ${RED}${FAILED_TESTS} Failed${NC}"
echo -e "${CYAN}================================================================================${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ All Lab 7 API Gateway & Service Discovery tests completed successfully!${NC}\n"
  exit 0
else
  echo -e "${RED}${BOLD}✗ Some tests failed. Please review the output above.${NC}\n"
  exit 1
fi
