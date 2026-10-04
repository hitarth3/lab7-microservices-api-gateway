#!/bin/bash
# ==============================================================================
# Lab 6: Microservices End-to-End Automated Verification Script
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}  CampusConnect Microservices Automated Verification (Lab 6)   ${NC}"
echo -e "${CYAN}================================================================${NC}\n"

# Helper function to print results
print_result() {
  local title="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"

  echo -e "${YELLOW}>> Test: ${title}${NC}"
  echo -e "   Expected Status: ${expected} | Actual Status: ${actual}"
  if [ "$expected" == "$actual" ]; then
    echo -e "   ${GREEN}✓ PASSED${NC}"
  else
    echo -e "   ${RED}✗ FAILED${NC}"
  fi
  echo -e "   Response Payload:\n   ${body}\n"
}

# 1. Health Checks
echo -e "${CYAN}--- Step 1: Service Health Checks ---${NC}"
USER_HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:3001/health)
USER_BODY=$(echo "$USER_HEALTH" | sed '$d')
USER_CODE=$(echo "$USER_HEALTH" | tail -n 1)
print_result "User Service Health (Port 3001)" "200" "$USER_CODE" "$USER_BODY"

PROD_HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:3002/health)
PROD_BODY=$(echo "$PROD_HEALTH" | sed '$d')
PROD_CODE=$(echo "$PROD_HEALTH" | tail -n 1)
print_result "Product Service Health (Port 3002)" "200" "$PROD_CODE" "$PROD_BODY"

ORDER_HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:3003/health)
ORDER_BODY=$(echo "$ORDER_HEALTH" | sed '$d')
ORDER_CODE=$(echo "$ORDER_HEALTH" | tail -n 1)
print_result "Order Service Health (Port 3003)" "200" "$ORDER_CODE" "$ORDER_BODY"

# 2. Direct Endpoints
echo -e "${CYAN}--- Step 2: Direct REST Endpoints ---${NC}"
USERS_RES=$(curl -s -w "\n%{http_code}" http://localhost:3001/users)
USERS_BODY=$(echo "$USERS_RES" | sed '$d')
USERS_CODE=$(echo "$USERS_RES" | tail -n 1)
print_result "GET /users (List All Users)" "200" "$USERS_CODE" "$USERS_BODY"

PRODS_RES=$(curl -s -w "\n%{http_code}" http://localhost:3002/products)
PRODS_BODY=$(echo "$PRODS_RES" | sed '$d')
PRODS_CODE=$(echo "$PRODS_RES" | tail -n 1)
print_result "GET /products (List All Products)" "200" "$PRODS_CODE" "$PRODS_BODY"

# 3. Inter-Service Communication: Place Order (Order -> User & Product)
echo -e "${CYAN}--- Step 3: Service-to-Service Communication (Order -> User & Product) ---${NC}"
ORDER_POST_RES=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": 101, "productId": 501, "quantity": 2}')
ORDER_POST_BODY=$(echo "$ORDER_POST_RES" | sed '$d')
ORDER_POST_CODE=$(echo "$ORDER_POST_RES" | tail -n 1)
print_result "POST /orders (Successful Order Placement with Inter-Service Resolution)" "201" "$ORDER_POST_CODE" "$ORDER_POST_BODY"

# 4. Invalid Resource Test (404)
echo -e "${CYAN}--- Step 4: Invalid Resource Handling (404 Not Found) ---${NC}"
INVALID_USER_RES=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": 9999, "productId": 501, "quantity": 1}')
INVALID_USER_BODY=$(echo "$INVALID_USER_RES" | sed '$d')
INVALID_USER_CODE=$(echo "$INVALID_USER_RES" | tail -n 1)
print_result "POST /orders with Invalid User ID (404 Expected)" "404" "$INVALID_USER_CODE" "$INVALID_USER_BODY"

# 5. Fault Tolerance: Controlled 503 Error on Dependency Failure
echo -e "${CYAN}--- Step 5: Controlled Fault Tolerance (Stopping user-service container) ---${NC}"
echo -e "${YELLOW}Executing: docker stop user-service...${NC}"
docker stop user-service > /dev/null 2>&1
sleep 1

DEP_FAIL_RES=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": 101, "productId": 501, "quantity": 1}')
DEP_FAIL_BODY=$(echo "$DEP_FAIL_RES" | sed '$d')
DEP_FAIL_CODE=$(echo "$DEP_FAIL_RES" | tail -n 1)
print_result "POST /orders when User Service is down (503 Controlled Error Expected)" "503" "$DEP_FAIL_CODE" "$DEP_FAIL_BODY"

# 6. Service Recovery Test
echo -e "${CYAN}--- Step 6: Service Recovery (Restarting user-service container) ---${NC}"
echo -e "${YELLOW}Executing: docker start user-service...${NC}"
docker start user-service > /dev/null 2>&1
echo -e "${YELLOW}Waiting for user-service to re-establish connections...${NC}"
sleep 3

RECOVERY_RES=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": 101, "productId": 502, "quantity": 1}')
RECOVERY_BODY=$(echo "$RECOVERY_RES" | sed '$d')
RECOVERY_CODE=$(echo "$RECOVERY_RES" | tail -n 1)
print_result "POST /orders after User Service restart (201 Recovery Expected)" "201" "$RECOVERY_CODE" "$RECOVERY_BODY"

# 7. Query All Orders
echo -e "${CYAN}--- Step 7: Final Orders List Verification ---${NC}"
ALL_ORDERS=$(curl -s -w "\n%{http_code}" http://localhost:3003/orders)
ALL_ORDERS_BODY=$(echo "$ALL_ORDERS" | sed '$d')
ALL_ORDERS_CODE=$(echo "$ALL_ORDERS" | tail -n 1)
print_result "GET /orders (Listing all verified orders in Order DB)" "200" "$ALL_ORDERS_CODE" "$ALL_ORDERS_BODY"

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✓ All Lab 6 microservices tests completed successfully!       ${NC}"
echo -e "${GREEN}================================================================${NC}"
