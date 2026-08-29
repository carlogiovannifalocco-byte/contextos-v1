FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY packages ./packages
COPY connectors ./connectors
COPY e2e/package.json ./e2e/package.json
COPY scripts ./scripts
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm ci
RUN npm run build -w @contextos/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=8 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
