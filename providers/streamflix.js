// Nuvio Plugin - StreamFlix (Baseado no Doramogo)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    'Referer': 'https://streamflix.live/'
};

const CACHE = {};

// ==============================================
// BUSCAR TÍTULO NO TMDB
// ==============================================
async function getTMDBTitle(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        
        CACHE[cacheKey] = title;
        return title;
    } catch {
        return null;
    }
}

// ==============================================
// BUSCAR FILMES DO STREAMFLIX
// ==============================================
async function getStreamFlixMovies() {
    const cacheKey = 'streamflix_movies';
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        const data = await response.json();
        CACHE[cacheKey] = data;
        return data;
    } catch {
        return [];
    }
}

// ==============================================
// BUSCAR SÉRIES DO STREAMFLIX
// ==============================================
async function getStreamFlixSeries() {
    const cacheKey = 'streamflix_series';
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const data = await response.json();
        CACHE[cacheKey] = data;
        return data;
    } catch {
        return [];
    }
}

// ==============================================
// OBTER URL DO FILME
// ==============================================
async function getMovieUrl(movieId) {
    try {
        const url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${movieId}`;
        const response = await fetch(url);
        const data = await response.json();
        return data.stream_url;
    } catch {
        return null;
    }
}

// ==============================================
// OBTER URL DO EPISÓDIO
// ==============================================
async function getSeriesEpisodeUrl(seriesId, seasonNum, episodeNum) {
    try {
        const infoUrl = `${BASE_URL}/api_proxy.php?action=get_series_info&series_id=${seriesId}`;
        const infoResponse = await fetch(infoUrl);
        const infoData = await infoResponse.json();
        
        const episodes = infoData.episodes;
        if (!episodes) return null;
        
        const seasonKey = seasonNum.toString();
        if (!episodes[seasonKey]) return null;
        
        const episodeData = episodes[seasonKey].find(ep => parseInt(ep.episode_num) === parseInt(episodeNum));
        if (!episodeData) return null;
        
        const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${episodeData.id}`;
        const streamResponse = await fetch(streamUrl);
        const streamData = await streamResponse.json();
        
        return streamData.stream_url;
    } catch {
        return null;
    }
}

// ==============================================
// LIMPAR TÍTULO PARA COMPARAÇÃO
// ==============================================
function cleanTitle(title) {
    if (!title) return '';
    return title.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s*(4k|hdr|hybrid|dv|hd|fullhd|uhd|1080|720|2160)\s*/gi, ' ')
        .replace(/\s*\(\d{4}\)\s*/g, ' ')
        .replace(/\s*\[[^\]]+\]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : (season || 1);
    const targetEpisode = mediaType === 'movie' ? 1 : (episode || 1);
    
    // 1. Buscar título no TMDB
    const tmdbTitle = await getTMDBTitle(tmdbId, mediaType);
    if (!tmdbTitle) return [];
    
    const cleanSearch = cleanTitle(tmdbTitle);
    
    // 2. Buscar filmes ou séries
    let items = [];
    if (mediaType === 'movie') {
        items = await getStreamFlixMovies();
    } else {
        items = await getStreamFlixSeries();
    }
    
    if (!items.length) return [];
    
    // 3. Encontrar melhor correspondência
    let bestMatch = null;
    let bestScore = 0;
    
    for (const item of items) {
        const cleanItem = cleanTitle(item.name);
        
        // Verifica se o título está contido
        let score = 0;
        if (cleanItem.includes(cleanSearch) || cleanSearch.includes(cleanItem.substring(0, 10))) {
            score = 1;
        } else {
            // Conta palavras em comum
            const searchWords = cleanSearch.split(' ');
            let matches = 0;
            for (const word of searchWords) {
                if (word.length > 3 && cleanItem.includes(word)) {
                    matches++;
                }
            }
            score = matches / searchWords.length;
        }
        
        if (score > bestScore && score > 0.3) {
            bestScore = score;
            bestMatch = item;
        }
    }
    
    if (!bestMatch) return [];
    
    // 4. Obter URL do vídeo
    let videoUrl = null;
    
    if (mediaType === 'movie') {
        videoUrl = await getMovieUrl(bestMatch.stream_id);
    } else {
        videoUrl = await getSeriesEpisodeUrl(bestMatch.series_id, targetSeason, targetEpisode);
    }
    
    if (!videoUrl) return [];
    
    // 5. Detectar qualidade
    let quality = 720;
    if (videoUrl.includes('2160') || videoUrl.includes('4k')) quality = 2160;
    else if (videoUrl.includes('1080')) quality = 1080;
    else if (videoUrl.includes('720')) quality = 720;
    
    // 6. Definir áudio
    const isLegendado = bestMatch.name.includes('[L]') || bestMatch.name.toLowerCase().includes('legendado');
    const audioType = isLegendado ? 'Legendado' : 'Dublado';
    
    // 7. Montar título do episódio
    let episodeTitle = '';
    if (mediaType === 'movie') {
        episodeTitle = tmdbTitle;
    } else {
        episodeTitle = `${tmdbTitle} - S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
    }
    
    // 8. Retornar stream
    return [{
        name: `${tmdbTitle} (${audioType})`,
        title: `${episodeTitle} - ${quality}p`,
        url: videoUrl,
        quality: quality,
        headers: HEADERS
    }];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
