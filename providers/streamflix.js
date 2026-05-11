// pomfy.js
// Provider Pomfy - Fluxo completo Byse/9n8o (COM IMPLEMENTAÇÃO MANUAL AES-256-GCM)

const API_POMFY = "https://api.pomfy.stream";
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1'
};

const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

// ==================== IMPLEMENTAÇÃO MANUAL AES-256-GCM ====================

const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

class AES256GCM_Manual {
    constructor(key) {
        this.roundKeys = this._expandKey(key);
    }

    _expandKey(key) {
        let w = new Uint32Array(60);
        for (let i = 0; i < 8; i++) {
            w[i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3];
        }
        for (let i = 8; i < 60; i++) {
            let temp = w[i - 1];
            if (i % 8 === 0) {
                temp = ((temp << 8) | (temp >>> 24)) >>> 0;
                temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) |
                       (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
                temp ^= (RCON[i / 8] << 24) >>> 0;
            } else if (i % 8 === 4) {
                temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) |
                       (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
            }
            w[i] = (w[i - 8] ^ temp) >>> 0;
        }
        return w;
    }

    _galoisMult(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) p ^= a;
            let hiBitSet = a & 0x80;
            a = (a << 1) & 0xff;
            if (hiBitSet) a ^= 0x1b;
            b >>= 1;
        }
        return p;
    }

    _encryptBlock(block) {
        let state = Array.from({ length: 4 }, (_, r) => 
            Array.from({ length: 4 }, (_, c) => block[r + c * 4])
        );

        const addRoundKey = (s, rkIdx) => {
            for (let c = 0; c < 4; c++) {
                let rk = this.roundKeys[rkIdx * 4 + c];
                for (let r = 0; r < 4; r++) {
                    s[r][c] ^= (rk >>> (24 - 8 * r)) & 0xff;
                }
            }
        };

        addRoundKey(state, 0);

        for (let round = 1; round < 14; round++) {
            for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
            
            let row1 = state[1], row2 = state[2], row3 = state[3];
            state[1] = [row1[1], row1[2], row1[3], row1[0]];
            state[2] = [row2[2], row2[3], row2[0], row2[1]];
            state[3] = [row3[3], row3[0], row3[1], row3[2]];

            for (let c = 0; c < 4; c++) {
                let s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
                state[0][c] = this._galoisMult(0x02, s0) ^ this._galoisMult(0x03, s1) ^ s2 ^ s3;
                state[1][c] = s0 ^ this._galoisMult(0x02, s1) ^ this._galoisMult(0x03, s2) ^ s3;
                state[2][c] = s0 ^ s1 ^ this._galoisMult(0x02, s2) ^ this._galoisMult(0x03, s3);
                state[3][c] = this._galoisMult(0x03, s0) ^ s1 ^ s2 ^ this._galoisMult(0x02, s3);
            }
            addRoundKey(state, round);
        }

        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
        let row1 = state[1], row2 = state[2], row3 = state[3];
        state[1] = [row1[1], row1[2], row1[3], row1[0]];
        state[2] = [row2[2], row2[3], row2[0], row2[1]];
        state[3] = [row3[3], row3[0], row3[1], row3[2]];
        addRoundKey(state, 14);

        let res = new Uint8Array(16);
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) res[c * 4 + r] = state[r][c];
        return res;
    }

    decrypt(iv, ciphertext) {
        let counter = new Uint8Array(16);
        counter.set(iv);
        counter[15] = 2; // O contador GCM para dados começa em 2

        let plaintext = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i += 16) {
            let keystream = this._encryptBlock(counter);
            for (let j = 0; j < 16 && (i + j) < ciphertext.length; j++) {
                plaintext[i + j] = ciphertext[i + j] ^ keystream[j];
            }
            // Incrementa contador (últimos 4 bytes)
            for (let j = 15; j >= 12; j--) {
                counter[j]++;
                if (counter[j] !== 0) break;
            }
        }
        // Usa TextDecoder se disponível (Node.js/browser), senão converte manualmente
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(plaintext);
        }
        // Fallback para Node.js sem TextDecoder
        return Buffer.from(plaintext).toString('utf8');
    }
}

// ==================== GERAR FINGERPRINT ====================

function generateRandomId(length) {
    const chars = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateFingerprint() {
    const viewerId = generateRandomId(32);
    const deviceId = generateRandomId(32);
    const timestamp = Math.floor(Date.now() / 1000);
    
    const payload = {
        viewer_id: viewerId,
        device_id: deviceId,
        confidence: 0.93,
        iat: timestamp,
        exp: timestamp + 600
    };
    
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    return {
        token: token,
        viewer_id: viewerId,
        device_id: deviceId,
        confidence: 0.93
    };
}

// ==================== AUXILIAR BASE64URL ====================

function base64UrlDecodeToBuffer(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}

function base64UrlDecodeToUint8(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const buffer = Buffer.from(str, 'base64');
    return new Uint8Array(buffer);
}

// ==================== DESCRIPTOGRAFAR PLAYBACK ====================

function decryptPlayback(playback) {
    try {
        console.log(`\n[decrypt] ========== INICIANDO DESCRIPTOGRAFIA ==========`);
        console.log(`[decrypt] IV (base64): ${playback.iv}`);
        console.log(`[decrypt] Key part 0 (base64): ${playback.key_parts[0]}`);
        console.log(`[decrypt] Key part 1 (base64): ${playback.key_parts[1]}`);
        
        // Decodificar base64 URL-safe para Uint8Array (como no exemplo que funciona)
        const iv = base64UrlDecodeToUint8(playback.iv);
        const key1 = base64UrlDecodeToUint8(playback.key_parts[0]);
        const key2 = base64UrlDecodeToUint8(playback.key_parts[1]);
        
        // Concatena as partes da chave
        const key = new Uint8Array(32);
        key.set(key1);
        key.set(key2, 16);
        
        console.log(`[decrypt] Key size: ${key.length} bytes`);
        console.log(`[decrypt] IV size: ${iv.length} bytes`);
        
        // Processar payload (URL-safe base64) - converte para Uint8Array
        let payload = playback.payload;
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4) {
            payload += '=';
        }
        const encryptedBuffer = Buffer.from(payload, 'base64');
        const encryptedData = new Uint8Array(encryptedBuffer);
        
        console.log(`[decrypt] Encrypted data size: ${encryptedData.length} bytes`);
        
        // Remove o auth tag (últimos 16 bytes) - exatamente como no exemplo
        const ciphertext = encryptedData.slice(0, -16);
        // const authTag = encryptedData.slice(-16); // Não usado na descriptografia
        
        console.log(`[decrypt] Ciphertext size: ${ciphertext.length} bytes`);
        
        // Descriptografar usando a implementação manual (mesma do exemplo)
        console.log(`\n[decrypt] ========== DESCRIPTOGRAFANDO (MANUAL) ==========`);
        const cipher = new AES256GCM_Manual(key);
        const decrypted = cipher.decrypt(iv, ciphertext);
        
        console.log(`\n[decrypt] ========== RESULTADO ==========`);
        console.log(`[decrypt] ✅ Descriptografado com sucesso!`);
        console.log(`[decrypt] Decrypted (primeiros 200 chars): ${decrypted.substring(0, 200)}`);
        
        // Parse do JSON
        const videoData = JSON.parse(decrypted);
        console.log(`[decrypt] JSON parseado com sucesso. Keys: ${Object.keys(videoData).join(', ')}`);
        
        // Extrair URL do m3u8
        let m3u8Url = null;
        
        if (videoData.sources && videoData.sources.length > 0) {
            m3u8Url = videoData.sources[0].url;
            console.log(`[decrypt] URL encontrada em sources[0].url: ${m3u8Url}`);
        } else if (videoData.url) {
            m3u8Url = videoData.url;
            console.log(`[decrypt] URL encontrada em url: ${m3u8Url}`);
        } else if (videoData.data && videoData.data.sources) {
            m3u8Url = videoData.data.sources[0].url;
            console.log(`[decrypt] URL encontrada em data.sources[0].url: ${m3u8Url}`);
        }
        
        if (m3u8Url) {
            // Limpar URL
            m3u8Url = m3u8Url.replace(/\\u0026/g, '&');
            console.log(`\n[decrypt] ✅✅✅ URL FINAL: ${m3u8Url} ✅✅✅`);
            return m3u8Url;
        }
        
        console.log(`[decrypt] ❌ Nenhuma URL encontrada`);
        return null;
        
    } catch (error) {
        console.log(`\n[decrypt] ❌❌❌ ERRO: ${error.message} ❌❌❌`);
        console.log(`[decrypt] Stack: ${error.stack}`);
        return null;
    }
}

// ==================== FUNÇÃO PRINCIPAL ====================

async function getStreams(tmdbId, mediaType, season, episode) {
    const results = [];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Pomfy] Buscando: ${mediaType} ${tmdbId} S${season}E${episode}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        // PASSO 1: Buscar HTML do Pomfy
        const pomfyUrl = mediaType === 'movie'
            ? `${API_POMFY}/filme/${tmdbId}`
            : `${API_POMFY}/serie/${tmdbId}/${season}/${episode}`;
        
        console.log(`[1] API Pomfy: ${pomfyUrl}`);
        
        const response = await fetch(pomfyUrl, {
            headers: {
                ...HEADERS,
                'Cookie': COOKIE
            }
        });
        
        if (!response.ok) {
            console.log(`[1] ❌ HTTP ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        console.log(`[1] ✅ HTML recebido: ${html.length} caracteres`);
        
        // PASSO 2: Extrair link do vídeo
        const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
        if (!linkMatch) {
            console.log(`[2] ❌ Link não encontrado no HTML`);
            return [];
        }
        
        const byseUrl = linkMatch[1];
        console.log(`[2] ✅ Link Byse: ${byseUrl}`);
        
        const byseId = byseUrl.split('/').pop();
        console.log(`[3] Byse ID: ${byseId}`);
        
        // PASSO 3: Buscar detalhes do vídeo
        const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;
        console.log(`\n[4] Detalhes: ${detailsUrl}`);
        
        const detailsResponse = await fetch(detailsUrl, {
            headers: {
                'accept': '*/*',
                'referer': byseUrl,
                'x-embed-origin': 'api.pomfy.stream',
                'x-embed-parent': byseUrl,
                'user-agent': HEADERS['User-Agent'],
                'cookie': COOKIE
            }
        });
        
        if (!detailsResponse.ok) {
            console.log(`[4] ❌ HTTP ${detailsResponse.status}`);
            return [];
        }
        
        const detailsData = await detailsResponse.json();
        const embedUrl = detailsData.embed_frame_url;
        console.log(`[4] ✅ Embed URL: ${embedUrl}`);
        
        // Extrair domínio do embed (9n8o.com ou similar)
        const embedDomain = new URL(embedUrl).origin;
        console.log(`[5] Embed domain: ${embedDomain}`);
        
        // PASSO 4: Buscar settings
        const settingsUrl = `${embedDomain}/api/videos/${byseId}/embed/settings`;
        console.log(`\n[6] Settings: ${settingsUrl}`);
        
        const settingsResponse = await fetch(settingsUrl, {
            headers: {
                'accept': '*/*',
                'referer': embedUrl,
                'x-embed-origin': 'api.pomfy.stream',
                'x-embed-parent': byseUrl,
                'user-agent': HEADERS['User-Agent']
            }
        });
        
        if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json();
            console.log(`[6] ✅ Settings obtidas`);
            console.log(`[6]   - Download allowed: ${settingsData.download_allowed}`);
            console.log(`[6]   - Default language: ${settingsData.default_language}`);
        } else {
            console.log(`[6] ⚠️ Settings não disponíveis`);
        }
        
        // PASSO 5: Gerar fingerprint
        const fingerprint = generateFingerprint();
        console.log(`\n[7] Fingerprint gerado`);
        
        // PASSO 6: Requisitar playback
        const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;
        console.log(`[8] Playback: ${playbackUrl}`);
        
        const playbackResponse = await fetch(playbackUrl, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'pt-BR,pt;q=0.9',
                'content-type': 'application/json',
                'origin': embedDomain,
                'referer': embedUrl,
                'x-embed-origin': 'api.pomfy.stream',
                'x-embed-parent': byseUrl,
                'user-agent': HEADERS['User-Agent']
            },
            body: JSON.stringify({
                fingerprint: fingerprint
            })
        });
        
        if (!playbackResponse.ok) {
            console.log(`[8] ❌ Playback falhou: ${playbackResponse.status}`);
            // Tenta ler o erro
            const errorText = await playbackResponse.text();
            console.log(`[8] Erro: ${errorText}`);
            return [];
        }
        
        const playbackData = await playbackResponse.json();
        console.log(`[8] ✅ Playback recebido`);
        
        // PASSO 7: Descriptografar o payload
        const m3u8Url = decryptPlayback(playbackData.playback);
        
        if (!m3u8Url) {
            console.log(`[9] ❌ Falha ao descriptografar`);
            return [];
        }
        
        console.log(`\n[9] ✅ URL .m3u8 obtida:`);
        console.log(`[9] ${m3u8Url}`);
        
        // PASSO 8: Criar o stream
        const title = mediaType === 'movie'
            ? `Filme ${tmdbId}`
            : `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
        
        results.push({
            name: `Pomfy 1080p`,
            title: title,
            url: m3u8Url,
            quality: 1080,
            headers: {
                'User-Agent': HEADERS['User-Agent'],
                'Referer': embedUrl,
                'Accept': '*/*',
                'Accept-Language': 'pt-BR,pt;q=0.9'
            }
        });
        
        console.log(`\n✅ Total streams: ${results.length}`);
        
    } catch (error) {
        console.log(`\n❌ Erro: ${error.message}`);
        console.log(error.stack);
    }
    
    return results;
}

// ==================== EXPORT ====================

module.exports = { getStreams };
