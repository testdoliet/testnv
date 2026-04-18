// Nuvio Plugin - StreamFlix (Com Fallback Garantido e Debug)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

// URL de fallback que sabemos que funciona
const FALLBACK_URL = "http://p2toptz.pro:80/movie/573468/697200/4713.mp4";

let cache = null;
let cacheDate = null;
let seriesEpisodesCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.95;

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
        
        if (movies && movies.length) {
            for (const movie of movies) {
                const cleanTitle = cleanTitleForMapping(movie.name);
                if (cleanTitle) {
                    if (!map[cleanTitle]) map[cleanTitle] = [];
                    map[cleanTitle].push({
                        id: movie.stream_id,
                        type: "movie",
                        originalName: movie.name
                    });
                }
            }
        }
    } catch (e) {}
    
    try {
        const seriesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const series = await seriesResponse.json();
        
        if (series && series.length) {
            for (const serie of series) {
                const cleanTitle = cleanTitleForMapping(serie.name);
                if (cleanTitle) {
                    if (!map[cleanTitle]) map[cleanTitle] = [];
                    map[cleanTitle].push({
                        id: serie.series_id,
                        type: "series",
                        originalName: serie.name
                    });
                }
            }
        }
    } catch (e) {}
    
    return map;
}

function cleanTitleForMapping(title) {
    let cleaned = title.toLowerCase();
    cleaned = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    cleaned = cleaned.replace(/[^\w\s]/g, " ");
    cleaned = cleaned.replace(/\b(4k|hdr|hybrid|dv|hd|fullhd|uhd|2160|1080|720)\b/gi, "");
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*/g, " ");
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned;
}

function normalizeString(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").trim();
}

function calculateSimilarity(str1, str2) {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, len2);
        
        for (let j = start; j < end; j++) {
            if (!s2Matches[j] && s1[i] === s2[j]) {
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }
    }
    
    if (matches === 0) return 0.0;
    
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (s1Matches[i]) {
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }
    }
    
    transpositions = Math.floor(transpositions / 2);
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
    
    let prefixLength = 0;
    for (let i = 0; i < Math.min(4, len1, len2); i++) {
        if (s1[i] === s2[i]) prefixLength++;
        else break;
    }
    
    return Math.min(1.0, jaro + (prefixLength * 0.1 * (1 - jaro)));
}

async function detectRealQuality(url) {
    try {
        const response = await fetch(url, { 
            headers: { 
                "Range": "bytes=0-5242880",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        
        if (!response.ok && response.status !== 206) return null;
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        for (let i = 0; i < bytes.length - 20; i++) {
            if (bytes[i] === 0x74 && bytes[i+1] === 0x6B && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
                for (let offset = 48; offset <= 80; offset++) {
                    if (i + offset + 8 <= bytes.length) {
                        const widthFixed = (bytes[i+offset] << 24) | (bytes[i+offset+1] << 16) | 
                                          (bytes[i+offset+2] << 8) | bytes[i+offset+3];
                        const heightFixed = (bytes[i+offset+4] << 24) | (bytes[i+offset+5] << 16) | 
                                           (bytes[i+offset+6] << 8) | bytes[i+offset+7];
                        
                        const width = Math.round(widthFixed / 65536);
                        const height = Math.round(heightFixed / 65536);
                        
                        if (width >= 640 && width <= 7680 && height >= 360 && height <= 4320) {
                            const pixels = width * height;
                            if (pixels >= 6000000) return 2160;
                            if (pixels >= 1400000) return 1080;
                            if (pixels >= 700000) return 720;
                            return 480;
                        }
                    }
                }
            }
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

async function getMovieUrl(movieId) {
    const url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${movieId}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.stream_url;
}

async function getSeriesEpisodeUrl(seriesId, seasonNum, episodeNum) {
    const cacheKey = `${seriesId}_${seasonNum}_${episodeNum}`;
    if (seriesEpisodesCache[cacheKey]) return seriesEpisodesCache[cacheKey];
    
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
        
        if (streamData.stream_url) {
            seriesEpisodesCache[cacheKey] = streamData.stream_url;
            return streamData.stream_url;
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

async function fetchTMDBTitle(tmdbId, type) {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return type === "movie" ? data.title : data.name;
    } catch (e) {
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL COM FALLBACK GARANTIDO
// ==============================================

async function getStreams(tmdbId, mediaType, season, episode) {
    const debugSteps = [];
    debugSteps.push(`🚀 INICIO: ${tmdbId}, ${mediaType}, S${season}E${episode}`);
    
    // Stream padrão de fallback (sempre disponível)
    let fallbackUsed = false;
    let finalVideoUrl = FALLBACK_URL;
    let finalQuality = 720;
    let finalName = "StreamFlix (Fallback)";
    let finalTitle = `S${String(season || 1).padStart(2, '0')}E${String(episode || 1).padStart(2, '0')} - 720p`;
    let finalAudioType = "Dublado";
    
    try {
        // PASSO 1: Buscar TMDB
        debugSteps.push("PASSO1: Buscando TMDB");
        const tmdbTitle = await fetchTMDBTitle(tmdbId, mediaType);
        
        if (tmdbTitle) {
            debugSteps.push(`✅ TMDB: "${tmdbTitle}"`);
            finalName = `${tmdbTitle} (Dublado)`;
        } else {
            debugSteps.push(`⚠️ TMDB não encontrado, usando nome padrão`);
            finalName = `StreamFlix (Dublado)`;
        }
        
        // PASSO 2: Carregar cache
        debugSteps.push("PASSO2: Carregando cache");
        const index = await getCache();
        debugSteps.push(`Cache: ${Object.keys(index).length} chaves`);
        
        // PASSO 3: Buscar candidatos
        if (tmdbTitle) {
            const cleanTmdbTitle = cleanTitleForMapping(tmdbTitle);
            debugSteps.push(`Clean title: "${cleanTmdbTitle}"`);
            
            const candidates = [];
            
            for (const [key, items] of Object.entries(index)) {
                const similarity = calculateSimilarity(cleanTmdbTitle, key);
                if (similarity >= SIMILARITY_THRESHOLD) {
                    for (const item of items) {
                        if ((mediaType === "movie" && item.type === "movie") ||
                            (mediaType === "tv" && item.type === "series")) {
                            candidates.push({ ...item, similarity });
                        }
                    }
                }
            }
            
            debugSteps.push(`Candidatos: ${candidates.length}`);
            
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.similarity - a.similarity);
                const bestCandidate = candidates[0];
                debugSteps.push(`Melhor: "${bestCandidate.originalName.substring(0, 40)}" (sim: ${bestCandidate.similarity})`);
                
                // Tenta obter URL
                let videoUrl = null;
                
                if (bestCandidate.type === "movie") {
                    videoUrl = await getMovieUrl(bestCandidate.id);
                    debugSteps.push(`Movie ID: ${bestCandidate.id}`);
                } else {
                    videoUrl = await getSeriesEpisodeUrl(bestCandidate.id, season || 1, episode || 1);
                    debugSteps.push(`Series ID: ${bestCandidate.id}`);
                }
                
                if (videoUrl) {
                    debugSteps.push(`✅ URL obtida com sucesso`);
                    finalVideoUrl = videoUrl;
                    fallbackUsed = false;
                    
                    // Detecta qualidade
                    const detectedQuality = await detectRealQuality(videoUrl);
                    if (detectedQuality) {
                        finalQuality = detectedQuality;
                        debugSteps.push(`🎯 Qualidade: ${finalQuality}p`);
                    } else {
                        debugSteps.push(`⚠️ Falha na detecção, usando 720p`);
                    }
                    
                    // Define áudio
                    const isLegendado = bestCandidate.originalName.includes("[L]") || 
                                       bestCandidate.originalName.toLowerCase().includes("legendado");
                    finalAudioType = isLegendado ? "Legendado" : "Dublado";
                    finalName = tmdbTitle ? `${tmdbTitle} (${finalAudioType})` : `StreamFlix (${finalAudioType})`;
                    
                    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
                    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
                    finalTitle = mediaType === "movie" ? "Filme" : `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
                    finalTitle += ` - ${finalQuality}p`;
                    
                    debugSteps.push(`✅ Stream encontrado!`);
                } else {
                    debugSteps.push(`❌ URL não obtida, usando fallback`);
                    fallbackUsed = true;
                }
            } else {
                debugSteps.push(`❌ Nenhum candidato, usando fallback`);
                fallbackUsed = true;
            }
        } else {
            debugSteps.push(`❌ Sem TMDB, usando fallback`);
            fallbackUsed = true;
        }
        
    } catch (error) {
        debugSteps.push(`❌ ERRO: ${error.message}`);
        fallbackUsed = true;
    }
    
    // Se usou fallback, adiciona debug no título
    if (fallbackUsed) {
        finalTitle = `[FALLBACK] ${finalTitle} | ${debugSteps.join(" → ").substring(0, 100)}`;
    }
    
    // SEMPRE RETORNA UM STREAM
    return [{
        name: finalName,
        title: finalTitle,
        url: finalVideoUrl,
        quality: finalQuality,
        headers: {
            "Referer": BASE_URL,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    }];
}

module.exports = { getStreams };
