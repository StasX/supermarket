FROM node:22.22.3-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/angular.json frontend/tsconfig*.json ./
COPY frontend/src ./src
RUN npm run build

FROM node:22.22.3-bookworm-slim AS build

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22.22.3-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /app/backend/node_modules ./node_modules
COPY backend/package.json ./

COPY --from=build /app/backend/dist ./dist
COPY backend/static ./static
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/keys /app/backend/static/products/uploads && chown node:node /app/keys /app/backend/static/products/uploads

USER node
EXPOSE 3000
CMD ["node", "dist/app-entrypoint.cjs"]
