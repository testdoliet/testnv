/**
 * Doramogo Provider - Com debugs detalhados em streams
 * Para identificar onde está falhando no Nuvio
 */

const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HEADERS reduzidos (remove headers problemáticos para o Nuvio)
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

// ==============================================
// DEBUG
// ==============================================
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
// CONVERTER IMDb → TMDB
// ==============================================
async function convertImdbToTmdb(imdbId, mediaType, streams) {
    addDebug(streams, "🔄 CONVERTENDO IMDb", `${imdbId} → TMDB`);
    
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { "User-Agent": HEADERS["User-Agent"], "Accept": "application/json" }
        });
        
        if (!response.ok) {
            addDebug(streams, "❌ CONVERSÃO FALHOU", `HTTP ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
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
        
        addDebug(streams, "❌ NENHUM RESULTADO", "IMDb não encontrado");
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
        addDebug(streams, "💾 USANDO CACHE", `Primary: ${cachedProxies.primary}`);
        return cachedProxies;
    }
    
    addDebug(streams, "🔍 BUSCANDO PROXYS", PROXY_SOURCE_URL);
    
    try {
        const response = await fetch(PROXY_SOURCE_URL, { headers: HEADERS });
        
        addDebug(streams, "📡 RESPOSTA PROXY", `Status: ${response.status}`);
        
        if (!response.ok) {
            addDebug(streams, "❌ FALHA PROXY", `HTTP ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        addDebug(streams, "📄 HTML PROXY", `${html.length} bytes`);
        
        const primaryMatch = html.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        const fallbackMatch = html.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        
        addDebug(streams, "🔍 PRIMARY_MATCH", primaryMatch ? primaryMatch[1] : "não encontrado");
        addDebug(streams, "🔍 FALLBACK_MATCH", fallbackMatch ? fallbackMatch[1] : "não encontrado");
        
        const proxies = {
            primary: primaryMatch ? primaryMatch[1] : "https://ondemand.netflxx.shop",
            fallback: fallbackMatch ? fallbackMatch[1] : "https://forks-doramas.netflxx.shop"
        };
        
        addDebug(streams, "✅ PROXYS FINAIS", `Primary: ${proxies.primary}\nFallback: ${proxies.fallback}`);
        
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        
        return proxies;
        
    } catch (err) {
        addDebug(streams, "❌ ERRO FETCH PROXY", err.message);
        return null;
    }
}

// ==============================================
// TESTAR URL
// ==============================================
async function testStreamUrl(url, streams) {
    addDebug(streams, "📡 TESTANDO URL", url.substring(0, 100) + "...");
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS
        });
        
        addDebug(streams, "📡 RESPOSTA", `Status: ${response.status}`);
        
        return response.ok || response.status === 206;
    } catch (err) {
        addDebug(streams, "❌ ERRO FETCH", err.message);
        return false;
    }
}

// ==============================================
// EXTRAIR QUALIDADES
// ==============================================
async function extractQualitiesFromM3u8(url, streams) {
    addDebug(streams, "🎯 EXTRAINDO QUALIDADES", url.substring(0, 80) + "...");
    
    try {
        const response = await fetch(url, { headers: HEADERS });
        if (!response.ok) {
            addDebug(streams, "❌ M3U8 FALHOU", `Status: ${response.status}`);
            return [];
        }
        
        const content = await response.text();
        addDebug(streams, "📄 M3U8 CONTEÚDO", `${content.length} bytes`);
        
        const qualities = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
            
            if (resolutionMatch) {
                const height = parseInt(resolutionMatch[2]);
                let streamUrl = lines[i + 1]?.trim();
                
                if (streamUrl && !streamUrl.startsWith('http')) {
                    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
                    streamUrl = baseUrl + streamUrl;
                }
                
                if (streamUrl && streamUrl.startsWith('http')) {
                    qualities.push({ url: streamUrl, height });
                    addDebug(streams, "🎯 QUALIDADE", `${height}p`);
                }
            }
        }
        
        addDebug(streams, "✅ TOTAL QUALIDADES", qualities.length);
        return qualities;
    } catch (err) {
        addDebug(streams, "❌ ERRO M3U8", err.message);
        return [];
    }
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================
function titleToSlug(title) {
    if (!title) return '';
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateSlugVariations(baseTitle, season, ano, streams) {
    const baseSlug = titleToSlug(baseTitle);
    const variations = [];
    const seen = {};

    addDebug(streams, "🔨 SLUG BASE", baseSlug);

    function add(slug) {
        if (!seen[slug]) {
            seen[slug] = true;
            variations.push(slug);
        }
    }

    add(baseSlug);
    if (ano) add(baseSlug + '-' + ano);
    add(baseSlug + '-legendado');
    add(baseSlug + '-dublado');
    if (ano) {
        add(baseSlug + '-' + ano + '-legendado');
        add(baseSlug + '-' + ano + '-dublado');
    }
    if (season > 1) {
        add(baseSlug + '-' + season);
        if (ano) add(baseSlug + '-' + ano + '-' + season);
    }

    addDebug(streams, "✅ SLUGS GERADOS", variations.join(", "));
    return variations;
}

async function getTMDBTitle(tmdbId, mediaType, streams) {
    addDebug(streams, "📡 BUSCANDO TÍTULO TMDB", `ID: ${tmdbId}`);
    
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        
        const response = await fetch(url);
        if (!response.ok) {
            addDebug(streams, "❌ TMDB FALHOU", `Status: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const ano = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        
        addDebug(streams, "✅ TÍTULO ENCONTRADO", `${title} (${ano || 'sem ano'})`);
        
        return { title, ano };
    } catch (err) {
        addDebug(streams, "❌ ERRO TMDB", err.message);
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
    const streams = [];
    
    addDebug(streams, "🎬 INICIANDO DORAMOGO", `ID: ${tmdbId} | Tipo: ${mediaType} | S${season}E${episode}`);
    
    // ==============================================
    // CONVERTE IMDb → TMDB se necessário
    // ==============================================
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType, streams);
        if (convertedId) {
            finalId = convertedId;
        } else {
            addDebug(streams, "❌ FALHA CONVERSÃO", "Retornando sem streams");
            return streams;
        }
    }
    
    addDebug(streams, "📺 ID FINAL", `${finalId}`);
    
    try {
        // 1. Busca proxies
        const proxies = await fetchProxies(streams);
        if (!proxies) {
            addDebug(streams, "❌ SEM PROXYS", "Retornando sem streams");
            return streams;
        }
        
        // 2. Busca título TMDB
        const info = await getTMDBTitle(finalId, mediaType, streams);
        if (!info) {
            addDebug(streams, "❌ SEM TÍTULO", "Retornando sem streams");
            return streams;
        }
        
        // 3. Gera slugs
        const targetSeason = mediaType === 'movie' ? 1 : season;
        const targetEpisode = mediaType === 'movie' ? 1 : episode;
        const epPadded = targetEpisode.toString().padStart(2, '0');
        const seasonPadded = targetSeason.toString().padStart(2, '0');
        const timestamp = Date.now();
        
        const slugVariations = generateSlugVariations(info.title, targetSeason, info.ano, streams);
        addDebug(streams, "🔨 TOTAL SLUGS", slugVariations.length);
        
        // 4. Testa cada slug
        for (let i = 0; i < slugVariations.length; i++) {
            const slug = slugVariations[i];
            const firstLetter = slug.charAt(0).toUpperCase() || 'T';
            const streamPath = `${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
            
            const urlsToTry = [
                `${proxies.primary}/${streamPath}`,
                `${proxies.fallback}/${streamPath}`
            ];
            
            for (let j = 0; j < urlsToTry.length; j++) {
                const url = urlsToTry[j];
                const proxyName = j === 0 ? "PRIMARY" : "FALLBACK";
                
                addDebug(streams, `📡 TESTANDO [${i+1}/${slugVariations.length}] ${proxyName}`, slug);
                
                const isValid = await testStreamUrl(url, streams);
                
                if (isValid) {
                    addDebug(streams, "✅ URL FUNCIONOU", url.substring(0, 100) + "...");
                    
                    const qualities = await extractQualitiesFromM3u8(url, streams);
                    
                    if (qualities.length > 0) {
                        for (const q of qualities) {
                            streams.push({
                                name: "Doramogo",
                                title: `${q.height}p`,
                                url: q.url,
                                quality: q.height,
                                type: "hls",
                                headers: HEADERS
                            });
                        }
                    } else {
                        streams.push({
                            name: "Doramogo",
                            title: "720p",
                            url: url,
                            quality: 720,
                            type: "hls",
                            headers: HEADERS
                        });
                    }
                    
                    addDebug(streams, "🎉 STREAMS ADICIONADOS", streams.length);
                    return streams;
                }
            }
        }
        
        addDebug(streams, "❌ NENHUM STREAM ENCONTRADO", "Todos os slugs falharam");
        return streams;
        
    } catch (err) {
        addDebug(streams, "❌ ERRO CRÍTICO", err.message);
        return streams;
    }
}

module.exports = { getStreams };
