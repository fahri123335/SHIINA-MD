import fetch from 'node-fetch';

export default {
    name: 'wq',
    command: ['wq'],
    category: 'maker',
    desc: 'Gambar quote: wq <teks> | <pemisah>',
    async run({ sock, remoteJid, mek, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Harap sertakan teks dengan pemisah |!');
        }
        await react('🕦');
        const apiUrl = `https://api.zyvor.my.id/api/canvas/wmp?text=${encodeURIComponent(args.join(' '))}`;
        try {
            const res = await fetch(apiUrl);
            const buffer = Buffer.from(await res.arrayBuffer());
            await sock.sendMessage(remoteJid, { image: buffer, mimetype: 'image/png', caption: 'Proses sukses.' }, { quoted: mek });
            await react('✅');
        } catch (e) {
            console.error(e);
            await reply('Gagal memproses gambar.');
            await react('⛔');
        }
    }
};
