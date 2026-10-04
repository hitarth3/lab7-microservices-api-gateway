# ==============================================================================
# Lab 6: Order Service Dockerfile (Port 3003)
# ==============================================================================
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose Order Service internal/external port
EXPOSE 3003

# Environment variable defaults
ENV PORT=3003
ENV NODE_ENV=production
ENV USER_SERVICE_URL=http://user-service:3001
ENV PRODUCT_SERVICE_URL=http://product-service:3002

# Start the Order Service
CMD ["node", "server.js"]
