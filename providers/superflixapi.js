// SuperFlixAPI - Versão com headers COMPLETOS

async function getStreams(tmdbId, mediaType = 'tv', season = 1, episode = 1) {
    console.log(`[SuperFlix] Iniciando: ${tmdbId} S${season}E${episode}`);
    
    // Headers COMPLETOS iguais ao Python
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR',
        'Referer': 'https://lospobreflix.site/',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
    };
    
    const apiHeaders = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://warezcdn.site',
        'Referer': 'https://warezcdn.site/',
        'Connection': 'keep-alive'
    };
    
    try {
        // 1. Buscar página inicial
        const pageUrl = `https://warezcdn.site/serie/${tmdbId}/${season}/${episode}`;
        console.log(`[SuperFlix] Acessando: ${pageUrl}`);
        
        const pageRes = await fetch(pageUrl, { headers });
        
        if (!pageRes.ok) {
            console.log(`[SuperFlix] Erro HTTP: ${pageRes.status}`);
            return [];
        }
        
        const html = await pageRes.text();
        console.log(`[SuperFlix] HTML recebido: ${html.length} chars`);
        
        // Mostrar primeiros 500 chars para debug
        console.log(`[SuperFlix] HTML preview: ${html.substring(0, 500)}`);
        
        // 2. Extrair tokens
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        const episodesMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        
        console.log(`[SuperFlix] CSRF encontrado: ${!!csrfMatch}`);
        console.log(`[SuperFlix] PAGE_TOKEN encontrado: ${!!pageMatch}`);
        console.log(`[SuperFlix] ALL_EPISODES encontrado: ${!!episodesMatch}`);
        
        if (!csrfMatch || !pageMatch) {
            console.log('[SuperFlix] Tokens não encontrados');
            return [];
        }
        
        const csrfToken = csrfMatch[1];
        const pageToken = pageMatch[1];
        console.log(`[SuperFlix] CSRF: ${csrfToken.substring(0, 20)}...`);
        console.log(`[SuperFlix] PageToken: ${pageToken.substring(0, 20)}...`);
        
        // 3. Extrair content_id
        if (!episodesMatch) {
            console.log('[SuperFlix] ALL_EPISODES não encontrado');
            return [];
        }
        
        let contentId = null;
        try {
            const episodes = JSON.parse(episodesMatch[1]);
            const seasonData = episodes[season.toString()];
            if (seasonData) {
                for (const ep of seasonData) {
                    if (ep.epi_num === episode) {
                        contentId = ep.ID?.toString();
                        break;
                    }
                }
            }
        } catch (e) {
            console.log('[SuperFlix] Erro ao parsear episódios:', e.message);
            return [];
        }
        
        if (!contentId) {
            console.log('[SuperFlix] Content ID não encontrado');
            return [];
        }
        
        console.log(`[SuperFlix] Content ID: ${contentId}`);
        
        // 4. Obter options
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', csrfToken);
        optionsParams.append('page_token', pageToken);
        optionsParams.append('pageToken', pageToken);
        
        const optionsHeaders = {
            ...apiHeaders,
            'X-Page-Token': pageToken,
            'Referer': `https://warezcdn.site/serie/${tmdbId}/${season}/${episode}`
        };
        
        console.log(`[SuperFlix] Enviando options para content_id: ${contentId}`);
        
        const optionsRes = await fetch('https://warezcdn.site/player/options', {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams
        });
        
        if (!optionsRes.ok) {
            console.log(`[SuperFlix] Options falhou: ${optionsRes.status}`);
            const text = await optionsRes.text();
            console.log(`[SuperFlix] Resposta: ${text.substring(0, 200)}`);
            return [];
        }
        
        const optionsData = await optionsRes.json();
        console.log(`[SuperFlix] Options resposta:`, JSON.stringify(optionsData).substring(0, 200));
        
        const videoId = optionsData?.data?.options?.[0]?.ID;
        
        if (!videoId) {
            console.log('[SuperFlix] Nenhum video_id encontrado');
            return [];
        }
        
        console.log(`[SuperFlix] Video ID: ${videoId}`);
        
        // 5. Obter source
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', pageToken);
        sourceParams.append('_token', csrfToken);
        
        const sourceHeaders = {
            ...apiHeaders,
            'Referer': `https://warezcdn.site/serie/${tmdbId}/${season}/${episode}`
        };
        
        console.log(`[SuperFlix] Buscando source para video_id: ${videoId}`);
        
        const sourceRes = await fetch('https://warezcdn.site/player/source', {
            method: 'POST',
            headers: sourceHeaders,
            body: sourceParams
        });
        
        if (!sourceRes.ok) {
            console.log(`[SuperFlix] Source falhou: ${sourceRes.status}`);
            const text = await sourceRes.text();
            console.log(`[SuperFlix] Resposta: ${text.substring(0, 200)}`);
            return [];
        }
        
        const sourceData = await sourceRes.json();
        console.log(`[SuperFlix] Source resposta:`, JSON.stringify(sourceData).substring(0, 200));
        
        const redirectUrl = sourceData?.data?.video_url;
        
        if (!redirectUrl) {
            console.log('[SuperFlix] Nenhuma URL de redirect');
            return [];
        }
        
        console.log(`[SuperFlix] Redirect: ${redirectUrl.substring(0, 100)}...`);
        
        // 6. Seguir redirect
        const redirectRes = await fetch(redirectUrl, {
            method: 'GET',
            headers: headers,
            redirect: 'follow'
        });
        
        const playerUrl = redirectRes.url;
        const playerHash = playerUrl.split('/').pop();
        console.log(`[SuperFlix] Player URL: ${playerUrl}`);
        console.log(`[SuperFlix] Player Hash: ${playerHash}`);
        
        // 7. Obter dados do vídeo
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');
        
        const videoHeaders = {
            'Accept': '*/*',
            'Accept-Language': 'pt-BR',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://llanfairpwllgwyngy.com',
            'Referer': 'https://llanfairpwllgwyngy.com/',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
        };
        
        console.log(`[SuperFlix] Obtendo dados do vídeo para hash: ${playerHash}`);
        
        const videoRes = await fetch(`https://llanfairpwllgwyngy.com/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: videoHeaders,
            body: videoParams
        });
        
        if (!videoRes.ok) {
            console.log(`[SuperFlix] Video data falhou: ${videoRes.status}`);
            return [];
        }
        
        const videoData = await videoRes.json();
        console.log(`[SuperFlix] Video data recebida`);
        
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            console.log('[SuperFlix] Nenhuma URL final encontrada');
            return [];
        }
        
        console.log(`[SuperFlix] FINAL URL: ${finalUrl}`);
        
        // 8. Retornar stream
        return [{
            url: finalUrl,
            headers: {
                'Referer': 'https://llanfairpwllgwyngy.com/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            },
            name: 'SuperFlix 1080p',
            title: `S${season}E${episode}`
        }];
        
    } catch (error) {
        console.log(`[SuperFlix] ERRO: ${error.message}`);
        return [];
    }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
