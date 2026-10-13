import crypto from 'crypto';
import { downloadContentFromMessage, generateWAMessageContent } from '@sairidev/baileys-new';

// =====================================================================
//  UPSW  —  posting status grup (swgc) ke SATU grup: grup tempat perintah diketik
//  Khusus owner dan hanya di dalam grup.
//
//    • balas gambar / video  + upsw [caption]   -> status gambar/video (caption boleh kosong)
//    • balas pesan teks      + upsw             -> status teks dari isi pesan itu
//    • kirim gambar/video dengan caption "upsw [caption]"
//    • upsw <teks>           -> status teks dari teks yang diketik
// =====================================================================

const BG_COLORS = ['#735ae5', '#1b8f6a', '#c0392b', '#2c3e50', '#e67e22', '#8e44ad', '#16a085', '#d35400'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const newId = () => '3EB0' + crypto.randomBytes(8).toString('hex').toUpperCase();
const unwrap = (m) => m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.ephemeralMessage?.message || m;

// Cari sumber status: media/teks dari pesan yang dibalas, atau media yang dikirim langsung
function findSource(msg) {
    if (msg?.imageMessage) return { kind: 'image', node: msg.imageMessage };
    if (msg?.videoMessage) return { kind: 'video', node: msg.videoMessage };

    const q = unwrap(msg?.extendedTextMessage?.contextInfo?.quotedMessage);
    if (q?.imageMessage) return { kind: 'image', node: q.imageMessage };
    if (q?.videoMessage) return { kind: 'video', node: q.videoMessage };
    const quotedText = q?.conversation || q?.extendedTextMessage?.text;
    if (quotedText) return { kind: 'text', text: quotedText };
    return null;
}

// Susun isi pesan status (diunggah sekali, dipakai ke banyak grup)
async function buildContent(sock, src, text) {
    if (src.kind === 'image' || src.kind === 'video') {
        const stream = await downloadContentFromMessage(src.node, src.kind);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return generateWAMessageContent(
            { [src.kind]: buffer, ...(text ? { caption: text } : {}) },
            { upload: sock.waUploadToServer }
        );
    }
    return generateWAMessageContent({ text: src.text }, {
        upload: sock.waUploadToServer,
        backgroundColor: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
        font: Math.floor(Math.random() * 5)
    });
}

// Kirim sebagai status grup
async function postGroupStatus(sock, groupJid, content) {
    await sock.relayMessage(groupJid, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        groupStatusMessageV2: { message: content }
    }, { messageId: newId() });
}

// Ulangi otomatis kalau kena rate-overlimit (429)
async function withRetry(fn, tries = 3) {
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        } catch (e) {
            const limited = e?.data === 429 || /rate-overlimit/i.test(e?.message || '');
            if (!limited || i === tries - 1) throw e;
            await sleep(6000 * (i + 1));
        }
    }
}

const HELP =
`📢 *UPSW — STATUS GRUP*

Posting status ke grup ini.

• balas gambar/video + *upsw [caption]*
• balas pesan teks + *upsw*
• caption boleh kosong
• *upsw <teks>* — status teks dari teks yang diketik`;

export async function handleUpsw(sock, remoteJid, mek, args, reply, { isOwner, isGroup, msg }) {
    if (!isOwner) {
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        return reply('Fitur ini khusus owner bot!');
    }
    if (!isGroup) {
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        return reply('*upsw* dipakai di dalam grup, statusnya diposting ke grup itu.');
    }

    const typed = args.join(' ').trim();
    let src = findSource(msg);

    // media + teks diketik = caption; balas pesan teks = isi status; tanpa balasan = teks diketik
    if (!src && typed) src = { kind: 'text', text: typed };
    if (!src) return reply(HELP);
    const caption = src.kind === 'text' ? '' : typed;

    await sock.sendMessage(remoteJid, { react: { text: '⏳', key: mek.key } });

    try {
        const content = await buildContent(sock, src, caption);
        await withRetry(() => postGroupStatus(sock, remoteJid, content));
        await sock.sendMessage(remoteJid, { react: { text: '✅', key: mek.key } });
        await reply('Status grup berhasil diposting.');
    } catch (e) {
        console.error('[SWGC ERROR]:', e?.message || e);
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        await reply('Gagal memposting status. Coba lagi nanti.');
    }
}

// ==================== PLUGIN ====================
export default {
    name: 'upsw',
    command: ['upsw'],
    category: 'owner',
    desc: 'Posting status grup (balas gambar/video/teks + caption opsional)',
    async run({ sock, remoteJid, mek, args, reply, isOwner, isGroup, msg }) {
        await handleUpsw(sock, remoteJid, mek, args, reply, { isOwner, isGroup, msg });
    }
};
