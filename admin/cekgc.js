export default {
    name: 'cekgc',
    command: ['cekgc'],
    category: 'owner',
    desc: 'Daftar semua grup bot',
    owner: true,
    async run({ sock, reply, react }) {
        await react('🕦');
        const allGroups = await sock.groupFetchAllParticipating();
        let teks = `*DAFTAR SEMUA GRUP (${Object.keys(allGroups).length})*\n\n`;
        let no = 1;
        for (const id of Object.keys(allGroups)) {
            teks += `${no++}. ${allGroups[id].subject} (${allGroups[id].participants.length} member)\n`;
        }
        await reply(teks);
        await react('✅');
    }
};
