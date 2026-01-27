FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Важно: создаем пустую базу, если она не приедет из гита
RUN echo '{"clients": {}, "system_logs": []}' > vector_db.json
EXPOSE 3000
CMD ["node", "index.js"]