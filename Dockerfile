FROM node:18

# Устанавливаем FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Создаем директорию и копируем проект
WORKDIR /app
COPY . .

# Устанавливаем зависимости
RUN npm install

# Запускаем бота
CMD ["node", "index.js"]
