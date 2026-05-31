/**
 * Doramogo Provider - Com conversão IMDb → TMDB e headers completos
 */

const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HEADERS COMPLETOS (iguais ao Kotlin)
const HEADERS = {
    "accept": "*/*",
    "accept-language": "pt-BR",
    "origin": "https://www.doramogo.net",
    "priority": "u=1, i",
    "referer": "https://www.doramogo.net/",
    "sec-ch-ua": "\"Chromium\";v=\"127\", \"Not)A;Brand\";v=\"99\", \"Microsoft Edge Simulate\";v=\"127\", \"Lemur\";v=\"127\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
};

// URL de um dorama que SEMPRE existe (para extrair proxies)
const PROXY_SOURCE_URL = "https://www.doramogo.net/series/dream-stage-2026-legendado/temporada-1/episodio-1";

let cachedProxies = null;
let proxyExpiry = 0;
const PROXY_CACHE_TIME = 60 * 60 * 1000; // 1 hora

// ==============================================
// 1. CONVERTER IMDb → TMDB
// ==============================================
async function convertImdbToTmdb(imdbId, mediaType) {
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { "User-Agent": HEADERS["user-agent"], "Accept": "application/json" }
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
        console.log(`[Doramogo] ❌ Erro conversão IMDb: ${err.message}`);
        return null;
    }
}

// ==============================================
// 2. EXTRAIR PROXYS
// ==============================================
async function fetchProxies() {
    if (cachedProxies && Date.now() < proxyExpiry) {
        console.log(`[Doramogo] 💾 Usando proxies em cache`);
        return cachedProxies;
    }
    
    console.log(`[Doramogo] 🔍 Buscando proxies...`);
    
    try {
        const response = await fetch(PROXY_SOURCE_URL, { headers: HEADERS });
        if (!response.ok) {
            console.log(`[Doramogo] ❌ Falha: ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        
        const primaryMatch = html.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        const fallbackMatch = html.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        
        const proxies = {
            primary: primaryMatch ? primaryMatch[1] : "https://ondemand.netflxx.shop",
            fallback: fallbackMatch ? fallbackMatch[1] : "https://forks-doramas.netflxx.shop"
        };
        
        console.log(`[Doramogo] ✅ PRIMARY: ${proxies.primary}`);
        console.log(`[Doramogo] ✅ FALLBACK: ${proxies.fallback}`);
        
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        
        return proxies;
        
    } catch (err) {
        console.log(`[Doramogo] ❌ Erro: ${err.message}`);
        return null;
    }
}

// ==============================================
// 3. TESTAR URL
// ==============================================
async function testStreamUrl(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok || response.status === 206;
    } catch (err) {
        return false;
    }
}

// ==============================================
// 4. EXTRAIR QUALIDADES
// ==============================================
async function extractQualitiesFromM3u8(url) {
    try {
        const response = await fetch(url, { headers: HEADERS });
        if (!response.ok) return [];
        
        const content = await response.text();
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
                }
            }
        }
        
        return qualities;
    } catch {
        return [];
    }
}

// ==============================================
// 5. FUNÇÕES AUXILIARES
// ==============================================
function titleToSlug(title) {
    if (!title) return '';
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateSlugVariations(baseTitle, season, ano) {
    const baseSlug = titleToSlug(baseTitle);
    const variations = [];
    const seen = {};

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

    return variations;
}

async function getTMDBTitle(tmdbId, mediaType) {
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const ano = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        
        console.log(`[Doramogo] ✅ Título: ${title}`);
        
        return { title, ano };
    } catch (err) {
        return null;
    }
}

// ==============================================
// 6. FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
    const streams = [];
    
    console.log(`\n[Doramogo] 🎬 INICIANDO`);
    
    // ==============================================
    // CONVERTE IMDb → TMDB se necessário
    // ==============================================
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        console.log(`[Doramogo] 🔄 Convertendo IMDb: ${tmdbId}`);
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType);
        if (convertedId) {
            finalId = convertedId;
            console.log(`[Doramogo] ✅ Convertido para TMDB: ${finalId}`);
        } else {
            console.log(`[Doramogo] ❌ Falha na conversão IMDb`);
            return [];
        }
    }
    
    console.log(`[Doramogo] 📺 TMDB ID: ${finalId} | Tipo: ${mediaType} | S${season}E${episode}`);
    
    try {
        const proxies = await fetchProxies();
        if (!proxies) return [];
        
        const info = await getTMDBTitle(finalId, mediaType);
        if (!info) return [];
        
        const targetSeason = mediaType === 'movie' ? 1 : season;
        const targetEpisode = mediaType === 'movie' ? 1 : episode;
        const epPadded = targetEpisode.toString().padStart(2, '0');
        const seasonPadded = targetSeason.toString().padStart(2, '0');
        const timestamp = Date.now();
        
        const slugVariations = generateSlugVariations(info.title, targetSeason, info.ano);
        console.log(`[Doramogo] 🔨 ${slugVariations.length} slugs gerados`);
        
        for (const slug of slugVariations) {
            const firstLetter = slug.charAt(0).toUpperCase() || 'T';
            const streamPath = `${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
            
            const urlsToTry = [
                `${proxies.primary}/${streamPath}`,
                `${proxies.fallback}/${streamPath}`
            ];
            
            for (const url of urlsToTry) {
                console.log(`[Doramogo] 📡 Testando...`);
                
                if (await testStreamUrl(url)) {
                    console.log(`[Doramogo] ✅ Funcionou! Slug: ${slug}`);
                    
                    const qualities = await extractQualitiesFromM3u8(url);
                    
                    if (qualities.length > 0) {
                        for (const q of qualities) {
                            streams.push({
                                name: "Doramogo",
                                title: `${q.height}p`,
                                url: q.url,
                                quality: q.height,
                                type: "hls",
                                headers: HEADERS  // HEADERS no stream!
                            });
                        }
                    } else {
                        streams.push({
                            name: "Doramogo",
                            title: "720p",
                            url: url,
                            quality: 720,
                            type: "hls",
                            headers: HEADERS  // HEADERS no stream!
                        });
                    }
                    return streams;
                }
            }
        }
        
        console.log(`[Doramogo] ❌ Nenhum stream encontrado`);
        return streams;
        
    } catch (err) {
        console.log(`[Doramogo] ❌ Erro: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
