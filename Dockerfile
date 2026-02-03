FROM node:18-slim
WORKDIR /app

# Копируем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем
CMD ["node", "index.js"]