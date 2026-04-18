// Nuvio Plugin - StreamFlix (Versão Ultra-Simplificada com Debug)
// Sempre retorna algo para diagnóstico

const BASE_URL = "https://streamflix.live";
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';

// ==============================================
// FUNÇÃO PRINCIPAL COM DEBUG FORÇADO
// ==============================================

async function getStreams(tmdbId, mediaType, season, episode) {
    // DEBUG INICIAL - Sempre retorna algo
    const debugSteps = [];
    debugSteps.push(`INICIO: tmdbId=${tmdbId}, type=${mediaType}, S${season}E${episode}`);
    
    try {
        // PASSO 1: Testar fetch básico
        debugSteps.push("PASSO1: Testando fetch no BASE_URL");
        
        const testFetch = await fetch(BASE_URL, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }).catch(e => ({ ok: false, error: e.message }));
        
        debugSteps.push(`BASE_URL status: ${testFetch.ok ? 'OK' : 'FALHA - ' + (testFetch.error || '')}`);
        
        // PASSO 2: Buscar título TMDB
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
        
        // PASSO 3: Tentar buscar filmes do cache do StreamFlix
        debugSteps.push("PASSO3: Buscando filmes no StreamFlix");
        
        let movies = [];
        try {
            const moviesResponse = await fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`);
            if (moviesResponse.ok) {
                movies = await moviesResponse.json();
                debugSteps.push(`Filmes encontrados: ${movies.length}`);
            } else {
                debugSteps.push(`Filmes FALHA: status ${moviesResponse.status}`);
            }
        } catch (e) {
            debugSteps.push(`Filmes ERRO: ${e.message}`);
        }
        
        // PASSO 4: Tentar buscar um stream específico (hardcoded para teste)
        debugSteps.push("PASSO4: Tentando stream hardcoded");
        
        // Testa com um ID conhecido (Central do Brasil)
        const testMovieId = 4713; // ID que vimos funcionar
        
        try {
            const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${testMovieId}`;
            debugSteps.push(`Request URL: ${streamUrl}`);
            
            const streamResponse = await fetch(streamUrl);
            debugSteps.push(`Stream response status: ${streamResponse.status}`);
            
            if (streamResponse.ok) {
                const streamData = await streamResponse.json();
                debugSteps.push(`Stream data recebido: ${Object.keys(streamData).join(', ')}`);
                
                if (streamData.stream_url) {
                    debugSteps.push(`URL obtida: ${streamData.stream_url.substring(0, 80)}...`);
                    
                    // Testa qualidade
                    const qualityTest = await testQuality(streamData.stream_url, debugSteps);
                    
                    // Retorna o stream funcionando
                    return [{
                        name: `[DEBUG] ${debugSteps.join(" | ")}`,
                        title: `Stream Teste - ${qualityTest.quality}p`,
                        url: streamData.stream_url,
                        quality: qualityTest.quality,
                        headers: {
                            "Referer": BASE_URL,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    }];
                } else {
                    debugSteps.push("❌ stream_url não encontrado no response");
                }
            }
        } catch (e) {
            debugSteps.push(`Stream ERRO: ${e.message}`);
        }
        
        // PASSO 5: Se tudo falhou, retorna o debug
        return [{
            name: `🐛 DEBUG COMPLETO`,
            title: debugSteps.join(" → "),
            url: "",
            quality: 0,
            headers: {}
        }];
        
    } catch (error) {
        debugSteps.push(`❌ ERRO FATAL: ${error.message}`);
        return [{
            name: `🐛 DEBUG ERRO`,
            title: debugSteps.join(" → "),
            url: "",
            quality: 0,
            headers: {}
        }];
    }
}

// Função auxiliar para testar qualidade
async function testQuality(url, debugSteps) {
    try {
        debugSteps.push(`Testando qualidade: baixando 5MB...`);
        
        const response = await fetch(url, {
            headers: {
                "Range": "bytes=0-5242880",
                "User-Agent": "Mozilla/5.0"
            }
        });
        
        if (!response.ok && response.status !== 206) {
            debugSteps.push(`Qualidade: HTTP ${response.status}`);
            return { quality: 720 };
        }
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Procura por tkhd box
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
                            let quality = 720;
                            if (pixels >= 1400000) quality = 1080;
                            if (pixels >= 6000000) quality = 2160;
                            
                            debugSteps.push(`✅ Qualidade: ${width}x${height} → ${quality}p`);
                            return { quality };
                        }
                    }
                }
            }
        }
        
        debugSteps.push(`⚠️ Nenhum tkhd encontrado, usando 720p padrão`);
        return { quality: 720 };
        
    } catch (e) {
        debugSteps.push(`❌ Erro qualidade: ${e.message}`);
        return { quality: 720 };
    }
}

module.exports = { getStreams };
