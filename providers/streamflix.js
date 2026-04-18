// Nuvio Plugin - StreamFlix (Versão Corrigida - Tudo em uma função)

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

async function getStreams(tmdbId, mediaType, season, episode) {
    const debugSteps = [];
    debugSteps.push(`INICIO: ${tmdbId}, ${mediaType}, S${season}E${episode}`);
    
    try {
        // PASSO 1: Testar BASE_URL
        debugSteps.push("PASSO1: Testando BASE_URL");
        const testFetch = await fetch(BASE_URL, { method: 'HEAD' }).catch(e => ({ ok: false, error: e.message }));
        debugSteps.push(`BASE_URL: ${testFetch.ok ? 'OK' : 'FALHA'}`);
        
        // PASSO 2: Buscar TMDB
        debugSteps.push("PASSO2: Buscando TMDB");
        let tmdbTitle = null;
        try {
            const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
            const tmdbResponse = await fetch(tmdbUrl);
            if (tmdbResponse.ok) {
                const tmdbData = await tmdbResponse.json();
                tmdbTitle = mediaType === "movie" ? tmdbData.title : tmdbData.name;
                debugSteps.push(`TMDB OK: "${tmdbTitle}"`);
            } else {
                debugSteps.push(`TMDB FALHA: status ${tmdbResponse.status}`);
            }
        } catch (e) {
            debugSteps.push(`TMDB ERRO: ${e.message}`);
        }
        
        // PASSO 3: Buscar filmes
        debugSteps.push("PASSO3: Buscando filmes");
        let movies = [];
        try {
            const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
            if (moviesResponse.ok) {
                movies = await moviesResponse.json();
                debugSteps.push(`Filmes: ${movies ? movies.length : 0}`);
            } else {
                debugSteps.push(`Filmes FALHA: ${moviesResponse.status}`);
            }
        } catch (e) {
            debugSteps.push(`Filmes ERRO: ${e.message}`);
        }
        
        // PASSO 4: Stream hardcoded com ID 4713
        debugSteps.push("PASSO4: Stream hardcoded ID 4713");
        
        const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=4713`;
        debugSteps.push(`Request: ${streamUrl}`);
        
        const streamResponse = await fetch(streamUrl);
        debugSteps.push(`Status: ${streamResponse.status}`);
        
        if (streamResponse.ok) {
            const streamData = await streamResponse.json();
            debugSteps.push(`Data keys: ${Object.keys(streamData).join(', ')}`);
            
            if (streamData.stream_url) {
                const videoUrl = streamData.stream_url;
                debugSteps.push(`URL: ${videoUrl.substring(0, 80)}...`);
                
                // ==========================================
                // TESTE DE QUALIDADE DIRETO (sem função externa)
                // ==========================================
                debugSteps.push("Testando qualidade...");
                
                let quality = 720;
                let resolution = "";
                
                try {
                    const qualityResponse = await fetch(videoUrl, {
                        headers: {
                            "Range": "bytes=0-5242880",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    });
                    
                    debugSteps.push(`Qualidade HTTP: ${qualityResponse.status}`);
                    
                    if (qualityResponse.ok || qualityResponse.status === 206) {
                        const buffer = await qualityResponse.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        debugSteps.push(`Bytes: ${bytes.length}`);
                        
                        // Procura por tkhd box
                        let found = false;
                        for (let i = 0; i < bytes.length - 20 && !found; i++) {
                            if (bytes[i] === 0x74 && bytes[i+1] === 0x6B && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
                                debugSteps.push(`tkhd encontrado na posição ${i}`);
                                
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
                                            if (pixels >= 1400000) quality = 1080;
                                            if (pixels >= 6000000) quality = 2160;
                                            resolution = `${width}x${height}`;
                                            debugSteps.push(`✅ Resolução: ${resolution} → ${quality}p`);
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!found) {
                            debugSteps.push("⚠️ Nenhum tkhd válido encontrado, usando 720p");
                        }
                    } else {
                        debugSteps.push(`❌ Falha no download: ${qualityResponse.status}`);
                    }
                } catch (e) {
                    debugSteps.push(`❌ Erro qualidade: ${e.message}`);
                }
                
                // ==========================================
                // RETORNO DO STREAM
                // ==========================================
                const audioType = "Dublado"; // Forçando dublado para teste
                const episodeTitle = mediaType === "movie" ? "Filme" : `S${season}E${episode}`;
                
                let streamTitle = `${episodeTitle} - ${quality}p`;
                if (resolution) {
                    streamTitle += ` [${resolution}]`;
                }
                
                // Retorna APENAS o stream funcional (sem debug no nome)
                return [{
                    name: tmdbTitle ? `${tmdbTitle} (${audioType})` : `StreamFlix (${audioType})`,
                    title: streamTitle,
                    url: videoUrl,
                    quality: quality,
                    headers: {
                        "Referer": BASE_URL,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }
                }];
            }
        }
        
        // Se falhou, retorna debug
        return [{
            name: "🐛 DEBUG",
            title: debugSteps.join(" → "),
            url: "",
            quality: 0,
            headers: {}
        }];
        
    } catch (error) {
        debugSteps.push(`ERRO FATAL: ${error.message}`);
        return [{
            name: "🐛 DEBUG ERRO",
            title: debugSteps.join(" → "),
            url: "",
            quality: 0,
            headers: {}
        }];
    }
}

module.exports = { getStreams };
