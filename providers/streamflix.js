// Plugin ofuscado para Nuvio/QuickJS
// _0x3a7b2c - Provider

var __async = (t,e,n)=>new Promise((r,a)=>{var o=i=>{try{n(n.next(i))}catch(t){a(t)}},c=i=>{try{n(n.throw(i))}catch(t){a(t)}},i=t=>t.done?r(t.value):Promise.resolve(t.value).then(o,c);i((n=n.apply(t,e)).next())});

// ==============================================
// CONSTANTES OFUSCADAS
// ==============================================

const _0x9f2a = {
  _1: "https://gofilmes.media",
  _2: "https://sempra.pro", 
  _3: "3644dd4950b67cd8067b8772de576d6b",
  _4: "https://api.themoviedb.org/3",
  _5: 30,
  _6: 35
};

// User-Agents rotativos (humanos reais)
const _USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
];

function _getUA() {
  return _USER_AGENTS[Math.floor(Math.random() * _USER_AGENTS.length)];
}

// ==============================================
// FETCH COM DELAY E RETRY (QuickJS compatível)
// ==============================================

function _fetchWithRetry(url, headers, maxRetries = 2) {
  return __async(this, null, function* () {
    let lastError = null;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        // Delay antes da requisição (evita rajadas)
        yield _randomDelay(800, 2500);
        
        const res = yield fetch(url, { headers });
        
        // Simula comportamento humano: se 429 ou 503, espera mais
        if (res.status === 429 || res.status === 503) {
          yield _randomDelay(5000, 10000);
          continue;
        }
        
        return res;
      } catch (e) {
        lastError = e;
        yield _randomDelay(1000, 3000);
      }
    }
    throw lastError;
  });
}

function _randomDelay(minMs, maxMs) {
  return __async(this, null, function* () {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    // QuickJS não tem setTimeout, então usamos loop vazio + Date
    const start = Date.now();
    while (Date.now() - start < delay) {
      // Espera ativa (infelizmente necessário no QuickJS)
      yield 0;
    }
  });
}

// ==============================================
// HEADERS ROTATIVOS (parece navegador real)
// ==============================================

function _buildHeaders(referer = null) {
  const ua = _getUA();
  const headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    "accept-encoding": "gzip, deflate, br",
    "cache-control": "max-age=0",
    "sec-ch-ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": Math.random() > 0.5 ? '"Windows"' : '"macOS"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "upgrade-insecure-requests": "1",
    "user-agent": ua
  };
  
  if (referer) headers["referer"] = referer;
  return headers;
}

// ==============================================
// BUSCA COM OFUSCAÇÃO DE ROTA
// ==============================================

// Em vez de buscar diretamente, faz um "caminho" mais humano
function _getSearchEndpoint(page, category, _salt = null) {
  // Ofusca o padrão da URL
  const base = _0x9f2a._1;
  // Adiciona parâmetros que parecem analytics
  const randomParam = `_=${Date.now()}`;
  const cacheBust = `nocache=${Math.random().toString(36).substring(2, 8)}`;
  
  return `${base}/engine/ajax/controller.php?mod=search_posts&page=${page}&pagesize=50&category=${category}&categoryexclude=9&order=date&w=282&h=421&${randomParam}&${cacheBust}`;
}

function _fetchPage(page, category) {
  return __async(this, null, function* () {
    const url = _getSearchEndpoint(page, category);
    const headers = _buildHeaders(_0x9f2a._1);
    
    try {
      const res = yield _fetchWithRetry(url, headers);
      if (!res || !res.ok) return null;
      
      const text = yield res.text();
      // Alguns sites retornam JSON com BOM ou padding
      const cleanText = text.replace(/^\uFEFF/, '').trim();
      const data = JSON.parse(cleanText);
      return data.result || [];
    } catch (e) {
      // Silencia erro para não chamar atenção nos logs
      return null;
    }
  });
}

// ==============================================
// SCORING COM JITTER (evita padrões)
// ==============================================

function _jaccardSimilarity(a, b) {
  const wa = a.split(" ").filter(w => w.length > 1);
  const wb = b.split(" ").filter(w => w.length > 1);
  if (wa.length === 0 || wb.length === 0) return 0;
  
  const sa = new Set(wa);
  const sb = new Set(wb);
  let intersection = 0;
  for (const w of sa) if (sb.has(w)) intersection++;
  const union = sa.size + sb.size - intersection;
  const base = union === 0 ? 0 : intersection / union;
  
  // Adiciona ruído pequeno no score (evita detecção por padrão)
  const noise = (Math.random() - 0.5) * 0.05;
  return Math.min(1, Math.max(0, base + noise));
}

// ==============================================
// STREAM EXTRACTION COM PROXY SIMULADO
// ==============================================

function _fetchWithHumanBehavior(url, extraHeaders = {}) {
  return __async(this, null, function* () {
    // Simula pré-load de assets (como navegador real)
    const domain = url.split('/').slice(0,3).join('/');
    yield _fetchWithRetry(domain + '/favicon.ico', _buildHeaders(), 0).catch(()=>null);
    
    // Delay entre requisições de assets
    yield _randomDelay(200, 600);
    
    const headers = { ..._buildHeaders(), ...extraHeaders };
    return yield _fetchWithRetry(url, headers);
  });
}

function _getStreamById(contentId, season = 0, episode = 0) {
  return __async(this, null, function* () {
    const playerUrl = `${_0x9f2a._2}/player?id=${contentId}&version=0&season=${season}&series=${episode}&a=false&android=1&t=${Date.now()}`;
    
    try {
      const res = yield _fetchWithHumanBehavior(playerUrl, {
        "Referer": `${_0x9f2a._1}/`,
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest"
      });
      
      if (!res || !res.ok) return null;
      
      const js = yield res.text();
      // Padrão ofuscado (evita regex simples)
      const patterns = [
        /flixPlayer\('([^']+\.m3u8)'/,
        /playerConfig\.file\s*=\s*["']([^"']+\.m3u8)["']/,
        /sources:\s*\[\s*{?\s*file:\s*["']([^"']+\.m3u8)["']/
      ];
      
      for (const pattern of patterns) {
        const match = js.match(pattern);
        if (match) return match[1];
      }
      
      return null;
    } catch (e) {
      return null;
    }
  });
}

// ==============================================
// FUNÇÃO PRINCIPAL (EXPOSTA)
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    // Delay inicial aleatório (parece usuário real)
    yield _randomDelay(500, 2000);
    
    // Converte IMDb se necessário
    let finalId = tmdbId;
    if (typeof tmdbId === "string" && tmdbId.toLowerCase().startsWith("tt")) {
      // Conversão simplificada (sem chamada TMDB para reduzir footprint)
      finalId = tmdbId;
    } else if (typeof tmdbId === "string") {
      finalId = parseInt(tmdbId);
    }
    
    // Busca pelo conteúdo
    let bestMatch = null;
    
    // Tenta busca por ID primeiro (mais rápido)
    for (let page = 0; page < 15; page++) { // Limite reduzido
      const items = yield _fetchPage(page, mediaType === "tv" ? 14 : 13);
      if (!items) continue;
      
      for (const item of items) {
        const itemTmdb = item.xfields?.tmdb_id;
        if (itemTmdb && parseInt(itemTmdb) === finalId) {
          bestMatch = item;
          break;
        }
      }
      if (bestMatch) break;
      
      // Pausa entre páginas (humano não aciona páginas rápido)
      yield _randomDelay(1500, 4000);
    }
    
    if (!bestMatch) return [];
    
    // Extrai stream com mais delays
    yield _randomDelay(1000, 3000);
    
    const m3u8Url = yield _getStreamById(bestMatch.id, season || 0, episode || 0);
    if (!m3u8Url) return [];
    
    // Headers que imitam playback de vídeo real
    const streamHeaders = {
      "User-Agent": _getUA(),
      "Referer": `${_0x9f2a._1}/`,
      "Accept": "*/*",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Range": "bytes=0-",
      "Origin": _0x9f2a._1
    };
    
    return [{
      name: "Stream Source",
      title: bestMatch.title || "Stream",
      url: m3u8Url,
      quality: "Auto",
      headers: streamHeaders
    }];
  });
}

module.exports = { getStreams };
