FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7010

COPY package*.json ./
RUN npm ci --omit=dev

COPY addon.js server.js ./
COPY lib ./lib
COPY data ./data

EXPOSE 7010

CMD ["node", "server.js"]
