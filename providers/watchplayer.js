/**
 * Watch Brasil Provider - Versão Corrigida
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

// ==============================================
// FUNÇÃO PRINCIPAL - FLUXO DIRETO (como no Python)
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

  const seasonNum = mediaType === "movie" ? 1 : (season || 1);
  const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
  addDebug(`📺 PARÂMETROS FINAIS`, `Tipo: ${mediaType}, Season: ${seasonNum}, Episode: ${episodeNum}`);

  try {
    // NOTA IMPORTANTE: O watchplayer.xyz USA O PRÓPRIO TMDB ID COMO ID INTERNO!
    // No exemplo que funcionou: tmdbId=46648 (True Detective) funcionou direto
    // Então vamos usar o próprio TMDB ID como watchId
    
    const watchId = finalTmdbId;
    addDebug(`✅ [1/3] USANDO TMDB ID COMO REFERÊNCIA`, watchId);

    // Passo 1: Buscar HTML do episódio para extrair content_id
    let episodeUrl;
    if (mediaType === "movie") {
      episodeUrl = `${WATCH_BASE_URL}/filme/${watchId}`;
    } else {
      episodeUrl = `${WATCH_BASE_URL}/tvshow/${watchId}/${seasonNum}/${episodeNum}`;
    }
    
    addDebug(`📡 [1/3] BUSCANDO EPISÓDIO`, episodeUrl);
    
    const htmlResponse = await fetch(episodeUrl, { headers: HEADERS });
    if (!htmlResponse.ok) {
      addDebug(`❌ [1/3] FALHA HTTP`, `Status: ${htmlResponse.status}`);
      return streams;
    }
    
    const html = await htmlResponse.text();
    addDebug(`📄 [1/3] HTML RECEBIDO`, `${html.length} bytes`);
    
    // Extrair content_id - padrão: data-contentid="1805"
    const contentIdMatch = html.match(/data-contentid="(\d+)"/);
    if (!contentIdMatch) {
      addDebug(`❌ [1/3] CONTENT_ID NÃO ENCONTRADO`, `Procurando por data-contentid no HTML`);
      // Mostra um trecho do HTML para debug
      addDebug(`📄 HTML SAMPLE`, html.substring(0, 1000));
      return streams;
    }
    
    const contentId = contentIdMatch[1];
    addDebug(`✅ [1/3] CONTENT_ID ENCONTRADO`, contentId);

    // Passo 2: Obter options via API
    addDebug(`📡 [2/3] BUSCANDO OPTIONS`, `contentid: ${contentId}`);
    
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
      addDebug(`❌ [2/3] OPTIONS FALHOU`, `HTTP ${optionsResponse.status}`);
      return streams;
    }
    
    const optionsData = await optionsResponse.json();
    addDebug(`📦 [2/3] OPTIONS RESPONSE`, optionsData);
    
    if (!optionsData.data?.options?.length) {
      addDebug(`❌ [2/3] NENHUMA OPÇÃO DISPONÍVEL`, optionsData);
      return streams;
    }
    
    // Coleta todos os video_ids disponíveis
    const videoOptions = optionsData.data.options;
    addDebug(`✅ [2/3] ENCONTRADAS ${videoOptions.length} OPÇÕES`, videoOptions.map(o => ({ ID: o.ID, type: o.type })));
    
    // Para cada opção, buscar a URL do player
    const results = [];
    
    for (const option of videoOptions) {
      const videoId = option.ID;
      const videoType = option.type;
      const audioType = videoType == 1 ? "Dublado" : (videoType == 2 ? "Legendado" : "Original");
      
      addDebug(`🎬 [3/3] BUSCANDO PLAYER`, `video_id: ${videoId} (${audioType})`);
      
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
            captionUrl = `${WATCH_BASE_URL}/app/caption/${mediaType}/${watchId}/leg/s${seasonNum}e${episodeNum}.vtt`;
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
        name: "Watch Brasil",
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
