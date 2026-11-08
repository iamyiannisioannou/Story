FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV DATA_DIR=/data HOST=0.0.0.0 PORT=3001
VOLUME /data
EXPOSE 3001
CMD ["node", "server/index.js"]
