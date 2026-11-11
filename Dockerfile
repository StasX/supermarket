FROM node:22-bookworm-slim AS build

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /app/backend/node_modules ./node_modules
COPY backend/package.json ./

COPY --from=build /app/backend/dist ./dist
COPY frontend/src /app/frontend/src
RUN mkdir -p /app/keys && chown node:node /app/keys

USER node
EXPOSE 3000
CMD ["node", "dist/app-entrypoint.cjs"]
