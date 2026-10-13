export default {
    name: 'profile',
    command: ['profile'],
    category: 'umum',
    desc: 'Lihat profil kamu',
    async run({ sock, remoteJid, mek, reply, react, pushName, senderJid, cleanSenderJid, senderLid, isOwner, checkGroupAdmin }) {
        await react('🕦');
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(senderJid, 'image');
        } catch {
            ppUrl = 'https://i.ibb.co/1Z2x32S/avatar-placeholder.png';
        }

        let isSenderAdmin = false;
        try {
            ({ isSenderAdmin } = await checkGroupAdmin());
        } catch (e) {
            console.error('checkGroupAdmin gagal:', e);
        }

        const statusUser = isOwner ? 'Pengasuh Bot (Owner)' : (isSenderAdmin ? 'Penjaga Grup (Admin)' : 'Anggota');
        const lidTampil = senderLid || (String(senderJid || '').endsWith('@lid') ? senderJid : 'Tidak terdeteksi');
        const profileText = `*PROFIL PENGELANA*\n\n` +
                            `• Nama: ${pushName || 'Pengelana'}\n` +
                            `• Nomor: ${cleanSenderJid}\n` +
                            `• Status: ${statusUser}\n` +
                            `• LID: ${lidTampil}\n` +
                            `• Remote JID: ${remoteJid}`;

        await sock.sendMessage(remoteJid, { image: { url: ppUrl }, caption: profileText }, { quoted: mek });
        await react('✅');
    }
};
