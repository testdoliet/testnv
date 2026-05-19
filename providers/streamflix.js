/**
 * Gofilmes - Provider com fluxo de busca e extração
 * Fluxo: TMDB ID -> Título -> Busca no gofilmes -> Extrai ID -> Obtém .m3u8
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

const GOFILMES_URL = "https://gofilmes.media";
const SEMPRA_URL = "https://sempra.pro";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": GOFILMES_URL,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

function log(step, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [${step}] ${message}`);
  if (data !== null && typeof data === 'object') {
    console.log(`[${timestamp}] [${step}] └─ ${JSON.stringify(data).substring(0, 300)}`);
  }
}

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

async function getTmdbTitle(tmdbId, mediaType = 'movie') {
  const url = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.title || data.name;
}

// ==============================================
// BUSCA NO GOFILMES (AJAX)
// ==============================================

async function searchGofilmes(query, limit = 50) {
  log("SEARCH", `🔍 Buscando: "${query}"`);
  
  const searchUrl = `${GOFILMES_URL}/engine/ajax/controller.php?mod=search_posts&page=0&pagesize=${limit}&category=13&order=date`;
  
  try {
    const response = await fetch(searchUrl, { headers: HEADERS });
    if (!response.ok) return [];
    
    const data = await response.json();
    const results = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ');
    
    for (const item of (data.result || [])) {
      const title = item.title || "";
      const titleLower = title.toLowerCase();
      
      let matches = false;
      if (titleLower.includes(queryLower)) {
        matches = true;
      } else {
        for (const word of queryWords) {
          if (word.length > 2 && titleLower.includes(word)) {
            matches = true;
            break;
          }
        }
      }
      
      if (matches) {
        const url = item.url || "";
        const idMatch = url.match(/\/(\d+)-/);
        if (idMatch) {
          results.push({
            id: parseInt(idMatch[1]),
            title: title,
            url: url,
            type: url.includes('/filmes/') || url.includes('/drama/') ? 'movie' : 'tv'
          });
        }
      }
    }
    
    log("SEARCH", `✅ Encontrados ${results.length} resultados`);
    return results;
    
  } catch (error) {
    log("SEARCH", `❌ Erro: ${error.message}`);
    return [];
  }
}

// ==============================================
// EXTRAÇÃO DO STREAM
// ==============================================

async function checkAllowed() {
  try {
    const response = await fetch(`${SEMPRA_URL}/allowed`, { headers: HEADERS });
    const allowed = await response.text();
    return allowed.trim() === "OK";
  } catch (error) {
    return false;
  }
}

async function getStreamById(contentId, version = 0, season = 0, series = 0) {
  log("STREAM", `📡 Buscando stream para ID ${contentId}`);
  
  const allowed = await checkAllowed();
  if (!allowed) {
    log("STREAM", `❌ Acesso negado`);
    return null;
  }
  
  const playerUrl = `${SEMPRA_URL}/player?id=${contentId}&version=${version}&season=${season}&series=${series}&a=false&android=1`;
  
  try {
    const response = await fetch(playerUrl, {
      headers: { ...HEADERS, "Referer": `${GOFILMES_URL}/` }
    });
    
    if (!response.ok) return null;
    
    const js = await response.text();
    const pattern = /flixPlayer\('([^']+\.m3u8)'/;
    const match = js.match(pattern);
    
    if (match) {
      const m3u8Url = match[1];
      log("STREAM", `✅ M3U8 encontrado!`);
      log("STREAM", `🔗 ${m3u8Url.substring(0, 100)}...`);
      return m3u8Url;
    }
    
    return null;
    
  } catch (error) {
    log("STREAM", `❌ Erro: ${error.message}`);
    return null;
  }
}

// ==============================================
// DETECTOR DE QUALIDADE
// ==============================================

async function detectQuality(m3u8Url) {
  const quality = m3u8Url.includes('1080p') ? 1080 :
                  m3u8Url.includes('720p') ? 720 :
                  m3u8Url.includes('4k') || m3u8Url.includes('2160') ? 2160 : 1080;
  return quality;
}

// ==============================================
// FUNÇÃO PRINCIPAL getStreams
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  log("START", `═══════════════════════════════════════════════════════════`);
  log("START", `INICIANDO getStreams`);
  log("START", `TMDB ID: ${tmdbId}, Type: ${mediaType}, Season: ${season}, Episode: ${episode}`);
  
  let finalTmdbId = tmdbId;

  // Converter IMDb se necessário
  if (isImdbId(tmdbId)) {
    const conversion = await convertImdbToTmdb(tmdbId, mediaType);
    if (conversion.success) {
      finalTmdbId = conversion.tmdbId;
    } else {
      log("START", `❌ Falha na conversão IMDb`);
      return [];
    }
  } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
    finalTmdbId = parseInt(tmdbId);
  }

  // Obter título do TMDB
  const title = await getTmdbTitle(finalTmdbId, mediaType);
  if (!title) {
    log("START", `❌ Não foi possível obter o título do TMDB`);
    return [];
  }
  
  log("START", `📌 Título: "${title}"`);
  
  // Buscar no gofilmes
  const searchResults = await searchGofilmes(title);
  
  if (!searchResults || searchResults.length === 0) {
    log("START", `❌ Nenhum resultado encontrado`);
    return [];
  }
  
  // Mostrar resultados
  log("START", `📋 RESULTADOS ENCONTRADOS:`);
  for (let i = 0; i < Math.min(5, searchResults.length); i++) {
    log("START", `   ${i+1}. [${searchResults[i].id}] ${searchResults[i].title}`);
  }
  
  // Selecionar o primeiro
  const selected = searchResults[0];
  log("START", `✅ Selecionado: [${selected.id}] ${selected.title}`);
  
  // Obter stream
  const m3u8Url = await getStreamById(selected.id);
  
  if (!m3u8Url) {
    log("START", `❌ Falha ao obter stream`);
    return [];
  }
  
  const quality = await detectQuality(m3u8Url);
  
  const streamHeaders = {
    "User-Agent": USER_AGENT,
    "Referer": `${GOFILMES_URL}/`,
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9"
  };
  
  const result = [{
    name: `${selected.title} - ${quality}p`,
    title: selected.title,
    url: m3u8Url,
    quality: quality,
    headers: streamHeaders
  }];
  
  log("END", `═══════════════════════════════════════════════════════════`);
  log("END", `🎉 SUCESSO!`);
  log("END", `📺 ${result[0].name}`);
  log("END", `🔗 ${result[0].url.substring(0, 100)}...`);
  log("END", `═══════════════════════════════════════════════════════════`);
  
  return result;
}

module.exports = { getStreams };
