/**
 * Doramogo Provider - Com validação e fallbacks
 */

const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HEADERS reduzidos
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": "https://www.doramogo.net/",
    "Origin": "https://www.doramogo.net"
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

// ==============================================
// CONVERTER IMDb → TMDB (com validação)
// ==============================================
async function convertImdbToTmdb(imdbId, mediaType, streams) {
    addDebug(streams, "🔄 CONVERTENDO IMDb", `${imdbId}`);
    
    // Verifica se é um IMDb ID válido (formato tt + números)
    if (!imdbId.match(/^tt\d+$/i)) {
        addDebug(streams, "❌ IMDb INVÁLIDO", "Formato incorreto");
        return null;
    }
    
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { "User-Agent": HEADERS["User-Agent"], "Accept": "application/json" }
        });
        
        addDebug(streams, "📡 RESPOSTA TMDB", `Status: ${response.status}`);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        addDebug(streams, "📦 DADOS TMDB", data);
        
        if (mediaType === "movie") {
            if (data.movie_results && data.movie_results.length > 0) {
                const tmdbId = data.movie_results[0].id;
                addDebug(streams, "✅ CONVERTIDO (FILME)", tmdbId);
                return tmdbId;
            }
        } else {
            if (data.tv_results && data.tv_results.length > 0) {
                const tmdbId = data.tv_results[0].id;
                addDebug(streams, "✅ CONVERTIDO (SÉRIE)", tmdbId);
                return tmdbId;
            }
        }
        
        addDebug(streams, "❌ SEM RESULTADOS", "Nenhum conteúdo encontrado para este IMDb");
        return null;
    } catch (err) {
        addDebug(streams, "❌ ERRO CONVERSÃO", err.message);
        return null;
    }
}

// ==============================================
// EXTRAIR PROXYS
// ==============================================
async function fetchProxies(streams) {
    if (cachedProxies && Date.now() < proxyExpiry) {
        addDebug(streams, "💾 CACHE PROXYS", `P: ${cachedProxies.primary}`);
        return cachedProxies;
    }
    
    addDebug(streams, "🔍 BUSCANDO PROXYS", PROXY_SOURCE_URL);
    
    try {
        const response = await fetch(PROXY_SOURCE_URL, { headers: HEADERS });
        addDebug(streams, "📡 STATUS", `HTTP ${response.status}`);
        
        if (!response.ok) return null;
        
        const html = await response.text();
        addDebug(streams, "📄 HTML", `${html.length} bytes`);
        
        const primaryMatch = html.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        const fallbackMatch = html.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        
        const proxies = {
            primary: primaryMatch ? primaryMatch[1] : "https://ondemand.netflxx.shop",
            fallback: fallbackMatch ? fallbackMatch[1] : "https://forks-doramas.netflxx.shop"
        };
        
        addDebug(streams, "✅ PROXYS", `Primary: ${proxies.primary}\nFallback: ${proxies.fallback}`);
        
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        
        return proxies;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return null;
    }
}

// ==============================================
// BUSCAR TÍTULO TMDB
// ==============================================
async function getTMDBTitle(tmdbId, mediaType, streams) {
    addDebug(streams, "📡 BUSCANDO TMDB", `ID: ${tmdbId}`);
    
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
        
        const response = await fetch(url);
        addDebug(streams, "📡 STATUS", `HTTP ${response.status}`);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const ano = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        
        addDebug(streams, "✅ TÍTULO", `${title} (${ano || 'sem ano'})`);
        return { title, ano };
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return null;
    }
}

// ==============================================
// TESTAR URL
// ==============================================
async function testUrl(url, streams) {
    addDebug(streams, "📡 TESTANDO", url.substring(0, 80) + "...");
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS
        });
        
        addDebug(streams, "📡 RESPOSTA", `Status: ${response.status}`);
        return response.ok || response.status === 206;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return false;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
    const streams = [];
    
    addDebug(streams, "🎬 INÍCIO", `ID: ${tmdbId} | Tipo: ${mediaType} | S${season}E${episode}`);
    
    // ==============================================
    // CONVERTE IMDb → TMDB (se necessário)
    // ==============================================
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType, streams);
        if (convertedId) {
            finalId = convertedId;
            addDebug(streams, "✅ ID CONVERTIDO", finalId);
        } else {
            addDebug(streams, "❌ CONVERSÃO FALHOU", "Verifique se o IMDb ID está correto");
            return streams;
        }
    }
    
    addDebug(streams, "📺 ID FINAL", `${finalId}`);
    
    try {
        // 1. Busca proxies
        const proxies = await fetchProxies(streams);
        if (!proxies) {
            addDebug(streams, "❌ SEM PROXYS", "Não foi possível obter os proxies");
            return streams;
        }
        
        // 2. Busca título TMDB
        const info = await getTMDBTitle(finalId, mediaType, streams);
        if (!info) {
            addDebug(streams, "❌ SEM TÍTULO", "TMDB ID pode estar incorreto");
            return streams;
        }
        
        // 3. Constrói URL do stream
        const targetSeason = mediaType === 'movie' ? 1 : season;
        const targetEpisode = mediaType === 'movie' ? 1 : episode;
        const epPadded = targetEpisode.toString().padStart(2, '0');
        const seasonPadded = targetSeason.toString().padStart(2, '0');
        const timestamp = Date.now();
        
        // Gera slug a partir do título
        const slug = info.title.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        addDebug(streams, "🔨 SLUG", slug);
        
        const firstLetter = slug.charAt(0).toUpperCase() || 'T';
        const streamPath = `${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
        
        const urlsToTry = [
            `${proxies.primary}/${streamPath}`,
            `${proxies.fallback}/${streamPath}`
        ];
        
        // 4. Testa URLs
        for (const url of urlsToTry) {
            addDebug(streams, "📡 TESTANDO URL", url.substring(0, 100) + "...");
            
            const isValid = await testUrl(url, streams);
            
            if (isValid) {
                addDebug(streams, "✅ STREAM ENCONTRADO", url);
                
                streams.push({
                    name: "Doramogo",
                    title: "720p",
                    url: url,
                    quality: 720,
                    type: "hls",
                    headers: HEADERS
                });
                return streams;
            }
        }
        
        addDebug(streams, "❌ NENHUM STREAM", "Todas as tentativas falharam");
        return streams;
        
    } catch (err) {
        addDebug(streams, "❌ ERRO CRÍTICO", err.message);
        return streams;
    }
}

module.exports = { getStreams };
