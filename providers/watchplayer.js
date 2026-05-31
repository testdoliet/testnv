/**
 * Watch Brasil Provider - Versão Corrigida para Filmes
 * Baseado no fluxo que funcionou via Python
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

const WATCH_BASE_URL = "https://watchplayer.xyz";
const PLAYERFLIX_BASE_URL = "https://playerflix.ink";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://watchplayer.xyz/",
  "Origin": "https://watchplayer.xyz"
};

const HLS_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Encoding": "identity",
  "Accept": "*/*",
  "Origin": "https://watchplayer.xyz",
  "Referer": "https://watchplayer.xyz/",
  "Connection": "keep-alive"
};

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, { 
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } 
    });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results && results.length > 0) return { success: true, tmdbId: results[0].id };
    return { success: false, error: "Nenhum resultado encontrado" };
  } catch (error) { 
    return { success: false, error: error.message }; 
  }
}

// Busca o ID interno do watchplayer baseado na busca
async function searchWatchId(tmdbId, mediaType) {
  try {
    // Tenta buscar via API de busca
    const searchUrl = `${WATCH_BASE_URL}/api/search?q=tmdb:${tmdbId}`;
    const response = await fetch(searchUrl, { headers: HEADERS });
    
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.id) {
        return { success: true, watchId: data.data.id };
      }
    }
    
    // Fallback: busca via scraping da página de busca
    const searchPageUrl = `${WATCH_BASE_URL}/search/${tmdbId}`;
    const searchRes = await fetch(searchPageUrl, { headers: HEADERS });
    
    if (searchRes.ok) {
      const html = await searchRes.text();
      
      // Procura por links de filme ou série
      let patterns = [];
      if (mediaType === "movie") {
        patterns = [
          /href="\/filme\/(\d+)"/,
          /data-movie-id="(\d+)"/,
          /\/filme\/(\d+)/,
          /id_movie=(\d+)/
        ];
      } else {
        patterns = [
          /href="\/tvshow\/(\d+)"/,
          /data-tv-id="(\d+)"/,
          /\/tvshow\/(\d+)/
        ];
      }
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return { success: true, watchId: match[1] };
        }
      }
    }
    
    return { success: false, error: "ID não encontrado via search" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  
  const addDebug = (title, content) => {
    let debugContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
    if (debugContent.length > 500) debugContent = debugContent.substring(0, 500) + '...';
    streams.push({
      name: "Watch Brasil [DEBUG]",
      title: title,
      url: debugContent,
      quality: 0,
      headers: {}
    });
  };

  addDebug(`🔍 INICIANDO BUSCA`, `${mediaType} ${tmdbId}`);
  
  let finalTmdbId = tmdbId;

  // Converte IMDb para TMDb se necessário
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

  const seasonNum = mediaType === "movie" ? null : (season || 1);
  const episodeNum = mediaType === "movie" ? null : (episode || 1);
  addDebug(`📺 PARÂMETROS FINAIS`, `Tipo: ${mediaType}, Season: ${seasonNum}, Episode: ${episodeNum}`);

  try {
    // Passo 0: Buscar o ID interno do watchplayer
    addDebug(`🔎 [0/4] BUSCANDO ID INTERNO`, `TMDB ID: ${finalTmdbId}`);
    
    const searchResult = await searchWatchId(finalTmdbId, mediaType);
    let watchId;
    
    if (searchResult.success) {
      watchId = searchResult.watchId;
      addDebug(`✅ [0/4] ID INTERNO ENCONTRADO`, watchId);
    } else {
      // Fallback: tenta usar o próprio TMDB ID como fallback
      watchId = finalTmdbId;
      addDebug(`⚠️ [0/4] USANDO TMDB ID COMO FALLBACK`, `${watchId} (${searchResult.error})`);
    }

    // Passo 1: Buscar HTML do conteúdo
    let contentUrl;
    if (mediaType === "movie") {
      contentUrl = `${WATCH_BASE_URL}/filme/${watchId}`;
    } else {
      contentUrl = `${WATCH_BASE_URL}/tvshow/${watchId}/${seasonNum}/${episodeNum}`;
    }
    
    addDebug(`📡 [1/4] BUSCANDO CONTEÚDO`, contentUrl);
    
    const htmlResponse = await fetch(contentUrl, { headers: HEADERS });
    if (!htmlResponse.ok) {
      addDebug(`❌ [1/4] FALHA HTTP`, `Status: ${htmlResponse.status} - URL pode ser inválida`);
      return streams;
    }
    
    const html = await htmlResponse.text();
    addDebug(`📄 [1/4] HTML RECEBIDO`, `${html.length} bytes`);
    
    // Extrair content_id - para filmes é diferente
    let contentId = null;
    
    if (mediaType === "movie") {
      // Para filmes, procura padrões diferentes
      const moviePatterns = [
        /data-contentid="(\d+)"/,
        /data-video-id="(\d+)"/,
        /content_id['"]?\s*[:=]\s*['"]?(\d+)/,
        /var\s+contentId\s*=\s*['"](\d+)['"]/,
        /video_id\s*:\s*(\d+)/
      ];
      
      for (const pattern of moviePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          contentId = match[1];
          break;
        }
      }
      
      // Se não achou, tenta pegar da API inline
      if (!contentId) {
        const apiMatch = html.match(/\/api[^"']*contentid[=:](\d+)/i);
        if (apiMatch && apiMatch[1]) {
          contentId = apiMatch[1];
        }
      }
    } else {
      // Para séries, usa o padrão já testado
      const episodeMatch = html.match(new RegExp(`data-season="${seasonNum}"[^>]*data-episode="${episodeNum}"[^>]*data-contentid="(\\d+)"`));
      if (episodeMatch && episodeMatch[1]) {
        contentId = episodeMatch[1];
      } else {
        const fallbackMatch = html.match(/data-contentid="(\d+)"/);
        if (fallbackMatch && fallbackMatch[1]) {
          contentId = fallbackMatch[1];
        }
      }
    }
    
    if (!contentId) {
      addDebug(`❌ [1/4] CONTENT_ID NÃO ENCONTRADO`, `MediaType: ${mediaType}`);
      // Mostra trecho do HTML para debug
      addDebug(`📄 HTML SAMPLE (primeiros 2000 chars)`, html.substring(0, 2000));
      return streams;
    }
    
    addDebug(`✅ [1/4] CONTENT_ID ENCONTRADO`, contentId);

    // Passo 2: Obter options via API
    addDebug(`📡 [2/4] BUSCANDO OPTIONS`, `contentid: ${contentId}`);
    
    const optionsResponse = await fetch(`${WATCH_BASE_URL}/api`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: `action=getOptions&contentid=${contentId}`
    });
    
    if (!optionsResponse.ok) {
      addDebug(`❌ [2/4] OPTIONS FALHOU`, `HTTP ${optionsResponse.status}`);
      return streams;
    }
    
    const optionsData = await optionsResponse.json();
    addDebug(`📦 [2/4] OPTIONS RESPONSE`, optionsData);
    
    if (!optionsData.data?.options?.length) {
      addDebug(`❌ [2/4] NENHUMA OPÇÃO DISPONÍVEL`, optionsData);
      return streams;
    }
    
    const videoOptions = optionsData.data.options;
    addDebug(`✅ [2/4] ENCONTRADAS ${videoOptions.length} OPÇÕES`, videoOptions.map(o => ({ ID: o.ID, type: o.type })));
    
    // Passo 3: Para cada opção, buscar URL do player
    const results = [];
    
    for (const option of videoOptions) {
      const videoId = option.ID;
      const videoType = option.type;
      const audioType = videoType == 1 ? "Dublado" : (videoType == 2 ? "Legendado" : "Original");
      
      addDebug(`🎬 [3/4] BUSCANDO PLAYER`, `video_id: ${videoId} (${audioType})`);
      
      const playerResponse = await fetch(`${WATCH_BASE_URL}/api`, {
        method: "POST",
        headers: {
          ...HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: `action=getPlayer&video_id=${videoId}`
      });
      
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        let videoUrl = playerData.data?.video_url;
        let captionUrl = playerData.data?.video_caption_url;
        
        if (videoUrl) {
          // Processa URL de legendas se existir
          if (captionUrl && captionUrl === String(watchId)) {
            if (mediaType === "movie") {
              captionUrl = `${WATCH_BASE_URL}/app/caption/movie/${watchId}/leg.vtt`;
            } else {
              captionUrl = `${WATCH_BASE_URL}/app/caption/tv/${watchId}/leg/s${seasonNum}e${episodeNum}.vtt`;
            }
          }
          
          results.push({
            url: videoUrl,
            audio: audioType,
            caption: captionUrl
          });
          
          addDebug(`✅ URL OBTIDA`, `${audioType}: ${videoUrl.substring(0, 80)}...`);
        } else {
          addDebug(`⚠️ SEM URL`, `${audioType}: ${JSON.stringify(playerData)}`);
        }
      } else {
        addDebug(`⚠️ PLAYER FALHOU`, `${audioType}: HTTP ${playerResponse.status}`);
      }
    }
    
    if (results.length === 0) {
      addDebug(`❌ NENHUMA URL FOI OBTIDA`, `Tentativas: ${videoOptions.length}`);
      return streams;
    }
    
    // Remove streams de debug
    streams.length = 0;
    
    // Adiciona streams encontrados
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      streams.push({
        name: "WatchPlayer",
        title: `${result.audio} - 1080p`,
        url: result.url,
        quality: 1080,
        type: "hls",
        headers: HLS_HEADERS,
        subtitles: result.caption ? [{
          language: "Português",
          url: result.caption,
          default: true
        }] : []
      });
    }
    
    addDebug(`🎉 SUCESSO! ${streams.length} STREAM(S) ENCONTRADO(S)`, streams.map(s => s.title));
    return streams;
    
  } catch (e) { 
    addDebug(`❌ ERRO CRÍTICO`, `${e.message}\n${e.stack || ''}`);
    return streams;
  }
}

module.exports = { getStreams };
