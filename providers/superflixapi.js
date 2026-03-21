// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão com debug detalhado na URL

const BASE_URL = "https://superflixapi.rest";
const CDN_BASE = "https://llanfairpwllgwyngy.com";

// Store para cookies e tokens da sessão
let SESSION_DATA = {
    cookies: '',
    csrfToken: '',
    pageToken: ''
};

// Headers para a página inicial
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR',
    'Referer': 'https://lospobreflix.site/',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive'
};

// Headers para as requisições API
const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Connection': 'keep-alive'
};

// Headers para o player final
const VIDEO_HEADERS = {
    'Accept': '*/*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': CDN_BASE,
    'Referer': `${CDN_BASE}/`,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
};

// Função para extrair e armazenar cookies da resposta
function updateCookies(response) {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        SESSION_DATA.cookies = setCookie;
    }
}

// Função para obter header de cookies para requisições
function getCookieHeader() {
    return SESSION_DATA.cookies ? { 'Cookie': SESSION_DATA.cookies } : {};
}

// Função para formatar logs como string
function formatLog(step, data) {
    let logStr = `[${step}] `;
    if (typeof data === 'object') {
        try {
            logStr += JSON.stringify(data);
        } catch(e) {
            logStr += String(data);
        }
    } else {
        logStr += String(data);
    }
    return logStr;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
    // Array para armazenar logs detalhados
    const logs = [];
    const startTime = Date.now();
    
    function addLog(step, data) {
        const timestamp = Date.now() - startTime;
        let logStr = `[${timestamp}ms]${formatLog(step, data)}`;
        logs.push(logStr);
        // Também imprime no console para debug local
        console.log(logStr);
    }
    
    try {
        addLog('INICIO', { tmdbId, mediaType, season: targetSeason, episode: targetEpisode });
        
        // ==================== PASSO 1: CARREGAR PÁGINA ====================
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addLog('PAGE_URL', pageUrl);
        
        const pageHeaders = { ...HEADERS, ...getCookieHeader() };
        addLog('PAGE_HEADERS', { 
            UserAgent: pageHeaders['User-Agent'].substring(0, 50),
            Referer: pageHeaders['Referer'],
            HasCookie: !!pageHeaders['Cookie']
        });
        
        const pageStart = Date.now();
        const pageResponse = await fetch(pageUrl, { headers: pageHeaders });
        const pageTime = Date.now() - pageStart;
        
        addLog('PAGE_RESPONSE', { 
            status: pageResponse.status, 
            ok: pageResponse.ok,
            timeMs: pageTime,
            url: pageResponse.url
        });
        
        if (!pageResponse.ok) {
            addLog('PAGE_FAILED', pageResponse.status);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Page Failed', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        updateCookies(pageResponse);
        addLog('COOKIES_SET', { hasCookies: !!SESSION_DATA.cookies });
        
        const html = await pageResponse.text();
        addLog('HTML_LEN', html.length);
        
        // ==================== PASSO 2: EXTRAIR TOKENS ====================
        addLog('EXTRAINDO_TOKENS', '');
        
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            addLog('CSRF_NOT_FOUND', html.substring(0, 200));
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - CSRF Not Found', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addLog('CSRF_TOKEN', SESSION_DATA.csrfToken.substring(0, 30) + '...');
        
        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            addLog('PAGE_TOKEN_NOT_FOUND', true);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Page Token Not Found', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addLog('PAGE_TOKEN', SESSION_DATA.pageToken.substring(0, 30) + '...');
        
        // ==================== PASSO 3: EXTRAIR EPISÓDIOS ====================
        addLog('EXTRAINDO_EPISODIOS', '');
        
        const epMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            addLog('ALL_EPISODES_NOT_FOUND', true);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - No Episodes', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        let contentId = null;
        try {
            const episodes = JSON.parse(epMatch[1]);
            addLog('EPISODES_KEYS', Object.keys(episodes));
            
            const seasonData = episodes[targetSeason.toString()];
            if (seasonData) {
                addLog('SEASON_DATA', { season: targetSeason, count: seasonData.length });
                for (let i = 0; i < seasonData.length; i++) {
                    if (seasonData[i].epi_num === targetEpisode) {
                        contentId = seasonData[i].ID?.toString();
                        addLog('EPISODE_FOUND', { episode: targetEpisode, contentId });
                        break;
                    }
                }
            } else {
                addLog('SEASON_NOT_FOUND', { season: targetSeason, available: Object.keys(episodes) });
            }
        } catch (e) {
            addLog('PARSE_ERROR', e.message);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Parse Error', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        if (!contentId) {
            addLog('CONTENT_ID_NOT_FOUND', targetEpisode);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - No Content ID', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        addLog('CONTENT_ID', contentId);
        
        // ==================== PASSO 4: POST /player/options ====================
        addLog('OPTIONS_REQUEST', { contentId });
        
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        addLog('OPTIONS_PARAMS', { 
            contentid: contentId, 
            token_len: SESSION_DATA.csrfToken.length,
            page_token_len: SESSION_DATA.pageToken.length
        });
        
        const optionsHeaders = {
            ...API_HEADERS,
            'X-Page-Token': SESSION_DATA.pageToken,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        const optionsStart = Date.now();
        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams.toString()
        });
        const optionsTime = Date.now() - optionsStart;
        
        addLog('OPTIONS_RESPONSE', { status: optionsResponse.status, timeMs: optionsTime });
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addLog('OPTIONS_ERROR', { status: optionsResponse.status, error: errorText.substring(0, 100) });
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Options Failed', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        const optionsData = await optionsResponse.json();
        addLog('OPTIONS_DATA', { options: optionsData?.data?.options?.length || 0 });
        
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) {
            addLog('VIDEO_ID_NOT_FOUND', true);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - No Video ID', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        addLog('VIDEO_ID', videoId);
        
        // ==================== PASSO 5: POST /player/source ====================
        addLog('SOURCE_REQUEST', { videoId });
        
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        const sourceHeaders = {
            ...API_HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        const sourceStart = Date.now();
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: sourceHeaders,
            body: sourceParams.toString()
        });
        const sourceTime = Date.now() - sourceStart;
        
        addLog('SOURCE_RESPONSE', { status: sourceResponse.status, timeMs: sourceTime });
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addLog('SOURCE_ERROR', { status: sourceResponse.status, error: errorText.substring(0, 100) });
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Source Failed', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        
        if (!redirectUrl) {
            addLog('REDIRECT_URL_NOT_FOUND', true);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - No Redirect URL', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        addLog('REDIRECT_URL', redirectUrl.substring(0, 100) + '...');
        
        // ==================== PASSO 6: SEGUIR REDIRECT MANUALMENTE ====================
        addLog('FOLLOW_REDIRECT', redirectUrl.substring(0, 80));
        
        const redirectStart = Date.now();
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            },
            redirect: 'manual'
        });
        const redirectTime = Date.now() - redirectStart;
        
        addLog('REDIRECT_STATUS', { status: redirectResponse.status, timeMs: redirectTime });
        
        let playerUrl = redirectResponse.headers.get('location');
        addLog('REDIRECT_LOCATION', playerUrl ? playerUrl.substring(0, 100) : 'null');
        
        if (!playerUrl) {
            const htmlRedirect = await redirectResponse.text();
            addLog('REDIRECT_HTML_PREVIEW', htmlRedirect.substring(0, 300));
            
            let metaMatch = htmlRedirect.match(/url=["']?([^"'>]+)["']?/i);
            if (!metaMatch) metaMatch = htmlRedirect.match(/URL=([^\s"']+)/i);
            if (!metaMatch) metaMatch = htmlRedirect.match(/content="0;url='([^']+)'/i);
            if (!metaMatch) metaMatch = htmlRedirect.match(/content="0;URL=([^"\s]+)/i);
            
            if (metaMatch) {
                playerUrl = metaMatch[1];
                addLog('META_REFRESH_FOUND', playerUrl.substring(0, 100));
            } else {
                addLog('NO_REDIRECT_FOUND', true);
                return [{ 
                    name: 'SuperFlix_Debug', 
                    title: 'Debug - No Redirect Found', 
                    url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                    quality: 0, 
                    type: 'debug' 
                }];
            }
        }
        
        addLog('PLAYER_URL', playerUrl);
        
        // ==================== PASSO 7: ACESSAR PLAYER ====================
        addLog('ACCESS_PLAYER', playerUrl.substring(0, 80));
        
        const playerStart = Date.now();
        const playerResponse = await fetch(playerUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            }
        });
        const playerTime = Date.now() - playerStart;
        
        addLog('PLAYER_RESPONSE', { status: playerResponse.status, timeMs: playerTime, url: playerResponse.url });
        
        if (!playerResponse.ok) {
            const errorText = await playerResponse.text();
            addLog('PLAYER_ERROR', { status: playerResponse.status, error: errorText.substring(0, 100) });
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Player Failed', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        const playerHash = playerUrl.split('/').pop();
        addLog('PLAYER_HASH', playerHash);
        
        // ==================== PASSO 8: OBTER URL FINAL DO VÍDEO ====================
        addLog('GET_FINAL_VIDEO', { hash: playerHash });
        
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');
        
        const videoStart = Date.now();
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        const videoTime = Date.now() - videoStart;
        
        addLog('VIDEO_RESPONSE', { status: videoResponse.status, timeMs: videoTime });
        
        if (!videoResponse.ok) {
            const errorText = await videoResponse.text();
            addLog('VIDEO_ERROR', { status: videoResponse.status, error: errorText.substring(0, 100) });
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - Video Failed', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            addLog('FINAL_URL_NOT_FOUND', true);
            return [{ 
                name: 'SuperFlix_Debug', 
                title: 'Debug - No Final URL', 
                url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
                quality: 0, 
                type: 'debug' 
            }];
        }
        
        const totalTime = Date.now() - startTime;
        addLog('SUCCESS', { totalTimeMs: totalTime, url: finalUrl.substring(0, 80) });
        
        // Determinar qualidade
        let quality = '1080p';
        if (finalUrl.includes('2160') || finalUrl.includes('4k')) quality = '2160p';
        else if (finalUrl.includes('1440')) quality = '1440p';
        else if (finalUrl.includes('1080')) quality = '1080p';
        else if (finalUrl.includes('720')) quality = '720p';
        else if (finalUrl.includes('480')) quality = '480p';
        
        let title = `TMDB ${tmdbId}`;
        if (mediaType === 'tv') {
            title = `S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
        }
        
        // Retorna o stream com TODOS os logs na URL (codificados)
        // A URL real vem depois, separada por uma quebra de linha visível
        const debugInfo = logs.join(' | ');
        const finalUrlWithDebug = `DEBUG_INFO: ${encodeURIComponent(debugInfo)}\nREAL_URL: ${finalUrl}`;
        
        console.log('\n' + '='.repeat(60));
        console.log('DEBUG INFO (copie para análise):');
        console.log(debugInfo);
        console.log('='.repeat(60));
        console.log('FINAL URL:');
        console.log(finalUrl);
        console.log('='.repeat(60) + '\n');
        
        return [{
            name: 'SuperFlix',
            title: title,
            url: finalUrlWithDebug,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        }];
        
    } catch (error) {
        addLog('CATCH_ERROR', { message: error.message, stack: error.stack?.substring(0, 200) });
        return [{ 
            name: 'SuperFlix_Debug', 
            title: 'Debug - Error', 
            url: `DEBUG://${encodeURIComponent(logs.join(' | '))}`,
            quality: 0, 
            type: 'debug' 
        }];
    }
}

module.exports = { getStreams };
