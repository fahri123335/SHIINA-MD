import fetch from 'node-fetch';

export default {
    name: 'fakeff',
    command: ['fakeff'],
    category: 'maker',
    desc: 'Lobby Free Fire palsu: fakeff <nama>',
    async run({ sock, remoteJid, mek, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Harap sertakan nama untuk lobby Free Fire!\nContoh: fakeff Finnx');
        }
        await react('🕦');
        const apiUrl = `https://api.jerexd.my.id/api/maker/fakelobbyff?apikey=XVsu1z4Fzd90UeD9&nama=${encodeURIComponent(args.join(' '))}`;
        try {
            const res = await fetch(apiUrl);
            const buffer = Buffer.from(await res.arrayBuffer());
            await sock.sendMessage(remoteJid, { image: buffer, mimetype: 'image/jpeg', caption: 'Proses sukses.' }, { quoted: mek });
            await react('✅');
        } catch (e) {
            console.error(e);
            await reply('Gagal memproses gambar.');
            await react('⛔');
        }
    }
};
