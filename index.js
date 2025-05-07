// index.js
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const AUTO_DELETE_CHANNEL_ID = '1369413651416748104';
const DELETE_INTERVAL_MS = 60 * 60 * 1000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('addvoice')
        .setDescription('🎧 Прив\'язати звук до своєї ролі')
        .addStringOption(option =>
            option.setName('роль')
                .setDescription('Назва ролі, до якої прив\'язати звук')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('файл')
                .setDescription('Аудіофайл (.mp3 або .ogg)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('clean')
        .setDescription('🧹 Очистити останні повідомлення')
        .addIntegerOption(option =>
            option.setName('кількість')
                .setDescription('Скільки повідомлень видалити (1–100)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('removevoice')
        .setDescription('❌ Видалити прив\'язаний аудіофайл для ролі')
        .addStringOption(option =>
            option.setName('роль')
                .setDescription('Назва ролі, для якої видалити звук')
                .setRequired(true)
        ),

].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`✅ Бот запущено як ${client.user.tag}`);

    // Перевіряємо наявність директорії mp3, якщо немає - створюємо
    const mp3Dir = path.join(__dirname, 'mp3');
    if (!fs.existsSync(mp3Dir)) {
        fs.mkdirSync(mp3Dir, { recursive: true });
        console.log('📁 Створено директорію для аудіофайлів');
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands } // ← твій масив команд
        );
        console.log('📌 Slash-команди зареєстровані');
    } catch (err) {
        console.error('❌ Помилка реєстрації команд:', err);
    }

    // Функція для автоматичного видалення старих повідомлень
    const autoDeleteMessages = async () => {
        try {
            const channel = await client.channels.fetch(AUTO_DELETE_CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                console.warn('⚠️ Канал для автовидалення не знайдено або він не є текстовим');
                return;
            }
            
            console.log(`🕒 Запуск перевірки старих повідомлень у каналі #${channel.name}`);
            
            // Отримуємо останні 100 повідомлень
            const messages = await channel.messages.fetch({ limit: 100 });
            const now = Date.now();
            const oldMessages = [];
            
            // Збираємо старі повідомлення
            messages.forEach(msg => {
                const age = now - msg.createdTimestamp;
                // Видаляємо повідомлення старші 24 годин
                if (age > 24 * 60 * 60 * 1000) {
                    oldMessages.push(msg);
                }
            });
            
            if (oldMessages.length > 0) {
                console.log(`🧹 Видаляю ${oldMessages.length} старих повідомлень...`);
                
                // Видаляємо повідомлення по одному, щоб уникнути помилок
                for (const msg of oldMessages) {
                    await msg.delete().catch(err => 
                        console.error(`❌ Помилка видалення повідомлення ${msg.id}:`, err.message)
                    );
                    // Короткий таймаут, щоб уникнути обмежень rate limit API Discord
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                console.log(`✅ Видалено ${oldMessages.length} повідомлень з каналу #${channel.name}`);
            } else {
                console.log(`✅ Немає старих повідомлень для видалення в каналі #${channel.name}`);
            }
        } catch (err) {
            console.error('❗ Помилка при автоочистці:', err);
        }
    };
    
    // Запускаємо автовидалення за розкладом
    setInterval(autoDeleteMessages, DELETE_INTERVAL_MS);
    
    // Також запускаємо перший раз одразу після запуску бота (через 1 хвилину)
    setTimeout(autoDeleteMessages, 60 * 1000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Користувач приєднався до голосового каналу
    if (!oldState.channel && newState.channel) {
        const member = newState.member;
        
        // Ігноруємо ботів
        if (member.user.bot) return;

        try {
            // Оновлюємо інформацію про користувача
            await member.fetch();
            
            // Шукаємо аудіофайл для ролей користувача
            let audioFile = null;
            let roleName = null;

            // Директорія з аудіофайлами
            const mp3Dir = path.join(__dirname, 'mp3');
            
            // Перевіряємо наявність директорії
            if (!fs.existsSync(mp3Dir)) {
                console.warn('⚠️ Директорія з аудіофайлами не існує');
                return;
            }

            // Перебираємо всі ролі користувача
            for (const role of member.roles.cache.values()) {
                const mp3Path = path.join(mp3Dir, `${role.name}.mp3`);
                const oggPath = path.join(mp3Dir, `${role.name}.ogg`);

                if (fs.existsSync(mp3Path)) {
                    audioFile = mp3Path;
                    roleName = role.name;
                    break;
                } else if (fs.existsSync(oggPath)) {
                    audioFile = oggPath;
                    roleName = role.name;
                    break;
                }
            }

            // Якщо не знайдено аудіофайл для жодної з ролей
            if (!audioFile) return;
            
            console.log(`🔊 Відтворюю звук для ролі "${roleName}" користувачу ${member.user.tag}`);

            // Підключаємося до голосового каналу
            const connection = joinVoiceChannel({
                channelId: newState.channel.id,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            // Створюємо аудіоплеєр і ресурс
            const player = createAudioPlayer();
            const resource = createAudioResource(audioFile);
            
            // Обробка помилок при відтворенні
            player.on('error', error => {
                console.error(`❌ Помилка аудіоплеєра для ${member.user.tag}:`, error);
                connection.destroy();
            });
            
            // Відтворюємо звук
            player.play(resource);
            connection.subscribe(player);

            // Відключаємося, коли звук закінчиться
            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`✅ Звук відтворено для користувача ${member.user.tag}`);
                connection.destroy();
            });
            
            // Встановлюємо таймаут на випадок, якщо щось пішло не так
            setTimeout(() => {
                if (connection.state.status !== 'destroyed') {
                    console.log(`⚠️ Таймаут з'єднання для ${member.user.tag}`);
                    connection.destroy();
                }
            }, 30000); // 30 секунд максимального часу відтворення
            
        } catch (err) {
            console.error(`❗ Помилка відтворення звуку для ${member.user.tag}:`, err);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();
    if (content === '!help' || content === '!info') {
        return message.reply(`
📢 **Voice Role Bot — справка**

🔊 Бот програє звук при вході в голосовий канал, якщо у тебе є відповідна роль.

🎧 **Команда:**
\`/addvoice <назва_ролі> + аудіофайл\`

🧼 **Очищення чату:**
\`/clean кількість: 50\`

🔒 Тільки ти можеш змінювати звук для своїх ролей.
✉️ Напиши / щоб побачити всі доступні Slash-команди.
        `);
    }
});

// ========== ОБРОБКА КОМАНД ==========
client.on('interactionCreate', async interaction => {
    // Перевіряємо, чи це slash-команда
    if (!interaction.isChatInputCommand()) return;

    // ========== КОМАНДА /clean ==========
    if (interaction.commandName === 'clean') {
        // Перевіряємо права користувача на видалення повідомлень
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                content: '❌ У тебе немає прав на очищення повідомлень.',
                ephemeral: true
            });
        }

        // Отримуємо кількість повідомлень для видалення з опцій команди
        let count = interaction.options.getInteger('кількість');
        
        // Обмежуємо кількість повідомлень від 1 до 100
        if (count < 1) count = 1;
        if (count > 100) count = 100;
    
        // Відкладаємо відповідь, оскільки операція може зайняти час
        await interaction.deferReply({ ephemeral: true });
    
        try {
            // Отримуємо повідомлення (максимум count+1, щоб не видаляти команду)
            const messages = await interaction.channel.messages.fetch({ limit: count + 1 });
            
            // Фільтруємо тільки ті повідомлення, які не старіші 14 днів (обмеження Discord API)
            const deletable = messages.filter(msg => 
                (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000 &&
                msg.id !== interaction.id
            ).first(count);
            
            if (deletable.length === 0) {
                return interaction.editReply('ℹ️ Немає повідомлень для видалення (всі повідомлення старіші 14 днів).');
            }
            
            // Видаляємо повідомлення пакетом
            const deleted = await interaction.channel.bulkDelete(deletable, true);
            
            // Повідомляємо про успішне видалення
            await interaction.editReply(`✅ Видалено ${deleted.size} повідомлень.`);
        } catch (err) {
            // Обробка помилок при видаленні
            console.error('❌ Помилка очищення:', err);
            await interaction.editReply('❌ Сталася помилка при очищенні. Можливо, повідомлення старіші за 14 днів.');
        }
    }
    
    // ========== КОМАНДА /addvoice ==========
    else if (interaction.commandName === 'addvoice') {
        // Отримуємо назву ролі з опцій команди
        const roleName = interaction.options.getString('роль');
        const member = interaction.member;

        // Перевіряємо, чи є у користувача вказана роль
        const targetRole = member.roles.cache.find(r => r.name === roleName);
        if (!targetRole) {
            return interaction.reply({
                content: `❌ У тебе немає ролі "${roleName}".`,
                ephemeral: true
            });
        }

        // Шукаємо прикріплений файл
        const attachment = interaction.options.getAttachment('файл');
        if (!attachment) {
            return interaction.reply({
                content: '❌ Прикріпи `.mp3` або `.ogg` файл разом із командою.',
                ephemeral: true
            });
        }
    
        // Перевіряємо розширення файлу
        const extension = path.extname(attachment.name || '').toLowerCase();
        if (!['.mp3', '.ogg'].includes(extension)) {
            return interaction.reply({
                content: '❌ Підтримуються лише `.mp3` або `.ogg` файли.',
                ephemeral: true
            });
        }
    
        // Перевіряємо розмір файлу (максимум 2 MB)
        const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
        if (attachment.size > MAX_FILE_SIZE) {
            return interaction.reply({
                content: '❌ Розмір файлу перевищує 2 MB. Будь ласка, зменшіть розмір аудіофайлу.',
                ephemeral: true
            });
        }
    
        // Відкладаємо відповідь, оскільки завантаження файлу може зайняти час
        await interaction.deferReply({ ephemeral: true });
    
        // Шлях для збереження нового файлу
        const mp3Dir = path.join(__dirname, 'mp3');
        
        // Перевіряємо наявність директорії, якщо немає - створюємо
        if (!fs.existsSync(mp3Dir)) {
            fs.mkdirSync(mp3Dir, { recursive: true });
        }
    
        // Видаляємо старі файли з цією назвою ролі, якщо вони існують
        const oldMp3 = path.join(mp3Dir, `${roleName}.mp3`);
        const oldOgg = path.join(mp3Dir, `${roleName}.ogg`);
        
        try {
            if (fs.existsSync(oldMp3)) fs.unlinkSync(oldMp3);
            if (fs.existsSync(oldOgg)) fs.unlinkSync(oldOgg);
        } catch (err) {
            console.error('❌ Помилка при видаленні старого файлу:', err);
            // Продовжуємо виконання, навіть якщо видалення не вдалося
        }
    
        const filePath = path.join(mp3Dir, `${roleName}${extension}`);
    
        try {
            // Завантажуємо файл з URL вкладення
            const response = await axios.get(attachment.url, { 
                responseType: 'arraybuffer',
                timeout: 10000 // 10 секунд на таймаут
            });
            
            // Записуємо файл синхронно для уникнення колбеків
            fs.writeFileSync(filePath, Buffer.from(response.data));
            
            // Повідомляємо про успіх
            await interaction.editReply(`✅ Аудіо для ролі **${roleName}** успішно оновлено!`);
            
        } catch (err) {
            console.error('❌ Помилка завантаження/запису файлу:', err);
            await interaction.editReply({
                content: '❌ Не вдалося завантажити або зберегти файл. Спробуйте ще раз пізніше.',
            });
        }
    }
    
    else if (interaction.commandName === 'removevoice') {
        const roleName = interaction.options.getString('роль');
        const member = interaction.member;

        // Перевіряємо, чи користувач має роль "Майстер над Ботами" або свою власну роль
        const isMaster = member.roles.cache.some(role => role.name === 'Майстер над Ботами');

        if (!isMaster) {
            return interaction.reply({
                content: '❌ Лише користувачі з роллю **Майстер над Ботами** можуть видаляти аудіофайли.',
                ephemeral: true
            });
        }
    
        // Відкладаємо відповідь для впевненості в успішному виконанні
        await interaction.deferReply({ ephemeral: true });
        
        const mp3Dir = path.join(__dirname, 'mp3');
        
        // Перевіряємо наявність директорії mp3
        if (!fs.existsSync(mp3Dir)) {
            return interaction.editReply({
                content: `❌ Директорія з аудіофайлами не існує.`,
            });
        }
        
        const mp3Path = path.join(mp3Dir, `${roleName}.mp3`);
        const oggPath = path.join(mp3Dir, `${roleName}.ogg`);
    
        const mp3Exists = fs.existsSync(mp3Path);
        const oggExists = fs.existsSync(oggPath);
    
        if (!mp3Exists && !oggExists) {
            return interaction.editReply({
                content: `ℹ️ Для ролі **${roleName}** не знайдено жодного аудіофайлу.`,
            });
        }
    
        try {
            let deleted = false;
            
            if (mp3Exists) {
                fs.unlinkSync(mp3Path);
                deleted = true;
            }
            
            if (oggExists) {
                fs.unlinkSync(oggPath);
                deleted = true;
            }
    
            if (deleted) {
                return interaction.editReply({
                    content: `✅ Аудіо для ролі **${roleName}** успішно видалено.`,
                });
            } else {
                return interaction.editReply({
                    content: `ℹ️ Не вдалося знайти аудіофайл для ролі **${roleName}**.`,
                });
            }
        } catch (err) {
            console.error('❌ Помилка при видаленні файлу:', err);
            return interaction.editReply({
                content: '❌ Сталася помилка при видаленні файлу.',
            });
        }
    }
});

process.on('unhandledRejection', err => {
    console.error('❗ Unhandled error:', err);
});

client.login(TOKEN);