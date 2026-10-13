import fetch from 'node-fetch';

export default {
    name: 'reminder',
    command: ['reminder'],
    category: 'maker',
    desc: 'Gambar reminder: reminder <teks> | <footer>',
    async run({ sock, remoteJid, mek, args, reply, react, pushName }) {
        if (!args.length) {
            await react('⛔');
            return reply('Harap sertakan teks reminder!\nContoh: reminder cinta tulus tanpa syarat');
        }
        await react('🕦');

        const fullText = args.join(' ');
        const parts = fullText.split('|');
        const mainText = parts[0].trim();
        const footerText = parts[1] ? parts[1].trim() : (pushName || 'Pengelana');

        const apiUrl = `https://api.zyvor.my.id/api/canvas/reminder?text=${encodeURIComponent(mainText)}&footer=${encodeURIComponent(footerText)}`;
        try {
            const res = await fetch(apiUrl);
            const buffer = Buffer.from(await res.arrayBuffer());
            await sock.sendMessage(remoteJid, { image: buffer, mimetype: 'image/png', caption: 'Proses sukses.' }, { quoted: mek });
            await react('✅');
        } catch (e) {
            console.error(e);
            await reply('Gagal memproses gambar reminder.');
            await react('⛔');
        }
    }
};
