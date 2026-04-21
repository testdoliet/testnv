// Nuvio Plugin - StreamFlix (Baseado no MovieBlast)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://streamflix.live/'
};

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

function normalizeTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .replace(/\b(the|a|an)\b/g, "")
        .replace(/[:\-_]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();
}

function calculateSimilarity(title1, title2) {
    const norm1 = normalizeTitle(title1);
    const norm2 = normalizeTitle(title2);
    
    if (norm1 === norm2) return 1;
    
    const words1 = norm1.split(/\s+/).filter(w => w.length > 0);
    const words2 = norm2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set2 = new Set(words2);
    const intersection = words1.filter(w => set2.has(w));
    const union = new Set([...words1, ...words2]);
    
    return intersection.length / union.size;
}

function matchQuality(s) {
    if (!s) return "720p";
    const v = s.toLowerCase();
    if (v.includes("2160") || v.includes("4k")) return "4K";
    if (v.includes("1080")) return "1080p";
    if (v.includes("720")) return "720p";
    if (v.includes("480")) return "480p";
    return "720p";
}

function getQualityNumber(qualityStr) {
    if (qualityStr === "4K") return 2160;
    if (qualityStr === "1080p") return 1080;
    if (qualityStr === "720p") return 720;
    return 720;
}

// ==============================================
// BUSCAR TÍTULO NO TMDB
// ==============================================

async function getTMDBDetails(tmdbId, mediaType) {
    console.log(`[StreamFlix] Buscando TMDB: ID ${tmdbId}, Tipo ${mediaType}`);
    
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { 
                "Accept": "application/json", 
                "User-Agent": "Mozilla/5.0" 
            }
        });
        
        if (!response.ok) {
            console.log(`[StreamFlix] TMDB erro: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        
        console.log(`[StreamFlix] TMDB encontrado: "${title}" (${year})`);
        
        return { title, year };
    } catch (e) {
        console.log(`[StreamFlix] TMDB erro: ${e.message}`);
        return null;
    }
}

// ==============================================
// BUSCAR FILMES/SÉRIES NO STREAMFLIX
// ==============================================

async function searchStreamFlix(query) {
    console.log(`[StreamFlix] Buscando por: "${query}"`);
    
    try {
        // Busca filmes
        const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
        const moviesRes = await fetch(moviesUrl, { headers: HEADERS });
        
        if (!moviesRes.ok) {
            console.log(`[StreamFlix] Erro ao buscar filmes: ${moviesRes.status}`);
            return [];
        }
        
        const movies = await moviesRes.json();
        console.log(`[StreamFlix] ${movies.length} filmes carregados`);
        
        // Busca séries
        const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
        const seriesRes = await fetch(seriesUrl, { headers: HEADERS });
        
        if (!seriesRes.ok) {
            console.log(`[StreamFlix] Erro ao buscar séries: ${seriesRes.status}`);
            return movies;
        }
        
        const series = await seriesRes.json();
        console.log(`[StreamFlix] ${series.length} séries carregadas`);
        
        // Combina resultados
        const allResults = [...movies, ...series];
        
        // Filtra por título
        const queryLower = query.toLowerCase();
        const filtered = allResults.filter(item => 
            item.name.toLowerCase().includes(queryLower)
        );
        
        console.log(`[StreamFlix] Encontrados ${filtered.length} resultados`);
        
        return filtered;
        
    } catch (e) {
        console.log(`[StreamFlix] Erro na busca: ${e.message}`);
        return [];
    }
}

// ==============================================
// OBTER URL DO VÍDEO
// ==============================================

async function getVideoUrl(item, mediaType, season, episode) {
    console.log(`[StreamFlix] Obtendo URL para: ${item.name} (ID: ${item.stream_id || item.series_id})`);
    
    try {
        let url = "";
        
        if (mediaType === "movie" || item.stream_id) {
            // É filme
            url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${item.stream_id}`;
        } else {
            // É série - precisa buscar episódio
            const infoUrl = `${BASE_URL}/api_proxy.php?action=get_series_info&series_id=${item.series_id}`;
            const infoRes = await fetch(infoUrl, { headers: HEADERS });
            
            if (!infoRes.ok) {
                console.log(`[StreamFlix] Erro ao buscar info da série`);
                return null;
            }
            
            const infoData = await infoRes.json();
            const episodes = infoData.episodes;
            
            if (episodes && episodes[season]) {
                const episodeData = episodes[season].find(ep => ep.episode_num == episode);
                if (episodeData) {
                    url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${episodeData.id}`;
                } else {
                    console.log(`[StreamFlix] Episódio ${episode} da temporada ${season} não encontrado`);
                    return null;
                }
            } else {
                console.log(`[StreamFlix] Temporada ${season} não encontrada`);
                return null;
            }
        }
        
        if (!url) return null;
        
        const streamRes = await fetch(url, { headers: HEADERS });
        
        if (!streamRes.ok) {
            console.log(`[StreamFlix] Erro ao obter stream: ${streamRes.status}`);
            return null;
        }
        
        const streamData = await streamRes.json();
        const videoUrl = streamData.stream_url;
        
        console.log(`[StreamFlix] URL obtida: ${videoUrl ? videoUrl.substring(0, 80) + "..." : "null"}`);
        
        return videoUrl;
        
    } catch (e) {
        console.log(`[StreamFlix] Erro ao obter URL: ${e.message}`);
        return null;
    }
}

// ==============================================
// FUNÇÃO PRINCIPAL (igual ao MovieBlast)
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
    console.log(`[StreamFlix] Iniciando para TMDB: ${tmdbId}, Tipo: ${mediaType}, S${season}E${episode}`);
    
    try {
        // 1. Buscar título no TMDB
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        if (!mediaInfo) {
            console.log(`[StreamFlix] TMDB não retornou dados para ID ${tmdbId}`);
            return [];
        }
        
        console.log(`[StreamFlix] Buscando por: "${mediaInfo.title}" (${mediaInfo.year})`);
        
        // 2. Buscar no StreamFlix
        const searchResults = await searchStreamFlix(mediaInfo.title);
        
        if (searchResults.length === 0) {
            console.log(`[StreamFlix] Nenhum resultado encontrado para "${mediaInfo.title}"`);
            return [];
        }
        
        // 3. Encontrar melhor correspondência (igual ao MovieBlast)
        let bestMatch = null;
        let bestScore = 0;
        
        for (const result of searchResults) {
            let score = calculateSimilarity(mediaInfo.title, result.name);
            
            // Bônus se o ano bater (se disponível)
            if (mediaInfo.year && result.year) {
                if (mediaInfo.year === result.year) score += 0.2;
            }
            
            console.log(`[StreamFlix] " ${result.name}" - Score: ${score.toFixed(2)}`);
            
            if (score > bestScore && score > 0.3) {
                bestScore = score;
                bestMatch = result;
            }
        }
        
        if (!bestMatch) {
            console.log(`[StreamFlix] Nenhuma correspondência confiável encontrada`);
            return [];
        }
        
        console.log(`[StreamFlix] Melhor match: "${bestMatch.name}" (Score: ${bestScore.toFixed(2)})`);
        
        // 4. Obter URL do vídeo
        const targetSeason = mediaType === "movie" ? 1 : (season || 1);
        const targetEpisode = mediaType === "movie" ? 1 : (episode || 1);
        
        const videoUrl = await getVideoUrl(bestMatch, mediaType, targetSeason, targetEpisode);
        
        if (!videoUrl) {
            console.log(`[StreamFlix] Não foi possível obter URL do vídeo`);
            return [];
        }
        
        // 5. Detectar qualidade
        let qualityStr = "720p";
        let qualityNum = 720;
        
        if (videoUrl.includes("2160") || videoUrl.includes("4k")) {
            qualityStr = "4K";
            qualityNum = 2160;
        } else if (videoUrl.includes("1080")) {
            qualityStr = "1080p";
            qualityNum = 1080;
        } else if (videoUrl.includes("720")) {
            qualityStr = "720p";
            qualityNum = 720;
        }
        
        // 6. Definir áudio
        const isLegendado = bestMatch.name.includes("[L]") || 
                           bestMatch.name.toLowerCase().includes("legendado");
        const audioType = isLegendado ? "Legendado" : "Dublado";
        
        // 7. Montar título do episódio
        let episodeTitle = "";
        if (mediaType === "movie") {
            episodeTitle = mediaInfo.title;
        } else {
            episodeTitle = `${mediaInfo.title} - S${String(targetSeason).padStart(2, '0')}E${String(targetEpisode).padStart(2, '0')}`;
        }
        
        // 8. Retornar stream (igual ao MovieBlast)
        const streams = [{
            name: `StreamFlix - ${mediaInfo.title} (${audioType})`,
            title: `${episodeTitle} - ${qualityStr}`,
            url: videoUrl,
            quality: qualityNum,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": BASE_URL,
                "x-request-x": "com.streamflix"
            }
        }];
        
        console.log(`[StreamFlix] ✅ Stream encontrado! Qualidade: ${qualityStr}`);
        return streams;
        
    } catch (error) {
        console.error(`[StreamFlix] Erro: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
