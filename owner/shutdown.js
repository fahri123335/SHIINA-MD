export default {
    name: 'shutdown',
    command: ['shutdown'],
    category: 'owner',
    desc: 'Matikan bot',
    owner: true,
    async run({ reply, react }) {
        await react('🕦');
        await reply('Bot diistirahatkan...');
        await react('✅');
        setTimeout(() => process.exit(0), 1000);
    }
};
