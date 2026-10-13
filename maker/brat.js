import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// brat (stiker diam) dan bratvid (stiker animasi)
async function makeBrat({ sock, remoteJid, mek, text, reply, react }, animated) {
    if (!text) {
        await react('⛔');
        return reply('Masukkan teks untuk stiker Brat!');
    }
    await react('🕦');

    try {
        const apiUrl = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}${animated ? '&isAnimated=true&delay=500' : ''}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Gagal mengambil data');
        const buffer = Buffer.from(await response.arrayBuffer());

        const tempPath = path.join(os.tmpdir(), `${uuidv4()}.webp`);
        const inputPath = path.join(os.tmpdir(), `${uuidv4()}.tmp`);
        fs.writeFileSync(inputPath, buffer);

        const cleanup = () => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        };

        const cmd = ffmpeg(inputPath);
        if (animated) cmd.inputOptions(['-ss 0']);
        cmd.outputOptions(animated
            ? ['-vcodec libwebp', '-vf scale=512:512:force_original_aspect_ratio=increase,fps=15,crop=512:512', '-loop 0', '-preset default', '-an', '-vsync 0']
            : ['-vcodec libwebp', '-vf scale=512:512:force_original_aspect_ratio=increase,crop=512:512', '-lossless 1', '-q:v 80', '-an', '-vsync 0'])
            .toFormat('webp')
            .save(tempPath)
            .on('end', async () => {
                await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(tempPath) }, { quoted: mek });
                await react('✅');
                cleanup();
            })
            .on('error', async (err) => {
                console.error(err);
                await react('⛔');
                await reply('Gagal memproses stiker Brat!');
                cleanup();
            });
    } catch (err) {
        console.error(err);
        await reply('Terjadi kesalahan!');
        await react('⛔');
    }
}

export default {
    name: 'brat',
    command: ['brat', 'bratvid'],
    category: 'maker',
    desc: 'Stiker Brat: brat <teks> / bratvid <teks> (animasi)',
    async run(ctx) {
        await makeBrat(ctx, ctx.command === 'bratvid');
    }
};
