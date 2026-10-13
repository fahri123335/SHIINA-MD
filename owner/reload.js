import { loadPlugins } from '../lib/plugins.js';

export default {
    name: 'reload',
    command: ['reload', 'reloadplugin'],
    category: 'owner',
    desc: 'Muat ulang semua plugin tanpa restart bot',
    owner: true,
    async run({ reply, react }) {
        await react('🕦');
        const info = await loadPlugins(true);
        let teks = `*PLUGIN DIMUAT ULANG*\n\n• Plugin: ${info.plugins}\n• Perintah: ${info.commands}`;
        if (info.errors.length) teks += `\n• Gagal (${info.errors.length}):\n${info.errors.map(e => `  - ${e}`).join('\n')}`;
        teks += '\n\n_Perubahan di s.js, handler.js, handler/ atau lib/ tetap butuh restart._';
        await reply(teks);
        await react(info.errors.length ? '⚠️' : '✅');
    }
};
