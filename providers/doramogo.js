/**
 * Doramogo Provider - Seguindo a abordagem do Pomfy (sem headers no stream)
 */

const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Headers para REQUISIÇÕES (buscar proxies, etc.) - NÃO para o stream
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": "https://www.doramogo.net/",
    "Origin": "https://www.doramogo.net",
    "Cookie": "PHPSESSID=8vf7thq8lr33f6q1sk8v1f763a; _ga=GA1.1.616884067.1772822292"
};

const PROXY_SOURCE_URL = "https://www.doramogo.net/series/dream-stage-2026-legendado/temporada-1/episodio-1";

let cachedProxies = null;
let proxyExpiry = 0;
const PROXY_CACHE_TIME = 60 * 60 * 1000;

function addDebug(streams, title, content) {
    streams.push({
        name: "Doramogo [DEBUG]",
        title: title,
        url: typeof content === 'object' ? JSON.stringify(content) : String(content),
        quality: 0,
        headers: {}
    });
}

async function convertImdbToTmdb(imdbId, mediaType, streams) {
    addDebug(streams, "🔄 CONVERTENDO IMDb", `${imdbId}`);
    
    if (!imdbId.match(/^tt\d+$/i)) {
        addDebug(streams, "❌ IMDb INVÁLIDO", "Formato incorreto");
        return null;
    }
    
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { "User-Agent": HEADERS["User-Agent"], "Accept": "application/json" }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (mediaType === "movie") {
            if (data.movie_results && data.movie_results.length > 0) {
                return data.movie_results[0].id;
            }
        } else {
            if (data.tv_results && data.tv_results.length > 0) {
                return data.tv_results[0].id;
            }
        }
        
        return null;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return null;
    }
}

async function fetchProxies(streams) {
    if (cachedProxies && Date.now() < proxyExpiry) {
        addDebug(streams, "💾 CACHE", `P: ${cachedProxies.primary}`);
        return cachedProxies;
    }
    
    addDebug(streams, "🔍 BUSCANDO PROXYS", PROXY_SOURCE_URL);
    
    try {
        const response = await fetch(PROXY_SOURCE_URL, { headers: HEADERS });
        if (!response.ok) return null;
        
        const html = await response.text();
        
        const primaryMatch = html.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        const fallbackMatch = html.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        
        const proxies = {
            primary: primaryMatch ? primaryMatch[1] : "https://ondemand.netflxx.shop",
            fallback: fallbackMatch ? fallbackMatch[1] : "https://forks-doramas.netflxx.shop"
        };
        
        addDebug(streams, "✅ PROXYS", `P: ${proxies.primary}\nF: ${proxies.fallback}`);
        
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        
        return proxies;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return null;
    }
}

async function testUrl(url, streams) {
    addDebug(streams, "📡 TESTANDO", url.substring(0, 80) + "...");
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS
        });
        
        addDebug(streams, "📡 STATUS", `HTTP ${response.status}`);
        return response.ok || response.status === 206;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return false;
    }
}

async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
    const streams = [];
    
    addDebug(streams, "🎬 INÍCIO", `ID: ${tmdbId} | ${mediaType} | S${season}E${episode}`);
    
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType, streams);
        if (convertedId) {
            finalId = convertedId;
        } else {
            return streams;
        }
    }
    
    try {
        const proxies = await fetchProxies(streams);
        if (!proxies) return streams;
        
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${finalId}?api_key=${TMDB_API_KEY}&language=en-US`;
        
        const tmdbResp = await fetch(tmdbUrl);
        if (!tmdbResp.ok) return streams;
        
        const tmdbData = await tmdbResp.json();
        const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
        
        const slug = title.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        const targetSeason = mediaType === 'movie' ? 1 : season;
        const targetEpisode = mediaType === 'movie' ? 1 : episode;
        const epPadded = targetEpisode.toString().padStart(2, '0');
        const seasonPadded = targetSeason.toString().padStart(2, '0');
        const timestamp = Date.now();
        
        const firstLetter = slug.charAt(0).toUpperCase() || 'T';
        const streamPath = `${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
        
        const urlsToTry = [
            `${proxies.primary}/${streamPath}`,
            `${proxies.fallback}/${streamPath}`
        ];
        
        for (const url of urlsToTry) {
            const isValid = await testUrl(url, streams);
            
            if (isValid) {
                addDebug(streams, "✅ STREAM ENCONTRADO", url.substring(0, 100));
                
                // ==============================================
                // IGUAL AO POMFY: SEM HEADERS NO STREAM!
                // Deixa o Nuvio gerenciar os headers automaticamente
                // ==============================================
                streams.push({
                    name: "Doramogo",
                    title: "1080p",
                    url: url,
                    quality: 1080,
                    type: "hls"
                    // SEM HEADERS!
                });
                return streams;
            }
        }
        
        addDebug(streams, "❌ FIM", "Nenhum stream encontrado");
        return streams;
        
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return streams;
    }
}

module.exports = { getStreams };
