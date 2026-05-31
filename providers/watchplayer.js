/**
 * WatchPlayer Provider - Versão Corrigida (sem Buffer)
 * Baseado no Pomfy que funciona no Nuvio
 */

// Cache em memória
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ==============================================
// BASE64 MANUAL (igual ao Pomfy)
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
// ANTI-DETECÇÃO (inspirado no Pomfy)
// ==============================================

const randomDelay = (min = 100, max = 500) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

const generateRandomId = (length) => {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateFingerprint = () => {
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
  
  return { token, viewer_id: viewerId, device_id: deviceId };
};

const getUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

const getHtmlHeaders = (referer) => {
  const userAgent = getUserAgent();
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://watchplayer.xyz",
    "X-Fingerprint": fingerprint.token
  };
};

const getApiHeaders = (referer) => {
  const userAgent = getUserAgent();
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": userAgent,
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": referer,
    "Origin": "https://watchplayer.xyz",
    "X-Fingerprint": fingerprint.token
  };
};

const getStreamHeaders = () => {
  return {
    "User-Agent": getUserAgent(),
    "Accept-Encoding": "identity",
    "Accept": "*/*",
    "Origin": "https://watchplayer.xyz",
    "Referer": "https://watchplayer.xyz/",
    "Connection": "keep-alive"
  };
};

// ==============================================
// DETECÇÃO DE QUALIDADE POR PADRÃO NA URL (simples)
// ==============================================

const detectQualityByUrl = (url) => {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('1080') || urlLower.includes('fhd') || urlLower.includes('1920')) {
    return { label: '1080p', value: 1080 };
  } else if (urlLower.includes('720') || urlLower.includes('hd')) {
    return { label: '720p', value: 720 };
  } else if (urlLower.includes('480') || urlLower.includes('sd')) {
    return { label: '480p', value: 480 };
  } else if (urlLower.includes('360')) {
    return { label: '360p', value: 360 };
  }
  
  return { label: '1080p', value: 1080 };
};

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];

  try {
    // Cache check
    const cacheKey = `${mediaType}:${tmdbId}:${season}:${episode}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    // Delay inicial
    await randomDelay(100, 300);

    // Monta URL
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${s}/${e}`;
    }

    // Busca HTML
    const htmlResp = await fetch(url, { headers: getHtmlHeaders(url) });
    if (!htmlResp.ok) return [];

    const html = await htmlResp.text();
    let videoId = null;

    if (mediaType === "movie") {
      // Filmes: pega data-id
      const match = html.match(/<div class="player_select_item" data-id="(\d+)">/);
      if (match) videoId = match[1];
    } else {
      // Séries: content_id + options
      const s = season || 1;
      const e = episode || 1;
      
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
      const match = html.match(pattern);
      
      if (!match) return [];
      
      const contentId = match[1];
      
      await randomDelay(150, 400);
      
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: getApiHeaders(url),
        body: `action=getOptions&contentid=${contentId}`
      });
      
      if (!optsResp.ok) return [];
      
      const optsData = await optsResp.json();
      
      if (optsData.data?.options?.length) {
        videoId = optsData.data.options[0].ID;
      }
    }

    if (!videoId) return [];

    await randomDelay(100, 250);

    // Busca URL do player
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: getApiHeaders(url),
      body: `action=getPlayer&video_id=${videoId}`
    });
    
    if (!playerResp.ok) return [];
    
    const playerData = await playerResp.json();
    
    if (!playerData.data?.video_url) return [];
    
    const videoUrl = playerData.data.video_url;
    
    // Detecta qualidade
    const quality = detectQualityByUrl(videoUrl);

    // Headers para o stream
    const streamHeaders = getStreamHeaders();

    const result = [{
      name: "WatchPlayer",
      title: quality.label,
      url: videoUrl,
      quality: quality.value,
      type: "hls",
      headers: streamHeaders
    }];

    // Salva cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
