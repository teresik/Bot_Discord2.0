const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 🧷 ВСТАВ СЮДИ СВОЮ ССИЛКУ WEBHOOK
const webhookUrl = 'https://discord.com/api/webhooks/1369404310340894920/b8cAh0JG0EEB_L7i_dGM-18qO8nw9ZoXNM7ry6W2eTaYhtoTOobyXCJrcqHTpnqmqPMB';

// 📂 Шлях до локального файлу з аватаром
const imagePath = path.join(__dirname, './images/bot_avatar.png'); // або .jpg, .jpeg

// 📄 Зчитуємо файл і кодуємо у base64
const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
const dataUri = `data:${mimeType};base64,${imageData}`;

// 🔁 Функція оновлення аватара
async function updateAvatarAndSend() {
    try {
        // 1. Оновлення аватара
        await axios.patch(webhookUrl, {
            name: 'Voice Role Bot',
            avatar: dataUri,
        });
        console.log('✅ Аватар успішно оновлено.');

        // 2. Надсилання повідомлення
        await axios.post(webhookUrl, {
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

🧹 **Очистити чат від зайвих повідомлень**
      `
        });
        console.log('✅ Повідомлення надіслано!');
    } catch (err) {
        console.error('❌ Помилка:', err.response?.data || err.message);
    }
}

updateAvatarAndSend();
