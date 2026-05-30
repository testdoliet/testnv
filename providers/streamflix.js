/**
 * Pomfy - Provider com Byse/9n8o
 * Versão Final: 100% Manual (Sem Buffer/Crypto)
 * CORREÇÃO: Accept-Encoding: identity para evitar compressão gzip/br
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ==============================================
// CONSTANTS
// ==============================================

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://pomfy.online/",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1"
};

// ==============================================
// BASE64 MANUAL
// ==============================================

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64) {
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
  const len = b64.length;
  let outputLen = (len * 3) >> 2;
  if (b64[len - 1] === '=') outputLen--;
  if (b64[len - 2] === '=') outputLen--;
  const bytes = new Uint8Array(outputLen);
  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)];
    const b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)];
    const d = lookup[b64.charCodeAt(i + 3)];
    if (byteIdx < outputLen) bytes[byteIdx++] = (a << 2) | (b >> 4);
    if (byteIdx < outputLen) bytes[byteIdx++] = ((b & 0x0f) << 4) | (c >> 2);
    if (byteIdx < outputLen) bytes[byteIdx++] = ((c & 0x03) << 6) | d;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

function utf8BytesToString(bytes) {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 0x80) { str += String.fromCharCode(byte); i += 1; }
    else if ((byte & 0xe0) === 0xc0) { str += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if ((byte & 0xf0) === 0xe0) { str += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else if ((byte & 0xf8) === 0xf0) {
      const cp = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
      const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
      str += String.fromCharCode(hi, lo);
      i += 4;
    } else { i += 1; }
  }
  return str;
}

function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + (cp - 0xd800) * 0x400 + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) { bytes.push(cp); }
    else if (cp < 0x800) { bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)); }
    else if (cp < 0x10000) { bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
    else { bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
  }
  return new Uint8Array(bytes);
}

// ==============================================
// AES-256-GCM MANUAL
// ==============================================

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
  constructor(key) { this.roundKeys = this._expandKey(key); }
  
  _expandKey(key) {
    let w = new Uint32Array(60);
    for (let i = 0; i < 8; i++) { w[i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]; }
    for (let i = 8; i < 60; i++) {
      let temp = w[i - 1];
      if (i % 8 === 0) {
        temp = ((temp << 8) | (temp >>> 24)) >>> 0;
        temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) | (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
        temp ^= (RCON[i / 8] << 24) >>> 0;
      } else if (i % 8 === 4) {
        temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) | (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
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
    let state = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => block[r + c * 4]));
    const addRoundKey = (s, rkIdx) => {
      for (let c = 0; c < 4; c++) {
        let rk = this.roundKeys[rkIdx * 4 + c];
        for (let r = 0; r < 4; r++) { s[r][c] ^= (rk >>> (24 - 8 * r)) & 0xff; }
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
    counter[15] = 2;
    let plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 16) {
      let keystream = this._encryptBlock(counter);
      for (let j = 0; j < 16 && (i + j) < ciphertext.length; j++) { plaintext[i + j] = ciphertext[i + j] ^ keystream[j]; }
      for (let j = 15; j >= 12; j--) {
        counter[j]++;
        if (counter[j] !== 0) break;
      }
    }
    return utf8BytesToString(plaintext);
  }
}

// ==============================================
// KEY SELECTION LOGIC (baseada na versão)
// ==============================================

function buildVersionMap() {
    const map = {};
    for (let n = 1; n <= 30; n += 1) {
        const i = n ^ 0;
        const a = 31 - n ^ 0;
        map[String(n)] = [i, a];
    }
    return map;
}

function getIndicesForVersion(version, arrayLength) {
    const map = buildVersionMap();
    const indices = map[String(version)];
    if (!indices || !Array.isArray(indices)) return [];
    
    const validIndices = [];
    for (const idx of indices) {
        if (idx >= 1 && idx <= arrayLength) {
            validIndices.push(idx - 1);
        }
    }
    return validIndices;
}

function selectKeyParts(payload) {
    const keyParts = Array.isArray(payload.key_parts) ? payload.key_parts : [];
    const indices = getIndicesForVersion(payload.version, keyParts.length);
    
    if (indices.length === 0) {
        return keyParts.slice(0, 2);
    }
    
    const selected = indices.map(i => keyParts[i]).filter(p => p && p.length > 0);
    return selected.length > 0 ? selected : keyParts.slice(0, 2);
}

function reconstructKey(payload) {
    const selected = selectKeyParts(payload);
    const decoded = selected.map(p => base64ToBytes(p));
    const total = decoded.reduce((acc, arr) => acc + arr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of decoded) {
        out.set(arr, offset);
        offset += arr.length;
    }
    if (out.length > 32) return out.slice(0, 32);
    return out;
}

// ==============================================
// FUNÇÃO DE DESCRIPTOGRAFIA
// ==============================================

function decryptPlayback(playback) {
  try {
    const key = reconstructKey(playback);
    const iv = base64ToBytes(playback.iv);
    const encryptedData = base64ToBytes(playback.payload);
    const ciphertext = encryptedData.slice(0, -16);
    const cipher = new AES256GCM_Manual(key);
    const decrypted = cipher.decrypt(iv, ciphertext);
    const videoData = JSON.parse(decrypted);
    
    let m3u8Url = videoData.url || 
                  (videoData.sources && videoData.sources[0] && videoData.sources[0].url) || 
                  (videoData.data && videoData.data.sources && videoData.data.sources[0].url);
    
    if (m3u8Url) return { success: true, url: m3u8Url.replace(/\\u0026/g, '&') };
    return { success: false, error: "URL não encontrada" };
  } catch (e) { 
    return { success: false, error: e.message }; 
  }
}

// ==============================================
// GERAÇÃO DE FINGERPRINT
// ==============================================

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

  const token = bytesToBase64(stringToUtf8Bytes(JSON.stringify(payload)));

  return {
    token: token,
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93
  };
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results && results.length > 0) return { success: true, tmdbId: results[0].id };
    return { success: false, error: "Nenhum resultado encontrado" };
  } catch (error) { return { success: false, error: error.message }; }
}

// ==============================================
// FUNÇÃO PRINCIPAL getStreams
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  
  const addDebug = (title, content) => {
    let debugContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    if (debugContent.length > 500) debugContent = debugContent.substring(0, 500) + '...';
    streams.push({
      name: "Pomfy [DEBUG]",
      title: title,
      url: debugContent,
      quality: 0,
      headers: {}
    });
  };

  addDebug(`🔍 INICIANDO BUSCA`, `${mediaType} ${tmdbId}`);
  
  let finalTmdbId = tmdbId;

  if (isImdbId(tmdbId)) {
    addDebug(`📽️ CONVERTENDO IMDb → TMDb`, tmdbId);
    const conversion = await convertImdbToTmdb(tmdbId, mediaType);
    if (conversion.success) {
      finalTmdbId = conversion.tmdbId;
      addDebug(`✅ IMDb CONVERTIDO`, `TMDb ID: ${finalTmdbId}`);
    } else {
      addDebug(`❌ FALHA NA CONVERSÃO IMDb`, conversion.error);
      return streams;
    }
  }

  const seasonNum = mediaType === "movie" ? 1 : (season || 1);
  const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
  addDebug(`📺 PARÂMETROS FINAIS`, `Tipo: ${mediaType}, Season: ${seasonNum}, Episode: ${episodeNum}`);

  try {
    // 1. Buscar HTML para obter statusToken
    const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${finalTmdbId}` : `${API_POMFY}/serie/${finalTmdbId}/${seasonNum}/${episodeNum}`;
    addDebug(`📡 [1/6] REQUISIÇÃO API`, pomfyUrl);
    
    const response = await fetch(pomfyUrl, { headers: HEADERS });
    if (!response.ok) {
      addDebug(`❌ [1/6] FALHA HTTP`, `Status: ${response.status}`);
      return streams;
    }
    
    const html = await response.text();
    addDebug(`📄 [1/6] HTML RECEBIDO`, `${html.length} bytes`);

    // Extrair statusToken
    let statusToken = null;
    const statusPatterns = [
      /const statusToken="([^"]+)"/,
      /statusToken["']?\s*[:=]\s*["']([^"']+)["']/,
      /["']statusToken["']\s*:\s*["']([^"']+)["']/
    ];
    
    for (const pattern of statusPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        statusToken = match[1];
        break;
      }
    }
    
    if (!statusToken) {
      addDebug(`❌ [2/6] STATUS_TOKEN NÃO ENCONTRADO`, `Patterns testados: ${statusPatterns.length}`);
      return streams;
    }
    
    addDebug(`✅ [2/6] STATUS_TOKEN OBTIDO`, statusToken.substring(0, 50) + '...');

    // 2. Pegar byseUrl via /api/play-token
    const playTokenUrl = `${API_POMFY}/api/play-token?t=${statusToken}`;
    addDebug(`📡 [3/6] PLAY-TOKEN URL`, playTokenUrl);
    
    const playTokenResponse = await fetch(playTokenUrl, {
      headers: {
        "accept": "*/*",
        "cookie": COOKIE,
        "referer": pomfyUrl,
        "user-agent": USER_AGENT
      }
    });
    
    if (!playTokenResponse.ok) {
      addDebug(`❌ [3/6] PLAY-TOKEN FALHOU`, `HTTP ${playTokenResponse.status}`);
      return streams;
    }
    
    const playTokenData = await playTokenResponse.json();
    const byseUrl = playTokenData.byseUrl;
    if (!byseUrl) {
      addDebug(`❌ [3/6] BYSE_URL NÃO ENCONTRADO`, `Resposta: ${JSON.stringify(playTokenData)}`);
      return streams;
    }
    
    const byseId = byseUrl.split('/').pop();
    addDebug(`✅ [3/6] BYSE_ID OBTIDO`, byseId);

    // 3. Embed Details
    const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;
    addDebug(`📡 [4/6] BUSCANDO DETALHES`, detailsUrl);
    
    const detailsRes = await fetch(detailsUrl, {
      headers: { "referer": byseUrl, "x-embed-origin": "api.pomfy.stream", "user-agent": USER_AGENT }
    });
    
    if (!detailsRes.ok) {
      addDebug(`❌ [4/6] DETAILS FALHOU`, `HTTP ${detailsRes.status}`);
      return streams;
    }
    
    const detailsData = await detailsRes.json();
    const embedUrl = detailsData.embed_frame_url;
    if (!embedUrl) {
      addDebug(`❌ [4/6] EMBED_FRAME_URL NÃO ENCONTRADO`, JSON.stringify(detailsData));
      return streams;
    }
    
    const playerDomain = new URL(embedUrl).origin;
    addDebug(`✅ [4/6] PLAYER DOMAIN`, playerDomain);

    // 4. Challenge
    try {
      const challengeUrl = `${playerDomain}/api/videos/access/challenge`;
      addDebug(`🔐 [5/6] CHALLENGE`, challengeUrl);
      
      const challengeRes = await fetch(challengeUrl, {
        method: 'POST',
        headers: { 'accept': '*/*', 'origin': playerDomain, 'referer': embedUrl, 'user-agent': USER_AGENT }
      });
      
      if (challengeRes.ok) {
        addDebug(`✅ [5/6] CHALLENGE OK`, `HTTP ${challengeRes.status}`);
      } else {
        addDebug(`⚠️ [5/6] CHALLENGE IGNORADO`, `HTTP ${challengeRes.status}`);
      }
    } catch (e) {
      addDebug(`⚠️ [5/6] CHALLENGE ERRO`, e.message);
    }

    // 5. Playback
    const fingerprint = generateFingerprint();
    addDebug(`🔐 [6/6] FINGERPRINT GERADO`, `viewer_id: ${fingerprint.viewer_id}`);

    const playbackUrl = `${playerDomain}/api/videos/${byseId}/embed/playback`;
    addDebug(`📡 [6/6] PLAYBACK URL`, playbackUrl);
    
    const playbackRes = await fetch(playbackUrl, {
      method: "POST",
      headers: { 
        "content-type": "application/json", 
        "origin": playerDomain, 
        "referer": embedUrl, 
        "user-agent": USER_AGENT,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": byseUrl
      },
      body: JSON.stringify({ fingerprint: fingerprint })
    });
    
    if (!playbackRes.ok) {
      addDebug(`❌ [6/6] PLAYBACK FALHOU`, `HTTP ${playbackRes.status}`);
      return streams;
    }
    
    const playbackData = await playbackRes.json();
    if (!playbackData.playback) {
      addDebug(`❌ [6/6] SEM PLAYBACK NA RESPOSTA`, JSON.stringify(playbackData));
      return streams;
    }
    
    addDebug(`🔓 DESCRIPTOGRAFANDO`, `Versão: ${playbackData.playback.version}`);
    const decryptResult = decryptPlayback(playbackData.playback);
    
    if (decryptResult.success) {
      addDebug(`✅ SUCESSO! URL OBTIDA`, decryptResult.url.substring(0, 100) + '...');
      
      // HEADERS CORRIGIDOS - COM Accept-Encoding: identity
      // Isso impede o servidor de comprimir a resposta com gzip/br
      const finalHeaders = {
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "identity",  // ← ESSE É O SEGREDO!
        "Accept": "*/*",
        "Origin": "https://pomfy-cdn.shop",
        "Referer": "https://pomfy-cdn.shop/",
        "X-Embed-Origin": "api.pomfy.stream",
        "X-Embed-Referer": "https://api.pomfy.stream/",
        "Connection": "keep-alive"
      };
      
      // Remove todos os streams de debug
      streams.length = 0;
      
      // Adiciona o stream real com type hls e headers corrigidos
      streams.push({
        name: "Pomfy",
        title: "1080p",
        url: decryptResult.url,
        quality: 1080,
        type: "hls",
        headers: finalHeaders
      });
      
      return streams;
    } else {
      addDebug(`❌ DESCRIPTOGRAFIA FALHOU`, decryptResult.error);
      return streams;
    }

  } catch (e) { 
    addDebug(`❌ ERRO CRÍTICO`, `${e.message}\n${e.stack || ''}`);
    return streams;
  }
}

module.exports = { getStreams };
