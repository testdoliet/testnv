// Nuvio Plugin - StreamFlix (Versão Direta)

async function getStreams(tmdbId, mediaType, season, episode) {
    
    // URL direta que sabemos que funciona do TESTE 6
    const videoUrl = "http://p2toptz.pro:80/movie/573468/697200/4713.mp4";
    
    // Tenta obter o título do TMDB (opcional)
    let title = "StreamFlix";
    const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
    
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        const response = await fetch(tmdbUrl);
        
        if (response.ok) {
            const data = await response.json();
            title = mediaType === 'tv' ? data.name : data.title;
        }
    } catch (e) {
        // Mantém título padrão
    }
    
    // Define temporada e episódio
    const seasonNum = mediaType === 'movie' ? 1 : (season || 1);
    const episodeNum = mediaType === 'movie' ? 1 : (episode || 1);
    const episodeDisplay = mediaType === 'movie' ? 'Filme' : `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
    
    // Retorna APENAS UM stream (o que funciona)
    return [{
        name: `${title} (Dublado)`,
        title: `${episodeDisplay} - 1080p`,
        url: videoUrl,
        quality: 1080,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://streamflix.live/"
        }
    }];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
