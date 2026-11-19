FROM node:20-bullseye-slim

WORKDIR /app

# Cài đặt font emoji và DejaVu cho Canvas đồ họa
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
