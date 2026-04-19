// Nuvio Plugin - StreamFlix (Baseado no modelo que funciona)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://streamflix.live/',
    'Accept': '*/*'
};

const CACHE = {};

// ==============================================
// FUNÇÃO PARA TESTAR URL
// ==============================================
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

// ==============================================
// BUSCAR TÍTULO NO TMDB
// ==============================================
async function getTMDBTitle(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;

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
    if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].timestamp < 3600000) {
        return CACHE[cacheKey].data;
    }

    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        const data = await response.json();
        CACHE[cacheKey] = { data, timestamp: Date.now() };
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
    if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].timestamp < 3600000) {
        return CACHE[cacheKey].data;
    }

    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const data = await response.json();
        CACHE[cacheKey] = { data, timestamp: Date.now() };
        return data;
    } catch {
        return [];
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
// CALCULAR SIMILARIDADE
// ==============================================
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const s1 = str1;
    const s2 = str2;
    const len1 = s1.length;
    const len2 = s2.length;
    
    let matches = 0;
    let i = 0, j = 0;
    
    while (i < len1 && j < len2) {
        if (s1[i] === s2[j]) {
            matches++;
            i++;
            j++;
        } else {
            i++;
        }
    }
    
    return matches / Math.max(len1, len2);
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
// OBTER URL DO EPISÓDIO DA SÉRIE
// ==============================================
async function getSeriesEpisodeUrl(seriesId, seasonNum, episodeNum) {
    try {
        // Primeiro busca informações da série
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
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : (season || 1);
    const targetEpisode = mediaType === 'movie' ? 1 : (episode || 1);
    
    // Busca título no TMDB
    const tmdbTitle = await getTMDBTitle(tmdbId, mediaType);
    if (!tmdbTitle) return [];
    
    const cleanTmdbTitle = cleanTitle(tmdbTitle);
    
    // Busca filmes/séries do StreamFlix
    let items = [];
    if (mediaType === 'movie') {
        items = await getStreamFlixMovies();
    } else {
        items = await getStreamFlixSeries();
    }
    
    if (!items.length) return [];
    
    // Encontra o melhor match
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const item of items) {
        const cleanItemTitle = cleanTitle(item.name);
        const similarity = calculateSimilarity(cleanTmdbTitle, cleanItemTitle);
        
        if (similarity > bestSimilarity && similarity >= 0.7) {
            bestSimilarity = similarity;
            bestMatch = item;
        }
    }
    
    if (!bestMatch) return [];
    
    // Obtém a URL do vídeo
    let videoUrl = null;
    
    if (mediaType === 'movie') {
        videoUrl = await getMovieUrl(bestMatch.stream_id);
    } else {
        videoUrl = await getSeriesEpisodeUrl(bestMatch.series_id, targetSeason, targetEpisode);
    }
    
    if (!videoUrl) return [];
    
    // Define qualidade (padrão 720p por enquanto)
    let quality = 720;
    let qualityLabel = "720p";
    
    // Tenta detectar qualidade real (opcional, pode remover se der erro)
    try {
        if (videoUrl.includes('2160') || videoUrl.includes('4k')) {
            quality = 2160;
            qualityLabel = "2160p";
        } else if (videoUrl.includes('1080')) {
            quality = 1080;
            qualityLabel = "1080p";
        } else if (videoUrl.includes('720')) {
            quality = 720;
            qualityLabel = "720p";
        }
    } catch (e) {}
    
    // Define se é dublado ou legendado
    const isLegendado = bestMatch.name.includes('[L]') || bestMatch.name.toLowerCase().includes('legendado');
    const audioType = isLegendado ? 'Legendado' : 'Dublado';
    
    // Monta título do episódio
    let episodeTitle = '';
    if (mediaType === 'movie') {
        episodeTitle = tmdbTitle;
    } else {
        episodeTitle = `${tmdbTitle} - S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
    }
    
    return [{
        name: `StreamFlix - ${tmdbTitle} (${audioType}) ${qualityLabel}`,
        title: episodeTitle,
        url: videoUrl,
        quality: quality,
        headers: HEADERS
    }];
}

// Exporta a função
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
