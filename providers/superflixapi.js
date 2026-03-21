// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão com debug no título e no nome

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

function updateCookies(response) {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        SESSION_DATA.cookies = setCookie;
    }
}

function getCookieHeader() {
    return SESSION_DATA.cookies ? { 'Cookie': SESSION_DATA.cookies } : {};
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
    // Array para armazenar logs no formato simplificado
    const logs = [];
    
    function addLog(step, data) {
        if (typeof data === 'object') {
            try {
                logs.push(`[${step}] ${JSON.stringify(data)}`);
            } catch(e) {
                logs.push(`[${step}] ${String(data)}`);
            }
        } else {
            logs.push(`[${step}] ${data}`);
        }
    }
    
    // Função para retornar debug (usada em caso de erro ou sucesso parcial)
    function returnDebug(debugName, finalUrl = null) {
        const debugTitle = logs.join(' | ');
        const debugNameStr = `DEBUG_${debugName}`;
        
        if (finalUrl) {
            return [{
                name: debugNameStr,
                title: debugTitle,
                url: finalUrl,
                quality: 0,
                type: 'debug'
            }];
        } else {
            return [{
                name: debugNameStr,
                title: debugTitle,
                url: `DEBUG_${debugName}`,
                quality: 0,
                type: 'debug'
            }];
        }
    }
    
    try {
        addLog('START', { tmdbId, mediaType, season: targetSeason, episode: targetEpisode });
        
        // ==================== PASSO 1: CARREGAR PÁGINA ====================
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addLog('PAGE_URL', pageUrl);
        
        const pageResponse = await fetch(pageUrl, {
            headers: { ...HEADERS, ...getCookieHeader() }
        });
        
        addLog('PAGE_STATUS', pageResponse.status);
        
        if (!pageResponse.ok) {
            addLog('PAGE_FAILED', pageResponse.status);
            return returnDebug('PAGE_FAILED');
        }
        
        updateCookies(pageResponse);
        addLog('COOKIES_SET', !!SESSION_DATA.cookies);
        
        const html = await pageResponse.text();
        addLog('HTML_LEN', html.length);
        
        const isReadable = html.includes('var CSRF_TOKEN') || html.includes('<!DOCTYPE');
        addLog('HTML_READABLE', isReadable);
        
        let finalHtml = html;
        if (!isReadable) {
            addLog('TRY_ALT_ENCODING', true);
            const altResponse = await fetch(pageUrl, {
                headers: {
                    ...HEADERS,
                    ...getCookieHeader(),
                    'Accept-Encoding': 'gzip, deflate'
                }
            });
            if (altResponse.ok) {
                updateCookies(altResponse);
                finalHtml = await altResponse.text();
                addLog('ALT_HTML_LEN', finalHtml.length);
            }
        }
        
        // ==================== PASSO 2: EXTRAIR TOKENS ====================
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            addLog('CSRF_TOKEN_NOT_FOUND', true);
            return returnDebug('NO_CSRF');
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addLog('CSRF_TOKEN', SESSION_DATA.csrfToken.substring(0, 30) + '...');
        
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            addLog('PAGE_TOKEN_NOT_FOUND', true);
            return returnDebug('NO_PAGE');
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addLog('PAGE_TOKEN', SESSION_DATA.pageToken.substring(0, 30) + '...');
        
        // ==================== PASSO 3: EXTRAIR EPISÓDIOS ====================
        const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            addLog('ALL_EPISODES_NOT_FOUND', true);
            return returnDebug('NO_EPISODES');
        }
        
        let contentId = null;
        try {
            const episodes = JSON.parse(epMatch[1]);
            const seasonData = episodes[targetSeason.toString()];
            if (seasonData) {
                for (let i = 0; i < seasonData.length; i++) {
                    if (seasonData[i].epi_num === targetEpisode) {
                        contentId = seasonData[i].ID?.toString();
                        addLog('EPISODE_FOUND', { episode: targetEpisode, contentId });
                        break;
                    }
                }
            }
        } catch (e) {
            addLog('PARSE_ERROR', e.message);
            return returnDebug('PARSE_ERROR');
        }
        
        if (!contentId) {
            addLog('CONTENT_ID_NOT_FOUND', targetEpisode);
            return returnDebug('NO_CONTENT');
        }
        addLog('CONTENT_ID', contentId);
        
        // ==================== PASSO 4: POST /player/options ====================
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        addLog('OPTIONS_REQUEST', { contentId });
        
        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: {
                ...API_HEADERS,
                'X-Page-Token': SESSION_DATA.pageToken,
                'Referer': pageUrl,
                ...getCookieHeader()
            },
            body: optionsParams.toString()
        });
        
        addLog('OPTIONS_STATUS', optionsResponse.status);
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addLog('OPTIONS_ERROR', { status: optionsResponse.status, error: errorText.substring(0, 100) });
            return returnDebug('OPTIONS_FAIL');
        }
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) {
            addLog('VIDEO_ID_NOT_FOUND', true);
            return returnDebug('NO_VIDEO');
        }
        addLog('VIDEO_ID', videoId);
        
        // ==================== PASSO 5: POST /player/source ====================
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        addLog('SOURCE_REQUEST', { videoId });
        
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: {
                ...API_HEADERS,
                'Referer': pageUrl,
                ...getCookieHeader()
            },
            body: sourceParams.toString()
        });
        
        addLog('SOURCE_STATUS', sourceResponse.status);
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addLog('SOURCE_ERROR', { status: sourceResponse.status, error: errorText.substring(0, 100) });
            return returnDebug('SOURCE_FAIL');
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        
        if (!redirectUrl) {
            addLog('REDIRECT_URL_NOT_FOUND', true);
            return returnDebug('NO_REDIRECT');
        }
        addLog('REDIRECT_URL', redirectUrl.substring(0, 100) + '...');
        
        // ==================== PASSO 6: SEGUIR REDIRECT ====================
        addLog('FOLLOW_REDIRECT', redirectUrl.substring(0, 80));
        
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            },
            redirect: 'follow'
        });
        
        addLog('REDIRECT_STATUS', redirectResponse.status);
        addLog('REDIRECT_URL_FINAL', redirectResponse.url);
        
        if (!redirectResponse.ok) {
            addLog('REDIRECT_FAILED', redirectResponse.status);
            return returnDebug('REDIRECT_FAIL');
        }
        
        const playerUrl = redirectResponse.url;
        const playerHash = playerUrl.split('/').pop();
        addLog('PLAYER_HASH', playerHash);
        
        // ==================== PASSO 7: OBTER VÍDEO FINAL ====================
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');
        
        addLog('VIDEO_REQUEST', { hash: playerHash });
        
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        
        addLog('VIDEO_STATUS', videoResponse.status);
        
        if (!videoResponse.ok) {
            addLog('VIDEO_FAILED', videoResponse.status);
            return returnDebug('VIDEO_FAIL');
        }
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            addLog('FINAL_URL_NOT_FOUND', true);
            return returnDebug('NO_FINAL');
        }
        
        addLog('SUCCESS', finalUrl.substring(0, 80));
        
        // ==================== PASSO 8: FORMATAR RESPOSTA ====================
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
        
        // Retorna o stream com TODOS os logs no TÍTULO e no NAME
        const debugTitle = logs.join(' | ');
        
        return [{
            name: `SuperFlix_Success_${quality}`,
            title: title + ' | ' + debugTitle,
            url: finalUrl,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        }];
        
    } catch (error) {
        addLog('CATCH_ERROR', error.message);
        return [{
            name: `SuperFlix_Debug_CATCH_${error.message.substring(0, 30)}`,
            title: logs.join(' | '),
            url: 'DEBUG_CATCH',
            quality: 0,
            type: 'debug'
        }];
    }
}

module.exports = { getStreams };
