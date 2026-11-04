FROM node:22-alpine
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY shared shared
COPY server server
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]
