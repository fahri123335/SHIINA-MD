export default {
    name: 'listmem',
    command: ['listmem'],
    category: 'admin',
    desc: 'Info grup & jumlah anggota',
    group: true,
    async run({ sock, remoteJid, reply, react }) {
        await react('🕦');
        const groupMetadata = await sock.groupMetadata(remoteJid);
        await reply(`*INFO GRUP & ANGGOTA*\n\n` +
                    `• Nama Grup: ${groupMetadata.subject}\n` +
                    `• Total Anggota: ${groupMetadata.participants.length} orang\n` +
                    `• ID Grup: ${remoteJid}\n`);
        await react('✅');
    }
};
