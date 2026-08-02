# Backend Dockerfile — NestJS + Prisma
FROM node:20-alpine AS builder
# OpenSSL is required by the Prisma engine on Alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Schema must be present BEFORE `prisma generate`
COPY prisma ./prisma
# `prisma` is now a runtime dependency, so --omit=dev still installs the CLI
RUN npm ci --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 4000
# Apply pending migrations, then start the app. This runs on every container
# start (not at build time) because it needs the real runtime DATABASE_URL,
# which isn't available during `docker build`. If a migration fails, the
# container exits so Render's health check catches it instead of silently
# running against a stale schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
