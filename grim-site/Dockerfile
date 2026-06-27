# syntax=docker/dockerfile:1

# ---- deps: install node_modules once, reused by dev + build ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- dev: hot-reloading Vite server (target for docker-compose.dev.yml) ----
# Source is bind-mounted at runtime; node_modules comes from this layer (kept
# alive by an anonymous volume in compose), so no source is COPYed here.
FROM deps AS dev
EXPOSE 5173
# Auth runs entirely in the browser on sql.js now — no build-time secrets.
CMD ["npm", "run", "dev"]

# ---- build: produce the static dist/ bundle ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: nginx serving the static bundle (default build target) ----
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
