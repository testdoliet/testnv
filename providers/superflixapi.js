// providers/superflix.js - Versão com debug via stream
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

// Função para seguir redirects manualmente com debug
async function followRedirect(url, headers, stepName, maxRedirects = 5) {
    let currentUrl = url;
    
    for (let i = 0; i < maxRedirects; i++) {
        const response = await fetch(currentUrl, {
            method: 'GET',
            headers: headers,
            redirect: 'manual'
        });
        
        const location = response.headers.get('location');
        
        if (!location) {
            return { response, finalUrl: currentUrl };
        }
        
        currentUrl = new URL(location, currentUrl).href;
    }
    
    return { error: 'Too many redirects', url: currentUrl };
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
    try {
        // 1. Página inicial
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        const pageResponse = await fetch(pageUrl, {
            headers: { ...HEADERS, ...getCookieHeader() }
        });
        
        if (!pageResponse.ok) {
            return [{
                url: `DEBUG_ERROR_PAGE_${pageResponse.status}`,
                name: 'SuperFlix_Debug',
                title: `Page failed: ${pageResponse.status}`,
                quality: 0,
                type: 'debug'
            }];
        }
        updateCookies(pageResponse);
        
        let html = await pageResponse.text();
        
        // 2. Extrair tokens
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            return [{
                url: `DEBUG_NO_CSRF_TOKEN`,
                name: 'SuperFlix_Debug',
                title: `CSRF_TOKEN not found in HTML`,
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        
        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            return [{
                url: `DEBUG_NO_PAGE_TOKEN`,
                name: 'SuperFlix_Debug',
                title: `PAGE_TOKEN not found`,
                quality: 0,
                type: 'debug'
            }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        
        // 3. Extrair ALL_EPISODES
        const epMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            return [{
                url: `DEBUG_NO_EPISODES`,
                name: 'SuperFlix_Debug',
                title: `ALL_EPISODES not found`,
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
                title: `Failed to parse episodes: ${e.message}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        if (!contentId) {
            return [{
                url: `DEBUG_NO_CONTENT_ID`,
                name: 'SuperFlix_Debug',
                title: `Content ID not found for episode ${targetEpisode}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 4. Options
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
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
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            return [{
                url: `DEBUG_OPTIONS_FAILED_${optionsResponse.status}`,
                name: 'SuperFlix_Debug',
                title: `Options failed: ${errorText.substring(0, 100)}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) {
            return [{
                url: `DEBUG_NO_VIDEO_ID`,
                name: 'SuperFlix_Debug',
                title: `No video ID in options response`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 5. Source
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: {
                ...API_HEADERS,
                'Referer': pageUrl,
                ...getCookieHeader()
            },
            body: sourceParams.toString()
        });
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            return [{
                url: `DEBUG_SOURCE_FAILED_${sourceResponse.status}`,
                name: 'SuperFlix_Debug',
                title: `Source failed: ${errorText.substring(0, 100)}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        if (!redirectUrl) {
            return [{
                url: `DEBUG_NO_REDIRECT_URL`,
                name: 'SuperFlix_Debug',
                title: `No redirect URL in source response`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 6. Seguir redirect MANUALMENTE
        const redirectHeaders = {
            ...HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        const followResult = await followRedirect(redirectUrl, redirectHeaders, 'redirect');
        
        if (followResult.error) {
            return [{
                url: `DEBUG_REDIRECT_ERROR_${followResult.error}`,
                name: 'SuperFlix_Debug',
                title: `Redirect error: ${followResult.url}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        const finalResponse = followResult.response;
        
        if (!finalResponse.ok) {
            return [{
                url: `DEBUG_REDIRECT_HTTP_${finalResponse.status}`,
                name: 'SuperFlix_Debug',
                title: `Redirect response status: ${finalResponse.status}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        const playerUrl = finalResponse.url;
        const playerHash = playerUrl.split('/').pop();
        
        // 7. Obter vídeo final
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');
        
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'pt-BR',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': CDN_BASE,
                'Referer': `${CDN_BASE}/`,
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': HEADERS['User-Agent']
            },
            body: videoParams.toString()
        });
        
        if (!videoResponse.ok) {
            const errorText = await videoResponse.text();
            return [{
                url: `DEBUG_VIDEO_FAILED_${videoResponse.status}`,
                name: 'SuperFlix_Debug',
                title: `Video request failed: ${errorText.substring(0, 100)}`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            return [{
                url: `DEBUG_NO_FINAL_URL`,
                name: 'SuperFlix_Debug',
                title: `No video URL in response`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        // 8. Sucesso!
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
        
        return [{
            url: finalUrl,
            name: 'SuperFlix',
            title: title,
            quality: quality,
            type: 'hls',
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': HEADERS['User-Agent']
            }
        }];
        
    } catch (error) {
        return [{
            url: `DEBUG_CATCH_ERROR`,
            name: 'SuperFlix_Debug',
            title: `${error.message.substring(0, 150)}`,
            quality: 0,
            type: 'debug'
        }];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
}
