// Nuvio Plugin - StreamFlix

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

let cache = null;
let cacheDate = null;
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getCache() {
    if (!cache || Date.now() - cacheDate > CACHE_TTL) {
        cache = await buildIndex();
        cacheDate = Date.now();
    }
    return cache;
}

async function buildIndex() {
    const map = {};
    
    try {
        const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        const movies = await moviesResponse.json();
        
        for (const movie of movies) {
            if (isAdultContent(movie.name)) continue;
            const cleanTitle = cleanTitleForMapping(movie.name);
            if (cleanTitle) {
                map[cleanTitle] = {
                    id: movie.stream_id,
                    type: "movie"
                };
            }
        }
    } catch (e) {}
    
    try {
        const seriesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const series = await seriesResponse.json();
        
        for (const serie of series) {
            if (isAdultContent(serie.name)) continue;
            const cleanTitle = cleanTitleForMapping(serie.name);
            if (cleanTitle) {
                map[cleanTitle] = {
                    id: serie.series_id,
                    type: "series"
                };
            }
        }
    } catch (e) {}
    
    return map;
}

function isAdultContent(title) {
    const adultKeywords = ["XXX", "ADULTOS", "Porn", "Sexo", "Erótico", "Hardcore", "18+", "Adult"];
    const titleUpper = title.toUpperCase();
    return adultKeywords.some(keyword => titleUpper.includes(keyword));
}

function cleanTitleForMapping(title) {
    let cleaned = title.trim();
    cleaned = cleaned.replace(/\b4K\b/gi, "");
    cleaned = cleaned.replace(/\s*4K\s*/gi, " ");
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*/g, " ");
    cleaned = cleaned.replace(/\s*\(\d{4}\)$/g, "");
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*/g, " ");
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*$/g, "");
    cleaned = cleaned.replace(/\s*HDR\s*/gi, " ");
    cleaned = cleaned.replace(/\s*HYBRID\s*/gi, " ");
    cleaned = cleaned.replace(/\s*HD\s*/gi, " ");
    cleaned = cleaned.replace(/\s*FULLHD\s*/gi, " ");
    cleaned = cleaned.replace(/\s*UHD\s*/gi, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned.toLowerCase();
}

async function fetchTMDBTitle(tmdbId, type) {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return type === "movie" ? data.title : data.name;
}

async function getStreamUrl(id, type, season, episode) {
    if (type === "movie") {
        const streamResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${id}`);
        const streamData = await streamResponse.json();
        return streamData.stream_url;
    } else {
        const infoResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series_info&series_id=${id}`);
        const infoData = await infoResponse.json();
        
        const episodes = infoData.episodes;
        if (episodes && episodes[season]) {
            const episodeData = episodes[season].find(ep => ep.episode_num === episode);
            if (episodeData) {
                const streamResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${episodeData.id}`);
                const streamData = await streamResponse.json();
                return streamData.stream_url;
            }
        }
        return null;
    }
}

function getQualityFromUrl(url) {
    if (!url) return 720;
    if (url.includes("2160") || url.includes("4k")) return 2160;
    if (url.includes("1440")) return 1440;
    if (url.includes("1080")) return 1080;
    if (url.includes("720")) return 720;
    if (url.includes("480")) return 480;
    return 720;
}

async function load(tmdbId, type, season, episode) {
    try {
        const index = await getCache();
        
        const tmdbTitle = await fetchTMDBTitle(tmdbId, type);
        if (!tmdbTitle) return { streams: [] };
        
        const cleanTmdbTitle = cleanTitleForMapping(tmdbTitle);
        
        const mapped = index[cleanTmdbTitle];
        if (!mapped) return { streams: [] };
        
        const videoUrl = await getStreamUrl(mapped.id, mapped.type, season, episode);
        if (!videoUrl) return { streams: [] };
        
        const quality = getQualityFromUrl(videoUrl);
        
        return {
            streams: [{
                name: `StreamFlix ${quality}p`,
                url: videoUrl,
                quality: quality,
                headers: {
                    "Referer": BASE_URL,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
                }
            }]
        };
        
    } catch (error) {
        return { streams: [] };
    }
}

module.exports = { load };
