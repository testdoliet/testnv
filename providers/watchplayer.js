/**
 * WatchPlayer Provider - Versão Simplificada
 * Qualidade fixa: 720p
 * Sem cache para evitar problemas
 */

// ==============================================
// BASE64 MANUAL (igual ao Pomfy)
// ==============================================

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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
// ANTI-DETECÇÃO
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
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": getUserAgent(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://watchplayer.xyz",
    "X-Fingerprint": fingerprint.token
  };
};

const getApiHeaders = (referer) => {
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": getUserAgent(),
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
// FUNÇÃO PRINCIPAL
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
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
      const match = html.match(/data-id="(\d+)"/);
      if (match) videoId = match[1];
    } else {
      // Séries: pega content-id do episódio
      const s = season || 1;
      const e = episode || 1;
      
      let pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
      let match = html.match(pattern);
      
      if (!match) {
        pattern = new RegExp(`data-season="${s}"[^>]*data-episode="${e}"[^>]*data-contentid="(\\d+)"`);
        match = html.match(pattern);
      }
      
      if (!match) return [];
      
      const contentId = match[1];
      
      await randomDelay(150, 400);
      
      // Busca options
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

    // Qualidade fixa: 720p
    return [{
      name: "WatchPlayer",
      title: "720p",
      url: videoUrl,
      quality: 720,
      type: "hls",
      headers: getStreamHeaders()
    }];

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
