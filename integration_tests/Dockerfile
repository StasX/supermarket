FROM node:26.13.1-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:26.13.1-bookworm-slim
# checkov:skip=CKV_DOCKER_2:One-shot test runner; its exit code reports success or failure, not a service health check.
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN chown node:node /app/backend
USER node
HEALTHCHECK NONE
CMD ["npm", "run", "test:integration"]
