// providers/superflix.js
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
    
    try {
        // Página inicial
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        const pageResponse = await fetch(pageUrl, {
            headers: { ...HEADERS, ...getCookieHeader() }
        });
        
        if (!pageResponse.ok) return [];
        updateCookies(pageResponse);
        
        let html = await pageResponse.text();
        
        // Extrair tokens
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) return [];
        SESSION_DATA.csrfToken = csrfMatch[1];
        
        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) return [];
        SESSION_DATA.pageToken = pageMatch[1];
        
        // Extrair ALL_EPISODES
        const epMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) return [];
        
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
            return [];
        }
        
        if (!contentId) return [];
        
        // Options
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
        
        if (!optionsResponse.ok) return [];
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) return [];
        
        // Source
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
        
        if (!sourceResponse.ok) return [];
        
        const sourceData = await sourceResponse.json();
        let redirectUrl = sourceData?.data?.video_url;
        if (!redirectUrl) return [];
        
        // Seguir todos os redirects até chegar no player real
        let currentUrl = redirectUrl;
        let maxRedirects = 5;
        let playerHash = null;
        
        for (let i = 0; i < maxRedirects; i++) {
            const redirectResponse = await fetch(currentUrl, {
                method: 'GET',
                headers: { ...HEADERS, ...getCookieHeader() },
                redirect: 'manual'  // Não seguir automaticamente
            });
            
            const location = redirectResponse.headers.get('location');
            
            if (!location) {
                // Não é redirect, verificar se é a página do player
                const text = await redirectResponse.text();
                const hashMatch = text.match(/hash["']?\s*:\s*["']([^"']+)["']/);
                if (hashMatch) {
                    playerHash = hashMatch[1];
                    break;
                }
                // Se não encontrou hash, retorna a URL atual
                return [{
                    url: currentUrl,
                    name: 'SuperFlix_Debug',
                    title: `Step5_Final_URL`,
                    quality: 0,
                    type: 'debug'
                }];
            }
            
            currentUrl = new URL(location, currentUrl).href;
        }
        
        if (!playerHash) {
            return [{
                url: `DEBUG_STEP5_NO_HASH_${currentUrl.substring(0, 100)}`,
                name: 'SuperFlix_Debug',
                title: `Step5: No hash found`,
                quality: 0,
                type: 'debug'
            }];
        }
        
        // RETORNO 5: Player Hash
        return [{
            url: `DEBUG_STEP5_PLAYER_HASH_${playerHash}`,
            name: 'SuperFlix_Debug',
            title: `Step5: Player Hash ${playerHash}`,
            quality: 0,
            type: 'debug'
        }];
        
    } catch (error) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
}
