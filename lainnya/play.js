import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { generateWAMessageFromContent } from '@sairidev/baileys-new';

const PLAY_API = process.env.PLAY_API || 'https://api.jerexd.my.id/api/downloader/play';
const PLAY_API_KEY = process.env.PLAY_API_KEY || 'XVsu1z4Fzd90UeD9';

export const isSpotifyLink = (t) => /open\.spotify\.com\/track\//i.test(t);

function buildSongUrl(query) {
    return `${PLAY_API}?apikey=${encodeURIComponent(PLAY_API_KEY)}&q=${encodeURIComponent(query)}`;
}

async function fetchJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    return res.json();
}

function pick(obj, keys) {
    for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return null;
}

function cleanTitle(raw, channel) {
    let t = String(raw || '').split('|')[0].trim();
    t = t.replace(/\s*[\(\[][^)\]]*(official|video|audio|lyric|lirik|remaster|4k|hd|mv)[^)\]]*[\)\]]/gi, '').trim();
    const idx = t.indexOf(' - ');
    if (idx > 0) return { title: t.slice(idx + 3).trim() || t, artist: t.slice(0, idx).trim() };
    return { title: t, artist: channel || null };
}

function normalizeSong(data) {
    if (data && data.status === false) return null;
    let r = data?.result ?? data?.data ?? data;
    if (Array.isArray(r)) r = r[0];
    if (!r) return null;
    const channel = pick(r, ['channel', 'author', 'singer', 'artist', 'artists']);
    const channelText = Array.isArray(channel) ? channel.map(a => a?.name || a).join(', ') : channel;
    const { title, artist } = cleanTitle(pick(r, ['title', 'name', 'judul']), channelText);
    return {
        title,
        artist,
        cover: pick(r, ['thumbnail', 'cover', 'image', 'thumb']),
        audioUrl: pick(r, ['download', 'download_url', 'downloadUrl', 'audio', 'link']),
        spotifyUrl: pick(r, ['url', 'spotify_url', 'spotifyUrl', 'external_url'])
    };
}

function escHtml(t = '') {
    return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PLAYER_DEBUG = false;

function buildPlayerHtml({ title, artist, coverSrc, audioSrc }) {
    return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;-webkit-tap-highlight-color:transparent}
html,body{width:100%;background:transparent}
body{padding:8px}
.card{position:relative;isolation:isolate;overflow:hidden;max-width:430px;margin:0 auto;padding:16px;border-radius:40px;color:#fff;background:linear-gradient(160deg,#8296cc 0%,#4c527f 55%,#2b2942 100%);border:1px solid rgba(255,255,255,.45);box-shadow:0 20px 50px rgba(0,0,0,.35),inset 0 1.5px 1px rgba(255,255,255,.65)}
.bg{position:absolute;top:-50px;left:-50px;right:-50px;bottom:-50px;z-index:-2;background-size:cover;background-position:center;filter:blur(34px) saturate(2.1) brightness(1.15);transform:scale(1.4)}
.card::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;z-index:-1;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,0) 45%,rgba(0,0,0,.14) 100%)}
.glass{position:relative;overflow:hidden;padding:22px;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.13) 48%,rgba(255,255,255,.22) 100%);-webkit-backdrop-filter:blur(24px) saturate(200%);backdrop-filter:blur(24px) saturate(200%);border:1px solid rgba(255,255,255,.55);box-shadow:inset 0 2px 1px rgba(255,255,255,.8),inset 0 -1px 1px rgba(255,255,255,.25),inset 0 0 26px rgba(255,255,255,.14),0 10px 28px rgba(0,0,0,.2)}
.glass::before{content:'';position:absolute;top:-65%;left:-35%;width:95%;height:125%;background:linear-gradient(115deg,rgba(255,255,255,.4) 0%,rgba(255,255,255,0) 60%);transform:rotate(9deg);pointer-events:none}
.cover{position:relative;width:100%;max-width:320px;aspect-ratio:1/1;margin:0 auto 22px;border-radius:24px;overflow:hidden;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.6);box-shadow:0 16px 34px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,255,255,.7)}
.cover img{width:100%;height:100%;object-fit:cover;display:block}
.title{position:relative;font-size:22px;font-weight:700;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 8px rgba(0,0,0,.3)}
.artist{position:relative;font-size:15px;color:rgba(255,255,255,.85);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 6px rgba(0,0,0,.25)}
.track{position:relative;height:8px;margin-top:20px;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.35);border-radius:10px;overflow:hidden;cursor:pointer;box-shadow:inset 0 1px 3px rgba(0,0,0,.25)}
.bar{height:100%;width:0;background:linear-gradient(90deg,rgba(255,255,255,.8),#fff);border-radius:10px;box-shadow:0 0 12px rgba(255,255,255,.9)}
.times{position:relative;display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:rgba(255,255,255,.8);text-shadow:0 1px 4px rgba(0,0,0,.25)}
.play{position:relative;display:flex;align-items:center;justify-content:center;width:76px;height:76px;margin:18px auto 0;border:1.5px solid rgba(255,255,255,.7);border-radius:50%;background:linear-gradient(145deg,rgba(255,255,255,.6),rgba(255,255,255,.18));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 10px 24px rgba(0,0,0,.28),inset 0 2px 1px rgba(255,255,255,.85),inset 0 -2px 6px rgba(255,255,255,.2);cursor:pointer}
.play:active{transform:scale(.94)}
.play svg{width:32px;height:32px;fill:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
.dbg{margin-top:12px;font-size:11px;color:#1ed760;text-align:center;word-break:break-all}
</style>
<div class="card">
  ${coverSrc ? `<div class="bg" style="background-image:url(${coverSrc})"></div>` : ''}
  <div class="glass">
    <div class="cover">${coverSrc ? `<img src="${coverSrc}" alt="cover">` : ''}</div>
    <div class="title">${escHtml(title)}</div>
    <div class="artist">${escHtml(artist)}</div>
    <div class="track" id="track"><div class="bar" id="bar"></div></div>
    <div class="times"><span id="cur">0:00</span><span id="tot">0:00</span></div>
    <button class="play" id="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
    ${PLAYER_DEBUG ? '<div class="dbg" id="dbg">menunggu script...</div>' : ''}
  </div>
</div>
<audio id="aud" src="${audioSrc || ''}" preload="metadata"></audio>
<script>
(function(){
var a=document.getElementById('aud'),b=document.getElementById('bar'),
p=document.getElementById('play'),t=document.getElementById('track'),
c=document.getElementById('cur'),d=document.getElementById('tot'),g=document.getElementById('dbg');
var PLAY='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var PAUSE='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
var DATA=a.getAttribute('src')||'';
var stage=0,ctx=null,node=null,buf=null,wa={start:0,off:0,on:false};
var playing=false,session=0,lock=0;
function L(x){if(g)g.textContent=x}
function f(s){if(!isFinite(s)||s<0)return'0:00';var m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x}
function setPlaying(v){playing=v;p.innerHTML=v?PAUSE:PLAY}
function toU8(){var s=atob(DATA.split(',')[1]||''),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function hardStop(){
  try{a.pause()}catch(e){}
  if(wa.on){wa.off=waCur();wa.on=false}
  try{if(node){node.onended=null;node.stop()}}catch(e){}
  node=null;
}
function resetUI(){b.style.width='0';c.textContent='0:00'}
function waCur(){return wa.off+(wa.on&&ctx?ctx.currentTime-wa.start:0)}
function waPlay(my){
  if(!playing||my!==session||!buf)return;
  hardStop();
  if(ctx.resume)ctx.resume();
  node=ctx.createBufferSource();node.buffer=buf;node.connect(ctx.destination);
  wa.start=ctx.currentTime;node.start(0,wa.off);wa.on=true;L('memutar');waTick(my);
}
function waTick(my){
  if(!wa.on||my!==session)return;
  var cur=waCur();b.style.width=Math.min(100,cur/buf.duration*100)+'%';c.textContent=f(cur);
  if(cur>=buf.duration){hardStop();wa.off=0;setPlaying(false);resetUI();return}
  requestAnimationFrame(function(){waTick(my)});
}
function useWebAudio(my){
  stage=2;hardStop();a.removeAttribute('src');try{a.load()}catch(e){}
  try{
    var AC=window.AudioContext||window.webkitAudioContext;ctx=ctx||new AC();
    var ok=false,done=function(x){if(ok)return;ok=true;buf=x;d.textContent=f(x.duration);waPlay(my)};
    var fail=function(){setPlaying(false);L('decode audio gagal')};
    var r=ctx.decodeAudioData(toU8().buffer,done,fail);
    if(r&&r.then)r.then(done).catch(fail);
  }catch(e){setPlaying(false);L('webaudio gagal')}
}
function useBlob(){
  try{stage=1;a.pause();a.src=URL.createObjectURL(new Blob([toU8()],{type:'audio/mpeg'}));a.load();return true}
  catch(e){return false}
}
function playEl(my){
  var r;
  try{r=a.play()}catch(e){return fallback(e,my)}
  if(r&&r.then)r.then(function(){
    if(!playing||my!==session){try{a.pause()}catch(e){}return}
  }).catch(function(e){fallback(e,my)});
}
function fallback(e,my){
  if(!playing||my!==session)return;
  if(e&&e.name==='AbortError')return;
  if(e&&e.name==='NotAllowedError'){setPlaying(false);return}
  if(stage===0&&useBlob()){playEl(my);return}
  useWebAudio(my);
}
function startPlay(){
  var my=++session;hardStop();setPlaying(true);
  if(stage===2){if(buf)waPlay(my);else useWebAudio(my);return}
  playEl(my);
}
function stopPlay(){session++;setPlaying(false);hardStop()}
p.addEventListener('click',function(){
  var now=Date.now();if(now-lock<350)return;lock=now;
  if(playing)stopPlay();else startPlay();
});
a.addEventListener('play',function(){if(!playing||stage===2){try{a.pause()}catch(e){}}});
a.addEventListener('loadedmetadata',function(){if(stage<2)d.textContent=f(a.duration)});
a.addEventListener('timeupdate',function(){if(stage<2&&a.duration){b.style.width=(a.currentTime/a.duration*100)+'%';c.textContent=f(a.currentTime)}});
a.addEventListener('ended',function(){if(stage<2){setPlaying(false);resetUI()}});
t.addEventListener('click',function(e){
  var r=t.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  if(stage===2){
    if(!buf)return;
    var was=playing,my=++session;hardStop();wa.off=x*buf.duration;
    if(was)waPlay(my);else{b.style.width=(x*100)+'%';c.textContent=f(wa.off)}
    return;
  }
  if(a.duration)a.currentTime=x*a.duration;
});
})();
</script>`;
}

// Ukuran audio yang ditanam di player. Pesan HTML terlalu besar = player tidak tampil di WhatsApp.
const EMBED_TARGET = (Number(process.env.PLAYER_EMBED_KB) || 150) * 1024; // bisa diubah lewat env PLAYER_EMBED_KB
async function runFfmpeg(args, buffer) {
    return new Promise((resolve) => {
        try {
            const ff = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', ...args, 'pipe:1']);
            const chunks = [];
            ff.stdout.on('data', c => chunks.push(c));
            ff.on('error', () => resolve(null));
            ff.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : null));
            ff.stdin.on('error', () => {});
            ff.stdin.end(buffer);
        } catch { resolve(null); }
    });
}

async function shrinkAudio(buffer) {
    for (const kbps of [32, 24, 16]) {
        const out = await runFfmpeg(['-vn', '-ac', '1', '-ar', '22050', '-b:a', `${kbps}k`, '-f', 'mp3'], buffer);
        if (!out) return null;
        if (out.length <= EMBED_TARGET) return { buffer: out, trimmed: false };
    }
    // masih terlalu besar -> potong jadi pratinjau di awal lagu
    const seconds = Math.floor((EMBED_TARGET * 8) / 16000);
    const clip = await runFfmpeg(['-vn', '-ac', '1', '-ar', '22050', '-b:a', '16k', '-t', String(seconds), '-f', 'mp3'], buffer);
    return clip ? { buffer: clip, trimmed: true } : null;
}

async function shrinkCover(buffer) {
    return runFfmpeg(['-vf', 'crop=min(iw\\,ih):min(iw\\,ih),scale=320:320', '-q:v', '6', '-frames:v', '1', '-f', 'mjpeg'], buffer);
}

async function sendHtmlRich(sock, jid, html, quoted, label = 'Spotify Player') {
    const responseData = {
        response_id: 'spotify-music-' + Date.now(),
        sections: [{
            view_model: {
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    trusted_sources: ['levvicode.dev']
                },
                __typename: 'GenAISingleLayoutViewModel'
            }
        }]
    };
    const base64Data = Buffer.from(JSON.stringify(responseData)).toString('base64');
    console.log(`[PLAYER] ukuran HTML ${(html.length / 1024).toFixed(0)} KB, pesan ${(base64Data.length / 1024).toFixed(0)} KB`);

    const content = generateWAMessageFromContent(jid, {
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: label }],
                    unifiedResponse: { data: base64Data },
                    contextInfo: { forwardingScore: 999, isForwarded: true, forwardOrigin: 4 }
                }
            }
        }
    }, { quoted, userJid: sock.user?.id });

    await sock.relayMessage(jid, content.message, {
        messageId: content.key.id,
        additionalAttributes: { type: 'text' }
    });
}

export async function handlePlay(sock, sender, mek, args) {
    const sendReaction = async (emoji) => {
        await sock.sendMessage(sender, {
            react: { text: emoji, key: mek.key }
        });
    };

    try {
        const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
        if (!query) {
            await sendReaction('⛔');
            await sock.sendMessage(sender, { text: 'Masukkan judul lagu!\nContoh: play Ada apa dengan cinta' }, { quoted: mek });
            return;
        }

        // Reaksi Loading ⏳
        await sendReaction('⏳');

        // 1) API play (cari + download lagu)
        const songJson = await fetchJson(buildSongUrl(query));
        const song = normalizeSong(songJson);
        if (!song || !song.audioUrl) {
            await sendReaction('⛔');
            await sock.sendMessage(sender, { text: 'Lagu tidak ditemukan dari API.' }, { quoted: mek });
            return;
        }
        const title = song.title || query;
        const artist = song.artist || '-';

        // 2) Ambil audio & cover
        const audioRes = await fetch(song.audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!audioRes.ok) throw new Error('AUDIO_HTTP_' + audioRes.status);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        if (audioBuffer.length < 10240) throw new Error('AUDIO_KOSONG');

        let coverSrc = '';
        if (song.cover) {
            try {
                const cr = await fetch(song.cover);
                let coverBuf = Buffer.from(await cr.arrayBuffer());
                coverBuf = (await shrinkCover(coverBuf)) || coverBuf;
                coverSrc = `data:image/jpeg;base64,${coverBuf.toString('base64')}`;
            } catch {}
        }

        // 3) Siapkan audio untuk ditanam di player
        let embedBuffer = audioBuffer;
        if (audioBuffer.length > EMBED_TARGET) {
            const small = await shrinkAudio(audioBuffer);
            if (small && small.buffer.length > 10240) embedBuffer = small.buffer;
        }
        const embedAudio = embedBuffer.length <= EMBED_TARGET * 1.5;

        // 4) Kirim Player HTML Rich
        let richSent = false;
        try {
            const html = buildPlayerHtml({
                title, artist, coverSrc,
                audioSrc: embedAudio ? `data:audio/mpeg;base64,${embedBuffer.toString('base64')}` : ''
            });
            await sendHtmlRich(sock, sender, html, mek, 'Spotify Player');
            richSent = true;
        } catch (richErr) {
            console.error('Player HTML gagal:', richErr.message);
        }

        // Fallback audio biasa jika rich gagal/terlalu besar
        if (!richSent || !embedAudio) {
            await sock.sendMessage(sender, { audio: audioBuffer, mimetype: 'audio/mpeg' }, { quoted: mek });
        }

        // Reaksi Selesai 🍃
        await sendReaction('🍃');
    } catch (e) {
        console.error(e);
        await sendReaction('⛔');
        await sock.sendMessage(sender, { text: 'Gagal memproses lagu Spotify.' }, { quoted: mek });
    }
}

// ==================== PLUGIN ====================
export default {
    name: 'play',
    command: ['play'],
    category: 'musik',
    desc: 'Putar lagu dari judul: play <judul lagu>',
    async run({ sock, remoteJid, mek, args, reply }) {
        await handlePlay(sock, remoteJid, mek, args, reply);
    }
};
