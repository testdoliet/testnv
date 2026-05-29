/**
 * Provider para Nuvio/QuickJS - Modo Stealth
 * Com delays inteligentes e comportamento humano
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
// CONSTANTS OFUSCADAS
// ==============================================

// URLs base ofuscadas (hex simples)
var _0x1a = (function(){
  var a = "676f66696c6d65732e6d65646961";
  var b = "73656d7072612e70726f";
  return {
    g: "https://" + decodeURIComponent("%" + a.match(/.{2}/g).join("%")),
    s: "https://" + decodeURIComponent("%" + b.match(/.{2}/g).join("%"))
  };
})();

var GOFILMES_URL = _0x1a.g;
var SEMPRA_URL = _0x1a.s;
var TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var PROVIDER_NAME = "Stream";

var MAX_PAGES = 99;  // Reduzido para evitar detecção
var MIN_SCORE_THRESHOLD = 35;

// Múltiplos User-Agents (rotativos)
var USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
  "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36"
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Headers base (sem referer fixo - será dinâmico)
function getBaseHeaders(referer) {
  var ua = getRandomUA();
  return {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "pt-BR,pt;q=0.9",
    "referer": referer || GOFILMES_URL,
    "x-requested-with": "XMLHttpRequest",
    "user-agent": ua
  };
}

// ==============================================
// DELAYS INTELIGENTES
// ==============================================

function randomDelay(minMs, maxMs) {
  return __async(this, null, function* () {
    var delay = minMs + Math.random() * (maxMs - minMs);
    // Delay variável baseado no horário (simula comportamento humano)
    var hour = new Date().getHours();
    if (hour >= 23 || hour <= 6) delay = delay * 1.5; // Mais lento de madrugada
    if (hour >= 10 && hour <= 22) delay = delay * 0.7; // Mais rápido em horário nobre
    
    return new Promise(function(resolve) {
      setTimeout(resolve, delay);
    });
  });
}

function jitterDelay(baseMs) {
  var jitter = baseMs * (0.5 + Math.random());
  return jitter;
}

// ==============================================
// LOG (OPCIONAL - PODE SER REMOVIDO)
// ==============================================

var DEBUG = false; // Desative para produção

function log(step, message, data) {
  if (!DEBUG) return;
  var ts = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log("[" + ts + "] [" + step + "] " + message);
  if (data && typeof data === 'object') {
    console.log("[" + ts + "] [" + step + "] └─ " + JSON.stringify(data).substring(0, 300));
  }
}

// ==============================================
// TMDB (com delays)
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

function convertImdbToTmdb(imdbId, mediaType) {
  return __async(this, null, function* () {
    yield randomDelay(300, 800);
    try {
      var url = TMDB_BASE_URL + "/find/" + imdbId + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id";
      var res = yield fetch(url, { headers: { "User-Agent": getRandomUA() } });
      if (!res.ok) return { success: false, error: "HTTP " + res.status };
      var data = yield res.json();
      var results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
      if (results.length > 0) return { success: true, tmdbId: results[0].id };
      return { success: false, error: "Não encontrado" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    yield randomDelay(400, 900);
    try {
      var url = TMDB_BASE_URL + "/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=pt-BR";
      var res = yield fetch(url, { headers: { "User-Agent": getRandomUA() } });
      if (!res.ok) return null;
      var data = yield res.json();
      var ptTitle = data.title || data.name || null;
      var origTitle = data.original_title || data.original_name || null;
      var dateStr = data.release_date || data.first_air_date || "";
      var year = dateStr ? parseInt(dateStr.substring(0, 4)) : null;
      return { ptTitle: ptTitle, origTitle: origTitle, year: year };
    } catch (e) {
      return null;
    }
  });
}

// ==============================================
// NORMALIZAÇÃO (otimizada)
// ==============================================

function removeAccents(str) {
  if (!str) return "";
  var map = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
  };
  return str.replace(/[àáâãäèéêëìíîïòóôõöùúûüçñ]/gi, function(c) {
    return map[c] || c;
  });
}

function normalizeTitle(title) {
  if (!title) return "";
  return removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(o|a|os|as|um|uma|the|de|do|da|dos|das|em|no|na|e|and|of|in)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==============================================
// SCORING (com ruído)
// ==============================================

function jaccardSimilarity(a, b) {
  var wa = a.split(" ").filter(function(w) { return w.length > 1; });
  var wb = b.split(" ").filter(function(w) { return w.length > 1; });
  if (wa.length === 0 || wb.length === 0) return 0;
  
  var sa = new Set(wa);
  var sb = new Set(wb);
  var intersection = 0;
  for (var w of sa) {
    if (sb.has(w)) intersection++;
  }
  var union = sa.size + sb.size - intersection;
  var base = union === 0 ? 0 : intersection / union;
  // Adiciona ruído para evitar fingerprinting
  var noise = (Math.random() - 0.5) * 0.04;
  return Math.min(1, Math.max(0, base + noise));
}

function scoreResult(result, targetTitle, targetYear, targetType) {
  var score = 0;
  var normResult = normalizeTitle(result.title);
  var normTarget = normalizeTitle(targetTitle);
  var jaccard = jaccardSimilarity(normResult, normTarget);
  
  if (jaccard >= 0.85) score += 50;
  else if (jaccard >= 0.60) score += 35;
  else if (jaccard >= 0.35) score += 15;
  else return 0;
  
  if (result.year && targetYear && !isNaN(result.year)) {
    if (result.year === targetYear) score += 30;
    else if (Math.abs(result.year - targetYear) === 1) score += 10;
  }
  
  if (result.type === targetType) score += 20;
  
  // Pequena variação aleatória no score final
  return score + (Math.random() * 5 - 2.5);
}

function findBestMatch(results, titlesToTry, year, mediaType) {
  var bestResult = null;
  var bestScore = 0;
  for (var i = 0; i < results.length; i++) {
    var result = results[i];
    for (var j = 0; j < titlesToTry.length; j++) {
      var title = titlesToTry[j];
      if (!title) continue;
      var score = scoreResult(result, title, year, mediaType);
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
// BUSCA SEQUENCIAL (COM DELAYS ENTRE PÁGINAS)
// ==============================================

function fetchPage(page, category, referer) {
  return __async(this, null, function* () {
    var url = GOFILMES_URL + "/engine/ajax/controller.php?mod=search_posts&page=" + page + "&pagesize=50&category=" + category + "&categoryexclude=9&order=date&w=282&h=421&_=" + Date.now();
    
    yield randomDelay(1200, 3500);
    
    try {
      var headers = getBaseHeaders(referer);
      var res = yield fetch(url, { headers: headers });
      if (!res.ok) return null;
      var data = yield res.json();
      return data.result || [];
    } catch (e) {
      log("FETCH", "Erro na página " + page + ": " + e.message);
      return null;
    }
  });
}

function searchByTmdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var category = mediaType === "tv" ? 14 : 13;
    var searchId = parseInt(tmdbId);
    
    log("SEARCH", "Buscando TMDB ID " + searchId);
    
    // Pausa inicial antes de começar a busca
    yield randomDelay(800, 2000);
    
    for (var page = 0; page < MAX_PAGES; page++) {
      var items = yield fetchPage(page, category, GOFILMES_URL);
      if (!items || items.length === 0) {
        // Página vazia? Pausa maior
        yield randomDelay(2000, 4000);
        continue;
      }
      
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var itemTmdb = item.xfields && item.xfields.tmdb_id;
        if (itemTmdb && parseInt(itemTmdb) === searchId) {
          log("SEARCH", "Encontrado ID " + searchId);
          yield randomDelay(500, 1000);
          
          var year = null;
          if (item.xfields && item.xfields.year) {
            var yearStr = String(item.xfields.year);
            var yearMatch = yearStr.match(/\d{4}/);
            if (yearMatch) year = parseInt(yearMatch[0]);
          }
          
          return {
            id: parseInt(item.id),
            title: item.title,
            url: item.url,
            year: year,
            type: mediaType,
            tmdbId: parseInt(item.xfields.tmdb_id),
            imdbId: item.xfields ? item.xfields.imdb_id : null
          };
        }
      }
      
      // Delay entre páginas (evita scraping agressivo)
      yield randomDelay(1500, 4000);
    }
    
    return null;
  });
}

function searchByTitle(query, mediaType) {
  return __async(this, null, function* () {
    var category = mediaType === "tv" ? 14 : 13;
    var queryLower = query.toLowerCase();
    var allMatches = [];
    var seenIds = new Set();
    
    log("SEARCH", "Buscando por título: " + query);
    yield randomDelay(500, 1500);
    
    for (var page = 0; page < MAX_PAGES; page++) {
      var items = yield fetchPage(page, category, GOFILMES_URL);
      if (!items) continue;
      
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var title = item.title || "";
        if (!title || seenIds.has(item.id)) continue;
        
        if (title.toLowerCase().indexOf(queryLower) !== -1) {
          seenIds.add(item.id);
          
          var year = null;
          if (item.xfields && item.xfields.year) {
            var yearStr = String(item.xfields.year);
            var yearMatch = yearStr.match(/\d{4}/);
            if (yearMatch) year = parseInt(yearMatch[0]);
          }
          
          allMatches.push({
            id: parseInt(item.id),
            title: title,
            url: item.url,
            year: year,
            type: mediaType,
            tmdbId: item.xfields && item.xfields.tmdb_id ? parseInt(item.xfields.tmdb_id) : null
          });
          
          log("SEARCH", "Match: " + title);
        }
      }
      
      yield randomDelay(1000, 3000);
    }
    
    log("SEARCH", "Total: " + allMatches.length + " resultados");
    return allMatches;
  });
}

// ==============================================
// STREAM EXTRACTION (COM VERIFICAÇÕES)
// ==============================================

function checkAllowed() {
  return __async(this, null, function* () {
    yield randomDelay(300, 800);
    try {
      var res = yield fetch(SEMPRA_URL + "/allowed", { headers: { "User-Agent": getRandomUA() } });
      var text = yield res.text();
      return text.trim() === "OK";
    } catch (e) {
      return false;
    }
  });
}

function getStreamById(contentId, season, episode) {
  return __async(this, null, function* () {
    log("STREAM", "Extraindo stream para ID: " + contentId);
    
    // Delay antes de verificar allowed
    yield randomDelay(500, 1200);
    
    var allowed = yield checkAllowed();
    if (!allowed) {
      log("STREAM", "Acesso negado");
      return null;
    }
    
    yield randomDelay(600, 1500);
    
    var playerUrl = SEMPRA_URL + "/player?id=" + contentId + "&version=0&season=" + (season || 0) + "&series=" + (episode || 0) + "&a=false&android=1&t=" + Date.now();
    
    try {
      var res = yield fetch(playerUrl, {
        headers: { 
          "User-Agent": getRandomUA(),
          "Referer": GOFILMES_URL + "/",
          "Accept": "*/*"
        }
      });
      
      if (!res.ok) {
        log("STREAM", "HTTP " + res.status);
        return null;
      }
      
      var js = yield res.text();
      var match = js.match(/flixPlayer\('([^']+\.m3u8)'/);
      
      if (match) {
        log("STREAM", "M3U8 obtido");
        return match[1];
      }
      
      log("STREAM", "Padrão não encontrado");
      return null;
      
    } catch (e) {
      log("STREAM", "Erro: " + e.message);
      return null;
    }
  });
}

function detectQualityFromM3u8(m3u8Url, requestHeaders) {
  return __async(this, null, function* () {
    yield randomDelay(200, 500);
    try {
      var res = yield fetch(m3u8Url, { headers: requestHeaders });
      if (!res.ok) return { label: "?", height: 0 };
      var text = yield res.text();
      var matches = text.match(/RESOLUTION=(\d+)x(\d+)/g);
      if (matches && matches.length > 0) {
        var maxH = 0;
        for (var i = 0; i < matches.length; i++) {
          var parts = matches[i].replace("RESOLUTION=", "").split("x");
          var h = parseInt(parts[1]);
          if (h > maxH) maxH = h;
        }
        var label = maxH >= 2160 ? "4K" : maxH >= 1080 ? "1080p" : maxH >= 720 ? "720p" : maxH >= 480 ? "480p" : "SD";
        return { label: label, height: maxH };
      }
      return { label: "?", height: 0 };
    } catch (e) {
      return { label: "?", height: 0 };
    }
  });
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var startTime = Date.now();
    
    // Delay inicial - simula usuário pensando
    yield randomDelay(500, 2000);
    
    log("START", "Iniciando para ID: " + tmdbId);
    
    // Normaliza ID
    var finalId = tmdbId;
    if (isImdbId(tmdbId)) {
      var conv = yield convertImdbToTmdb(tmdbId, mediaType);
      if (!conv.success) {
        log("START", "Conversão IMDb falhou");
        return [];
      }
      finalId = conv.tmdbId;
    } else if (typeof tmdbId === "string") {
      finalId = parseInt(tmdbId);
    }
    
    // Delay entre etapas
    yield randomDelay(300, 800);
    
    // Estratégia 1: Busca por TMDB ID
    var bestMatch = yield searchByTmdbId(finalId, mediaType);
    
    // Estratégia 2: Busca por título (fallback)
    if (!bestMatch) {
      log("START", "TMDB ID falhou, tentando título...");
      yield randomDelay(500, 1200);
      
      var info = yield getTmdbInfo(finalId, mediaType);
      if (!info || !info.ptTitle) {
        log("START", "Sem informações do TMDB");
        return [];
      }
      
      var ptTitle = info.ptTitle;
      var origTitle = info.origTitle;
      var year = info.year;
      
      var results = yield searchByTitle(ptTitle, mediaType);
      
      if (results.length === 0 && origTitle && origTitle !== ptTitle) {
        var origResults = yield searchByTitle(origTitle, mediaType);
        var seen = new Set(results.map(function(r) { return r.id; }));
        for (var i = 0; i < origResults.length; i++) {
          var r = origResults[i];
          if (!seen.has(r.id)) results.push(r);
        }
      }
      
      if (results.length === 0) {
        return [];
      }
      
      var titlesToScore = [ptTitle];
      if (origTitle && origTitle !== ptTitle) titlesToScore.push(origTitle);
      
      bestMatch = findBestMatch(results, titlesToScore, year, mediaType);
    }
    
    if (!bestMatch) {
      log("START", "Nenhum match confiável");
      return [];
    }
    
    log("START", "Selecionado: " + bestMatch.title);
    yield randomDelay(400, 1000);
    
    // Extrai o stream
    var m3u8Url = yield getStreamById(bestMatch.id, season || 0, episode || 0);
    if (!m3u8Url) {
      log("START", "Stream não encontrado");
      return [];
    }
    
    yield randomDelay(200, 500);
    
    var streamHeaders = {
      "User-Agent": getRandomUA(),
      "Referer": GOFILMES_URL + "/",
      "Accept": "*/*",
      "Accept-Language": "pt-BR,pt;q=0.9"
    };
    
    var quality = yield detectQualityFromM3u8(m3u8Url, streamHeaders);
    
    var result = [{
      name: PROVIDER_NAME,
      title: bestMatch.title,
      url: m3u8Url,
      quality: quality.height || "Auto",
      headers: streamHeaders
    }];
    
    log("END", "Sucesso em " + (Date.now() - startTime) + "ms");
    return result;
  });
}

module.exports = { getStreams: getStreams };
