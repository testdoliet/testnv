/**
 * Pomfy - Provider com fingerprint fixo
 * Fluxo: api.pomfy.stream -> statusToken -> /api/play-token -> 9n8o.com -> challenge -> playback -> M3U8
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

// Cookie (pode precisar ser atualizado)
const COOKIE = "cf_clearance=FY8zyQybVu2kflZRPEY.MK6_U4tb6fhgsHFcqL8ADrw-1778869729-1.2.1.1-QEpMO3YW7Bw5towDJ0vt.qryy45W8_ZNcfiIwZVFH8VxGfccA92JLE.AijYDUhFSQvlcvBCYFOIQBfR7AiAU62Z2oi.LcbauCXoBKFn7PZgFIctmHdbwAw1PEX6Cd3KSIE4iYDAek732vCD0AKZpj356_o087ffIzRotI1NaRK8w99XVw.9feR25y8bUDv3zRKAwmZOmWCc4EJ2Gl.t9G4av0mgASGgZCiBrikohLj0kWfe8ZZVyx2cimdouLH1CBth.AiPugowBvs4Ta0omNyc8qCD09QTfKAiOF7EGrY8J7XXyRC9M_ejoQplmjOoDFUo7d5qFqqWG.OsRZWzPVg";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const DEBUG = true;
function log(step, message, data = null) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [${step}] ${message}`);
  if (data !== null && typeof data === 'object') {
    console.log(`[${timestamp}] [${step}] └─ ${JSON.stringify(data, null, 2).substring(0, 300)}`);
  } else if (data !== null) {
    console.log(`[${timestamp}] [${step}] └─ ${data}`);
  }
}

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
// KEY SELECTION LOGIC (cópia fiel do código do amigo)
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
            validIndices.push(idx - 1); // converte para 0-based
        }
    }
    return validIndices;
}

function selectKeyParts(payload) {
    const keyParts = Array.isArray(payload.key_parts) ? payload.key_parts : [];
    const indices = getIndicesForVersion(payload.version, keyParts.length);
    
    log("KEY", `Versão ${payload.version}, índices: ${indices.map(i => i+1).join(', ')}`);
    
    if (indices.length === 0) {
        log("KEY", `Fallback: primeiras 2 partes`);
        return keyParts.slice(0, 2);
    }
    
    const selected = indices.map(i => keyParts[i]).filter(p => p && p.length > 0);
    log("KEY", `Selecionadas ${selected.length} partes`);
    return selected;
}

function reconstructKey(payload) {
    if (!payload || !Array.isArray(payload.key_parts) || payload.key_parts.length === 0) {
        throw new Error("Invalid payload: missing key_parts");
    }
    
    const selected = selectKeyParts(payload);
    const decoded = selected.map(p => base64ToBytes(p));
    const total = decoded.reduce((acc, arr) => acc + arr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of decoded) {
        out.set(arr, offset);
        offset += arr.length;
    }
    
    log("KEY", `Chave reconstruída: ${out.length} bytes`);
    
    // AES-256 precisa de 32 bytes
    if (out.length > 32) {
        log("KEY", `Ajustando para 32 bytes (primeiros 32)`);
        return out.slice(0, 32);
    }
    
    return out;
}

// ==============================================
// AES-256-GCM (usando Web Crypto API)
// ==============================================

async function decryptWithWebCrypto(keyBytes, ivBytes, encryptedData) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      tagLength: 128
    },
    cryptoKey,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
}

// ==============================================
// FUNÇÃO PRINCIPAL DE DESCRIPTOGRAFIA
// ==============================================

async function decryptPlayback(playback) {
  log("DECRYPT", "═══════════════════════════════════════════════════════════");
  log("DECRYPT", "INICIANDO DESCRIPTOGRAFIA");
  log("DECRYPT", `Versão: ${playback.version}`);
  log("DECRYPT", `Key Parts: ${playback.key_parts.length}`);
  log("DECRYPT", `IV: ${playback.iv}`);
  log("DECRYPT", `Payload length: ${playback.payload.length}`);
  
  try {
    // Reconstrói a chave usando a lógica correta
    const keyBytes = reconstructKey(playback);
    log("DECRYPT", `Chave final: ${keyBytes.length} bytes`);
    
    if (keyBytes.length < 32) {
      throw new Error(`Chave muito curta: ${keyBytes.length} bytes (esperado 32)`);
    }
    
    // Prepara IV
    const iv = base64ToBytes(playback.iv);
    log("DECRYPT", `IV: ${iv.length} bytes`);
    
    // Prepara ciphertext
    const ciphertext = base64ToBytes(playback.payload);
    log("DECRYPT", `Ciphertext: ${ciphertext.length} bytes`);
    
    // Descriptografa
    let decryptedString;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      decryptedString = await decryptWithWebCrypto(keyBytes.slice(0, 32), iv, ciphertext);
    } else {
      throw new Error("Web Crypto API não disponível");
    }
    
    log("DECRYPT", `Descriptografado: ${decryptedString.substring(0, 150)}...`);
    
    // Parse JSON
    let videoData;
    try {
      videoData = JSON.parse(decryptedString);
    } catch (e) {
      const cleaned = decryptedString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      videoData = JSON.parse(cleaned);
    }
    
    log("DECRYPT", `JSON parsed. Keys: ${Object.keys(videoData).join(', ')}`);
    
    // Extrai URL
    let m3u8Url = videoData.url ||
                  videoData.playlist_url ||
                  videoData.m3u8_url ||
                  (videoData.sources && videoData.sources[0] && videoData.sources[0].url);
    
    if (m3u8Url) {
      m3u8Url = m3u8Url.replace(/\\u0026/g, '&');
      log("DECRYPT", `✅ URL obtida: ${m3u8Url.substring(0, 100)}...`);
      return { success: true, url: m3u8Url, rawData: videoData };
    }
    
    log("DECRYPT", `❌ URL não encontrada`);
    return { success: false, error: "URL não encontrada", rawData: videoData };
    
  } catch (error) {
    log("DECRYPT", `❌ ERRO: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

// FINGERPRINT FIXO
function generateFingerprint() {
  const viewerId = "bed4fadd25c8dcdcaced26e318c3be5a";
  const deviceId = "b69c7e41fe010d4445b827dd95aa89fc";
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93,
    iat: timestamp,
    exp: timestamp + 600
  };
  const token = bytesToBase64(stringToUtf8Bytes(JSON.stringify(payload)));
  return { token, viewer_id: viewerId, device_id: deviceId, confidence: 0.93 };
}

async function detectRealQuality(videoUrl, headers) {
  try {
    const rangeHeaders = { ...headers, "Range": "bytes=0-5242880" };
    const response = await fetch(videoUrl, { headers: rangeHeaders });
    if (!response.ok) return 1080;

    const bytes = new Uint8Array(await response.arrayBuffer());
    let quality = 0;

    for (let i = 0; i < bytes.length - 20; i++) {
      if (bytes[i] === 0x74 && bytes[i+1] === 0x6B && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
        for (let offset = 48; offset <= 80; offset++) {
          if (i + offset + 8 <= bytes.length) {
            const widthFixed = ((bytes[i+offset] << 24) | (bytes[i+offset+1] << 16) | (bytes[i+offset+2] << 8) | bytes[i+offset+3]);
            const heightFixed = ((bytes[i+offset+4] << 24) | (bytes[i+offset+5] << 16) | (bytes[i+offset+6] << 8) | bytes[i+offset+7]);
            const width = Math.round(widthFixed / 65536.0);
            const height = Math.round(heightFixed / 65536.0);

            if (width >= 640 && width <= 7680 && height >= 360 && height <= 4320) {
              const pixels = width * height;
              quality = (pixels >= 6000000) ? 2160 :
                       (pixels >= 1400000) ? 1080 :
                       (pixels >= 700000)  ? 720 : 480;
              break;
            }
          }
        }
        if (quality) break;
      }
    }

    if (quality === 0) {
      const urlMatch = videoUrl.match(/(\d{3,4})p/i);
      quality = urlMatch ? parseInt(urlMatch[1]) : 1080;
    }

    return quality;
  } catch (error) {
    return 1080;
  }
}

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results && results.length > 0) {
      return { success: true, tmdbId: results[0].id };
    }
    return { success: false, error: "Nenhum resultado encontrado" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL getStreams
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  log("START", `═══════════════════════════════════════════════════════════`);
  log("START", `INICIANDO getStreams`);
  log("START", `Parâmetros: tmdbId=${tmdbId}, type=${mediaType}, season=${season}, episode=${episode}`);

  let finalTmdbId = tmdbId;

  if (isImdbId(tmdbId)) {
    const conversion = await convertImdbToTmdb(tmdbId, mediaType);
    if (conversion.success) {
      finalTmdbId = conversion.tmdbId;
    } else {
      log("START", "Falha na conversão IMDb");
      return [];
    }
  } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
    finalTmdbId = parseInt(tmdbId);
  }

  const seasonNum = mediaType === "movie" ? 1 : (season || 1);
  const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
  log("START", `Parâmetros finais: season=${seasonNum}, episode=${episodeNum}`);

  try {
    // ========== PASSO 1: Acessar api.pomfy.stream ==========
    const mediaTypeParam = mediaType === "tv" ? "serie" : "filme";
    const apiUrl = `${API_POMFY}/${mediaTypeParam}/${finalTmdbId}/${seasonNum}/${episodeNum}`;

    log("STEP1", `🌐 Acessando: ${apiUrl}`);

    const apiHeaders = {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "pt-BR,pt;q=0.9",
      "cookie": COOKIE,
      "referer": `https://pomfy.online/assistir/${finalTmdbId}?tipo=${mediaTypeParam}&temporada=${seasonNum}&episodio=${episodeNum}`,
      "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "iframe",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "cross-site",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent": USER_AGENT
    };

    const response = await fetch(apiUrl, { headers: apiHeaders });
    log("STEP1", `📡 HTTP Status: ${response.status}`);

    if (!response.ok) {
      log("STEP1", `❌ Falha HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    log("STEP1", `📄 HTML recebido: ${html.length} bytes`);

    // ========== PASSO 2: Extrair statusToken e byseId ==========
    const statusTokenMatch = html.match(/const statusToken="([^"]+)"/);
    if (!statusTokenMatch) {
      log("STEP2", `❌ statusToken NÃO encontrado`);
      return [];
    }

    const statusToken = statusTokenMatch[1];
    const byseId = statusToken.split('.')[0];
    log("STEP2", `✅ byseId=${byseId}`);
    log("STEP2", `🔑 statusToken: ${statusToken.substring(0, 60)}...`);

    // ========== PASSO 3: Chamar /api/play-token (opcional, para referer) ==========
    const playTokenUrl = `${API_POMFY}/api/play-token?t=${statusToken}`;
    log("STEP3", `🌐 Play-token: ${playTokenUrl}`);

    const playTokenResponse = await fetch(playTokenUrl, {
      headers: {
        "accept": "*/*",
        "cookie": COOKIE,
        "referer": apiUrl,
        "user-agent": USER_AGENT
      }
    });

    let embedPageUrl = null;
    if (playTokenResponse.ok) {
      const playTokenData = await playTokenResponse.json();
      embedPageUrl = playTokenData.url;
      log("STEP3", `✅ Embed URL: ${embedPageUrl}`);
    } else {
      log("STEP3", `⚠️ Play-token falhou: ${playTokenResponse.status}, continuando...`);
    }

    // ========== PASSO 4: Acessar 9n8o.com ==========
    let playerUrl = `https://9n8o.com/fu2/${byseId}`;
    log("STEP4", `🌐 Acessando player: ${playerUrl}`);

    let playerResponse = await fetch(playerUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "referer": embedPageUrl || apiUrl,
        "user-agent": USER_AGENT,
        "cookie": COOKIE,
        "sec-fetch-dest": "iframe"
      }
    });

    if (!playerResponse.ok) {
      log("STEP4", `⚠️ /fu2/ falhou (${playerResponse.status}), tentando /gtg/...`);
      playerUrl = `https://9n8o.com/gtg/${byseId}`;
      playerResponse = await fetch(playerUrl, {
        headers: {
          "accept": "text/html,application/xhtml+xml",
          "referer": embedPageUrl || apiUrl,
          "user-agent": USER_AGENT,
          "cookie": COOKIE,
          "sec-fetch-dest": "iframe"
        }
      });
    }

    if (!playerResponse.ok) {
      log("STEP4", `❌ Player falhou: ${playerResponse.status}`);
      return [];
    }

    log("STEP4", `✅ Player carregado: ${playerUrl}`);

    // ========== PASSO 5: Challenge ==========
    const challengeUrl = "https://9n8o.com/api/videos/access/challenge";
    log("STEP5", `🔐 Challenge: ${challengeUrl}`);

    try {
      const challengeResponse = await fetch(challengeUrl, {
        method: 'POST',
        headers: {
          "accept": "*/*",
          "origin": "https://9n8o.com",
          "referer": playerUrl,
          "user-agent": USER_AGENT
        }
      });
      log("STEP5", `✅ Challenge HTTP: ${challengeResponse.status}`);
    } catch (err) {
      log("STEP5", `⚠️ Challenge ignorado: ${err.message}`);
    }

    // ========== PASSO 6: Playback com fingerprint ==========
    const fingerprint = generateFingerprint();
    log("STEP6", `🔑 Fingerprint: ${fingerprint.viewer_id}`);

    const playbackUrl = `https://9n8o.com/api/videos/${byseId}/embed/playback`;
    log("STEP6", `🎬 Playback: ${playbackUrl}`);

    const embedParentUrl = `https://pomfy-cdn.shop/e/${byseId}`;
    
    const playbackResponse = await fetch(playbackUrl, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": "https://9n8o.com",
        "referer": embedParentUrl,
        "user-agent": USER_AGENT,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": embedParentUrl,
        "x-embed-referer": apiUrl
      },
      body: JSON.stringify({ fingerprint })
    });

    log("STEP6", `📡 Playback HTTP: ${playbackResponse.status}`);

    if (!playbackResponse.ok) {
      log("STEP6", `❌ Playback falhou: ${playbackResponse.status}`);
      try {
        const errorText = await playbackResponse.text();
        log("STEP6", `📦 Erro: ${errorText.substring(0, 200)}`);
      } catch(e) {}
      return [];
    }

    const playbackData = await playbackResponse.json();
    log("STEP6", `📦 Playback response recebida`);

    if (!playbackData.playback) {
      log("STEP6", `❌ Sem playback na resposta`);
      return [];
    }

    // ========== PASSO 7: Descriptografar ==========
    const decryptResult = await decryptPlayback(playbackData.playback);

    if (!decryptResult.success) {
      log("STEP7", `❌ Descriptografia falhou: ${decryptResult.error}`);
      return [];
    }

    const m3u8Url = decryptResult.url;
    log("STEP7", `✅ M3U8 obtido: ${m3u8Url.substring(0, 100)}...`);

    // ========== PASSO 8: Qualidade ==========
    const streamHeaders = {
      "User-Agent": USER_AGENT,
      "Referer": playerUrl,
      "Accept": "*/*"
    };

    const realQuality = await detectRealQuality(m3u8Url, streamHeaders);

    const title = mediaType === "movie"
      ? `Filme ${finalTmdbId} - ${realQuality}p`
      : `S${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")} - ${realQuality}p`;

    log("END", `═══════════════════════════════════════════════════════════`);
    log("END", `🎉 SUCESSO! Stream encontrado!`);
    log("END", `📺 Título: ${title}`);
    log("END", `🎬 Qualidade: ${realQuality}p`);
    log("END", `🔗 URL: ${m3u8Url.substring(0, 150)}...`);
    log("END", `═══════════════════════════════════════════════════════════`);

    return [{
      name: title,
      title: title,
      url: m3u8Url,
      quality: realQuality,
      headers: streamHeaders
    }];

  } catch (error) {
    log("ERROR", `❌ Exceção: ${error.message}`);
    log("ERROR", error.stack || "");
    return [];
  }
}

module.exports = { getStreams };
