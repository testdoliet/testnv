// Nuvio Plugin - StreamFlix (Debug com Qualidade 1080)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

async function getStreams(tmdbId, mediaType, season, episode) {
    
    const debugStreams = [];
    
    // ==========================================
    // DEBUG 1: Verificar parâmetros recebidos
    // ==========================================
    debugStreams.push({
        name: "🔍 DEBUG 1 - Parâmetros",
        title: `ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`,
        url: "",
        quality: 1080,
        headers: {}
    });
    
    // ==========================================
    // DEBUG 2: Buscar TMDB
    // ==========================================
    let tmdbTitle = null;
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        const response = await fetch(tmdbUrl);
        
        if (response.ok) {
            const data = await response.json();
            tmdbTitle = mediaType === 'tv' ? data.name : data.title;
            debugStreams.push({
                name: "✅ DEBUG 2 - TMDB OK",
                title: `Título: "${tmdbTitle}"`,
                url: "",
                quality: 1080,
                headers: {}
            });
        } else {
            debugStreams.push({
                name: "❌ DEBUG 2 - TMDB Falhou",
                title: `Status: ${response.status}`,
                url: "",
                quality: 1080,
                headers: {}
            });
        }
    } catch (e) {
        debugStreams.push({
            name: "❌ DEBUG 2 - TMDB Erro",
            title: e.message,
            url: "",
            quality: 1080,
            headers: {}
        });
    }
    
    // ==========================================
    // DEBUG 3: Buscar filmes do StreamFlix
    // ==========================================
    let movies = [];
    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        movies = await response.json();
        
        debugStreams.push({
            name: "✅ DEBUG 3 - Filmes Carregados",
            title: `Total: ${movies.length} filmes`,
            url: "",
            quality: 1080,
            headers: {}
        });
        
        // Mostrar primeiros 5 filmes
        for (let i = 0; i < Math.min(5, movies.length); i++) {
            debugStreams.push({
                name: `📽️ Filme ${i+1}`,
                title: movies[i].name.substring(0, 60),
                url: "",
                quality: 1080,
                headers: {}
            });
        }
    } catch (e) {
        debugStreams.push({
            name: "❌ DEBUG 3 - Erro Filmes",
            title: e.message,
            url: "",
            quality: 1080,
            headers: {}
        });
    }
    
    // ==========================================
    // DEBUG 4: Buscar séries do StreamFlix
    // ==========================================
    let series = [];
    try {
        const response = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        series = await response.json();
        
        debugStreams.push({
            name: "✅ DEBUG 4 - Séries Carregadas",
            title: `Total: ${series.length} séries`,
            url: "",
            quality: 1080,
            headers: {}
        });
        
        // Mostrar primeiras 5 séries
        for (let i = 0; i < Math.min(5, series.length); i++) {
            debugStreams.push({
                name: `📺 Série ${i+1}`,
                title: series[i].name.substring(0, 60),
                url: "",
                quality: 1080,
                headers: {}
            });
        }
    } catch (e) {
        debugStreams.push({
            name: "❌ DEBUG 4 - Erro Séries",
            title: e.message,
            url: "",
            quality: 1080,
            headers: {}
        });
    }
    
    // ==========================================
    // DEBUG 5: Tentar encontrar correspondência
    // ==========================================
    if (tmdbTitle) {
        const searchTerm = tmdbTitle.toLowerCase().substring(0, 20);
        debugStreams.push({
            name: "🔍 DEBUG 5 - Buscando",
            title: `Procurando por: "${searchTerm}"`,
            url: "",
            quality: 1080,
            headers: {}
        });
        
        let found = null;
        let foundId = null;
        let foundType = null;
        
        // Buscar em filmes
        for (const movie of movies) {
            if (movie.name.toLowerCase().includes(searchTerm)) {
                found = movie.name;
                foundId = movie.stream_id;
                foundType = "movie";
                debugStreams.push({
                    name: "✅ Encontrado nos Filmes!",
                    title: `"${movie.name}" (ID: ${movie.stream_id})`,
                    url: "",
                    quality: 1080,
                    headers: {}
                });
                break;
            }
        }
        
        // Se não encontrou, buscar em séries
        if (!found) {
            for (const serie of series) {
                if (serie.name.toLowerCase().includes(searchTerm)) {
                    found = serie.name;
                    foundId = serie.series_id;
                    foundType = "series";
                    debugStreams.push({
                        name: "✅ Encontrado nas Séries!",
                        title: `"${serie.name}" (ID: ${serie.series_id})`,
                        url: "",
                        quality: 1080,
                        headers: {}
                    });
                    break;
                }
            }
        }
        
        if (!found) {
            debugStreams.push({
                name: "❌ Nenhum Match Encontrado",
                title: `Tente buscar manualmente por: "${tmdbTitle}"`,
                url: "",
                quality: 1080,
                headers: {}
            });
        }
        
        // ==========================================
        // DEBUG 6: Tentar obter URL do vídeo
        // ==========================================
        if (foundId) {
            try {
                let videoUrl = null;
                
                if (foundType === "movie") {
                    const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${foundId}`;
                    const streamRes = await fetch(streamUrl);
                    const streamData = await streamRes.json();
                    videoUrl = streamData.stream_url;
                    
                    if (videoUrl) {
                        debugStreams.push({
                            name: "🎯 STREAM ENCONTRADO!",
                            title: `${tmdbTitle} - 1080p`,
                            url: videoUrl,
                            quality: 1080,
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                                "Referer": BASE_URL
                            }
                        });
                    } else {
                        debugStreams.push({
                            name: "❌ DEBUG 6 - URL não obtida",
                            title: `Falha ao obter URL para ID ${foundId}`,
                            url: "",
                            quality: 1080,
                            headers: {}
                        });
                    }
                }
            } catch (e) {
                debugStreams.push({
                    name: "❌ DEBUG 6 - Erro URL",
                    title: e.message,
                    url: "",
                    quality: 1080,
                    headers: {}
                });
            }
        }
    }
    
    // ==========================================
    // STREAM FUNCIONAL (FALLBACK) - SEMPRE NO FINAL
    // ==========================================
    debugStreams.push({
        name: "🎯 STREAM FALLBACK (Sempre funciona)",
        title: "Usando URL direta - 1080p",
        url: "http://p2toptz.pro:80/movie/573468/697200/4713.mp4",
        quality: 1080,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": BASE_URL
        }
    });
    
    return debugStreams;
}

module.exports = { getStreams };
