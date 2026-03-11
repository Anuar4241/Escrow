# Step 1: Base & Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including dev) for building
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

COPY . .

# Build NestJS
RUN npm run build

# Step 2: Production Dependencies
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies to keep image small
RUN npm ci --omit=dev
RUN npx prisma generate

# Step 3: Production Image
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built code and prod-only modules
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/prisma ./prisma

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
