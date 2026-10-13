import fetch from 'node-fetch';
import { FormData, Blob } from 'formdata-node';

const IMGBB_API_KEY = '015ebed6829ae80b858156840fb985d0';

// Upload utama: Catbox (gratis, tanpa akun). Mengembalikan link langsung gambar.
async function uploadCatbox(buffer, mime, filename) {
    const form = new FormData();
    form.set('reqtype', 'fileupload');
    form.set('fileToUpload', new Blob([buffer], { type: mime }), filename);

    const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(45000)
    });
    const text = (await res.text()).trim();
    if (!res.ok || !/^https?:\/\//.test(text)) throw new Error('Catbox: ' + text.slice(0, 120));
    return text;
}

// Cadangan: ImgBB (dipakai kalau Catbox gagal)
async function uploadImgbb(buffer, mime, filename) {
    const form = new FormData();
    form.set('key', IMGBB_API_KEY);
    form.set('image', new Blob([buffer], { type: mime }), filename);

    const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(45000)
    });
    const json = await res.json();
    if (!json?.success || !json.data?.url) throw new Error('ImgBB: ' + JSON.stringify(json?.error || json).slice(0, 120));
    return json.data.url;
}

async function uploadGambar(buffer, mime = 'image/jpeg') {
    const ext = mime.includes('png') ? 'png' : (mime.includes('webp') ? 'webp' : 'jpg');
    const filename = 'image.' + ext;
    try {
        return await uploadCatbox(buffer, mime, filename);
    } catch (e) {
        console.error('[TOHD] Catbox gagal, coba ImgBB:', e?.message || e);
        return await uploadImgbb(buffer, mime, filename);
    }
}

export async function handleToHd(sock, remoteJid, mek, reply) {
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quoted || !quoted.imageMessage) {
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        return reply('Harap reply atau balas foto yang ingin diubah menjadi HD!');
    }

    await sock.sendMessage(remoteJid, { react: { text: '⏳', key: mek.key } });

    try {
        // 1. Download buffer gambar dari pesan yang direply
        const { downloadContentFromMessage } = await import('@sairidev/baileys-new');
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // 2. Upload gambar (Catbox, cadangan ImgBB) untuk dapat link publik
        let imageUrl;
        try {
            imageUrl = await uploadGambar(buffer, quoted.imageMessage.mimetype || 'image/jpeg');
        } catch (e) {
            console.error('[TOHD] Semua upload gagal:', e?.message || e);
            await sock.sendMessage(remoteJid, { react: { text: '❌', key: mek.key } });
            return reply('Gagal mengupload gambar. Coba lagi nanti.');
        }
        console.log('[TOHD DEBUG] Image URL:', imageUrl);

        // 3. Panggil API Upscaler Jerexd
        const apiResponse = await fetch('https://api.jerexd.my.id/api/tools/hd3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: imageUrl,
                scale: 2,
                apikey: 'XVsu1z4Fzd90UeD9'
            })
        });

        const resData = await apiResponse.json();
        console.log('[TOHD DEBUG] Respon API Upscale:', resData);

        // Ambil URL dari dalam objek result.upscaled_url atau fallback lainnya
        const hdUrl = resData.result?.upscaled_url || resData.result || resData.url || resData.data?.url;

        if (!hdUrl || typeof hdUrl !== 'string') {
            await sock.sendMessage(remoteJid, { react: { text: '❌', key: mek.key } });
            return reply('Gagal memproses gambar menjadi HD.');
        }

        console.log('[TOHD DEBUG] Final HD URL:', hdUrl);

        // 4. Kirim hasil foto HD ke WhatsApp
        await sock.sendMessage(remoteJid, { 
            image: { url: hdUrl }, 
            caption: 'Proses sukses ✅' 
        }, { quoted: mek });

        await sock.sendMessage(remoteJid, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('[TOHD ERROR]:', err);
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        return reply('Terjadi kesalahan saat memproses gambar.');
    }
}

// ==================== PLUGIN ====================
export default {
    name: 'tohd',
    command: ['tohd'],
    category: 'tools',
    desc: 'Perjelas gambar (HD)',
    async run({ sock, remoteJid, mek, reply }) {
        await handleToHd(sock, remoteJid, mek, reply);
    }
};
