# ==============================================================================
# AUTO APPLY AI — PRODUCTION DOCKERFILE (MULTI-STAGE BUILD)
# ==============================================================================

# --- STAGE 1: Build & Compilation ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and TypeScript configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# --- STAGE 2: Production Minimal Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init for proper signal forwarding and PID 1 zombie reaping
RUN apk add --no-cache dumb-init curl

# Copy dependency manifests and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create and switch to non-root user for container security
USER node

# Expose backend API port
EXPOSE 5000

# Automated container healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/health || exit 1

# Start server using dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]

