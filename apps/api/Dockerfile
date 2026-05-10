# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source
COPY src/ ./src/

# Copy prisma schema from shared package
COPY ../../packages/database/prisma ./prisma/ 2>/dev/null || true

# Generate prisma client
RUN npx prisma generate 2>/dev/null || true

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy prisma if needed at runtime
COPY --from=builder /app/prisma ./prisma 2>/dev/null || true

EXPOSE 3001

CMD ["node", "dist/index.js"]
