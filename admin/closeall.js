import { getBotIds, isParticipantAdmin, setGroupAnnounce, sleep } from '../lib/utils.js';

export default {
    name: 'closeall',
    command: ['closeall', 'openall'],
    category: 'admin',
    desc: 'Tutup / buka semua subgrup komunitas',
    group: true,
    admin: true,
    async run({ sock, remoteJid, command, reply, react }) {
        const isClose = command === 'closeall';
        await react('🕦');

        const allGroups = await sock.groupFetchAllParticipating();
        const current = allGroups[remoteJid] || await sock.groupMetadata(remoteJid);
        const communityId = current.isCommunity ? remoteJid : current.linkedParent;

        if (!communityId) {
            await react('⛔');
            return reply('Grup ini bukan bagian dari komunitas!');
        }

        const botIds = getBotIds(sock);
        const subGroups = Object.values(allGroups).filter(g =>
            g.linkedParent === communityId && !g.isCommunity && !g.isCommunityAnnounce
        );

        let berhasil = 0, dilewati = 0, gagal = 0;
        for (const g of subGroups) {
            const botAdmin = g.participants.some(p => isParticipantAdmin(p, botIds));
            if (!botAdmin) { dilewati++; continue; }
            if (isClose === !!g.announce) continue; // sudah sesuai
            try {
                await setGroupAnnounce(sock, g.id, isClose);
                berhasil++;
                await sleep(3000);
            } catch (e) {
                console.error(e);
                gagal++;
            }
        }

        await reply(
            `*${isClose ? 'TUTUP' : 'BUKA'} SEMUA SUBGRUP*\n\n` +
            `• Total subgrup: ${subGroups.length}\n` +
            `• Berhasil: ${berhasil}\n` +
            `• Dilewati (bot bukan admin): ${dilewati}\n` +
            `• Gagal: ${gagal}`
        );
        await react('✅');
    }
};
