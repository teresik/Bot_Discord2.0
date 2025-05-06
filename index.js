const { Client, GatewayIntentBits } = require('discord.js');
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

// Создание клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const AUTO_DELETE_CHANNEL_ID = '1369413651416748104'; // Заміни на ID твого каналу
const DELETE_INTERVAL_MS = 60 * 60 * 1000; // Щогодини (1 година)

client.once('ready', () => {
    console.log(`✅ Бот запущен как ${client.user.tag}`);

    // Запускаємо інтервал для перевірки
    setInterval(async () => {
        const channel = await client.channels.fetch(AUTO_DELETE_CHANNEL_ID);
        if (!channel.isTextBased()) return;

        try {
            const messages = await channel.messages.fetch({ limit: 100 });

            const now = Date.now();
            messages.forEach(msg => {
                const age = now - msg.createdTimestamp;
                if (age > 24 * 60 * 60 * 1000) { // 24 години
                    msg.delete().catch(err => console.error('❌ Помилка видалення:', err));
                }
            });
        } catch (err) {
            console.error('❗ Помилка при автоочистці:', err);
        }
    }, DELETE_INTERVAL_MS);
});

// 🎧 Воспроизведение при входе в голосовой канал
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channel && newState.channel) {
        const member = newState.member;
        const channel = newState.channel;

        if (member.user.bot) return;

        await member.fetch(); // Загрузка ролей

        let audioFile = null;

        for (const role of member.roles.cache.values()) {
            const mp3Path = path.join(__dirname, 'mp3', `${role.name}.mp3`);
            const oggPath = path.join(__dirname, 'mp3', `${role.name}.ogg`);

            if (fs.existsSync(mp3Path)) {
                audioFile = mp3Path;
                break;
            } else if (fs.existsSync(oggPath)) {
                audioFile = oggPath;
                break;
            }
        }

        if (!audioFile) {
            console.log(`❌ ${member.user.tag} — нет аудиофайла по ролям`);
            return;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(audioFile);
            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

        } catch (err) {
            console.error('❗ Ошибка при воспроизведении:', err);
        }
    }
});

// 💬 Команда !добавить <роль> с прикреплённым файлом
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    // Показ справки
    if (content === '!help' || content === '!info') {
        return message.reply(`
📢 **Voice Role Bot — справка**

🔊 Бот проигрывает звук при заходе в голосовой канал, если у вас есть роль с привязанным аудио.

🎧 **Команда:**
\`!добавить <название_роли>\` — прикрепите .mp3 или .ogg файл, и он будет воспроизводиться, когда вы заходите в голосовой канал.

📌 **Примеры:**
\`!добавить Бодя\` + прикреплённый файл

🎵 Поддерживаются форматы: \`.mp3\`, \`.ogg\`

🔒 Можно привязывать звук **только к своим ролям**
💡 Можно заменить звук, отправив новый файл

Чтобы проверить, сработает ли — просто перезайди в голосовой канал 😎
        `);
    }

    // Команда !добавить <роль>
    if (message.content.startsWith('!добавить')) {
        const args = message.content.split(' ');
        const roleName = args.slice(1).join(' ').trim();

        if (!roleName) {
            return message.reply('❌ Укажи название роли. Пример: `!добавить Бодя`');
        }

        const member = message.member;
        const targetRole = member.roles.cache.find(r => r.name === roleName);

        if (!targetRole) {
            return message.reply(`❌ У тебя нет роли "${roleName}"`);
        }

        if (message.attachments.size === 0) {
            return message.reply('❌ Прикрепи `.mp3` или `.ogg` файл к сообщению.');
        }

        const attachment = message.attachments.first();
        const extension = path.extname(attachment.name || '').toLowerCase();

        if (!['.mp3', '.ogg'].includes(extension)) {
            return message.reply('❌ Только .mp3 или .ogg файлы поддерживаются.');
        }

        // Удаление старых файлов для роли перед сохранением нового
        const oldMp3 = path.join(__dirname, 'mp3', `${roleName}.mp3`);
        const oldOgg = path.join(__dirname, 'mp3', `${roleName}.ogg`);

        if (fs.existsSync(oldMp3)) fs.unlinkSync(oldMp3);
        if (fs.existsSync(oldOgg)) fs.unlinkSync(oldOgg);

        const filePath = path.join(__dirname, 'mp3', `${roleName}${extension}`);


        try {
            const response = await axios.get(attachment.url, { responseType: 'stream' });
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                message.reply(`✅ Аудио для роли **${roleName}** успешно обновлено!`);
            });

            writer.on('error', (err) => {
                console.error('❌ Ошибка записи файла:', err);
                message.reply('❌ Не удалось сохранить файл.');
            });
        } catch (err) {
            console.error('❌ Ошибка загрузки файла:', err);
            message.reply('❌ Не удалось загрузить файл.');
        }
    }
});

// Обработка ошибок
process.on('unhandledRejection', err => {
    console.error('❗ Необработанная ошибка:', err);
});

client.login(TOKEN);
