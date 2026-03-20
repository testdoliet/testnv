// providers/superflix.js - Versão com debug completo retornado no stream
const BASE_URL = "https://warezcdn.site";
const CDN_BASE = "https://llanfairpwllgwyngy.com";

let SESSION_DATA = {
    cookies: '',
    csrfToken: '',
    pageToken: ''
};

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

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Connection': 'keep-alive'
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
    
    const debugLog = [];
    
    function addDebug(step, data) {
        debugLog.push(`[${step}] ${JSON.stringify(data).substring(0, 200)}`);
    }
    
    try {
        // 1. Página inicial
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addDebug('STEP1_START', { url: pageUrl });
        
        const pageResponse = await fetch(pageUrl, {
            headers: { ...HEADERS, ...getCookieHeader() }
        });
        
        addDebug('STEP1_RESPONSE', { status: pageResponse.status, ok: pageResponse.ok });
        
        if (!pageResponse.ok) {
            return [{
                url: `DEBUG_FAILED`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        updateCookies(pageResponse);
        addDebug('STEP1_COOKIES', { cookiesSet: !!SESSION_DATA.cookies });
        
        let html = await pageResponse.text();
        addDebug('STEP1_HTML_LEN', html.length);
        
        // 2. Extrair tokens
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            return [{
                url: `DEBUG_NO_CSRF`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addDebug('STEP2_CSRF', { token: SESSION_DATA.csrfToken.substring(0, 30) });
        
        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            return [{
                url: `DEBUG_NO_PAGE`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addDebug('STEP2_PAGE', { token: SESSION_DATA.pageToken.substring(0, 30) });
        
        // 3. Extrair ALL_EPISODES
        const epMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            return [{
                url: `DEBUG_NO_EPISODES`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
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
            return [{
                url: `DEBUG_PARSE_ERROR`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        if (!contentId) {
            return [{
                url: `DEBUG_NO_CONTENT_ID`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        addDebug('STEP3_CONTENT_ID', contentId);
        
        // 4. Options
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        addDebug('STEP4_OPTIONS', { contentId, hasToken: !!SESSION_DATA.csrfToken });
        
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
        
        addDebug('STEP4_RESPONSE', { status: optionsResponse.status, ok: optionsResponse.ok });
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addDebug('STEP4_ERROR', errorText.substring(0, 100));
            return [{
                url: `DEBUG_OPTIONS_FAIL`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) {
            addDebug('STEP4_NO_VIDEO_ID', optionsData);
            return [{
                url: `DEBUG_NO_VIDEO_ID`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        addDebug('STEP4_VIDEO_ID', videoId);
        
        // 5. Source
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        addDebug('STEP5_SOURCE', { videoId });
        
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: {
                ...API_HEADERS,
                'Referer': pageUrl,
                ...getCookieHeader()
            },
            body: sourceParams.toString()
        });
        
        addDebug('STEP5_RESPONSE', { status: sourceResponse.status, ok: sourceResponse.ok });
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addDebug('STEP5_ERROR', errorText.substring(0, 100));
            return [{
                url: `DEBUG_SOURCE_FAIL`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        
        addDebug('STEP5_REDIRECT_URL', { url: redirectUrl ? redirectUrl.substring(0, 100) : 'null' });
        
        if (!redirectUrl) {
            return [{
                url: `DEBUG_NO_REDIRECT`,
                name: 'SuperFlix_Debug',
                title: debugLog.join(' | '),
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 6. Testar redirect com headers
        const redirectHeaders = {
            ...HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        addDebug('STEP6_REDIRECT_HEADERS', { 
            hasCookies: !!SESSION_DATA.cookies,
            referer: pageUrl
        });
        
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: redirectHeaders,
            redirect: 'manual'
        });
        
        addDebug('STEP6_REDIRECT_STATUS', { 
            status: redirectResponse.status,
            headers: Object.fromEntries(redirectResponse.headers.entries())
        });
        
        const location = redirectResponse.headers.get('location');
        addDebug('STEP6_LOCATION', location || 'no location');
        
        // RETORNA TODOS OS DEBUGS
        return [{
            url: `DEBUG_REDIRECT_COMPLETE`,
            name: 'SuperFlix_Debug',
            title: debugLog.join(' | '),
            quality: 0,
            type: 'debug'
        }];
        
    } catch (error) {
        addDebug('CATCH_ERROR', error.message);
        return [{
            url: `DEBUG_CATCH`,
            name: 'SuperFlix_Debug',
            title: debugLog.join(' | '),
            quality: 0,
            type: 'debug'
        }];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
}
