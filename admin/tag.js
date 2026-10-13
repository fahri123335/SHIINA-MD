export default {
    name: 'tag',
    command: ['tag'],
    category: 'admin',
    desc: 'Panggil semua anggota grup: tag <pesan>',
    group: true,
    botAdmin: true,
    admin: true,
    async run({ sock, remoteJid, mek, args, react, checkGroupAdmin }) {
        await react('🕦');
        const { groupMetadata } = await checkGroupAdmin();
        const pesan = args.join(' ') || 'Panggilan untuk seluruh penghuni!';
        let teks = `*PANGGILAN GRUP*\n💬 Pesan: ${pesan}\n\n`;
        const members = [];
        for (const mem of groupMetadata.participants) {
            teks += `• @${mem.id.split('@')[0]}\n`;
            members.push(mem.id);
        }
        await sock.sendMessage(remoteJid, { text: teks, mentions: members }, { quoted: mek });
        await react('✅');
    }
};
