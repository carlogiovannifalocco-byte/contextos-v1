FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY packages ./packages
COPY connectors ./connectors
COPY e2e/package.json ./e2e/package.json
COPY scripts ./scripts
COPY fixtures ./fixtures
# prod-start.mjs runs the API through tsx, so devDependencies must stay installed.
RUN npm ci
WORKDIR /app/packages/db
RUN npx prisma generate
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "scripts/prod-start.mjs"]
