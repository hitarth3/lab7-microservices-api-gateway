# ==============================================================================
# CampusConnect API Gateway Dockerfile (Port 8080)
# Supports both root repository context (Render/Cloud) and local compose builds
# ==============================================================================
FROM node:20-slim

WORKDIR /app

# Copy application package manifests from api-gateway directory
COPY api-gateway/package*.json ./
RUN npm install --omit=dev

# Copy application source code from api-gateway
COPY api-gateway/ .

# Expose API Gateway external port
EXPOSE 8080

# Environment variable defaults
ENV PORT=8080
ENV NODE_ENV=production

# Start the API Gateway
CMD ["node", "server.js"]
