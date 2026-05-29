// Provider: GoFilmes - Modo Stealth
// Compatível com Nuvio/QuickJS

var GOFILMES_URL = "https://gofilmes.media";
var SEMPRA_URL = "https://sempra.pro";
var PROVIDER_NAME = "Stream";

// User-Agents rotativos
var USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Delay síncrono (busy wait - funciona no QuickJS)
function sleep(ms) {
    var start = Date.now();
    while (Date.now() - start < ms) {}
}

// Headers dinâmicos
function getHeaders(referer) {
    return {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "pt-BR,pt;q=0.9",
        "referer": referer || GOFILMES_URL,
        "user-agent": getRandomUA(),
        "x-requested-with": "XMLHttpRequest"
    };
}

// Busca uma página
function fetchPage(page, category) {
    var url = GOFILMES_URL + "/engine/ajax/controller.php?mod=search_posts&page=" + page + "&pagesize=50&category=" + category + "&categoryexclude=9&order=date&_=" + Date.now();
    
    sleep(1200 + Math.random() * 2000);
    
    try {
        var res = fetch(url, { headers: getHeaders() });
        if (!res || !res.ok) return null;
        
        var data = res.json();
        if (data && data.result) {
            return data.result;
        }
        return null;
    } catch(e) {
        return null;
    }
}

// Busca por TMDB ID
function searchByTmdbId(tmdbId, isTv) {
    var category = isTv ? 14 : 13;
    var searchId = parseInt(tmdbId);
    var maxPages = 25;
    
    for (var page = 0; page < maxPages; page++) {
        var items = fetchPage(page, category);
        if (!items) continue;
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemTmdb = item.xfields && item.xfields.tmdb_id;
            
            if (itemTmdb && parseInt(itemTmdb) === searchId) {
                sleep(500);
                
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
                    year: year
                };
            }
        }
        
        // Pausa entre páginas
        if (page % 3 === 0 && page > 0) {
            sleep(2500);
        }
    }
    
    return null;
}

// Busca por título (fallback)
function searchByTitle(query, isTv) {
    var category = isTv ? 14 : 13;
    var queryLower = query.toLowerCase();
    var results = [];
    var seenIds = {};
    var maxPages = 15;
    
    for (var page = 0; page < maxPages; page++) {
        var items = fetchPage(page, category);
        if (!items) continue;
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var title = item.title || "";
            
            if (!title || seenIds[item.id]) continue;
            
            if (title.toLowerCase().indexOf(queryLower) !== -1) {
                seenIds[item.id] = true;
                
                var year = null;
                if (item.xfields && item.xfields.year) {
                    var yearStr = String(item.xfields.year);
                    var yearMatch = yearStr.match(/\d{4}/);
                    if (yearMatch) year = parseInt(yearMatch[0]);
                }
                
                results.push({
                    id: parseInt(item.id),
                    title: title,
                    url: item.url,
                    year: year,
                    tmdbId: item.xfields && item.xfields.tmdb_id ? parseInt(item.xfields.tmdb_id) : null
                });
            }
        }
        
        sleep(1000);
    }
    
    return results;
}

// Normalização de título
function normalizeTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Calcula similaridade
function similarity(a, b) {
    var na = normalizeTitle(a);
    var nb = normalizeTitle(b);
    
    if (na === nb) return 1;
    
    var wordsA = na.split(" ");
    var wordsB = nb.split(" ");
    var common = 0;
    
    for (var i = 0; i < wordsA.length; i++) {
        for (var j = 0; j < wordsB.length; j++) {
            if (wordsA[i] === wordsB[j]) {
                common++;
                break;
            }
        }
    }
    
    return common / Math.max(wordsA.length, wordsB.length);
}

// Encontra melhor match
function findBestMatch(results, targetTitle, targetYear) {
    var best = null;
    var bestScore = 0;
    
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var sim = similarity(r.title, targetTitle);
        var score = sim * 100;
        
        if (r.year && targetYear && Math.abs(r.year - targetYear) <= 1) {
            score += 25;
        }
        
        if (score > bestScore && score >= 40) {
            bestScore = score;
            best = r;
        }
    }
    
    return best;
}

// Extrai M3U8
function getStreamUrl(contentId, season, episode) {
    var playerUrl = SEMPRA_URL + "/player?id=" + contentId + "&version=0&season=" + (season || 0) + "&series=" + (episode || 0) + "&a=false&android=1&t=" + Date.now();
    
    sleep(800 + Math.random() * 1500);
    
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
        
        // Múltiplos padrões
        var patterns = [
            /flixPlayer\('([^']+\.m3u8)'/,
            /file:"([^"]+\.m3u8)"/,
            /file:'([^']+\.m3u8)'/,
            /source:\s*["']([^"']+\.m3u8)["']/
        ];
        
        for (var i = 0; i < patterns.length; i++) {
            var match = js.match(patterns[i]);
            if (match) return match[1];
        }
        
        return null;
    } catch(e) {
        return null;
    }
}

// Detecta qualidade
function detectQuality(m3u8Url) {
    sleep(300);
    
    try {
        var res = fetch(m3u8Url, {
            headers: {
                "user-agent": getRandomUA(),
                "referer": GOFILMES_URL + "/"
            }
        });
        
        if (!res || !res.ok) return "Auto";
        
        var text = res.text();
        var match = text.match(/RESOLUTION=\d+x(\d+)/);
        
        if (match) {
            var height = parseInt(match[1]);
            if (height >= 2160) return "4K";
            if (height >= 1080) return "1080p";
            if (height >= 720) return "720p";
            if (height >= 480) return "480p";
        }
        
        return "HD";
    } catch(e) {
        return "Auto";
    }
}

// Busca info no TMDB
function getTmdbInfo(tmdbId, isTv) {
    var type = isTv ? "tv" : "movie";
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=3644dd4950b67cd8067b8772de576d6b&language=pt-BR";
    
    sleep(500);
    
    try {
        var res = fetch(url, { headers: { "user-agent": getRandomUA() } });
        if (!res || !res.ok) return null;
        
        var data = res.json();
        var ptTitle = data.title || data.name || null;
        var origTitle = data.original_title || data.original_name || null;
        var dateStr = data.release_date || data.first_air_date || "";
        var year = dateStr ? parseInt(dateStr.substring(0, 4)) : null;
        
        return { ptTitle: ptTitle, origTitle: origTitle, year: year };
    } catch(e) {
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType, season, episode) {
    // Delay inicial
    sleep(800 + Math.random() * 1500);
    
    var isTv = (mediaType === "tv" || mediaType === "series");
    var id = parseInt(tmdbId);
    
    // Estratégia 1: Busca por TMDB ID
    var match = searchByTmdbId(id, isTv);
    
    // Estratégia 2: Busca por título (fallback)
    if (!match) {
        var info = getTmdbInfo(id, isTv);
        
        if (info && info.ptTitle) {
            var results = searchByTitle(info.ptTitle, isTv);
            
            if (results.length > 0) {
                match = findBestMatch(results, info.ptTitle, info.year);
            }
        }
    }
    
    if (!match) {
        return [];
    }
    
    // Delay antes de extrair stream
    sleep(600 + Math.random() * 1000);
    
    // Extrai M3U8
    var m3u8 = getStreamUrl(match.id, season, episode);
    
    if (!m3u8) {
        return [];
    }
    
    // Detecta qualidade
    var quality = detectQuality(m3u8);
    
    // Headers para o stream
    var streamHeaders = {
        "User-Agent": getRandomUA(),
        "Referer": GOFILMES_URL + "/",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9"
    };
    
    // Resultado final
    return [{
        name: PROVIDER_NAME + " - " + quality,
        title: match.title,
        url: m3u8,
        quality: quality,
        headers: streamHeaders
    }];
}

module.exports = { getStreams: getStreams };
