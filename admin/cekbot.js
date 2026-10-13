import os from 'os';
import { formatUptime } from '../lib/utils.js';

export default {
    name: 'cekbot',
    command: ['cekbot'],
    category: 'owner',
    desc: 'Status & uptime bot',
    owner: true,
    async run({ reply, react }) {
        await react('🕦');
        await reply(`*STATUS BOT*\n• Status: Aktif & Bugar\n• Uptime: ${formatUptime(process.uptime())}\n• OS: ${os.type()} ${os.arch()}`);
        await react('✅');
    }
};
