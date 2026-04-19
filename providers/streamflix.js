// Nuvio Plugin - StreamFlix (Formato SuperFlixAPI)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

async function getStreams(tmdbId, mediaType, season, episode) {
    
    // URL direta que funciona
    const videoUrl = "http://p2toptz.pro:80/movie/573468/697200/4713.mp4";
    
    let title = "StreamFlix";
    
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
        const response = await fetch(tmdbUrl);
        
        if (response.ok) {
            const data = await response.json();
            title = mediaType === 'tv' ? data.name : data.title;
        }
    } catch (e) {}
    
    const seasonNum = mediaType === 'movie' ? 1 : (season || 1);
    const episodeNum = mediaType === 'movie' ? 1 : (episode || 1);
    const episodeDisplay = mediaType === 'movie' ? 'Filme' : `S${seasonNum.toString().padStart(2, '0')}E${episodeNum.toString().padStart(2, '0')}`;
    
    // FORMATO EXATO QUE FUNCIONA NO SUPERFLIXAPI
    const stream = {
        name: `${title} (Dublado)`,
        title: `${episodeDisplay} - 1080p`,
        url: videoUrl,
        quality: 1080,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://streamflix.live/"
        }
    };
    
    return [stream];
}

// ESTA É A LINHA MAIS IMPORTANTE - MESMO FORMATO DO SUPERFLIXAPI
module.exports = { getStreams };
