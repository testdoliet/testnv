/**
 * WatchPlayer Provider - Versão Manual para quick.js (Nuvio)
 * Baseado no fluxo que funcionou nos testes
 * Sem dependências externas, tudo manual
 */

// Cache simples em memória
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Delay manual (se existir sleep no ambiente)
const sleep = (ms) => {
  if (typeof $sleep !== 'undefined') return $sleep(ms);
  if (typeof sleep !== 'undefined') return sleep(ms);
  // Fallback: loop vazio (não ideal, mas funciona)
  const start = Date.now();
  while (Date.now() - start < ms) {}
};

// Função para classificar qualidade manualmente
const classifyQuality = (url) => {
  const urlLower = url.toLowerCase();
  
  // Detecção por padrões na URL
  if (urlLower.includes('1080') || urlLower.includes('hd') || urlLower.includes('fhd')) {
    return '1080p';
  } else if (urlLower.includes('720') || urlLower.includes('hd720')) {
    return '720p';
  } else if (urlLower.includes('480') || urlLower.includes('sd')) {
    return '480p';
  } else if (urlLower.includes('360')) {
    return '360p';
  }
  
  // Por padrão, assume 1080p (mais comum)
  return '1080p';
};

// Função principal
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  const debug = [];

  const addDebug = (title, content) => {
    debug.push({ title, content: String(content).substring(0, 200) });
  };

  addDebug("🔍 INICIANDO", `${mediaType} ${tmdbId}`);

  try {
    // Cache key
    const cacheKey = `${mediaType}:${tmdbId}:${season}:${episode}`;
    
    // Verifica cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        addDebug("💾 CACHE", "Usando resultado em cache");
        return cached.data;
      }
    }

    // Delay inicial (simula navegador)
    await sleep(100 + Math.random() * 200);

    // Monta URL
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${s}/${e}`;
    }
    addDebug("📡 URL", url);

    // Headers padrão
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "Referer": "https://playerflix.ink/",
      "Origin": "https://watchplayer.xyz"
    };

    // Busca HTML
    const htmlResp = await fetch(url, { headers });
    if (!htmlResp.ok) {
      addDebug("❌ ERRO", `HTTP ${htmlResp.status}`);
      return [];
    }

    const html = await htmlResp.text();
    addDebug("📄 HTML", `${html.length} bytes`);

    let videoId = null;

    // ========== EXTRAI VIDEO_ID ==========
    if (mediaType === "movie") {
      // Filmes: pega data-id direto
      const match = html.match(/<div class="player_select_item" data-id="(\d+)">/);
      if (match) {
        videoId = match[1];
        addDebug("✅ VIDEO_ID (FILME)", videoId);
      }
    } else {
      // Séries: pega content_id primeiro
      const s = season || 1;
      const e = episode || 1;
      
      // Regex manual que funciona com a ordem data-contentid primeiro
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
      const match = html.match(pattern);
      
      if (!match) {
        addDebug("❌ CONTENT_ID", `T${s}E${e} não encontrado`);
        return [];
      }
      
      const contentId = match[1];
      addDebug("✅ CONTENT_ID", contentId);
      
      // Delay antes da API
      await sleep(100 + Math.random() * 150);
      
      // Busca options via API
      const apiHeaders = {
        "User-Agent": headers["User-Agent"],
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": url,
        "Origin": "https://watchplayer.xyz"
      };
      
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: apiHeaders,
        body: `action=getOptions&contentid=${contentId}`
      });
      
      if (!optsResp.ok) {
        addDebug("❌ OPTIONS", `HTTP ${optsResp.status}`);
        return [];
      }
      
      const optsData = await optsResp.json();
      
      if (optsData.data?.options?.length) {
        videoId = optsData.data.options[0].ID;
        addDebug("✅ VIDEO_ID (SÉRIE)", videoId);
      }
    }

    if (!videoId) {
      addDebug("❌ VIDEO_ID", "Não encontrado");
      return [];
    }

    // Delay antes da última requisição
    await sleep(100 + Math.random() * 150);

    // ========== BUSCA URL DO PLAYER ==========
    const playerHeaders = {
      "User-Agent": headers["User-Agent"],
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": url,
      "Origin": "https://watchplayer.xyz"
    };
    
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: playerHeaders,
      body: `action=getPlayer&video_id=${videoId}`
    });
    
    if (!playerResp.ok) {
      addDebug("❌ PLAYER", `HTTP ${playerResp.status}`);
      return [];
    }
    
    const playerData = await playerResp.json();
    
    if (!playerData.data?.video_url) {
      addDebug("❌ URL", "Não encontrada");
      return [];
    }
    
    const videoUrl = playerData.data.video_url;
    addDebug("✅ URL", videoUrl.substring(0, 80));

    // ========== CLASSIFICA QUALIDADE MANUALMENTE ==========
    const quality = classifyQuality(videoUrl);
    addDebug("🎯 QUALIDADE", quality);

    // Headers para o stream final
    const streamHeaders = {
      "User-Agent": headers["User-Agent"],
      "Accept-Encoding": "identity",
      "Accept": "*/*",
      "Origin": "https://watchplayer.xyz",
      "Referer": "https://watchplayer.xyz/",
      "Connection": "keep-alive"
    };

    // ========== MONTA RESULTADO ==========
    const result = [{
      name: "WatchPlayer",
      title: quality,
      url: videoUrl,
      quality: quality === "1080p" ? 1080 : (quality === "720p" ? 720 : 480),
      type: "hls",
      headers: streamHeaders
    }];

    // Salva no cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (err) {
    addDebug("❌ ERRO CRÍTICO", err.message);
    return [];
  }
}

module.exports = { getStreams };
