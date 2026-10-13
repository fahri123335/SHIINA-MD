import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@sairidev/baileys-new';
import { loadPlugins, registry } from '../lib/plugins.js';
import { reviewPlugin, verdictLabel } from '../lib/review.js';
import { aiRouter } from '../lib/config.js';

// =====================================================================
//  addplugin / delplugin  —  tambah & hapus plugin lewat chat (khusus owner)
//    addplugin <nama>            (balas pesan berisi kode, atau balas file .js)
//    addplugin <nama> <kode...>  (kode ditulis langsung setelah nama)
//    addplugin <nama> timpa      (ganti plugin yang sudah ada)
//    addplugin <nama> paksa      (pasang walau pemeriksa AI menolak / tidak bisa dihubungi)
//    delplugin                   (lihat daftar plugin)
//    delplugin <nama>            (hapus plugin; nama = nama file atau salah satu perintahnya,
//                                 cadangan disimpan di plugin/_hapus/)
//  Plugin baru dicek dulu: sintaks, lalu ditinjau AI (lihat lib/review.js), dan harus bisa dimuat.
//  Kalau gagal, perubahan dibatalkan otomatis.
// =====================================================================

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const TRASH_DIR = path.join(PLUGIN_DIR, '_hapus');
const PROTECTED = new Set(['manager', 'reload']); // supaya owner tidak mengunci diri sendiri
const NAME_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;
const MAX_BYTES = 200 * 1024;

const unwrap = (m) => m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.ephemeralMessage?.message || m;
const stripFences = (code) => code.replace(/^\s*```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '');

// Ambil kode: dari file .js yang dibalas, teks yang dibalas, atau teks setelah nama
async function getCode(msg, inline) {
    const q = unwrap(msg?.extendedTextMessage?.contextInfo?.quotedMessage);
    if (q?.documentMessage) {
        const stream = await downloadContentFromMessage(q.documentMessage, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length > MAX_BYTES) throw new Error('File terlalu besar (maks 200 KB).');
        }
        return buffer.toString('utf8');
    }
    const quotedText = q?.conversation || q?.extendedTextMessage?.text;
    return quotedText || inline || '';
}

// Cek sintaks sebagai ES module (selalu .mjs supaya tidak tergantung package.json)
function checkSyntax(code) {
    const tmp = path.join(os.tmpdir(), `plugin-check-${Date.now()}.mjs`);
    fs.writeFileSync(tmp, code);
    try {
        const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
        if (r.status === 0) return null;
        const lines = String(r.stderr || '').split('\n').filter(l => l.trim() && !l.includes(tmp));
        return lines.slice(0, 4).join('\n') || 'sintaks tidak valid';
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}

async function addPlugin({ body, msg, reply, react }) {
    // nama = kata kedua pesan (dipisah spasi ATAU baris baru)
    const name = String(body.trim().split(/\s+/)[1] || '').toLowerCase().replace(/\.js$/, '');
    if (!name) {
        return reply('*ADD PLUGIN*\n\n• balas pesan/file berisi kode: *addplugin <nama>*\n• atau tulis kode setelah nama: *addplugin <nama> <kode>*\n• ganti yang sudah ada: tambahkan kata *timpa*\n• lewati penolakan pemeriksa AI: tambahkan kata *paksa*\n\nKode harus berisi *export default { ... }* dan akan ditinjau AI sebelum dipasang.');
    }
    if (!NAME_RE.test(name)) {
        await react('⛔');
        return reply('Nama plugin tidak valid. Pakai huruf kecil, angka, - atau _ (2-30 karakter), tidak diawali simbol.\nContoh: *halo*, *cek-ping*');
    }

    // teks setelah "<perintah> <nama>" dengan baris baru & spasi dipertahankan
    let rest = body.trim().replace(/^\S+\s+\S+[ \t]*/, '');
    let force = false, skipAi = false;
    for (;;) {
        const m = rest.match(/^(timpa|force|-f|paksa|-p)(?=\s|$)[ \t]*/i);
        if (!m) break;
        if (/^(paksa|-p)$/i.test(m[1])) skipAi = true; else force = true;
        rest = rest.slice(m[0].length);
    }

    await react('🕦');
    let code;
    try {
        code = stripFences(await getCode(msg, rest)).trim();
    } catch (e) {
        await react('⛔');
        return reply(`Gagal membaca kode: ${e.message}`);
    }
    if (Buffer.byteLength(code) > MAX_BYTES) {
        await react('⛔');
        return reply('Kode terlalu besar (maks 200 KB).');
    }
    if (!code) {
        await react('⛔');
        return reply('Kodenya tidak ditemukan. Balas pesan/file berisi kode, atau tulis kode setelah nama plugin.');
    }
    if (!/export\s+default/.test(code)) {
        await react('⛔');
        return reply('Kode harus memuat *export default { command: [...], async run(ctx) { ... } }*.');
    }

    const syntaxError = checkSyntax(code);
    if (syntaxError) {
        await react('⛔');
        return reply(`Sintaks kode salah, plugin tidak disimpan:\n\n${syntaxError}`);
    }

    const file = path.join(PLUGIN_DIR, `${name}.js`);
    const existed = fs.existsSync(file);
    if (existed && !force) {
        await react('⛔');
        return reply(`Plugin *${name}* sudah ada. Tambahkan kata *timpa* untuk menggantinya:\n*addplugin ${name} timpa*`);
    }
    if (existed && PROTECTED.has(name)) {
        await react('⛔');
        return reply(`Plugin *${name}* dilindungi dan tidak bisa diganti lewat chat.`);
    }

    // ---- tinjauan AI (9router) + pindai lokal ----
    await reply(`🔍 Memeriksa kode dengan AI (${aiRouter.model})...`);
    const review = await reviewPlugin(name, code);
    const notes = review.issues.length ? '\n' + review.issues.map(i => `• ${i}`).join('\n') : '';

    if (!review.aiOk && !skipAi) {
        await react('⛔');
        return reply(`Pemeriksa AI tidak bisa dipakai: ${review.error}.\nPlugin *tidak* dipasang.\nTambahkan kata *paksa* untuk memasang tanpa pemeriksaan AI:\n*addplugin ${name} paksa*${notes ? `\n\nHasil pindai lokal:${notes}` : ''}`);
    }
    if (review.verdict === 'danger' && !skipAi) {
        await react('⛔');
        return reply(`🔍 *Hasil pemeriksaan: ${verdictLabel.danger}*${review.summary ? `\n${review.summary}` : ''}${notes}\n\nPlugin *tidak* dipasang. Kalau kamu yakin aman, ulangi dengan kata *paksa*:\n*addplugin ${name} paksa*`);
    }

    const previous = existed ? fs.readFileSync(file, 'utf8') : null;
    fs.writeFileSync(file, code + '\n');

    const info = await loadPlugins(true);
    const loadError = info.errors.find(e => e.startsWith(`${name}.js:`));
    if (loadError) {
        // batalkan: kembalikan versi lama atau hapus file baru
        if (previous !== null) fs.writeFileSync(file, previous); else fs.rmSync(file, { force: true });
        await loadPlugins(true);
        await react('⛔');
        return reply(`Plugin gagal dimuat, perubahan dibatalkan:\n\n${loadError}`);
    }

    const plugin = registry.plugins.find(p => p.file === `${name}.js`);
    const cmds = [...registry.commands].filter(([, p]) => p === plugin).map(([c]) => c);
    const reviewLine = skipAi && (!review.aiOk || review.verdict === 'danger')
        ? `\n\n⚠️ Dipasang dengan *paksa* (${review.aiOk ? verdictLabel[review.verdict] : 'tanpa pemeriksaan AI'}).${notes}`
        : review.verdict === 'safe'
            ? `\n\n🔍 Pemeriksaan AI: ${verdictLabel.safe}${review.summary ? ` — ${review.summary}` : ''}${notes}`
            : `\n\n🔍 *Hasil pemeriksaan: ${verdictLabel[review.verdict]}*${review.summary ? `\n${review.summary}` : ''}${notes}`;
    await react('✅');
    await reply(`Plugin *${name}* ${existed ? 'diganti' : 'ditambahkan'} dan langsung aktif.${cmds.length ? `\nPerintah: ${cmds.join(', ')}` : ''}${reviewLine}`);
}

async function delPlugin({ args, reply, react }) {
    let name = String(args[0] || '').toLowerCase().replace(/\.js$/, '');

    if (!name) {
        const list = registry.plugins
            .map(p => `• ${p.file.replace(/\.js$/, '')}${p.name !== p.file.replace(/\.js$/, '') ? ` (${p.name})` : ''}`)
            .sort();
        return reply(`*DAFTAR PLUGIN (${list.length})*\n\n${list.join('\n')}\n\nHapus: *delplugin <nama>*`);
    }
    if (!NAME_RE.test(name)) {
        await react('⛔');
        return reply('Nama plugin tidak valid.');
    }
    // bukan nama file? coba cocokkan dengan nama perintah (mis. bratvid -> brat)
    if (!fs.existsSync(path.join(PLUGIN_DIR, `${name}.js`))) {
        const viaCommand = registry.commands.get(name)?.file;
        if (viaCommand) name = viaCommand.replace(/\.js$/, '');
    }
    if (PROTECTED.has(name)) {
        await react('⛔');
        return reply(`Plugin *${name}* dilindungi dan tidak bisa dihapus lewat chat.`);
    }

    const file = path.join(PLUGIN_DIR, `${name}.js`);
    if (!fs.existsSync(file)) {
        await react('⛔');
        return reply(`Plugin *${name}* tidak ditemukan. Ketik *delplugin* untuk melihat daftar.`);
    }

    // simpan cadangan sebelum dihapus
    fs.mkdirSync(TRASH_DIR, { recursive: true });
    const backup = `${name}-${Date.now()}.js`;
    fs.copyFileSync(file, path.join(TRASH_DIR, backup));
    fs.rmSync(file);

    const info = await loadPlugins(true);
    await react('✅');
    await reply(`Plugin *${name}* dihapus (cadangan: plugin/_hapus/${backup}).\nSekarang ${info.plugins} plugin aktif.`);
}

export default {
    name: 'manager',
    command: ['addplugin', 'delplugin'],
    category: 'owner',
    desc: 'Tambah / hapus plugin lewat chat',
    owner: true,
    async run(ctx) {
        if (ctx.command === 'addplugin') return addPlugin(ctx);
        return delPlugin(ctx);
    }
};
