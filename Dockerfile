# ==============================================================================
# CampusConnect API Gateway - Cloud Deployment Dockerfile (Root Context)
# ==============================================================================
FROM node:20-slim

WORKDIR /app

# Copy package manifests from api-gateway directory
COPY api-gateway/package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY api-gateway/ .

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
