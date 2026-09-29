# Сервер BeerVia для хостинга. Сборка запускается из папки server/.
FROM node:22-slim

# Prisma нужен openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# При каждом старте: применить новые миграции базы, загрузить каталог пива (если пуст), запустить API.
CMD ["npm", "run", "start:prod"]
