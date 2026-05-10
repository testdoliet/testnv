// pomfy.js
// Provider Pomfy - Fluxo completo Byse/9n8o

const API_POMFY = "https://api.pomfy.stream";
const crypto = require('crypto');

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
        
        // PASSO 5: Access challenge
        const challengeUrl = `${embedDomain}/api/videos/access/challenge`;
        console.log(`\n[7] Challenge: ${challengeUrl}`);
        
        const challengeResponse = await fetch(challengeUrl, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'origin': embedDomain,
                'referer': embedUrl,
                'user-agent': HEADERS['User-Agent']
            }
        });
        
        if (!challengeResponse.ok) {
            console.log(`[7] ❌ Challenge falhou: ${challengeResponse.status}`);
            return [];
        }
        
        const challengeData = await challengeResponse.json();
        console.log(`[7] ✅ Challenge obtido`);
        console.log(`[7]   - challenge_id: ${challengeData.challenge_id}`);
        console.log(`[7]   - nonce: ${challengeData.nonce}`);
        
        // PASSO 6: Gerar fingerprint
        const fingerprint = generateFingerprint();
        console.log(`\n[8] Fingerprint gerado`);
        
        // PASSO 7: Requisitar playback
        const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;
        console.log(`[9] Playback: ${playbackUrl}`);
        
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
            console.log(`[9] ❌ Playback falhou: ${playbackResponse.status}`);
            return [];
        }
        
        const playbackData = await playbackResponse.json();
        console.log(`[9] ✅ Playback recebido`);
        
        // PASSO 8: Descriptografar o payload
        const m3u8Url = decryptPlayback(playbackData.playback);
        
        if (!m3u8Url) {
            console.log(`[10] ❌ Falha ao descriptografar`);
            return [];
        }
        
        console.log(`\n[10] ✅ URL .m3u8 obtida:`);
        console.log(`[10] ${m3u8Url}`);
        
        // PASSO 9: Criar o stream
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

// ==================== GERAR FINGERPRINT ====================
function generateFingerprint() {
    const viewerId = generateRandomId(32);
    const deviceId = generateRandomId(32);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Criar um token JWT simulado
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

function generateRandomId(length) {
    const chars = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ==================== DESCRIPTOGRAFAR PLAYBACK ====================
function decryptPlayback(playback) {
    try {
        console.log(`\n[decrypt] Iniciando descriptografia...`);
        console.log(`[decrypt] IV: ${playback.iv}`);
        console.log(`[decrypt] Key parts: ${playback.key_parts.length}`);
        console.log(`[decrypt] Payload size: ${playback.payload.length}`);
        
        // Decodificar base64
        const iv = Buffer.from(playback.iv, 'base64');
        const key1 = Buffer.from(playback.key_parts[0], 'base64');
        const key2 = Buffer.from(playback.key_parts[1], 'base64');
        const key = Buffer.concat([key1, key2]);
        
        // O payload pode vir em formato URL-safe base64
        let payload = playback.payload;
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4) {
            payload += '=';
        }
        const encryptedData = Buffer.from(payload, 'base64');
        
        console.log(`[decrypt] Key size: ${key.length} bytes`);
        console.log(`[decrypt] IV size: ${iv.length} bytes`);
        console.log(`[decrypt] Encrypted size: ${encryptedData.length} bytes`);
        
        // Para AES-256-GCM, o auth tag são os últimos 16 bytes
        const authTag = encryptedData.slice(-16);
        const ciphertext = encryptedData.slice(0, -16);
        
        console.log(`[decrypt] Auth tag size: ${authTag.length} bytes`);
        console.log(`[decrypt] Ciphertext size: ${ciphertext.length} bytes`);
        
        // Descriptografar
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(ciphertext, '', 'utf8');
        decrypted += decipher.final('utf8');
        
        console.log(`[decrypt] ✅ Descriptografado com sucesso`);
        console.log(`[decrypt] Primeiros 200 chars: ${decrypted.substring(0, 200)}`);
        
        const videoData = JSON.parse(decrypted);
        
        // Extrair URL do m3u8
        let m3u8Url = null;
        
        if (videoData.sources && videoData.sources.length > 0) {
            m3u8Url = videoData.sources[0].url;
            console.log(`[decrypt] URL encontrada em sources[0].url`);
        } else if (videoData.url) {
            m3u8Url = videoData.url;
            console.log(`[decrypt] URL encontrada em url`);
        } else if (videoData.data && videoData.data.sources) {
            m3u8Url = videoData.data.sources[0].url;
            console.log(`[decrypt] URL encontrada em data.sources[0].url`);
        }
        
        if (m3u8Url) {
            // Limpar URL
            m3u8Url = m3u8Url.replace(/\\u0026/g, '&');
            return m3u8Url;
        }
        
        console.log(`[decrypt] ❌ Nenhuma URL encontrada`);
        return null;
        
    } catch (error) {
        console.log(`[decrypt] ❌ Erro: ${error.message}`);
        return null;
    }
}

// ==================== EXPORT ====================
module.exports = { getStreams };
