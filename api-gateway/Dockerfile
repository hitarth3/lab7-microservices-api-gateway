# ==============================================================================
# CampusConnect API Gateway Dockerfile (Port 8080)
# ==============================================================================
FROM node:20-slim

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose API Gateway external port
EXPOSE 8080

# Environment variable defaults
ENV PORT=8080
ENV NODE_ENV=production

# Start the API Gateway
CMD ["node", "server.js"]
