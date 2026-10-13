import moment from 'moment-timezone';

export default {
    name: 'iqc',
    command: ['iqc'],
    category: 'maker',
    desc: 'Gambar chat iPhone gelap: iqc <teks>',
    async run({ sock, remoteJid, mek, args, reply, react }) {
        if (!args.length) {
            await react('⛔');
            return reply('Harap sertakan teks!');
        }
        await react('🕦');
        const apiUrl = `https://api.jerexd.my.id/api/maker/iqcdark?apikey=XVsu1z4Fzd90UeD9&txt=${encodeURIComponent(args.join(' '))}&timeStr=${encodeURIComponent(moment().format('HH:mm'))}`;
        await sock.sendMessage(remoteJid, { image: { url: apiUrl }, caption: 'Proses sukses.' }, { quoted: mek });
        await react('✅');
    }
};
