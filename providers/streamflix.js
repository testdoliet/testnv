// Nuvio Plugin - StreamFlix (Debug por Etapas)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

let cache = null;
let cacheDate = null;
let seriesEpisodesCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.95;

// ==============================================
// FUNÇÃO PRINCIPAL COM DEBUG POR ETAPAS
// ==============================================

async function getStreams(tmdbId, mediaType, season, episode) {
    
    // ==========================================
    // ETAPA 1: TESTAR CONEXÃO COM STREAMFLIX
    // ==========================================
    try {
        const testUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
        const testResponse = await fetch(testUrl, { method: 'HEAD' });
        
        if (!testResponse.ok) {
            return [{
                name: "❌ ETAPA 1 FALHOU",
                title: `StreamFlix offline: ${testResponse.status}`,
                url: "",
                quality: 0,
                headers: {}
            }];
        }
    } catch (e) {
        return [{
            name: "❌ ETAPA 1 FALHOU",
            title: `Não foi possível conectar: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 2: BUSCAR TMDB
    // ==========================================
    let tmdbTitle = null;
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        const tmdbResponse = await fetch(tmdbUrl);
        
        if (!tmdbResponse.ok) {
            return [{
                name: "❌ ETAPA 2 FALHOU",
                title: `TMDB erro ${tmdbResponse.status} para ID ${tmdbId}`,
                url: "",
                quality: 0,
                headers: {}
            }];
        }
        
        const tmdbData = await tmdbResponse.json();
        tmdbTitle = mediaType === "movie" ? tmdbData.title : tmdbData.name;
        
        if (!tmdbTitle) {
            return [{
                name: "❌ ETAPA 2 FALHOU",
                title: `TMDB não retornou título para ID ${tmdbId}`,
                url: "",
                quality: 0,
                headers: {}
            }];
        }
        
    } catch (e) {
        return [{
            name: "❌ ETAPA 2 FALHOU",
            title: `TMDB erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 3: CARREGAR CACHE (FILMES)
    // ==========================================
    let movies = [];
    try {
        const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        movies = await moviesResponse.json();
        
        if (!movies || !movies.length) {
            return [{
                name: "❌ ETAPA 3 FALHOU",
                title: `Nenhum filme encontrado no cache`,
                url: "",
                quality: 0,
                headers: {}
            }];
        }
        
    } catch (e) {
        return [{
            name: "❌ ETAPA 3 FALHOU",
            title: `Erro ao carregar filmes: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 4: CARREGAR CACHE (SÉRIES)
    // ==========================================
    let series = [];
    try {
        const seriesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        series = await seriesResponse.json();
        
    } catch (e) {
        return [{
            name: "❌ ETAPA 4 FALHOU",
            title: `Erro ao carregar séries: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 5: LIMPAR TÍTULO PARA BUSCA
    // ==========================================
    const cleanTmdbTitle = cleanTitleForMapping(tmdbTitle);
    
    // ==========================================
    // ETAPA 6: BUSCAR CANDIDATOS
    // ==========================================
    const candidates = [];
    
    // Busca em filmes
    for (const movie of movies) {
        const cleanMovieTitle = cleanTitleForMapping(movie.name);
        const similarity = calculateSimilarity(cleanTmdbTitle, cleanMovieTitle);
        
        if (similarity >= SIMILARITY_THRESHOLD && mediaType === "movie") {
            candidates.push({
                id: movie.stream_id,
                type: "movie",
                originalName: movie.name,
                similarity: similarity
            });
        }
    }
    
    // Busca em séries
    for (const serie of series) {
        const cleanSerieTitle = cleanTitleForMapping(serie.name);
        const similarity = calculateSimilarity(cleanTmdbTitle, cleanSerieTitle);
        
        if (similarity >= SIMILARITY_THRESHOLD && mediaType === "tv") {
            candidates.push({
                id: serie.series_id,
                type: "series",
                originalName: serie.name,
                similarity: similarity
            });
        }
    }
    
    if (candidates.length === 0) {
        return [{
            name: "❌ ETAPA 6 FALHOU",
            title: `Nenhum candidato encontrado para "${tmdbTitle}" (limpo: "${cleanTmdbTitle}")`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 7: ORDENAR CANDIDATOS
    // ==========================================
    candidates.sort((a, b) => b.similarity - a.similarity);
    const bestCandidates = candidates.filter(c => c.similarity === candidates[0].similarity);
    
    // ==========================================
    // ETAPA 8: OBTER URL DO VÍDEO
    // ==========================================
    let videoUrl = null;
    let selectedCandidate = null;
    
    for (const candidate of bestCandidates) {
        try {
            let url = null;
            
            if (candidate.type === "movie") {
                const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${candidate.id}`;
                const response = await fetch(streamUrl);
                const data = await response.json();
                url = data.stream_url;
            } else {
                const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${candidate.id}`;
                const response = await fetch(streamUrl);
                const data = await response.json();
                url = data.stream_url;
            }
            
            if (url) {
                videoUrl = url;
                selectedCandidate = candidate;
                break;
            }
        } catch (e) {
            continue;
        }
    }
    
    if (!videoUrl) {
        return [{
            name: "❌ ETAPA 8 FALHOU",
            title: `Não foi possível obter URL para os candidatos encontrados`,
            url: "",
            quality: 0,
            headers: {}
        }];
    }
    
    // ==========================================
    // ETAPA 9: DETECTAR QUALIDADE REAL
    // ==========================================
    let quality = 720;
    let resolution = "";
    
    try {
        const response = await fetch(videoUrl, { 
            headers: { 
                "Range": "bytes=0-5242880",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        
        if (response.ok || response.status === 206) {
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            let found = false;
            for (let i = 0; i < bytes.length - 20 && !found; i++) {
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
                                if (pixels >= 6000000) quality = 2160;
                                else if (pixels >= 1400000) quality = 1080;
                                else if (pixels >= 700000) quality = 720;
                                else quality = 480;
                                
                                resolution = `${width}x${height}`;
                                found = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Mantém qualidade padrão 720
    }
    
    // ==========================================
    // SUCESSO - RETORNA STREAM
    // ==========================================
    const isLegendado = selectedCandidate.originalName.includes("[L]") || 
                       selectedCandidate.originalName.toLowerCase().includes("legendado");
    const audioType = isLegendado ? "Legendado" : "Dublado";
    
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeDisplay = mediaType === "movie" ? "Filme" : `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
    
    let titleDisplay = `${episodeDisplay} - ${quality}p`;
    if (resolution) {
        titleDisplay += ` [${resolution}]`;
    }
    
    return [{
        name: `${tmdbTitle} (${audioType})`,
        title: titleDisplay,
        url: videoUrl,
        quality: quality,
        headers: {
            "Referer": BASE_URL,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    }];
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

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

module.exports = { getStreams };
