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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ========== SLASH-КОМАНДА /clean ==========
const commands = [
    new SlashCommandBuilder()
        .setName('addvoice')
        .setDescription('🎧 Прив’язати звук до своєї ролі')
        .addStringOption(option =>
            option.setName('роль')
                .setDescription('Назва ролі, до якої прив’язати звук')
                .setRequired(true)
        )
        .toJSON(),
];

// ========== ПРИ ЗАПУСКУ ==========
const AUTO_DELETE_CHANNEL_ID = '1369413651416748104';
const DELETE_INTERVAL_MS = 60 * 60 * 1000;

client.once('ready', async () => {
    console.log(`✅ Бот запущен как ${client.user.tag}`);

    // Реєстрація Slash-команд
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('📌 Slash-команди зареєстровані');
    } catch (err) {
        console.error('❌ Помилка реєстрації команд:', err);
    }

    // Автовидалення старих повідомлень
    setInterval(async () => {
        const channel = await client.channels.fetch(AUTO_DELETE_CHANNEL_ID);
        if (!channel.isTextBased()) return;

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const now = Date.now();
            messages.forEach(msg => {
                const age = now - msg.createdTimestamp;
                if (age > 24 * 60 * 60 * 1000) {
                    msg.delete().catch(err => console.error('❌ Помилка видалення:', err));
                }
            });
        } catch (err) {
            console.error('❗ Помилка при автоочистці:', err);
        }
    }, DELETE_INTERVAL_MS);
});

// ========== ВХІД В ГОЛОСОВИЙ КАНАЛ ==========
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channel && newState.channel) {
        const member = newState.member;
        const channel = newState.channel;

        if (member.user.bot) return;
        await member.fetch();

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
            console.log(`❌ ${member.user.tag} — немає аудіо за ролями`);
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
            console.error('❗ Помилка програвання:', err);
        }
    }
});

// ========== ОБРОБКА СТАРИХ КОМАНД (!добавить) ==========
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim().toLowerCase();

    if (content === '!help' || content === '!info') {
        return message.reply(`
📢 **Voice Role Bot — справка**

🔊 Бот програє звук при вході в голосовий канал, якщо у тебе є відповідна роль.

🎧 **Команда:**
\`/addvoice <названня_ролі>\` — прикріпи .mp3 або .ogg файл, який буде програватися при вході.

📌 **Приклад:**
\`/addvoice Бодя\` + аудіофайл

🔒 Можна лише для власних ролей.
🔁 Повторне відправлення — замінює попередній звук

---

🧹 **Slash-команда очищення чату:**
\`/clean\` кількість: 50

🧼 Видаляє останні **X повідомлень** (до 100 за раз) у поточному каналі.

⚠️ Працює лише для повідомлень **не старших за 14 днів**  
🔐 Необхідні права: \`Manage Messages\`

---

✉️ Напиши `/` у чаті, щоб побачити доступні Slash-команди з підказками!

        `);
    }

    if (interaction.commandName === 'addvoice') {
        const roleName = interaction.options.getString('роль');
        const member = interaction.member;

        const targetRole = member.roles.cache.find(r => r.name === roleName);
        if (!targetRole) {
            return interaction.reply({
                content: `❌ У тебе немає ролі "${roleName}".`,
                ephemeral: true
            });
        }

        const attachment = interaction.options.getAttachment?.('файл') || interaction.attachments?.first();
        if (!attachment) {
            return interaction.reply({
                content: '❌ Прикріпи `.mp3` або `.ogg` файл разом із командою.',
                ephemeral: true
            });
        }

        const extension = path.extname(attachment.name || '').toLowerCase();
        if (!['.mp3', '.ogg'].includes(extension)) {
            return interaction.reply({
                content: '❌ Підтримуються лише `.mp3` або `.ogg` файли.',
                ephemeral: true
            });
        }

        const oldMp3 = path.join(__dirname, 'mp3', `${roleName}.mp3`);
        const oldOgg = path.join(__dirname, 'mp3', `${roleName}.ogg`);
        if (fs.existsSync(oldMp3)) fs.unlinkSync(oldMp3);
        if (fs.existsSync(oldOgg)) fs.unlinkSync(oldOgg);

        const filePath = path.join(__dirname, 'mp3', `${roleName}${extension}`);

        try {
            await interaction.deferReply({ ephemeral: true });
            const response = await axios.get(attachment.url, { responseType: 'stream' });
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                interaction.editReply(`✅ Аудіо для ролі **${roleName}** оновлено!`);
            });

            writer.on('error', err => {
                console.error('❌ Помилка запису:', err);
                interaction.editReply('❌ Не вдалося зберегти файл.');
            });
        } catch (err) {
            console.error('❌ Помилка завантаження:', err);
            interaction.reply({
                content: '❌ Не вдалося завантажити файл.',
                ephemeral: true
            });
        }
    }
});

// ========== SLASH-КОМАНДА /clean ==========
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clean') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({
                content: '❌ У тебе немає прав на очищення повідомлень.',
                ephemeral: true
            });
        }

        const count = interaction.options.getInteger('кількість');

        await interaction.deferReply({ ephemeral: true });

        let deleted = 0;
        try {
            let fetched;
            do {
                fetched = await interaction.channel.messages.fetch({ limit: 100 });
                const deletable = fetched.filter(msg => (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);

                if (deletable.size === 0) break;

                const deletedBatch = await interaction.channel.bulkDelete(deletable, true);
                deleted += deletedBatch.size;
            } while (deleted < count);

            await interaction.editReply(`✅ Видалено приблизно ${deleted} повідомлень.`);

        } catch (err) {
            console.error('❌ Помилка очищення:', err);
            await interaction.editReply('❌ Сталася помилка при очищенні.');
        }
    }
});

// ========== ПОМИЛКИ ==========
process.on('unhandledRejection', err => {
    console.error('❗ Unhandled error:', err);
});

client.login(TOKEN);
