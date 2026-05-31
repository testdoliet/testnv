/**
 * WatchPlayer Provider - Versão Anti-Detecção
 * Com delay aleatório, cache e headers realistas
 */

// Cache em memória (válido por 5 minutos)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Delay aleatório entre 100ms e 800ms
const randomDelay = () => {
  const delay = Math.floor(Math.random() * 700) + 100;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Gera User-Agent aleatório (rotativo)
const getUserAgent = () => {
  const uas = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  return uas[Math.floor(Math.random() * uas.length)];
};

// Headers realistas para navegador
const getBrowserHeaders = (referer) => {
  const userAgent = getUserAgent();
  const isWindows = userAgent.includes("Windows");
  const isMobile = userAgent.includes("Android") || userAgent.includes("iPhone");
  
  return {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": isMobile ? "?1" : "?0",
    "Sec-Ch-Ua-Platform": isWindows ? '"Windows"' : (isMobile ? '"Android"' : '"macOS"'),
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://watchplayer.xyz"
  };
};

// Headers para API (XHR/fetch)
const getApiHeaders = (referer) => ({
  "User-Agent": getUserAgent(),
  "Accept": "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Origin": "https://watchplayer.xyz",
  "Referer": referer,
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "X-Requested-With": "XMLHttpRequest"
});

// Cache helper
const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCached = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Função principal getStreams
 */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  
  const addDebug = (title, content) => {
    streams.push({
      name: "WatchPlayer [DEBUG]",
      title: title,
      url: typeof content === 'object' ? JSON.stringify(content) : String(content),
      quality: 0,
      headers: {}
    });
  };

  addDebug(`🔍 INICIANDO BUSCA`, `${mediaType} ${tmdbId}`);

  try {
    // Delay inicial para simular navegador real
    await randomDelay();
    
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
      addDebug(`📡 BUSCANDO FILME`, url);
    } else {
      const seasonNum = season || 1;
      const episodeNum = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${seasonNum}/${episodeNum}`;
      addDebug(`📡 BUSCANDO SÉRIE`, `${url} (T${seasonNum}E${episodeNum})`);
    }

    // Verifica cache
    const cacheKey = `${mediaType}:${tmdbId}:${season}:${episode}`;
    const cachedResult = getCached(cacheKey);
    if (cachedResult) {
      addDebug(`💾 USANDO CACHE`, `Key: ${cacheKey}`);
      streams.length = 0;
      return cachedResult;
    }

    // Headers com referer correto
    const htmlHeaders = getBrowserHeaders(url);
    addDebug(`📋 HEADERS`, `User-Agent: ${htmlHeaders["User-Agent"].substring(0, 50)}...`);

    const htmlResp = await fetch(url, { headers: htmlHeaders });
    
    if (!htmlResp.ok) {
      addDebug(`❌ FALHA HTTP`, `Status: ${htmlResp.status}`);
      return streams;
    }

    // Delay após primeira requisição
    await randomDelay();

    const html = await htmlResp.text();
    addDebug(`📄 HTML`, `${html.length} bytes`);

    let videoId = null;

    if (mediaType === "movie") {
      // FILMES: extrai data-id
      const movieMatch = html.match(/<div class="player_select_item" data-id="(\d+)">/);
      if (movieMatch) {
        videoId = movieMatch[1];
        addDebug(`✅ VIDEO_ID ENCONTRADO (FILME)`, videoId);
      }
    } else {
      // SÉRIES: extrai content_id
      const seasonNum = season || 1;
      const episodeNum = episode || 1;
      
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${seasonNum}"[^>]*data-episode="${episodeNum}"`);
      const match = html.match(pattern);
      
      if (!match) {
        addDebug(`❌ CONTENT_ID NÃO ENCONTRADO`, `T${seasonNum}E${episodeNum}`);
        return streams;
      }
      
      const contentId = match[1];
      addDebug(`✅ CONTENT_ID ENCONTRADO (SÉRIE)`, contentId);
      
      // Delay antes da API
      await randomDelay();
      
      // Busca options via API
      const apiHeaders = getApiHeaders(url);
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: apiHeaders,
        body: `action=getOptions&contentid=${contentId}`
      });
      
      // Delay pós-requisição
      await randomDelay();
      
      const optsData = await optsResp.json();
      addDebug(`📦 OPTIONS RESPONSE`, optsData);
      
      if (!optsData.data?.options?.length) {
        addDebug(`❌ NENHUMA OPÇÃO DISPONÍVEL`, optsData);
        return streams;
      }
      
      videoId = optsData.data.options[0].ID;
      addDebug(`✅ VIDEO_ID VIA OPTIONS`, videoId);
    }

    if (!videoId) {
      addDebug(`❌ VIDEO_ID NÃO ENCONTRADO`, `Tipo: ${mediaType}`);
      return streams;
    }

    // Delay antes da última requisição
    await randomDelay();

    // Busca a URL do player
    addDebug(`📡 BUSCANDO PLAYER`, `video_id: ${videoId}`);
    
    const playerHeaders = getApiHeaders(url);
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: playerHeaders,
      body: `action=getPlayer&video_id=${videoId}`
    });

    const playerData = await playerResp.json();
    addDebug(`📦 PLAYER RESPONSE`, playerData);
    
    if (!playerData.data?.video_url) {
      addDebug(`❌ URL NÃO ENCONTRADA`, playerData);
      return streams;
    }

    const videoUrl = playerData.data.video_url;
    addDebug(`✅ URL OBTIDA`, videoUrl);

    // Headers para o stream final (sem compressão)
    const streamHeaders = {
      "User-Agent": getUserAgent(),
      "Accept-Encoding": "identity",
      "Accept": "*/*",
      "Origin": "https://watchplayer.xyz",
      "Referer": "https://watchplayer.xyz/",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache"
    };

    // Remove debug streams
    streams.length = 0;

    const result = [{
      name: "WatchPlayer",
      title: "1080p",
      url: videoUrl,
      quality: 1080,
      type: "hls",
      headers: streamHeaders
    }];

    // Salva no cache
    setCached(cacheKey, result);
    addDebug(`💾 CACHE SALVO`, `Key: ${cacheKey} (válido por ${CACHE_TTL/1000}s)`);

    return result;

  } catch (e) {
    addDebug(`❌ ERRO`, e.message);
    return streams;
  }
}

module.exports = { getStreams };
