const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 🧷 ВСТАВ СЮДИ СВОЮ ССИЛКУ WEBHOOK
const webhookUrl = 'https://discord.com/api/webhooks/1369404310340894920/b8cAh0JG0EEB_L7i_dGM-18qO8nw9ZoXNM7ry6W2eTaYhtoTOobyXCJrcqHTpnqmqPMB';

// Перевірка валідності вебхука
async function checkWebhook() {
    try {
        const response = await axios.get(webhookUrl);
        if (response.status === 200) {
            console.log(`✅ Вебхук активний: ${response.data.name}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Помилка перевірки вебхука:', 
            error.response?.status === 404 
                ? 'Вебхук не знайдено (404)' 
                : error.message
        );
        return false;
    }
}

// 📂 Шлях до локального файлу з аватаром
const imagePath = path.join(__dirname, './images/bot_avatar.png'); // або .jpg, .jpeg

let dataUri = null;

// Перевіряємо чи існує файл з аватаром
if (fs.existsSync(imagePath)) {
    try {
        // 📄 Зчитуємо файл і кодуємо у base64
        const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        dataUri = `data:${mimeType};base64,${imageData}`;
        console.log('✅ Успішно завантажено аватар бота');
    } catch (err) {
        console.error('❌ Помилка при зчитуванні файлу аватара:', err.message);
    }
} else {
    console.warn('⚠️ Файл аватара не знайдено за шляхом:', imagePath);
}

// 🔁 Функція оновлення аватара і надсилання повідомлення
async function updateAvatarAndSend() {
    try {
        // 1. Оновлення аватара (якщо він доступний)
        if (dataUri) {
            await axios.patch(webhookUrl, {
                name: 'Voice Role Bot',
                avatar: dataUri,
            });
            console.log('✅ Аватар успішно оновлено.');
        } else {
            await axios.patch(webhookUrl, {
                name: 'Voice Role Bot',
            });
            console.log('ℹ️ Оновлено тільки ім\'я вебхука (аватар не доступний).');
        }

        // 2. Надсилання повідомлення
        console.log('📨 Надсилання повідомлення через вебхук...');
        const response = await axios.post(webhookUrl, {
            content: `
📢 **Інформація про ботів на сервері**

🎉 На цьому сервері діють спеціальні боти!

🔊 Один із них — **Voice Role Bot**:
Він **включає звук при вході у голосовий канал**, залежно від твоєї ролі.

ℹ️ **Як користуватись:**
Надішли в чат одну з команд:

\`!info\`
або
\`!help\`

🔈 **Прив’язати звук до своєї ролі**  
🎧 Замінити звук у будь-який момент  
🤖 Дізнатись більше про можливості

🔐 *Тільки ти сам можеш змінювати звук для своїх ролей.*

🧠 **Будь унікальним — додай свій звук уже зараз! 😉**

---

📊 **Доступні звуки на сервері:**
${(() => {
    // Спроба отримати список аудіофайлів
    try {
        const mp3Dir = path.join(__dirname, 'mp3');
        
        if (!fs.existsSync(mp3Dir)) {
            return '• *Наразі немає доступних звуків*';
        }
        
        const files = fs.readdirSync(mp3Dir);
        
        if (files.length === 0) {
            return '• *Наразі немає доступних звуків*';
        }
        
        // Отримуємо унікальні назви ролей (без розширень файлів)
        const roleNames = [...new Set(
            files
                .map(file => path.parse(file).name)
                .filter(name => name.trim().length > 0)
        )];
        
        if (roleNames.length === 0) {
            return '• *Наразі немає доступних звуків*';
        }
        
        // Форматуємо список ролей
        return roleNames
            .sort()
            .map(role => `• **${role}**`)
            .join('\n');
    } catch (err) {
        console.error('❌ Помилка читання списку звуків:', err);
        return '• *Помилка отримання списку звуків*';
    }
})()}
      `
        });
        console.log('✅ Повідомлення надіслано!');
    } catch (err) {
        console.error('❌ Помилка:', err.response?.data || err.message);
    }
}

// Перевіряємо вебхук перед надсиланням
(async () => {
    try {
        const isWebhookValid = await checkWebhook();
        if (isWebhookValid) {
            await updateAvatarAndSend();
            console.log('🚀 Задачу успішно виконано!');
        } else {
            console.error('❌ Не вдалося надіслати повідомлення: неактивний вебхук');
        }
    } catch (error) {
        console.error('❌ Помилка запуску скрипта:', error);
    }
})();
