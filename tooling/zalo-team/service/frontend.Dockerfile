FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared packages/shared
RUN npm ci --ignore-scripts
COPY apps/frontend apps/frontend
WORKDIR /app/apps/frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL ZALO_TEAM_RUNTIME=zalo NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app/apps/frontend
ENV NODE_ENV=production ZALO_TEAM_RUNTIME=zalo NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1024
COPY --from=build --chown=node:node /app/apps/frontend/.next/standalone /app
COPY --from=build --chown=node:node /app/apps/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/apps/frontend/public ./public
USER node
CMD ["node", "server.js"]
