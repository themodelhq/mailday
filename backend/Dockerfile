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
CMD ["node", "dist/main.js"]
