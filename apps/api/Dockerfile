# Build from repository root (see docker-compose build context).
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
COPY apps/web-admin/package.json ./apps/web-admin/

COPY packages/database ./packages/database
COPY apps/api ./apps/api

RUN npm install --workspace=@comedor/database --workspace=@comedor/api

WORKDIR /app/packages/database
RUN npx prisma generate --schema=./prisma/schema.prisma

WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

COPY docker/api-entrypoint.sh /app/docker/api-entrypoint.sh
RUN chmod +x /app/docker/api-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/docker/api-entrypoint.sh"]
CMD ["node", "/app/apps/api/dist/index.js"]
