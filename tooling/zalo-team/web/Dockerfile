FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY apps/backend/integrations/zalo/web/package.json apps/backend/integrations/zalo/web/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir /data && chown pwuser:pwuser /data
COPY --chown=pwuser:pwuser apps/backend/integrations/zalo/web/*.mjs ./
USER pwuser
EXPOSE 9250
CMD ["node", "server.mjs"]
