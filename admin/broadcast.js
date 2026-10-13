export default {
    name: 'broadcast',
    command: ['broadcast', 'bc'],
    category: 'owner',
    desc: 'Kirim pesan ke semua grup: bc <teks>',
    owner: true,
    async run({ sock, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Masukkan teks broadcast!');
        }
        await react('🕦');
        const bcText = args.join(' ');
        const allGroups = await sock.groupFetchAllParticipating();
        for (const id of Object.keys(allGroups)) {
            await sock.sendMessage(id, { text: `*PESAN OWNER*\n\n${bcText}` }).catch(() => {});
        }
        await reply('Broadcast berhasil dikirim ke semua grup.');
        await react('✅');
    }
};
