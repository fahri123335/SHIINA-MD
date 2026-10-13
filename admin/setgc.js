export default {
    name: 'setgc',
    command: ['setgc'],
    category: 'admin',
    desc: 'Ubah nama grup: setgc <nama baru>',
    group: true,
    botAdmin: true,
    admin: true,
    async run({ sock, remoteJid, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Masukkan nama baru untuk grup!');
        }
        await react('🕦');
        const newName = args.join(' ');
        await sock.groupUpdateSubject(remoteJid, newName);
        await reply(`Nama grup berhasil diubah menjadi: ${newName}`);
        await react('✅');
    }
};
