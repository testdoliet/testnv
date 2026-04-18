// Nuvio Plugin - StreamFlix com Detecção de Qualidade REAL
// Com retorno organizado: Nome do Filme + Opção + Qualidade

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

let cache = null;
let cacheDate = null;
let cacheDetails = null;
let seriesEpisodesCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.95;

console.log("[StreamFlix] ========================================");
console.log("[StreamFlix] Plugin StreamFlix CARREGADO!");
console.log("[StreamFlix] ========================================");

async function getCache() {
    if (!cache || Date.now() - cacheDate > CACHE_TTL) {
        const result = await buildIndex();
        cache = result.map;
        cacheDetails = result.details;
        cacheDate = Date.now();
        console.log("[StreamFlix] Cache atualizado com " + Object.keys(cache).length + " chaves");
    }
    return { map: cache, details: cacheDetails };
}

async function buildIndex() {
    const map = {};
    const details = {};
    
    console.log("[StreamFlix] Construindo índice...");
    
    try {
        console.log("[StreamFlix] Buscando filmes...");
        const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        const movies = await moviesResponse.json();
        console.log("[StreamFlix] Encontrados " + movies.length + " filmes");
        
        for (const movie of movies) {
            if (isAdultContent(movie.name)) continue;
            const cleanTitle = cleanTitleForMapping(movie.name);
            if (cleanTitle) {
                const key = cleanTitle;
                if (!map[key]) map[key] = [];
                map[key].push({
                    id: movie.stream_id,
                    type: "movie",
                    originalName: movie.name,
                    cleanName: cleanTitle
                });
                details[movie.stream_id] = {
                    originalName: movie.name,
                    cleanName: cleanTitle,
                    type: "movie"
                };
            }
        }
    } catch (e) {
        console.log("[StreamFlix] Erro ao buscar filmes:", e.message);
    }
    
    try {
        console.log("[StreamFlix] Buscando séries...");
        const seriesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const series = await seriesResponse.json();
        console.log("[StreamFlix] Encontradas " + series.length + " séries");
        
        for (const serie of series) {
            if (isAdultContent(serie.name)) continue;
            const cleanTitle = cleanTitleForMapping(serie.name);
            if (cleanTitle) {
                const key = cleanTitle;
                if (!map[key]) map[key] = [];
                map[key].push({
                    id: serie.series_id,
                    type: "series",
                    originalName: serie.name,
                    cleanName: cleanTitle
                });
                details[serie.series_id] = {
                    originalName: serie.name,
                    cleanName: cleanTitle,
                    type: "series"
                };
            }
        }
    } catch (e) {
        console.log("[StreamFlix] Erro ao buscar séries:", e.message);
    }
    
    return { map, details };
}

function isAdultContent(title) {
    const adultKeywords = ["XXX", "ADULTOS", "Porn", "Sexo", "Erótico", "Hardcore", "18+", "Adult"];
    const titleUpper = title.toUpperCase();
    return adultKeywords.some(keyword => titleUpper.includes(keyword));
}

function cleanTitleForMapping(title) {
    let cleaned = title.trim();
    cleaned = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    cleaned = cleaned.replace(/[^\w\s]/g, " ");
    cleaned = cleaned.replace(/\b4K\b/gi, "");
    cleaned = cleaned.replace(/\s*4K\s*/gi, " ");
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*/g, " ");
    cleaned = cleaned.replace(/\s*\(\d{4}\)$/g, "");
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*/g, " ");
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*$/g, "");
    cleaned = cleaned.replace(/\s*HDR\s*/gi, " ");
    cleaned = cleaned.replace(/\s*HYBRID\s*/gi, " ");
    cleaned = cleaned.replace(/\s*DV\s*/gi, " ");
    cleaned = cleaned.replace(/\s*HD\s*/gi, " ");
    cleaned = cleaned.replace(/\s*FULLHD\s*/gi, " ");
    cleaned = cleaned.replace(/\s*UHD\s*/gi, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned.toLowerCase();
}

function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function jaroWinklerSimilarity(s1, s2) {
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
    const maxPrefix = Math.min(4, len1, len2);
    for (let i = 0; i < maxPrefix; i++) {
        if (s1[i] === s2[i]) {
            prefixLength++;
        } else {
            break;
        }
    }
    
    const p = 0.1;
    const jaroWinkler = jaro + (prefixLength * p * (1 - jaro));
    
    return Math.min(1.0, jaroWinkler);
}

function calculateSimilarity(str1, str2) {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    return jaroWinklerSimilarity(s1, s2);
}

function typeMatches(internalType, externalType) {
    if (internalType === "series" && externalType === "tv") return true;
    if (internalType === "movie" && externalType === "movie") return true;
    return false;
}

function extractTags(originalName) {
    const tags = {
        hasLegendado: false,
        hasHDR: false,
        hasHybrid: false,
        hasDV: false,
        otherTags: []
    };
    
    tags.hasLegendado = /\[L\]/.test(originalName);
    tags.hasHDR = originalName.toUpperCase().includes("HDR");
    tags.hasHybrid = originalName.toUpperCase().includes("HYBRID");
    tags.hasDV = originalName.toUpperCase().includes("DV");
    
    const tagRegex = /\[([^\]]+)\]/g;
    let match;
    while ((match = tagRegex.exec(originalName)) !== null) {
        const tag = match[1].toUpperCase();
        if (!["L", "HDR", "HYBRID", "DV"].includes(tag)) {
            tags.otherTags.push(tag);
        }
    }
    
    return tags;
}

function getQualityFromResolution(width, height) {
    const pixels = width * height;
    
    if (pixels >= 6000000) return 2160;
    if (pixels >= 1400000) return 1080;
    if (pixels >= 700000) return 720;
    if (pixels >= 300000) return 480;
    
    if (width >= 3840) return 2160;
    if (width >= 1920) return 1080;
    if (width >= 1280) return 720;
    
    return 480;
}

async function detectVideoMetadata(url) {
    console.log("[StreamFlix] [DEBUG] Detectando metadados...");
    
    try {
        const response = await fetch(url, { 
            headers: { 
                "Range": "bytes=0-20971520",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": BASE_URL
            }
        });
        
        if (!response.ok && response.status !== 206) {
            return null;
        }
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        let width = null;
        let height = null;
        
        // Busca por 'tkhd' para resolução
        for (let i = 0; i < bytes.length - 20; i++) {
            if (bytes[i] === 0x74 && bytes[i+1] === 0x6B && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
                for (let offset = 48; offset <= 80; offset++) {
                    if (i + offset + 8 <= bytes.length) {
                        const widthFixed = (bytes[i+offset] << 24) | (bytes[i+offset+1] << 16) | 
                                          (bytes[i+offset+2] << 8) | bytes[i+offset+3];
                        const heightFixed = (bytes[i+offset+4] << 24) | (bytes[i+offset+5] << 16) | 
                                           (bytes[i+offset+6] << 8) | bytes[i+offset+7];
                        
                        const w = Math.round(widthFixed / 65536);
                        const h = Math.round(heightFixed / 65536);
                        
                        if (w >= 640 && w <= 7680 && h >= 360 && h <= 4320) {
                            width = w;
                            height = h;
                            break;
                        }
                    }
                }
                if (width && height) break;
            }
        }
        
        if (!width || !height) {
            return null;
        }
        
        const quality = getQualityFromResolution(width, height);
        
        return {
            width: width,
            height: height,
            quality: quality,
            resolution: `${width}x${height}`
        };
        
    } catch (e) {
        console.log("[StreamFlix] [DEBUG] ❌ Erro:", e.message);
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
        
        const seasonData = episodes[seasonKey];
        const targetEpisode = parseInt(episodeNum);
        const episodeData = seasonData.find(ep => parseInt(ep.episode_num) === targetEpisode);
        
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

async function getMovieUrl(movieId) {
    const url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${movieId}`;
    const streamResponse = await fetch(url);
    const streamData = await streamResponse.json();
    return streamData.stream_url;
}

// ==============================================
// FUNÇÃO PRINCIPAL COM RETORNO ORGANIZADO
// ==============================================
async function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[StreamFlix] [DEBUG] getStreams iniciado para:", tmdbId);
    
    try {
        const { map: index } = await getCache();
        
        const tmdbTitle = await fetchTMDBTitle(tmdbId, mediaType);
        if (!tmdbTitle) {
            console.log("[StreamFlix] [DEBUG] ❌ TMDB title não encontrado");
            return [];
        }
        console.log("[StreamFlix] [DEBUG] TMDB Title:", tmdbTitle);
        
        const cleanTmdbTitle = cleanTitleForMapping(tmdbTitle);
        const normalizedTmdbTitle = normalizeString(cleanTmdbTitle);
        
        const allCandidates = [];
        
        for (const [key, items] of Object.entries(index)) {
            const normalizedKey = normalizeString(key);
            const similarity = calculateSimilarity(normalizedTmdbTitle, normalizedKey);
            
            for (const item of items) {
                allCandidates.push({
                    ...item,
                    similarity: similarity,
                    cleanKey: key
                });
            }
        }
        
        allCandidates.sort((a, b) => b.similarity - a.similarity);
        
        const validCandidates = allCandidates.filter(c => 
            c.similarity >= SIMILARITY_THRESHOLD && typeMatches(c.type, mediaType)
        );
        
        if (validCandidates.length === 0) return [];
        
        const maxSimilarity = validCandidates[0].similarity;
        const bestCandidates = validCandidates.filter(c => c.similarity === maxSimilarity);
        
        // Array para armazenar streams
        const streamsWithMetadata = [];
        
        for (const candidate of bestCandidates) {
            console.log("[StreamFlix] [DEBUG] Processando:", candidate.originalName);
            
            const tags = extractTags(candidate.originalName);
            let videoUrl = null;
            
            if (candidate.type === "movie") {
                videoUrl = await getMovieUrl(candidate.id);
            } else {
                videoUrl = await getSeriesEpisodeUrl(candidate.id, season || 1, episode || 1);
            }
            
            if (!videoUrl) continue;
            
            const metadata = await detectVideoMetadata(videoUrl);
            
            if (!metadata) {
                console.log("[StreamFlix] [DEBUG] ❌ Falha ao detectar metadados");
                continue;
            }
            
            // Define se é Dublado ou Legendado
            const audioType = tags.hasLegendado ? "Legendado" : "Dublado";
            
            streamsWithMetadata.push({
                url: videoUrl,
                quality: metadata.quality,
                resolution: metadata.resolution,
                width: metadata.width,
                height: metadata.height,
                audioType: audioType,
                originalName: candidate.originalName,
                headers: {
                    "Referer": BASE_URL,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            });
        }
        
        // Remove duplicatas (mesma resolução e qualidade)
        const uniqueStreams = [];
        const seenResolutions = new Set();
        
        for (const stream of streamsWithMetadata) {
            const key = `${stream.quality}_${stream.resolution}`;
            if (!seenResolutions.has(key)) {
                seenResolutions.add(key);
                uniqueStreams.push(stream);
            }
        }
        
        // Ordena por qualidade (maior primeiro)
        uniqueStreams.sort((a, b) => b.quality - a.quality);
        
        // Monta o retorno organizado
        const result = uniqueStreams.map((stream, index) => {
            const optionNumber = index + 1;
            
            // Nome: Nome do Filme (Dublado ou Legendado)
            const name = `${tmdbTitle} (${stream.audioType})`;
            
            // Título: Opção X - 1920x816
            const title = `Opção ${optionNumber} - ${stream.resolution}`;
            
            return {
                name: name,
                title: title,
                url: stream.url,
                quality: stream.quality,
                headers: stream.headers
            };
        });
        
        console.log("[StreamFlix] [DEBUG] Streams retornados:", result.length);
        return result;
        
    } catch (error) {
        console.log("[StreamFlix] [DEBUG] ❌ ERRO:", error.message);
        return [];
    }
}

module.exports = { getStreams };
