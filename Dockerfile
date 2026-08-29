# Stage 1: Build & Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Install standard build essentials if native dependencies require compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Stage 2: Production Execution
FROM node:18-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy application source and required assets
COPY --from=builder /app/src ./src
# Copy scripts or docs if rag ingestion is triggered in container
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["npm", "start"]