const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus
} = require('@discordjs/voice');
const path = require('path');

require('dotenv').config();
const TOKEN = process.env.TOKEN;

// Создание клиента с нужными интентами
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers // Чтобы бот видел роли
    ]
});


client.once('ready', () => {
    console.log(`✅ Бот запущен как ${client.user.tag}`);
});

// Когда кто-то заходит в голосовой канал
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Если это вход в канал
    if (!oldState.channel && newState.channel) {
        const member = newState.member;
        const channel = newState.channel;

        // Пропускаем, если это бот
        if (member.user.bot) return;

        // Привязка ролей к файлам
        const roleAudioMap = {
            'Мікола': 'kolya.mp3',
            'Бодя': 'bodya.mp3',
            'Егор': 'egor.mp3',
            'Славік': 'slavik.mp3',
            'Вадік': 'vadik.mp3',
            'Діма': 'dima.mp3',
            'Даня': 'danya.mp3',
        };

        let audioFile = null;

        for (const [roleName, fileName] of Object.entries(roleAudioMap)) {
            if (member.roles.cache.some(role => role.name === roleName)) {
                audioFile = fileName;
                break;
            }
        }

        if (!audioFile) {
            console.log(`❌ ${member.user.tag} — нет подходящей роли`);
            return;
        }

        const filePath = path.join(__dirname, 'mp3', audioFile);

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(filePath);
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

// Обработка необработанных ошибок
process.on('unhandledRejection', err => {
    console.error('❗ Необработанная ошибка:', err);
});

// Запуск
client.login(TOKEN);
