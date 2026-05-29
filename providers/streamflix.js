// Provider: GoFilmes v2 - Modo Stealth
// Compatível com Nuvio/QuickJS

// ==============================================
// CONSTANTES
// ==============================================

var GOFILMES_URL = "https://gofilmes.media";
var SEMPRA_URL = "https://sempra.pro";
var PROVIDER_NAME = "GF";

// User-Agents rotativos
var USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36"
];

// ==============================================
// UTILIDADES
// ==============================================

function randomDelay(min, max) {
    var delay = min + Math.random() * (max - min);
    var start = Date.now();
    while (Date.now() - start < delay) {
        // Busy wait - único jeito no QuickJS
    }
}

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHeaders(referer) {
    return {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9",
        "user-agent": getRandomUA(),
        "referer": referer || GOFILMES_URL,
        "cache-control": "no-cache"
    };
}

// ==============================================
// BUSCA COM DELAY
// ==============================================

function fetchPage(page, category) {
    var url = GOFILMES_URL + "/engine/ajax/controller.php?mod=search_posts&page=" + page + "&pagesize=50&category=" + category + "&categoryexclude=9&order=date";
    
    randomDelay(1000, 3000); // Delay humano
    
    try {
        var res = fetch(url, { headers: getHeaders() });
        if (!res || !res.ok) return null;
        
        var data = res.json();
        return data.result || [];
    } catch(e) {
        return null;
    }
}

function searchByTmdbId(tmdbId, isTv) {
    var category = isTv ? 14 : 13;
    var searchId = parseInt(tmdbId);
    
    // Busca páginas 0 a 20
    for (var page = 0; page < 20; page++) {
        var items = fetchPage(page, category);
        if (!items) continue;
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemTmdb = item.xfields && item.xfields.tmdb_id;
            
            if (itemTmdb && parseInt(itemTmdb) === searchId) {
                randomDelay(500, 1500);
                return {
                    id: parseInt(item.id),
                    title: item.title,
                    url: item.url,
                    type: isTv ? "tv" : "movie"
                };
            }
        }
        
        // Pequena pausa entre páginas
        if (page % 5 === 0) randomDelay(2000, 4000);
    }
    
    return null;
}

// ==============================================
// EXTRAÇÃO DO STREAM
// ==============================================

function getStreamById(contentId, season, episode) {
    var playerUrl = SEMPRA_URL + "/player?id=" + contentId + "&version=0&season=" + (season || 0) + "&series=" + (episode || 0) + "&a=false&android=1";
    
    randomDelay(800, 2000);
    
    try {
        var res = fetch(playerUrl, {
            headers: {
                "user-agent": getRandomUA(),
                "referer": GOFILMES_URL + "/",
                "accept": "*/*"
            }
        });
        
        if (!res || !res.ok) return null;
        
        var js = res.text();
        var match = js.match(/flixPlayer\('([^']+\.m3u8)'/);
        
        if (match) return match[1];
        
        // Fallback pattern
        var altMatch = js.match(/file:"([^"]+\.m3u8)"/);
        return altMatch ? altMatch[1] : null;
        
    } catch(e) {
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL (EXPORTADA)
// ==============================================

function getStreams(tmdbId, mediaType, season, episode) {
    // Delay inicial
    randomDelay(500, 1500);
    
    // Converte string para número se necessário
    var id = typeof tmdbId === "string" ? parseInt(tmdbId) : tmdbId;
    var isTv = mediaType === "tv";
    
    // Busca o conteúdo
    var match = searchByTmdbId(id, isTv);
    
    if (!match) {
        return [];
    }
    
    // Delay antes de extrair stream
    randomDelay(1000, 2500);
    
    // Extrai M3U8
    var m3u8 = getStreamById(match.id, season || 0, episode || 0);
    
    if (!m3u8) {
        return [];
    }
    
    // Headers para o stream
    var streamHeaders = {
        "User-Agent": getRandomUA(),
        "Referer": GOFILMES_URL + "/",
        "Accept": "*/*"
    };
    
    // Resultado final
    return [{
        name: PROVIDER_NAME,
        title: match.title,
        url: m3u8,
        quality: "HD",
        headers: streamHeaders
    }];
}

// Exporta a função
module.exports = { getStreams: getStreams };
