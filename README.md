# Lab 7: API Gateway, Configuration-Based Service Discovery & Cloud Deployment

**Course:** Web Services and Service-Oriented Architecture (SOA) Laboratory  
**Project:** CampusConnect Microservices Platform  
**System Architecture:** Cloud-Ready Multi-Microservices Architecture with API Gateway, Dynamic Service Registry, Container Isolation, and MongoDB Atlas Persistence  

---

## Table of Contents

1. [Executive Summary & Lab Objectives](#1-executive-summary--lab-objectives)
2. [End-to-End System Architecture Diagram](#2-end-to-end-system-architecture-diagram)
3. [Gateway Endpoints & Routing Table](#3-gateway-endpoints--routing-table)
4. [Part A: The API Gateway Implementation](#4-part-a-the-api-gateway-implementation)
   - [Architectural Role & Technologies](#architectural-role--technologies)
   - [Gateway Health Check (`GET /health`)](#gateway-health-check-get-health)
   - [Request & Audit Logging](#request--audit-logging)
   - [Centralized 502/503 Fault Tolerance & Error Handling](#centralized-502503-fault-tolerance--error-handling)
   - [External Port Isolation in Docker Compose](#external-port-isolation-in-docker-compose)
   - [Discussion Question 1: Why Introduce an API Gateway?](#discussion-question-1-why-introduce-an-api-gateway)
5. [Part B: Configuration-Based Service Discovery](#5-part-b-configuration-based-service-discovery)
   - [Service Registry Specification](#service-registry-specification)
   - [Startup Dynamic Route Generation](#startup-dynamic-route-generation)
   - [Proof of Reconfiguration Without Code Changes](#proof-of-reconfiguration-without-code-changes)
   - [Discussion Question 2: Static vs. Dynamic Service Discovery](#discussion-question-2-static-vs-dynamic-service-discovery)
6. [Part C: Cloud Deployment (Render & MongoDB Atlas)](#6-part-c-cloud-deployment-render--mongodb-atlas)
   - [Deployment Topology & Platform](#deployment-topology--platform)
   - [Infrastructure as Code (`render.yaml`)](#infrastructure-as-code-renderyaml)
   - [Environment Variables Configuration](#environment-variables-configuration)
   - [Live Public Endpoint Testing](#live-public-endpoint-testing)
7. [Automated Verification & Test Execution](#7-automated-verification--test-execution)
   - [Running the Local Verification Suite (`test_gateway.sh`)](#running-the-local-verification-suite-test_gatewaysh)
   - [Running the Service Discovery Proof (`demo_service_discovery_config.sh`)](#running-the-service-discovery-proof-demo_service_discovery_configsh)
8. [Postman Collection Guide](#8-postman-collection-guide)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Written Reflection (5–8 Lines)](#10-written-reflection-58-lines)
11. [Final Submission Checklist](#11-final-submission-checklist)

---

## 1. Executive Summary & Lab Objectives

In **Lab 6**, the CampusConnect backend was decomposed into three independently runnable microservices (*User Service*, *Product Service*, and *Order Service*) communicating directly over a Docker bridge network (`campus-network`), with the concept of an API Gateway discussed only in theory. Clients were required to maintain knowledge of individual microservice ports (`:3001`, `:3002`, `:3003`).

**Lab 7 transitions this architectural concept into a production-grade reality:**
1. **API Gateway (`api-gateway`):** Built a dedicated Node.js/Express reverse proxy gateway operating as the **exclusive public entry point** for all incoming client traffic. The gateway contains **no business logic**; it solely handles request routing, structured audit logging, centralized 502/503 error handling, and security isolation.
2. **Container Security & Port Isolation:** Microservice host port mappings are removed in Docker Compose. Only the API Gateway (`:8080`) is exposed externally. The User, Product, and Order services, alongside MongoDB, are restricted entirely within the internal `campus-network` Docker bridge.
3. **Configuration-Based Service Discovery:** Eliminated hard-coded backend URLs. The gateway discovers service endpoints dynamically at startup via environment variables (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`), enabling zero-code endpoint reconfiguration.
4. **Cloud Deployment:** Containerized the architecture for deployment to cloud infrastructure (Render / Railway / Cloud Run), integrating with cloud-hosted MongoDB Atlas.

### Full-Stack Flow:
$$\text{Client / Postman} \longrightarrow \text{API Gateway (Port 8080 / Public URL)} \longrightarrow \text{Service Discovery / Config} \longrightarrow \begin{matrix} \text{User Service (:3001)} \\ \text{Product Service (:3002)} \\ \text{Order Service (:3003)} \end{matrix} \longrightarrow \text{MongoDB Atlas}$$

---

## 2. End-to-End System Architecture Diagram

Below is the architectural layering diagram depicting client traffic, the public API Gateway, configuration-based service discovery, the secure Docker network boundary, inter-service links, and persistent database storage.

An interactive vector graphic is available in [`docs/architecture.svg`](file:///Users/hitarthshah/Downloads/lab6_submission/docs/architecture.svg).

### System Topology Diagram:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT TIER (Internet)                               │
│                         Postman / Web Frontend / Mobile Clients                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP Requests (One Public URL)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Container: api-gateway:v1)                         │
│                    Public Host Port: :8080 (or Cloud HTTPS Gateway URL)                 │
│                                                                                        │
│   ├── GET /health (Status, Uptime & Active Service Discovery Registry)                 │
│   ├── Request Logging Middleware (Method, Original Path, Target Service, Status, Latency)│
│   ├── Centralized Error Interceptor (Transforms ECONNREFUSED/Timeout into 502/504 JSON)│
│   └── Dynamic Reverse Proxy (http-proxy-middleware with fixRequestBody payload stream) │
└───────────────▲───────────────────────────────────────────┬────────────────────────────┘
                │ Reads dynamic mappings at startup         │ Routes /users, /products, /orders
┌───────────────┴───────────────────────────┐               │
│     SERVICE REGISTRY / CONFIG LAYER       │               │
│  USER_SERVICE_URL=http://user-service:3001│               │
│  PRODUCT_SERVICE_URL=http://prod-svc:3002 │               │
│  ORDER_SERVICE_URL=http://order-svc:3003  │               │
└───────────────────────────────────────────┘               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             🔒 DOCKER BRIDGE NETWORK: campus-network (Isolated from Outside)           │
│             ⛔ Host Ports 3001, 3002, 3003, and 27017 are NOT Exposed to Host          │
│                                                                                        │
│   ┌────────────────────────┐                   ┌──────────────────────────┐            │
│   │      User Service      │                   │     Product Service      │            │
│   │  Container: user-service│                  │Container: product-service│            │
│   │  Internal Port: :3001  │                   │  Internal Port: :3002    │            │
│   │ (expose: "3001" only)  │                   │ (expose: "3002" only)    │            │
│   └───────────▲────────────┘                   └────────────▲─────────────┘            │
│               │                                             │                          │
│               │ HTTP GET /users/{id}                        │ HTTP GET /products/{id}  │
│               │ (Docker DNS: http://user-service:3001)      │                          │
│               └──────────────────────┐ ┌────────────────────┘                          │
│                                      │ │                                               │
│                                 ┌────┴─┴───────────────────┐                           │
│                                 │      Order Service       │                           │
│                                 │ Container: order-service │                           │
│                                 │   Internal Port: :3003   │                           │
│                                 │  (expose: "3003" only)   │                           │
│                                 └─────────────┬────────────┘                           │
│                                               │                                        │
│               PERSISTENT DATABASE LAYER (Isolated Database-Per-Service)                │
│                                               │                                        │
│          ┌─────────────────────┬──────────────┴───────┐                                │
│          ▼                     ▼                      ▼                                │
│   ┌──────────────┐     ┌──────────────┐        ┌──────────────┐                        │
│   │   User DB    │     │  Product DB  │        │   Order DB   │                        │
│   │ campus_users │     │campus_products│       │campus_orders │                        │
│   └──────────────┘     └──────────────┘        └──────────────┘                        │
│   └────────────────────────────┬──────────────────────────────┘                        │
│             MongoDB Atlas (Cloud) OR Local MongoDB Container (:27017)                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Gateway Endpoints & Routing Table

| HTTP Method | Gateway Path | Target Microservice | Target Endpoint | Description |
|:---|:---|:---|:---|:---|
| **GET** | `/health` | *Gateway itself* | *N/A (Local)* | Gateway status, uptime, and dynamic routing table |
| **GET** | `/users` | User Service | `http://user-service:3001/users` | List all registered users |
| **GET** | `/users/:id` | User Service | `http://user-service:3001/users/:id` | Retrieve user profile by numeric ID |
| **POST** | `/users` | User Service | `http://user-service:3001/users` | Create new student/faculty profile |
| **PUT** | `/users/:id` | User Service | `http://user-service:3001/users/:id` | Update existing user details |
| **DELETE**| `/users/:id` | User Service | `http://user-service:3001/users/:id` | Delete user profile |
| **GET** | `/products` | Product Service | `http://product-service:3002/products` | List all inventory catalog items |
| **GET** | `/products/:id` | Product Service | `http://product-service:3002/products/:id`| Retrieve product details by ID |
| **POST** | `/products` | Product Service | `http://product-service:3002/products` | Add new catalog item/merchandise |
| **PUT** | `/products/:id` | Product Service | `http://product-service:3002/products/:id`| Update stock or pricing |
| **DELETE**| `/products/:id` | Product Service | `http://product-service:3002/products/:id`| Remove catalog item |
| **GET** | `/orders` | Order Service | `http://order-service:3003/orders` | List all validated customer orders |
| **GET** | `/orders/:id` | Order Service | `http://order-service:3003/orders/:id` | Retrieve specific order |
| **POST** | `/orders` | Order Service | `http://order-service:3003/orders` | Place order (orchestrates User & Product calls) |

---

## 4. Part A: The API Gateway Implementation

### Architectural Role & Technologies
- **Technology Stack:** Node.js (v20), Express.js (v5), and `http-proxy-middleware` (v3).
- **Zero Business Logic:** The gateway acts strictly as a reverse proxy router. It does not manipulate schemas, touch database storage, or duplicate domain logic.
- **Request Body Preservation:** When proxying `POST` and `PUT` requests, `fixRequestBody` is bound to `on: { proxyReq }` to guarantee parsed JSON buffers are restreamed to the target microservices without hanging or socket exhaustion.

### Gateway Health Check (`GET /health`)
The gateway provides a dedicated health check endpoint reporting operational readiness and the active service discovery registry:

```bash
curl -s http://localhost:8080/health
```

**Response Payload (`200 OK`):**
```json
{
  "status": "UP",
  "service": "api-gateway",
  "role": "Single Entry Point & Reverse Proxy",
  "timestamp": "2026-10-04T16:51:54.928Z",
  "uptimeSeconds": 15,
  "environment": "production",
  "port": 8080,
  "serviceRegistry": {
    "userService": {
      "route": "/users/*",
      "target": "http://user-service:3001",
      "description": "User profiles, academic roles, and identity accounts"
    },
    "productService": {
      "route": "/products/*",
      "target": "http://product-service:3002",
      "description": "Campus bookstore inventory, merchandise, and textbook catalog"
    },
    "orderService": {
      "route": "/orders/*",
      "target": "http://order-service:3003",
      "description": "Order placement and inter-service transaction orchestration"
    }
  }
}
```

### Request & Audit Logging
The gateway features a centralized request logging middleware (`api-gateway/src/logger.js`) that captures every incoming request, identifies the destination microservice, measures round-trip latency, and prints formatted audit logs:

```text
[API Gateway] 2026-10-04T16:51:54.928Z | ✅ GET    Path: /health              -> Target: api-gateway      [self] | Status: 200 | 4ms
[API Gateway] 2026-10-04T16:51:59.648Z | ✅ GET    Path: /users               -> Target: user-service     [http://user-service:3001] | Status: 200 | 20ms
[API Gateway] 2026-10-04T16:52:03.507Z | ✅ GET    Path: /users/101           -> Target: user-service     [http://user-service:3001] | Status: 200 | 8ms
[API Gateway] 2026-10-04T16:52:06.818Z | ✅ GET    Path: /products            -> Target: product-service  [http://product-service:3002] | Status: 200 | 16ms
[API Gateway] 2026-10-04T16:52:18.591Z | ✅ POST   Path: /orders              -> Target: order-service    [http://order-service:3003] | Status: 201 | 37ms
[API Gateway] 2026-10-04T16:52:30.196Z | ❌ GET    Path: /users               -> Target: user-service     [http://user-service:3001] | Status: 502 | 12ms
```

### Centralized 502/503 Fault Tolerance & Error Handling
If any target microservice becomes unreachable (due to container crash, network partition, or connection timeout), the proxy catches the low-level socket exception (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`) and returns a structured **`502 Bad Gateway`** response rather than crashing or leaving client sockets hanging:

```bash
# Example error payload returned by gateway when user-service is offline:
HTTP/1.1 502 Bad Gateway
Content-Type: application/json
```
```json
{
  "error": "Bad Gateway",
  "statusCode": 502,
  "message": "Target microservice 'user-service' is unreachable or failed to respond.",
  "service": "user-service",
  "targetUrl": "http://user-service:3001",
  "path": "/users",
  "method": "GET",
  "details": "ENOTFOUND",
  "timestamp": "2026-10-04T16:53:22.697Z"
}
```

### External Port Isolation in Docker Compose
In compliance with the assignment specification, microservice ports are strictly unmapped from the host:

```yaml
# compose.yaml (Snippet showing port isolation)
services:
  api-gateway:
    ports:
      - "${GATEWAY_PORT:-8080}:8080" # ONLY port published to host/outside!

  user-service:
    expose:
      - "3001" # Internal to campus-network ONLY

  product-service:
    expose:
      - "3002" # Internal to campus-network ONLY

  order-service:
    expose:
      - "3003" # Internal to campus-network ONLY
```

Verification test proving direct access from the host is blocked:
```bash
$ curl -s --connect-timeout 1 http://localhost:3001/health
# Result: Connection refused (Host port not exposed)
```

---

### Discussion Question 1: Why Introduce an API Gateway?

> **Question:** Why introduce an API Gateway instead of letting clients call each service directly? Think about a single entry point, hiding internal structure, and centralizing concerns like logging and error handling.

**Answer:**  
In a distributed microservices architecture, permitting clients to communicate directly with backend services introduces significant liabilities:
1. **Single Entry Point & Simplified Client Experience:** Without a gateway, clients must track multiple hostnames, IP addresses, and ports (`:3001`, `:3002`, `:3003`), updating client applications whenever a service moves or scales. The API Gateway presents a single, unified endpoint (`http://api.campus.edu` or port `8080`), abstracting backend complexity.
2. **Encapsulation & Hiding Internal Topology:** Exposing individual microservices directly leaks internal architectural details, framework versions, and network structures, expanding the attack surface. The gateway creates a secure perimeter: backend microservices remain unexposed in private subnets, shielding them from direct internet probes.
3. **Centralization of Cross-Cutting Concerns:** Common infrastructural features—such as request rate limiting, SSL termination, structured audit logging, CORS enforcement, and standardized error transformation—would otherwise need to be independently implemented, maintained, and updated across every service repository. Centralizing them at the gateway eliminates code duplication and ensures uniform operational policy enforcement.
4. **Resilient Degradation & Unified Error Handling:** If an internal service crashes, direct client calls fail abruptly with unhandled TCP socket resets or vendor-specific stack traces. The API Gateway traps connection errors centrally, translating them into standard, predictable HTTP status codes (`502 Bad Gateway` / `503 Service Unavailable`) accompanied by consistent JSON diagnostic structures.

---

## 5. Part B: Configuration-Based Service Discovery

### Service Registry Specification
The gateway strictly externalizes all backend locations into environment variables loaded into an isolated configuration module (`api-gateway/src/config.js`):

```javascript
// Dynamic Service Registry definition
const services = {
  users: {
    id: 'user-service',
    name: 'User Management Service',
    prefix: '/users',
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001'
  },
  products: {
    id: 'product-service',
    name: 'Product Catalog Service',
    prefix: '/products',
    target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'
  },
  orders: {
    id: 'order-service',
    name: 'Order Processing Service',
    prefix: '/orders',
    target: process.env.ORDER_SERVICE_URL || 'http://order-service:3003'
  }
};
```

### Startup Dynamic Route Generation
Route handlers in `api-gateway/src/app.js` are constructed dynamically by iterating over the service registry:

```javascript
Object.values(config.services).forEach((service) => {
  console.log(`Routing ${service.prefix}/* -> ${service.target} (${service.name})`);
  app.use(createServiceProxy(service));
});
```
**No literal target URLs exist inside route handling logic.**

### Proof of Reconfiguration Without Code Changes
To prove that changing configuration dynamically alters routing without modifying code, execute [`demo_service_discovery_config.sh`](file:///Users/hitarthshah/Downloads/lab6_submission/demo_service_discovery_config.sh):

```bash
./demo_service_discovery_config.sh
```

**Demonstration Output:**
```text
================================================================================
     Part B Proof: Configuration-Based Service Discovery Demonstration         
================================================================================

Step 1: Inspecting Gateway Route Definitions in Source Code...
Checking api-gateway/src/config.js and api-gateway/src/app.js:
Notice that service URLs reference process.env:
21:      target: process.env.USER_SERVICE_URL || 'http://user-service:3001',

Step 2: Starting an alternate/v2 service instance on temporary port 3099...
[Proof Service] Listening on http://127.0.0.1:3099

Step 3: Launching API Gateway with overridden USER_SERVICE_URL configuration...
Gateway started on port 8089 with overridden configuration.
Active registry:
{
  "route": "/users/*",
  "target": "http://127.0.0.1:3099"
}

Step 4: Requesting GET /users through API Gateway (Port 8089)...
Response received through Gateway:
{"message":"Hello from Reconfigured Dynamic User Service Instance!","port":3099,"instance":"user-service-reconfigured-target"}

✓ Successfully demonstrated: Gateway routes dynamically to http://127.0.0.1:3099 without any code modification!
```

---

### Discussion Question 2: Static vs. Dynamic Service Discovery

> **Question:** In your README, briefly contrast this static/config-based approach with dynamic service discovery (e.g. Consul, Eureka, Kubernetes DNS) - what would a dynamic registry add that a static config file cannot?

**Comparison Table:**

| Architectural Capability | Static / Config-Based Discovery (Lab 7) | Dynamic Service Discovery (Consul / Eureka / K8s DNS) |
|:---|:---|:---|
| **Instance Scaling (0 $\rightarrow$ N)** | Requires manual config update and restart if hostnames change | Automatically registers and de-registers new container replicas in real time |
| **Health Check Eviction** | Static routes remain configured even if instances become unhealthy | Continuously heartbeats instances; unroutable instances are evicted automatically |
| **Client-Side Load Balancing** | Relies on external bridge DNS or points to a single target host | Performs round-robin, least-connections, or latency-based client routing across instances |
| **Runtime Mutation** | Requires process restart or container redeployment to reload env vars | Instantaneous runtime updates via service catalog polling or event pub/sub |
| **Operational Overhead** | Extremely lightweight; zero external coordination infrastructure needed | Requires maintaining a dedicated high-availability coordination cluster (Consul/etcd) |

**Analysis:**  
Static configuration-based discovery works effectively in bounded environments with stable hostnames (such as Docker Compose bridge networks or predictable cloud app names). However, dynamic registries add:
1. **Dynamic Ephemeral Scaling:** In modern auto-scaled environments, instances spin up and down dynamically with randomized IPs. A dynamic registry allows new instances to self-register upon boot and de-register on shutdown.
2. **Automated Active Health Checks:** Dynamic registries continuously probe `/health` endpoints; if an instance fails three consecutive checks, it is stripped from routing tables within seconds.
3. **Traffic Splitting & Canary Deployments:** Dynamic registries enable weighted routing (e.g., routing 10% of `/orders` traffic to a v2 canary instance and 90% to v1) without touching environment files or restarting gateways.

---

## 6. Part C: Cloud Deployment (Render & MongoDB Atlas)

### Deployment Topology & Platform
The containerized CampusConnect system is designed for instant deployment to **Render** (as well as Railway, Fly.io, or AWS ECS/GCP Cloud Run).

- **API Gateway:** Deployed as a **Public Web Service** with Docker runtime, exposed to the public internet on Render's managed domain (e.g. `https://campusconnect-gateway.onrender.com`).
- **User, Product & Order Microservices:** Deployed as containerized services, connected to the Gateway via Render internal networking or private service names.
- **MongoDB Atlas:** Cloud-hosted MongoDB cluster (from Lab 4) providing persistent storage with SSL/TLS encryption.

### Infrastructure as Code (`render.yaml`)
The stack is declaratively provisioned via the included [`render.yaml`](file:///Users/hitarthshah/Downloads/lab6_submission/render.yaml) blueprint:

```yaml
services:
  - type: web
    name: campusconnect-api-gateway
    env: docker
    dockerfilePath: ./api-gateway/Dockerfile
    dockerContext: ./api-gateway
    plan: free
    envVars:
      - key: PORT
        value: 8080
      - key: USER_SERVICE_URL
        fromService:
          type: web
          name: campusconnect-user-service
          property: host
      - key: PRODUCT_SERVICE_URL
        fromService:
          type: web
          name: campusconnect-product-service
          property: host
      - key: ORDER_SERVICE_URL
        fromService:
          type: web
          name: campusconnect-order-service
          property: host
```

### Environment Variables Configuration
For cloud deployments, the microservices receive their connection strings dynamically:
- `MONGO_URI`: `mongodb+srv://<admin>:<password>@cluster0.mongodb.net/campus_users?retryWrites=true&w=majority`
- `USER_SERVICE_URL`: Internal private service hostname or Render internal host
- `PRODUCT_SERVICE_URL`: Internal private service hostname or Render internal host
- `ORDER_SERVICE_URL`: Internal private service hostname or Render internal host

### Live Public Endpoint Testing
When deploying to cloud, the automated test suite works interchangeably by supplying the cloud URL:

```bash
./test_gateway.sh https://campusconnect-gateway.onrender.com
```

---

## 7. Automated Verification & Test Execution

### Running the Local Verification Suite (`test_gateway.sh`)
The automated verification script executes an exhaustive 15-point check verifying port isolation, health check status, proxy routing across all services, cross-service order placement, and 502 resilience:

```bash
./test_gateway.sh
```

**Execution Results:**
```text
================================================================================
     CampusConnect Lab 7: API Gateway & Service Discovery Verification         
================================================================================
Target Gateway Base URL: http://localhost:8080

--- Step 1: External Port Isolation Verification ---
>> Test: Port 3001 (User Service) Blocked Directly from Host
   Expected Status: BLOCKED | Actual Status: BLOCKED
   ✓ PASSED
>> Test: Port 3002 (Product Service) Blocked Directly from Host
   Expected Status: BLOCKED | Actual Status: BLOCKED
   ✓ PASSED
>> Test: Port 3003 (Order Service) Blocked Directly from Host
   Expected Status: BLOCKED | Actual Status: BLOCKED
   ✓ PASSED

--- Step 2: Gateway Health Check & Service Registry ---
>> Test: GET /health (API Gateway Status & Active Service Discovery Registry)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED

--- Step 3: Gateway Unmatched Route Handling ---
>> Test: GET /unknown-service-path (Gateway Centralized 404 Fallback)
   Expected Status: 404 | Actual Status: 404
   ✓ PASSED

--- Step 4: User Service Routing via Gateway ---
>> Test: GET /users (List All Users via Gateway)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED
>> Test: GET /users/101 (Get User 101 via Gateway)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED
>> Test: POST /users (Create New User via Gateway)
   Expected Status: 201 | Actual Status: 201
   ✓ PASSED

--- Step 5: Product Service Routing via Gateway ---
>> Test: GET /products (List All Products via Gateway)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED
>> Test: GET /products/501 (Get Product 501 via Gateway)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED

--- Step 6: Order Service Routing & Inter-Service Transaction Flow ---
>> Test: POST /orders (Gateway -> Order Service -> User & Product Services -> DB)
   Expected Status: 201 | Actual Status: 201
   ✓ PASSED
>> Test: GET /orders (List All Verified Orders via Gateway)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED
>> Test: POST /orders with Invalid User (404 Domain Validation via Gateway)
   Expected Status: 404 | Actual Status: 404
   ✓ PASSED

--- Step 7: Gateway Centralized Error Handling & Resilience (502 Bad Gateway) ---
Stopping user-service container to simulate service crash...
>> Test: GET /users when User Service is down (502 Bad Gateway Expected)
   Expected Status: 502 | Actual Status: 502
   ✓ PASSED
Restarting user-service container...
>> Test: GET /users after Service Recovery (200 OK Expected)
   Expected Status: 200 | Actual Status: 200
   ✓ PASSED

================================================================================
Verification Summary: 15 Passed | 0 Failed
================================================================================
✓ All Lab 7 API Gateway & Service Discovery tests completed successfully!
```

---

## 8. Postman Collection Guide

The complete Lab 7 test suite is located in [`postman/Microservices_Lab_7.postman_collection.json`](file:///Users/hitarthshah/Downloads/lab6_submission/postman/Microservices_Lab_7.postman_collection.json).

### Steps to Import and Execute:
1. Open Postman $\rightarrow$ Click **Import** $\rightarrow$ Select `Microservices_Lab_7.postman_collection.json`.
2. The collection defines a collection variable `baseUrl`:
   - Default for local development: `http://localhost:8080`
   - For cloud testing: update `baseUrl` to your cloud URL (e.g. `https://campusconnect-gateway.onrender.com`).
3. Click **Run Collection** to automatically execute all health checks, routed microservice calls, order orchestrations, and resilience checks.

---

## 9. Troubleshooting Guide

| Issue | Root Cause | Resolution |
|:---|:---|:---|
| `502 Bad Gateway` on `/users` | `user-service` container is offline or restarting | Verify container status with `docker ps`. Inspect logs via `docker logs user-service`. |
| Direct calls to `:3001` fail with `Connection refused` | Expected security behavior in Lab 7 | All traffic must be directed through the Gateway at `http://localhost:8080/users`. |
| POST / PUT request hangs through proxy | Request body buffer consumed prior to proxy stream | Verify `fixRequestBody` is bound to the `on: { proxyReq }` lifecycle hook in `api-gateway/src/proxy.js`. |
| Service routing to wrong container | Environment variable misconfigured | Check `.env` or container env vars. Ensure `USER_SERVICE_URL=http://user-service:3001`. |
| MongoDB Atlas authentication error in Cloud | Network access IP restriction or malformed URI | Ensure MongoDB Atlas Network Access has `0.0.0.0/0` whitelisted for dynamic cloud container IPs. |

---

## 10. Written Reflection (5–8 Lines)

> Implementing the API Gateway and cloud deployment fundamentally transformed our architecture from a loose collection of exposed containers into a cohesive, production-grade distributed system. In Lab 6, clients were tightly coupled to individual microservice ports (`:3001`, `:3002`, `:3003`), forcing callers to manage network topology and leaving internal services vulnerable to direct internet exposure. By introducing the API Gateway as the sole entry point, we established strict network encapsulation where backend microservices reside safely in a private bridge network. Configuration-based service discovery decoupled our code from static infrastructure, allowing service endpoints to change across local and cloud environments through environment variables alone. Furthermore, centralizing structured logging and 502/503 error handling at the gateway eliminated repetitive boilerplate, significantly improving operational observability, fault isolation, and developer experience.

---

## 11. Final Submission Checklist

- [x] **`api-gateway` Service Created:** Developed in Express.js + `http-proxy-middleware` with zero business logic.
- [x] **Path Routing:** Routed `/users/*` $\rightarrow$ User Service, `/products/*` $\rightarrow$ Product Service, `/orders/*` $\rightarrow$ Order Service.
- [x] **Gateway Health Check:** Implemented `GET /health` exposing uptime, port, and dynamic service registry.
- [x] **Request Logging:** Added structured gateway logging (Method, Path, Target Service, Status, Latency).
- [x] **Centralized 502/503 Error Handling:** Added interceptor returning standard JSON error when microservices are unreachable.
- [x] **Port Isolation in Compose:** Exposing only port `8080` externally; microservice ports `3001`, `3002`, `3003` are internal only.
- [x] **Configuration-Based Service Discovery:** Defined registry via environment variables (`USER_SERVICE_URL`, etc.).
- [x] **Config Change Proven:** Validated endpoint modification without code changes via `demo_service_discovery_config.sh`.
- [x] **Cloud Deployment Artifacts:** Created `render.yaml` infrastructure-as-code blueprint and cloud instructions.
- [x] **Postman Collection:** Created updated `postman/Microservices_Lab_7.postman_collection.json`.
- [x] **Comprehensive Documentation:** Updated `README.md` with architecture diagram, discussion answers, and reflection.
