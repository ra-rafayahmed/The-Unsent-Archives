# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (see docker-compose.yml): this is an npm
# workspaces monorepo, so the single root lockfile is what `npm ci` needs.
FROM node:25-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --workspace backend

FROM node:25-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
# Workspace deps are hoisted to /app/node_modules; backend code resolves up to it.
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./backend/
USER app
WORKDIR /app/backend
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "server.js"]
