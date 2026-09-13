# Combined image for single-service hosts (e.g. Render's free Web Service tier)
# that only run one Docker container per service. Bundles the existing
# frontend (nginx) and backend (Fastify) into one container: nginx listens on
# the platform-assigned $PORT and proxies /api/ to the backend on localhost,
# exactly like frontend/nginx.conf does for the normal multi-container
# docker-compose setup. Build context must be the repo root.

FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:22-slim AS backend-builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/ .
RUN npm run build

FROM node:22-slim
WORKDIR /app
RUN apt-get update -y \
    && apt-get install -y openssl nginx gettext-base \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# Backend runtime (mirrors backend/Dockerfile's final stage)
COPY backend/package*.json ./
RUN npm ci
ENV NODE_ENV=production
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/src ./src
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p uploads

# Frontend static build, served by nginx
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

ENV PORT=10000
ENV BACKEND_PORT=3001
EXPOSE 10000
CMD ["/start.sh"]
