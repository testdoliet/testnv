/**
 * Gofilmes - Provider para Nuvio/QuickJS
 * Fluxo: TMDB ID -> Busca sequencial por páginas -> Extrai M3U8
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
const PROVIDER_NAME = "GoFilmes";

const MAX_PAGES = 999;           // Máximo de páginas para buscar
const MIN_SCORE_THRESHOLD = 35;

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "accept": "application/json, text/javascript, */*; q=0.01",
  "accept-language": "pt-BR,pt;q=0.9",
  "referer": GOFILMES_URL,
  "x-requested-with": "XMLHttpRequest",
  "user-agent": USER_AGENT
};

// ==============================================
// LOG
// ==============================================

function log(step, message, data = null) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${ts}] [${step}] ${message}`);
  if (data !== null && typeof data === 'object') {
    console.log(`[${ts}] [${step}] └─ ${JSON.stringify(data).substring(0, 300)}`);
  }
}

// ==============================================
// TMDB
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results.length > 0) return { success: true, tmdbId: results[0].id };
    return { success: false, error: "Não encontrado" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getTmdbInfo(tmdbId, mediaType = "movie") {
  try {
    const url = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    const ptTitle = data.title || data.name || null;
    const origTitle = data.original_title || data.original_name || null;
    const dateStr = data.release_date || data.first_air_date || "";
    const year = dateStr ? parseInt(dateStr.substring(0, 4)) : null;
    return { ptTitle, origTitle, year };
  } catch (e) {
    return null;
  }
}

// ==============================================
// NORMALIZAÇÃO
// ==============================================

function removeAccents(str) {
  const map = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n',
    'À': 'a', 'Á': 'a', 'Â': 'a', 'Ã': 'a', 'Ä': 'a',
    'È': 'e', 'É': 'e', 'Ê': 'e', 'Ë': 'e',
    'Ì': 'i', 'Í': 'i', 'Î': 'i', 'Ï': 'i',
    'Ò': 'o', 'Ó': 'o', 'Ô': 'o', 'Õ': 'o', 'Ö': 'o',
    'Ù': 'u', 'Ú': 'u', 'Û': 'u', 'Ü': 'u',
    'Ç': 'c', 'Ñ': 'n'
  };
  return str.replace(/[àáâãäèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ]/g, c => map[c] || c);
}

function normalizeTitle(title) {
  if (!title) return "";
  return removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(o|a|os|as|um|uma|the|de|do|da|dos|das|em|no|na|e|and|of|in|la|le|el)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==============================================
// SCORING
// ==============================================

function jaccardSimilarity(a, b) {
  const wa = a.split(" ").filter(w => w.length > 1);
  const wb = b.split(" ").filter(w => w.length > 1);
  if (wa.length === 0 || wb.length === 0) return 0;
  const sa = new Set(wa);
  const sb = new Set(wb);
  let intersection = 0;
  for (const w of sa) {
    if (sb.has(w)) intersection++;
  }
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function scoreResult(result, targetTitle, targetYear, targetType) {
  let score = 0;
  const normResult = normalizeTitle(result.title);
  const normTarget = normalizeTitle(targetTitle);
  const jaccard = jaccardSimilarity(normResult, normTarget);
  
  if (jaccard >= 0.85) score += 50;
  else if (jaccard >= 0.60) score += 35;
  else if (jaccard >= 0.35) score += 15;
  else return 0;
  
  if (result.year && targetYear && !isNaN(result.year)) {
    if (result.year === targetYear) score += 30;
    else if (Math.abs(result.year - targetYear) === 1) score += 10;
  }
  
  if (result.type === targetType) score += 20;
  return score;
}

function findBestMatch(results, titlesToTry, year, mediaType) {
  let bestResult = null;
  let bestScore = 0;
  for (const result of results) {
    for (const title of titlesToTry) {
      if (!title) continue;
      const score = scoreResult(result, title, year, mediaType);
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }
  }
  if (bestScore < MIN_SCORE_THRESHOLD) return null;
  return bestResult;
}

// ==============================================
// BUSCA SEQUENCIAL (COMPATÍVEL COM QUICKJS)
// ==============================================

// Busca uma única página
async function fetchPage(page, category) {
  const url = `${GOFILMES_URL}/engine/ajax/controller.php?mod=search_posts&page=${page}&pagesize=50&category=${category}&categoryexclude=9&order=date&w=282&h=421`;
  
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    log("FETCH", `Erro na página ${page}: ${e.message}`);
    return null;
  }
}

// Busca por TMDB ID (sequencial - compatível com QuickJS)
async function searchByTmdbId(tmdbId, mediaType = "tv") {
  const category = mediaType === "tv" ? 14 : 13;
  const searchId = parseInt(tmdbId);
  
  log("SEARCH", `🔍 Buscando TMDB ID ${searchId} (categoria ${category})`);
  
  // Busca sequencial página por página (sem Promise.all)
  for (let page = 0; page < MAX_PAGES; page++) {
    const items = await fetchPage(page, category);
    if (!items) continue;
    
    for (const item of items) {
      const itemTmdb = item.xfields?.tmdb_id;
      if (itemTmdb && parseInt(itemTmdb) === searchId) {
        log("SEARCH", `✅ Encontrado na página ${page + 1}!`);
        log("SEARCH", `   Título: ${item.title}`);
        log("SEARCH", `   ID GoFilmes: ${item.id}`);
        
        let year = null;
        if (item.xfields?.year) {
          const yearStr = String(item.xfields.year);
          const yearMatch = yearStr.match(/\d{4}/);
          if (yearMatch) year = parseInt(yearMatch[0]);
        }
        
        return {
          id: parseInt(item.id),
          title: item.title,
          url: item.url,
          year: year,
          type: mediaType,
          tmdbId: parseInt(item.xfields.tmdb_id),
          imdbId: item.xfields?.imdb_id
        };
      }
    }
    
    // Log de progresso a cada 5 páginas
    if ((page + 1) % 5 === 0) {
      log("SEARCH", `📄 Página ${page + 1}/${MAX_PAGES} - ${items.length} itens`);
    }
  }
  
  log("SEARCH", `❌ TMDB ID ${searchId} não encontrado em ${MAX_PAGES} páginas`);
  return null;
}

// Busca por título (sequencial - fallback)
async function searchByTitle(query, mediaType = "tv") {
  const category = mediaType === "tv" ? 14 : 13;
  const queryLower = query.toLowerCase();
  const allMatches = [];
  const seenIds = new Set();
  
  log("SEARCH", `🔍 Buscando por título: "${query}"`);
  
  for (let page = 0; page < MAX_PAGES; page++) {
    const items = await fetchPage(page, category);
    if (!items) continue;
    
    for (const item of items) {
      const title = item.title || "";
      if (!title || seenIds.has(item.id)) continue;
      
      if (title.toLowerCase().includes(queryLower)) {
        seenIds.add(item.id);
        
        let year = null;
        if (item.xfields?.year) {
          const yearStr = String(item.xfields.year);
          const yearMatch = yearStr.match(/\d{4}/);
          if (yearMatch) year = parseInt(yearMatch[0]);
        }
        
        allMatches.push({
          id: parseInt(item.id),
          title: title,
          url: item.url,
          year: year,
          type: mediaType,
          tmdbId: item.xfields?.tmdb_id ? parseInt(item.xfields.tmdb_id) : null
        });
        
        log("SEARCH", `   📌 "${title}" (ID: ${item.id})`);
      }
    }
  }
  
  log("SEARCH", `✅ Total: ${allMatches.length} resultados para "${query}"`);
  return allMatches;
}

// ==============================================
// STREAM EXTRACTION
// ==============================================

async function checkAllowed() {
  try {
    const res = await fetch(`${SEMPRA_URL}/allowed`, { headers: { "User-Agent": USER_AGENT } });
    const text = await res.text();
    return text.trim() === "OK";
  } catch {
    return false;
  }
}

async function getStreamById(contentId, season = 0, episode = 0) {
  log("STREAM", `📡 Extraindo stream para ID: ${contentId}`);
  
  if (!(await checkAllowed())) {
    log("STREAM", `❌ Acesso negado`);
    return null;
  }

  const playerUrl = `${SEMPRA_URL}/player?id=${contentId}&version=0&season=${season}&series=${episode}&a=false&android=1`;

  try {
    const res = await fetch(playerUrl, {
      headers: { 
        "User-Agent": USER_AGENT,
        "Referer": `${GOFILMES_URL}/`,
        "Accept": "*/*"
      }
    });
    
    if (!res.ok) {
      log("STREAM", `❌ HTTP ${res.status}`);
      return null;
    }

    const js = await res.text();
    const match = js.match(/flixPlayer\('([^']+\.m3u8)'/);

    if (match) {
      const m3u8Url = match[1];
      log("STREAM", `✅ M3U8 obtido!`);
      return m3u8Url;
    }

    log("STREAM", `⚠️ Padrão flixPlayer não encontrado`);
    return null;

  } catch (e) {
    log("STREAM", `❌ Erro: ${e.message}`);
    return null;
  }
}

async function detectQualityFromM3u8(m3u8Url, requestHeaders) {
  try {
    const res = await fetch(m3u8Url, { headers: requestHeaders });
    if (!res.ok) return { label: "?", height: 0 };
    const text = await res.text();
    const matches = text.match(/RESOLUTION=(\d+)x(\d+)/g);
    if (matches && matches.length > 0) {
      let maxH = 0;
      for (const m of matches) {
        const parts = m.replace("RESOLUTION=", "").split("x");
        const h = parseInt(parts[1]);
        if (h > maxH) maxH = h;
      }
      const label = maxH >= 2160 ? "4K" : maxH >= 1080 ? "1080p" : maxH >= 720 ? "720p" : maxH >= 480 ? "480p" : "SD";
      return { label, height: maxH };
    }
    return { label: "?", height: 0 };
  } catch (e) {
    return { label: "?", height: 0 };
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const startTime = Date.now();
  
  log("START", `═══════════════════════════════════════════════════════════`);
  log("START", `TMDB ID: ${tmdbId} | Type: ${mediaType} | S${season}E${episode}`);

  // Normaliza ID
  let finalId = tmdbId;
  if (isImdbId(tmdbId)) {
    const conv = await convertImdbToTmdb(tmdbId, mediaType);
    if (!conv.success) {
      log("START", `❌ Conversão IMDb falhou: ${conv.error}`);
      return [];
    }
    finalId = conv.tmdbId;
    log("START", `✅ IMDb convertido para TMDB: ${finalId}`);
  } else if (typeof tmdbId === "string") {
    finalId = parseInt(tmdbId);
  }

  // ESTRATÉGIA 1: Busca por TMDB ID (mais rápida e precisa)
  let bestMatch = await searchByTmdbId(finalId, mediaType);
  
  // ESTRATÉGIA 2: Busca por título (fallback)
  if (!bestMatch) {
    log("START", `⚠️ Busca por TMDB ID falhou, tentando por título...`);
    
    const info = await getTmdbInfo(finalId, mediaType);
    if (!info || !info.ptTitle) {
      log("START", `❌ TMDB sem informações`);
      return [];
    }
    
    const { ptTitle, origTitle, year } = info;
    log("START", `📌 Título PT: "${ptTitle}" | Ano: ${year}`);
    
    let results = await searchByTitle(ptTitle, mediaType);
    
    if (results.length === 0 && origTitle && origTitle !== ptTitle) {
      const origResults = await searchByTitle(origTitle, mediaType);
      const seen = new Set(results.map(r => r.id));
      for (const r of origResults) {
        if (!seen.has(r.id)) results.push(r);
      }
    }
    
    if (results.length === 0) {
      log("START", `❌ Nenhum resultado encontrado`);
      return [];
    }
    
    const titlesToScore = [ptTitle];
    if (origTitle && origTitle !== ptTitle) titlesToScore.push(origTitle);
    
    bestMatch = findBestMatch(results, titlesToScore, year, mediaType);
  }
  
  if (!bestMatch) {
    log("START", `❌ Nenhum match confiável`);
    return [];
  }

  log("START", `✅ Selecionado: [${bestMatch.id}] "${bestMatch.title}"`);

  // Extrai o stream
  const m3u8Url = await getStreamById(bestMatch.id, season || 0, episode || 0);
  if (!m3u8Url) {
    log("START", `❌ Stream não encontrado`);
    return [];
  }

  const streamHeaders = {
    "User-Agent": USER_AGENT,
    "Referer": `${GOFILMES_URL}/`,
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9"
  };

  const quality = await detectQualityFromM3u8(m3u8Url, streamHeaders);
  
  const result = [{
    name: `${PROVIDER_NAME} - ${quality.label}`,
    title: `${bestMatch.title} | ${quality.label}`,
    url: m3u8Url,
    quality: quality.height || quality.label,
    headers: streamHeaders
  }];

  const totalTime = Date.now() - startTime;
  log("END", `🎉 Sucesso! ${result[0].name}`);
  log("END", `✅ Concluído em ${totalTime}ms`);

  return result;
}

module.exports = { getStreams };
