FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY . .

RUN echo "===== SOURCE INSIDE IMAGE ====="
RUN head -n 30 /app/index.js
RUN echo "================================"

CMD ["npm", "start"]