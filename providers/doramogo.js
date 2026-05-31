/**
 * Doramogo Provider - Versão com headers forçados e sem dependências problemáticas
 */

const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HEADERS COMPLETOS (os mesmos que funcionam no curl)
const HEADERS = {
    "accept": "*/*",
    "accept-language": "pt-BR,pt;q=0.9",
    "origin": "https://www.doramogo.net",
    "referer": "https://www.doramogo.net/",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
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
// TESTAR URL (USANDO GET, NÃO HEAD)
// ==============================================
async function testStreamUrl(url, streams) {
    addDebug(streams, "📡 TESTANDO", url.substring(0, 100) + "...");
    
    try {
        // Usa GET em vez de HEAD (alguns servidores bloqueiam HEAD)
        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS
        });
        
        addDebug(streams, "📡 RESPOSTA", `Status: ${response.status}`);
        
        // Se for 403, tenta com headers adicionais
        if (response.status === 403) {
            addDebug(streams, "⚠️ 403 DETECTADO", "Tentando com headers alternativos...");
            
            // Tenta com headers mais completos
            const altHeaders = {
                ...HEADERS,
                "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site"
            };
            
            const altResponse = await fetch(url, {
                method: 'GET',
                headers: altHeaders
            });
            
            addDebug(streams, "📡 RESPOSTA ALTERNATIVA", `Status: ${altResponse.status}`);
            return altResponse.ok || altResponse.status === 206;
        }
        
        return response.ok || response.status === 206;
    } catch (err) {
        addDebug(streams, "❌ ERRO FETCH", err.message);
        return false;
    }
}

// ==============================================
// EXTRAIR PROXYS
// ==============================================
async function fetchProxies(streams) {
    if (cachedProxies && Date.now() < proxyExpiry) {
        addDebug(streams, "💾 CACHE", `Primary: ${cachedProxies.primary}`);
        return cachedProxies;
    }
    
    addDebug(streams, "🔍 BUSCANDO PROXYS", PROXY_SOURCE_URL);
    
    try {
        const response = await fetch(PROXY_SOURCE_URL, { headers: HEADERS });
        addDebug(streams, "📡 STATUS PROXY", `HTTP ${response.status}`);
        
        if (!response.ok) return null;
        
        const html = await response.text();
        addDebug(streams, "📄 HTML", `${html.length} bytes`);
        
        // Mostra um trecho do HTML para debug
        const scriptMatch = html.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        addDebug(streams, "🔍 SCRIPT MATCH", scriptMatch ? scriptMatch[1] : "não encontrado");
        
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

// ==============================================
// EXTRAIR QUALIDADES
// ==============================================
async function extractQualitiesFromM3u8(url, streams) {
    addDebug(streams, "🎯 EXTRAINDO", url.substring(0, 80) + "...");
    
    try {
        const response = await fetch(url, { headers: HEADERS });
        if (!response.ok) {
            addDebug(streams, "❌ M3U8", `HTTP ${response.status}`);
            return [];
        }
        
        const content = await response.text();
        addDebug(streams, "📄 M3U8", `${content.length} bytes`);
        
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
        
        addDebug(streams, "✅ TOTAL", qualities.length);
        return qualities;
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
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

    addDebug(streams, "✅ SLUGS", variations.join(", "));
    return variations;
}

async function getTMDBTitle(tmdbId, mediaType, streams) {
    addDebug(streams, "📡 TMDB", `ID: ${tmdbId}`);
    
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        
        const response = await fetch(url);
        if (!response.ok) {
            addDebug(streams, "❌ TMDB", `HTTP ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const ano = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        
        addDebug(streams, "✅ TÍTULO", `${title} (${ano || 'no ano'})`);
        return { title, ano };
    } catch (err) {
        addDebug(streams, "❌ ERRO", err.message);
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
    const streams = [];
    
    addDebug(streams, "🎬 INÍCIO", `${mediaType} ${tmdbId} S${season}E${episode}`);
    
    try {
        const proxies = await fetchProxies(streams);
        if (!proxies) return streams;
        
        const info = await getTMDBTitle(tmdbId, mediaType, streams);
        if (!info) return streams;
        
        const targetSeason = mediaType === 'movie' ? 1 : season;
        const targetEpisode = mediaType === 'movie' ? 1 : episode;
        const epPadded = targetEpisode.toString().padStart(2, '0');
        const seasonPadded = targetSeason.toString().padStart(2, '0');
        const timestamp = Date.now();
        
        const slugVariations = generateSlugVariations(info.title, targetSeason, info.ano, streams);
        
        for (const slug of slugVariations) {
            const firstLetter = slug.charAt(0).toUpperCase() || 'T';
            const streamPath = `${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
            
            const urlsToTry = [
                `${proxies.primary}/${streamPath}`,
                `${proxies.fallback}/${streamPath}`
            ];
            
            for (const url of urlsToTry) {
                const isValid = await testStreamUrl(url, streams);
                
                if (isValid) {
                    addDebug(streams, "✅ FUNCIONOU", url.substring(0, 100));
                    
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
                    return streams;
                }
            }
        }
        
        addDebug(streams, "❌ FIM", "Nenhum stream encontrado");
        return streams;
        
    } catch (err) {
        addDebug(streams, "❌ CRÍTICO", err.message);
        return streams;
    }
}

module.exports = { getStreams };
