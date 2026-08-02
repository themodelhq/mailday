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
# postgresql-client gives you `psql` right in this service's Shell tab on Render,
# so you can inspect the DB without switching to the separate Postgres service.
RUN apk add --no-cache openssl postgresql-client
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Schema must be present BEFORE `prisma generate`
COPY prisma ./prisma
# `prisma` is now a runtime dependency, so --omit=dev still installs the CLI
RUN npm ci --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
