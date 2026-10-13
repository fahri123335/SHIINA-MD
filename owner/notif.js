import { ownerLid } from '../lib/config.js';
import fs from 'fs';
import path from 'path';

// =====================================================================
//  NOTIF  —  ringkasan pesan baru yang masuk ke bot (khusus owner)
//  Dihitung sejak terakhir kali `notif` dibuka, tersimpan di notif.json
// =====================================================================

const FILE = path.join(process.cwd(), 'notif.json');
const SKIP = new Set([
    'protocolMessage', 'editedMessage', 'reactionMessage', 'encReactionMessage',
    'pollUpdateMessage', 'senderKeyDistributionMessage', 'messageContextInfo'
]);

let data = { chats: {} };
try {
    if (fs.existsSync(FILE)) {
        const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (saved && typeof saved.chats === 'object') data = saved;
    }
} catch (e) {
    console.error('Gagal baca notif.json:', e?.message || e);
}

let saveTimer = null;
function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try { fs.writeFileSync(FILE, JSON.stringify(data)); }
        catch (e) { console.error('Gagal simpan notif.json:', e?.message || e); }
    }, 5000);
}

const clean = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

// Panggil di awal handler messages.upsert
export function trackNotif(upsert, ownerIds = []) {
    if (upsert?.type !== 'notify') return;
    const owners = ownerIds.map(clean).filter(Boolean);
    let changed = false;

    for (const mek of upsert.messages || []) {
        if (!mek?.message || mek.key?.fromMe) continue;
        const jid = mek.key?.remoteJid;
        if (!jid || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) continue;
        if (!Object.keys(mek.message).some(k => !SKIP.has(k))) continue;

        const sender = jid.endsWith('@g.us') ? mek.key.participant : jid;
        if (owners.includes(clean(sender))) continue; // pesan owner sendiri tidak dihitung

        data.chats[jid] = (data.chats[jid] || 0) + 1;
        changed = true;
    }
    if (changed) scheduleSave();
}

export function getNotifSummary() {
    let total = 0, priv = 0, grp = 0;
    for (const [jid, n] of Object.entries(data.chats)) {
        if (!n) continue;
        total += n;
        if (jid.endsWith('@g.us')) grp++; else priv++;
    }
    return { total, priv, grp };
}

// notif        -> tampilkan ringkasan lalu tandai sudah dibaca (reset)
// notif lihat  -> tampilkan saja tanpa reset
export async function handleNotif(sock, remoteJid, mek, args, reply, { isOwner }) {
    if (!isOwner) {
        await sock.sendMessage(remoteJid, { react: { text: '⛔', key: mek.key } });
        return reply('Fitur ini khusus owner bot!');
    }

    const { total, priv, grp } = getNotifSummary();
    await reply(
`Notif
Bot :
${total} pesan terbaru di bot
${priv} chat pribadi
${grp} chat grup`);

    const peek = String(args[0] || '').toLowerCase().replace(/^-+/, '') === 'lihat';
    if (!peek) {
        data.chats = {};
        scheduleSave();
    }
}

// ==================== PLUGIN ====================
export default {
    name: 'notif',
    command: ['notif'],
    category: 'owner',
    desc: 'Ringkasan pesan baru yang masuk ke bot',
    // setiap pesan masuk dihitung untuk fitur notif
    upsert: (sock, m) => trackNotif(m, [ownerLid]),
    async run({ sock, remoteJid, mek, args, reply, isOwner }) {
        await handleNotif(sock, remoteJid, mek, args, reply, { isOwner });
    }
};
