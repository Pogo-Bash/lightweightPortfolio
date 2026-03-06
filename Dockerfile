# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY astro.config.mjs tsconfig.json tailwind.config.mjs vitest.config.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Stage 2: Build API
FROM oven/bun:1-alpine AS api-build
WORKDIR /app
COPY api/package.json ./
RUN bun install --production
COPY api/src/ ./src/

# Stage 3: Final image - nginx serves frontend, API runs via Bun
FROM nginx:alpine AS production
RUN apk add --no-cache supervisor

# Copy built frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy API
COPY --from=api-build /app /opt/api
COPY --from=api-build /usr/local/bin/bun /usr/local/bin/bun

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Supervisor config to run both nginx and API
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create data directory for SQLite
RUN mkdir -p /opt/api/data

# Entrypoint script patches nginx port then starts supervisord
COPY docker-entrypoint-override.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 80

CMD ["/usr/local/bin/start.sh"]
