export default {
    name: 'setbot',
    command: ['setbot'],
    category: 'owner',
    desc: 'Ubah nama bot: setbot <nama baru>',
    owner: true,
    async run({ sock, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Masukkan nama baru untuk bot!');
        }
        await react('🕦');
        const newName = args.join(' ');
        await sock.updateProfileName(newName);
        await reply(`Berhasil mengubah nama bot menjadi: ${newName}`);
        await react('✅');
    }
};
