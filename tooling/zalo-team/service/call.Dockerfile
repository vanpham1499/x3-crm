FROM node:22-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends libasound2t64 libpulse0 libstdc++6 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/call
COPY apps/backend/integrations/zalo/call/package*.json ./
RUN npm ci --omit=dev
RUN node --input-type=module -e "import('audify').then(m=>{new m.default.OpusDecoder(48000,1); console.log('Opus ready')})"
COPY apps/backend/integrations/zalo/call/*.mjs ./
COPY apps/backend/integrations/zalo/web/call-session.mjs /app/web/call-session.mjs
COPY apps/backend/integrations/zalo/shared /app/shared
USER node
ENV CALL_ENGINE=zrtc CALL_BIND_ADDRESS=0.0.0.0 NODE_OPTIONS=--max-old-space-size=256
CMD ["node", "audio-worker.mjs"]
