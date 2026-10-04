# ==============================================================================
# Lab 6: Product Service Dockerfile (Port 3002)
# ==============================================================================
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose Product Service internal/external port
EXPOSE 3002

# Environment variable defaults
ENV PORT=3002
ENV NODE_ENV=production

# Start the Product Service
CMD ["node", "server.js"]
