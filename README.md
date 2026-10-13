<div align="center">
  <h1 align="center">✨ Shiina-MD WhatsApp Bot ✨</h1>
  <p align="center">
    <b>A Secure, Modular, and High-Performance WhatsApp Bot built on top of <a href="https://github.com/itsliaaa/baileys">@itsliaaa/baileys</a></b>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-v26+-green.svg?style=flat-square&logo=node.js" alt="Node.js Version">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square" alt="GPLv3 License">
    <img src="https://img.shields.io/badge/Protection-Bytecode%20(Enc%20v1)-orange.svg?style=flat-square" alt="Enc v1 Protection">
    <img src="https://img.shields.io/badge/Plugins-CJS%20&%20ESM-purple.svg?style=flat-square" alt="Dual Module Support">
  </p>
</div>

<br>

## 🛡️ About Project
**Shiina-MD** adalah kerangka bot WhatsApp modular tingkat lanjut yang dirancang dengan sistem perlindungan **Enc v1 (Bytecode Compilation via Bytenode)**. Inti bot (`handler`) dikunci rapat untuk mengamankan logika perutean dan alamat repository, sementara pengguna tetap diberikan kebebasan penuh untuk menginstal plugin secara dinamis dari store resmi yang terintegrasi.

---

## 🌟 Key Features
* **🔒 Enc v1 Bytecode Security:** Logika inti bot dikompilasi menjadi bytecode (`.jsc`), melindungi source code dari modifikasi tidak sah.
* **📦 Dynamic Plugin Store:** Unduh, perbarui, dan hapus plugin langsung melalui perintah WhatsApp (`plug install`, `plug dell`, `plug list`).
* **⚡ Dual Module Compatibility:** Plugin loader mendukung format **CommonJS (`module.exports`)** maupun **ES Modules (`export default`)** secara fleksibel.
* **🔑 Interactive Multi-Key Management:** Deteksi otomatis kebutuhan *API Key* dari plugin yang diinstal dengan interaksi terminal interaktif yang tersimpan rapi ke `config.txt`.

---

## 🧩 Import (ESM & CJS)

### // --- CJS (commonjs)
```javascript
const axios = require('axios');

module.exports = {
    command: ['ai', 'openai'],
    description: 'Bertanya ke AI ChatGPT',
    apiKeyProviders: ['OpenAI'], // Otomatis terdeteksi oleh terminal

    execute: async ({ sock, msg, from, fullText, loadConfig }) => {
        const config = loadConfig();
        const apiKey = config.apiKeys?.apiKey1; // Diambil sekuensial dari config.txt

        if (!apiKey) {
            await sock.sendMessage(from, { text: '❌ API Key OpenAI belum diatur!' }, { quoted: msg });
            return;
        }

        if (!fullText) {
            await sock.sendMessage(from, { text: '⚠️ Masukkan teks pertanyaan!' }, { quoted: msg });
            return;
        }

        try {
            await sock.sendMessage(from, { text: '⏳ *Memproses pertanyaan...*' }, { quoted: msg });

            const res = await axios.post('[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: fullText }]
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            const answer = res.data.choices[0].message.content;
            await sock.sendMessage(from, { text: answer }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    }
};

### // --- MODULE (module es)
```javascript
export default {
    command: ['sticker', 's', 'stiker'],
    description: 'Mengubah gambar/video menjadi stiker WhatsApp',
    
    async execute({ sock, msg, from, args, fullText, loadConfig }) {
        try {
            // Logika plugin
            await sock.sendMessage(from, { text: '🌸 Fitur stiker sedang diproses...' }, { quoted: msg });
        } catch (err) {
            // Lempar error agar ditangani oleh AI Auto-Healer Engine
            throw err;
        }
    }
};
```
