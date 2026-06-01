const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PROXY_SOURCE_URL = "https://www.doramogo.net/series/dream-stage-2026-legendado/temporada-1/episodio-1";

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.doramogo.net/'
};

const CACHE = {};
let cachedProxies = null;
let proxyExpiry = 0;
const PROXY_CACHE_TIME = 60 * 60 * 1000;

// Conversão de números para palavras (0-10)
const NUMBER_WORDS = {
    '0': 'zero', '1': 'um', '2': 'dois', '3': 'tres', 
    '4': 'quatro', '5': 'cinco', '6': 'seis', 
    '7': 'sete', '8': 'oito', '9': 'nove', '10': 'dez'
};

function numberToWords(numStr) {
    return numStr.split('').map(d => NUMBER_WORDS[d] || d).join('-');
}

function titleToSlug(title) {
    if (!title) return '';
    
    const withWords = title.replace(/\d+/g, match => numberToWords(match));
    
    return withWords.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function testUrl(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: HEADERS
        });
        return response.ok || response.status === 206;
    } catch {
        return false;
    }
}

// ==================== BUSCA AUTOMÁTICA DE PROXIES ====================

async function fetchProxies() {
    if (cachedProxies && Date.now() < proxyExpiry) {
        return cachedProxies;
    }
    
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
        
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        
        return proxies;
    } catch {
        return null;
    }
}

// ==================== CONVERSOR IMDb → TMDB ====================

async function convertImdbToTmdb(imdbId, mediaType) {
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { 
                "User-Agent": HEADERS['User-Agent'], 
                "Accept": "application/json" 
            }
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
    } catch {
        return null;
    }
}

// ==================== FUNÇÕES TMDB ====================

async function getTMDBTitle(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        
        let ano = null;
        if (mediaType === 'tv' && data.first_air_date) {
            ano = data.first_air_date.substring(0, 4);
        } else if (mediaType === 'movie' && data.release_date) {
            ano = data.release_date.substring(0, 4);
        }
        
        CACHE[cacheKey] = { title, ano };
        return { title, ano };
    } catch {
        return null;
    }
}

async function getTMDBEpisodeDate(tmdbId, season, episode) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.air_date ? new Date(data.air_date).getTime() : null;
    } catch {
        return null;
    }
}

async function isAnime(tmdbId) {
    const cacheKey = `anime_check_${tmdbId}`;
    if (CACHE[cacheKey] !== undefined) return CACHE[cacheKey];
    
    try {
        const url = `${TMDB_BASE_URL}/tv/${tmdbId}/keywords?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return false;
        
        const data = await response.json();
        const keywords = data.results || [];
        const hasAnimeKeyword = keywords.some(k => k.name.toLowerCase() === 'anime');
        
        CACHE[cacheKey] = hasAnimeKeyword;
        return hasAnimeKeyword;
    } catch {
        CACHE[cacheKey] = false;
        return false;
    }
}

// ==================== FUNÇÕES ANILIST ====================

async function searchAnilistId(title) {
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
                title { romaji english }
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.Media?.id || null;
    } catch {
        return null;
    }
}

async function getAnimeDetails(animeId) {
    const query = `
        query ($id: Int) {
            Media(id: $id) {
                id
                title { romaji english }
                startDate { year month day }
                episodes
                relations {
                    edges {
                        node {
                            id
                            title { romaji english }
                            startDate { year month day }
                            episodes
                        }
                        relationType
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: animeId } })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.Media || null;
    } catch {
        return null;
    }
}

function dateToTimestamp(date) {
    if (!date || !date.year) return null;
    return new Date(date.year, (date.month || 1) - 1, date.day || 1).getTime();
}

async function getAllSeasons(startId) {
    const allSeasons = [];
    const visited = new Set();

    async function followChain(animeId, seasonNum) {
        if (visited.has(animeId)) return;
        visited.add(animeId);

        await new Promise(r => setTimeout(r, 500));

        const anime = await getAnimeDetails(animeId);
        if (!anime) return;

        allSeasons.push({
            id: animeId,
            title: anime.title.romaji || anime.title.english,
            date: dateToTimestamp(anime.startDate),
            season: seasonNum,
            episodes: anime.episodes || 0
        });

        const edges = anime.relations?.edges || [];
        for (const edge of edges) {
            if (edge.relationType === 'SEQUEL') {
                await followChain(edge.node.id, seasonNum + 1);
                break;
            }
        }
    }

    await followChain(startId, 1);
    allSeasons.sort((a, b) => (a.date || 0) - (b.date || 0));
    return allSeasons;
}

function findSeasonByDate(seasons, targetDate) {
    let closest = null;
    let minDiff = Infinity;

    for (const s of seasons) {
        if (!s.date) continue;
        const diff = Math.abs(targetDate - s.date);
        const days = diff / (1000 * 60 * 60 * 24);

        if (days < 180 && diff < minDiff) {
            minDiff = diff;
            closest = s;
        }
    }
    return closest;
}

function analyzeParts(seasons, targetEpisode, episodeDate) {
    const closest = findSeasonByDate(seasons, episodeDate);
    if (!closest) return null;

    const groups = {};
    for (const s of seasons) {
        let base = s.title
            .replace(/[:\s]*(?:Part|Parte|Cour)\s*\d+.*$/i, '')
            .trim();
        if (base.length < 3) base = s.title;
        if (!groups[base]) groups[base] = [];
        groups[base].push(s);
    }

    for (const base in groups) {
        groups[base].sort((a, b) => (a.date || 0) - (b.date || 0));
    }

    for (const base in groups) {
        const group = groups[base];
        const index = group.findIndex(s => s.id === closest.id);
        if (index !== -1) {
            let episodesBefore = 0;
            for (let k = 0; k < index; k++) episodesBefore += group[k].episodes;
            return {
                id: closest.id,
                title: closest.title,
                baseTitle: base,
                partNumber: index + 1,
                episodeInPart: targetEpisode - episodesBefore,
                hasMultipleParts: group.length > 1
            };
        }
    }

    return {
        id: closest.id,
        title: closest.title,
        baseTitle: closest.title,
        partNumber: 1,
        episodeInPart: targetEpisode,
        hasMultipleParts: false
    };
}

// ==================== GERAÇÃO DE SLUGS ====================

function generateSlugVariations(baseTitle, season, ano, animeInfo = null) {
    const baseSlug = titleToSlug(baseTitle);
    const variations = [];
    const seen = {};

    function add(slug) {
        if (!seen[slug]) {
            seen[slug] = true;
            variations.push(slug);
        }
    }

    const words = baseSlug.split('-');

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

    if (animeInfo) {
        const animeSlug = titleToSlug(animeInfo.title);
        add(animeSlug);
        add(animeSlug + '-legendado');
        add(animeSlug + '-dublado');
        
        const baseAnimeSlug = titleToSlug(animeInfo.baseTitle);
        if (baseAnimeSlug !== animeSlug) {
            add(baseAnimeSlug);
            add(baseAnimeSlug + '-legendado');
            add(baseAnimeSlug + '-dublado');
        }
        
        if (animeSlug.includes('2nd')) {
            add(animeSlug.replace('2nd', 'second'));
            add(animeSlug.replace('2nd', 'second') + '-legendado');
        }
        if (animeSlug.includes('3rd')) {
            add(animeSlug.replace('3rd', 'third'));
            add(animeSlug.replace('3rd', 'third') + '-legendado');
        }
        if (animeSlug.includes('4th')) {
            add(animeSlug.replace('4th', 'fourth'));
            add(animeSlug.replace('4th', 'fourth') + '-legendado');
        }
    }

    if (words.length > 3) {
        for (let i = 3; i < words.length; i++) {
            const reduced = words.slice(0, i).join('-');
            add(reduced);
            if (ano) add(reduced + '-' + ano);
            if (season > 1) add(reduced + '-' + season);
        }
    }

    return variations;
}

// ==================== FUNÇÃO PRINCIPAL ====================

async function getStreams(tmdbId, mediaType, season, episode) {
    const debugs = [];
    
    const addDebug = (title, content) => {
        debugs.push({
            name: "Doramogo [DEBUG]",
            title: title,
            url: typeof content === 'object' ? JSON.stringify(content) : String(content),
            quality: 0,
            headers: {}
        });
    };
    
    addDebug("🎬 INÍCIO", `ID: ${tmdbId} | ${mediaType} | S${season}E${episode}`);
    
    // Busca proxies atualizados
    let proxies = await fetchProxies();
    if (!proxies) {
        proxies = {
            primary: "https://ondemand.netflxx.shop",
            fallback: "https://forks-doramas.netflxx.shop"
        };
        addDebug("⚠️ PROXIES", "Usando fallback padrão");
    } else {
        addDebug("✅ PROXIES", `Primary: ${proxies.primary} | Fallback: ${proxies.fallback}`);
    }
    
    // Conversão IMDb → TMDB
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        addDebug("🔄 CONVERTENDO IMDb", tmdbId);
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType);
        if (convertedId) {
            finalId = convertedId;
            addDebug("✅ IMDb CONVERTIDO", `TMDB ID: ${finalId}`);
        } else {
            addDebug("❌ FALHA IMDb", "Não foi possível converter");
            return debugs;
        }
    }
    
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    const seasonPadded = targetSeason.toString().padStart(2, '0');
    const timestamp = Date.now();

    const info = await getTMDBTitle(finalId, mediaType);
    if (!info) {
        addDebug("❌ SEM TÍTULO", "TMDB não retornou dados");
        return debugs;
    }
    
    const { title, ano } = info;
    addDebug("📺 TÍTULO TMDB", `${title} (${ano || 'sem ano'})`);
    
    // Detecção de anime
    let animeInfo = null;
    const animeDetected = mediaType === 'tv' ? await isAnime(finalId) : false;
    
    if (animeDetected) {
        addDebug("🎌 ANIME DETECTADO", "Buscando no Anilist...");
        
        try {
            const episodeDate = await getTMDBEpisodeDate(finalId, targetSeason, targetEpisode);
            
            if (episodeDate) {
                const anilistId = await searchAnilistId(title);
                
                if (anilistId) {
                    addDebug("🔗 ANILIST ID", anilistId);
                    const allSeasons = await getAllSeasons(anilistId);
                    
                    if (allSeasons.length) {
                        const seasonInfo = analyzeParts(allSeasons, targetEpisode, episodeDate);
                        
                        if (seasonInfo) {
                            animeInfo = seasonInfo;
                            addDebug("✅ MATCH ANILIST", `Parte ${seasonInfo.partNumber}, Ep ${seasonInfo.episodeInPart}`);
                        }
                    }
                }
            }
        } catch (err) {
            addDebug("⚠️ ERRO ANILIST", err.message);
        }
    }

    const slugVariations = generateSlugVariations(title, targetSeason, ano, animeInfo);
    addDebug("🔤 SLUGS", `${slugVariations.length} variações`);

    const urls = [];
    const seen = new Set();
    const cdnList = [proxies.primary, proxies.fallback];

    for (const slug of slugVariations) {
        const firstLetter = slug.charAt(0).toUpperCase() || 'T';

        for (const cdn of cdnList) {
            if (mediaType === 'movie') {
                const url = cdn + '/' + firstLetter + '/' + slug + '/stream/stream.m3u8?nocache=' + timestamp;
                if (!seen.has(url)) {
                    seen.add(url);
                    urls.push(url);
                }
            } else {
                const url = cdn + '/' + firstLetter + '/' + slug + '/' + seasonPadded + '-temporada/' + epPadded + '/stream.m3u8?nocache=' + timestamp;
                if (!seen.has(url)) {
                    seen.add(url);
                    urls.push(url);
                }
            }
        }
    }

    addDebug("🔗 URLS PARA TESTAR", `${urls.length} combinações (${cdnList.length} CDNs × ${slugVariations.length} slugs)`);

    for (const url of urls) {
        addDebug("📡 TESTANDO", url.substring(0, 80) + '...');
        
        if (await testUrl(url)) {
            addDebug("✅ ENCONTRADO", url);
            
            let displayTitle = mediaType === 'movie' ? title : `${title} S${targetSeason} EP${targetEpisode}`;
            if (animeInfo && animeInfo.episodeInPart !== targetEpisode) {
                displayTitle += ` (Parte ${animeInfo.partNumber} - Ep ${animeInfo.episodeInPart})`;
            }
            
            const result = [{
                url,
                headers: HEADERS,
                name: animeDetected ? 'Animes 1080p' : 'Doramogo 1080p',
                title: displayTitle
            }];
            
            // Retorna o stream + debugs
            return [...result, ...debugs];
        }
    }

    addDebug("❌ FIM", "Nenhum stream encontrado");
    return debugs;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
