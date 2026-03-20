// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão com debug no stream

const BASE_URL = "https://warezcdn.site";
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
    
    // Array para armazenar logs
    const logs = [];
    
    function addLog(step, data) {
        let logStr = `[${step}] `;
        if (typeof data === 'object') {
            try {
                logStr += JSON.stringify(data).substring(0, 200);
            } catch(e) {
                logStr += String(data);
            }
        } else {
            logStr += String(data);
        }
        logs.push(logStr);
    }
    
    try {
        addLog('START', { tmdbId, mediaType, season: targetSeason, episode: targetEpisode });
        
        // 1. Acessar página do player
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addLog('PAGE_URL', pageUrl);
        
        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            }
        });
        
        addLog('PAGE_STATUS', pageResponse.status);
        
        if (!pageResponse.ok) {
            addLog('PAGE_FAILED', pageResponse.status);
            return [{
                url: `DEBUG_FAILED`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
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
        
        // 2. Extrair tokens
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            addLog('CSRF_TOKEN_NOT_FOUND', true);
            return [{
                url: `DEBUG_NO_CSRF`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addLog('CSRF_TOKEN', SESSION_DATA.csrfToken.substring(0, 30) + '...');
        
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            addLog('PAGE_TOKEN_NOT_FOUND', true);
            return [{
                url: `DEBUG_NO_PAGE`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addLog('PAGE_TOKEN', SESSION_DATA.pageToken.substring(0, 30) + '...');
        
        // 3. Extrair ALL_EPISODES
        const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            addLog('ALL_EPISODES_NOT_FOUND', true);
            return [{
                url: `DEBUG_NO_EPISODES`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        let contentId = null;
        try {
            const episodes = JSON.parse(epMatch[1]);
            const seasonData = episodes[targetSeason.toString()];
            if (seasonData) {
                for (let i = 0; i < seasonData.length; i++) {
                    if (seasonData[i].epi_num === targetEpisode) {
                        contentId = seasonData[i].ID?.toString();
                        break;
                    }
                }
            }
        } catch (e) {
            addLog('PARSE_ERROR', e.message);
            return [{
                url: `DEBUG_PARSE`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        if (!contentId) {
            addLog('CONTENT_ID_NOT_FOUND', targetEpisode);
            return [{
                url: `DEBUG_NO_CONTENT`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        addLog('CONTENT_ID', contentId);
        
        // 4. Obter options
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        const optionsHeaders = {
            ...API_HEADERS,
            'X-Page-Token': SESSION_DATA.pageToken,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        addLog('OPTIONS_REQUEST', { contentId });
        
        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams.toString()
        });
        
        addLog('OPTIONS_STATUS', optionsResponse.status);
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addLog('OPTIONS_ERROR', { status: optionsResponse.status, error: errorText.substring(0, 100) });
            return [{
                url: `DEBUG_OPTIONS_FAIL`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        
        if (!videoId) {
            addLog('VIDEO_ID_NOT_FOUND', true);
            return [{
                url: `DEBUG_NO_VIDEO`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        addLog('VIDEO_ID', videoId);
        
        // 5. Obter source
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        const sourceHeaders = {
            ...API_HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        addLog('SOURCE_REQUEST', { videoId });
        
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: sourceHeaders,
            body: sourceParams.toString()
        });
        
        addLog('SOURCE_STATUS', sourceResponse.status);
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addLog('SOURCE_ERROR', { status: sourceResponse.status, error: errorText.substring(0, 100) });
            return [{
                url: `DEBUG_SOURCE_FAIL`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        
        addLog('REDIRECT_URL', redirectUrl ? redirectUrl.substring(0, 100) + '...' : 'null');
        
        if (!redirectUrl) {
            addLog('NO_REDIRECT_URL', true);
            return [{
                url: `DEBUG_NO_REDIRECT`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 6. Seguir redirect
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
            return [{
                url: `DEBUG_REDIRECT_FAIL`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const playerUrl = redirectResponse.url;
        const playerHash = playerUrl.split('/').pop();
        addLog('PLAYER_HASH', playerHash);
        
        // 7. Obter dados do vídeo
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
            return [{
                url: `DEBUG_VIDEO_FAIL`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            addLog('NO_FINAL_URL', true);
            return [{
                url: `DEBUG_NO_FINAL`,
                name: 'SuperFlix_Debug',
                title: logs.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        addLog('SUCCESS', finalUrl.substring(0, 80));
        
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
        
        // Retorna com todos os logs no título
        return [{
            name: 'SuperFlix',
            title: title + ' | ' + logs.join(' | '),
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
            url: `DEBUG_CATCH`,
            name: 'SuperFlix_Debug',
            title: logs.join(' | '),
            quality: 0,
            type: 'debug'
        }];
    }
}

module.exports = { getStreams };
