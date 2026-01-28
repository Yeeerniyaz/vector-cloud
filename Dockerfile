FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Важно: если файла базы нет, создаем пустой
RUN if [ ! -f vector_db.json ]; then echo '{"authCodes":{}, "tokens":{}, "deviceStates":{}}' > vector_db.json; fi
EXPOSE 3000
CMD ["node", "index.js"]