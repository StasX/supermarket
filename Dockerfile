FROM node:22-bookworm-slim AS dependencies

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# The app uses bcrypt-nodejs; the unused legacy native bcrypt build is skipped.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend/package.json ./

COPY backend/src ./src
COPY frontend/src /app/frontend/src
RUN mkdir -p /app/keys && chown node:node /app/keys

USER node
EXPOSE 3000
CMD ["node", "src/app-entrypoint.cjs"]
