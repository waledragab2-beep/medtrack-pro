# Single-service image: the API also serves the built web app (one URL, one container).
# Used by render.yaml and any PaaS that builds from a Dockerfile. Build context: this folder (uyt/).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web ./
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production SERVE_WEB_DIR=/app/web UPLOAD_DIR=/app/uploads TRUST_PROXY=true
WORKDIR /app
COPY --from=api /app/node_modules ./node_modules
COPY --from=api /app/dist ./dist
COPY server/package.json ./
COPY server/migrations ./migrations
COPY --from=web /web/dist ./web
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
