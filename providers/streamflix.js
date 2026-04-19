// Nuvio Plugin - StreamFlix (Teste de Cada Função)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

// ==============================================
// FUNÇÃO PRINCIPAL - TESTA CADA FUNÇÃO SEPARADAMENTE
// ==============================================

async function getStreams(tmdbId, mediaType, season, episode) {
    
    const results = [];
    
    // ==========================================
    // TESTE 1: Função foi chamada
    // ==========================================
    results.push({
        name: "✅ TESTE 1 - Função Chamada",
        title: `Parâmetros: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`,
        url: "",
        quality: 0,
        headers: {}
    });
    
    // ==========================================
    // TESTE 2: Testar fetch no BASE_URL
    // ==========================================
    try {
        const testResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`, { 
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        results.push({
            name: testResponse.ok ? "✅ TESTE 2 - StreamFlix OK" : "❌ TESTE 2 - StreamFlix Falhou",
            title: `Status: ${testResponse.status}`,
            url: "",
            quality: 0,
            headers: {}
        });
    } catch (e) {
        results.push({
            name: "❌ TESTE 2 - StreamFlix Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 3: Testar TMDB
    // ==========================================
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        const tmdbResponse = await fetch(tmdbUrl);
        
        if (tmdbResponse.ok) {
            const data = await tmdbResponse.json();
            const title = mediaType === 'tv' ? data.name : data.title;
            results.push({
                name: "✅ TESTE 3 - TMDB OK",
                title: `Título: "${title}"`,
                url: "",
                quality: 0,
                headers: {}
            });
        } else {
            results.push({
                name: "❌ TESTE 3 - TMDB Falhou",
                title: `Status: ${tmdbResponse.status}`,
                url: "",
                quality: 0,
                headers: {}
            });
        }
    } catch (e) {
        results.push({
            name: "❌ TESTE 3 - TMDB Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 4: Buscar filmes do StreamFlix
    // ==========================================
    try {
        const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
        const movies = await moviesResponse.json();
        
        if (movies && movies.length) {
            results.push({
                name: "✅ TESTE 4 - Filmes OK",
                title: `Total: ${movies.length} filmes. Ex: "${movies[0]?.name?.substring(0, 30)}"`,
                url: "",
                quality: 0,
                headers: {}
            });
        } else {
            results.push({
                name: "❌ TESTE 4 - Filmes Falhou",
                title: "Nenhum filme encontrado",
                url: "",
                quality: 0,
                headers: {}
            });
        }
    } catch (e) {
        results.push({
            name: "❌ TESTE 4 - Filmes Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 5: Buscar séries do StreamFlix
    // ==========================================
    try {
        const seriesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_series`);
        const series = await seriesResponse.json();
        
        if (series && series.length) {
            results.push({
                name: "✅ TESTE 5 - Séries OK",
                title: `Total: ${series.length} séries. Ex: "${series[0]?.name?.substring(0, 30)}"`,
                url: "",
                quality: 0,
                headers: {}
            });
        } else {
            results.push({
                name: "❌ TESTE 5 - Séries Falhou",
                title: "Nenhuma série encontrada",
                url: "",
                quality: 0,
                headers: {}
            });
        }
    } catch (e) {
        results.push({
            name: "❌ TESTE 5 - Séries Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 6: Testar URL direta que sabemos que funciona
    // ==========================================
    const testVideoUrl = "http://p2toptz.pro:80/movie/573468/697200/4713.mp4";
    
    try {
        const videoResponse = await fetch(testVideoUrl, { 
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (videoResponse.ok || videoResponse.status === 206) {
            results.push({
                name: "✅ TESTE 6 - Vídeo Direto OK",
                title: `URL: ${testVideoUrl.substring(0, 60)}...`,
                url: testVideoUrl,
                quality: 1080,
                headers: {}
            });
        } else {
            results.push({
                name: "❌ TESTE 6 - Vídeo Direto Falhou",
                title: `Status: ${videoResponse.status}`,
                url: "",
                quality: 0,
                headers: {}
            });
        }
    } catch (e) {
        results.push({
            name: "❌ TESTE 6 - Vídeo Direto Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 7: Tentar obter URL de um filme específico (ID 4713)
    // ==========================================
    try {
        const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=4713`;
        const streamResponse = await fetch(streamUrl);
        const streamData = await streamResponse.json();
        
        if (streamData.stream_url) {
            results.push({
                name: "✅ TESTE 7 - Movie ID 4713 OK",
                title: `URL: ${streamData.stream_url.substring(0, 60)}...`,
                url: streamData.stream_url,
                quality: 1080,
                headers: {}
            });
        } else {
            results.push({
                name: "❌ TESTE 7 - Movie ID 4713 Falhou",
                title: "stream_url não encontrado",
                url: "",
                quality: 0,
                headers: {}
            });
        }
    } catch (e) {
        results.push({
            name: "❌ TESTE 7 - Movie ID 4713 Erro",
            title: `Erro: ${e.message}`,
            url: "",
            quality: 0,
            headers: {}
        });
    }
    
    // ==========================================
    // TESTE 8: Tentar buscar pelo título do TMDB
    // ==========================================
    if (results.some(r => r.name.includes("TESTE 3") && r.name.includes("OK"))) {
        try {
            // Pega o título do TMDB do teste 3
            const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
            const tmdbResponse = await fetch(tmdbUrl);
            const tmdbData = await tmdbResponse.json();
            const tmdbTitle = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
            
            // Busca filmes
            const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
            const movies = await moviesResponse.json();
            
            // Procura por título similar
            let found = null;
            for (const movie of movies) {
                if (movie.name.toLowerCase().includes(tmdbTitle.toLowerCase().substring(0, 10))) {
                    found = movie;
                    break;
                }
            }
            
            if (found) {
                results.push({
                    name: "✅ TESTE 8 - Busca por Título OK",
                    title: `Encontrado: "${found.name}" (ID: ${found.stream_id})`,
                    url: "",
                    quality: 0,
                    headers: {}
                });
                
                // Tenta obter a URL do filme encontrado
                const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${found.stream_id}`;
                const streamResponse = await fetch(streamUrl);
                const streamData = await streamResponse.json();
                
                if (streamData.stream_url) {
                    results.push({
                        name: "🎯 STREAM ENCONTRADO!",
                        title: `${tmdbTitle} - 1080p`,
                        url: streamData.stream_url,
                        quality: 1080,
                        headers: {}
                    });
                }
            } else {
                results.push({
                    name: "❌ TESTE 8 - Busca por Título Falhou",
                    title: `Nenhum filme encontrado para "${tmdbTitle}"`,
                    url: "",
                    quality: 0,
                    headers: {}
                });
            }
        } catch (e) {
            results.push({
                name: "❌ TESTE 8 - Busca por Título Erro",
                title: `Erro: ${e.message}`,
                url: "",
                quality: 0,
                headers: {}
            });
        }
    }
    
    // ==========================================
    // RETORNA TODOS OS TESTES
    // ==========================================
    return results;
}

// Exporta a função
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
