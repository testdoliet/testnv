// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão com headers completos anti-bot

const BASE_URL = "https://warezcdn.site";
const CDN_BASE = "https://llanfairpwllgwyngy.com";

let SESSION_DATA = {
    cookies: '',
    csrfToken: '',
    pageToken: ''
};

// HEADERS COMPLETOS - Simulando Chrome no Android REAL
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'DNT': '1',
    'Priority': 'u=0, i'
};

// Headers para API (AJAX)
const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Sec-Ch-Ua': '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Connection': 'keep-alive',
    'DNT': '1'
};

// Headers para o redirect (simulando navegação)
const REDIRECT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'DNT': '1',
    'Cache-Control': 'max-age=0'
};

// Headers para o player final (vídeo)
const VIDEO_HEADERS = {
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': CDN_BASE,
    'Referer': `${CDN_BASE}/`,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Sec-Ch-Ua': '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'DNT': '1'
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
        // 1. Página inicial
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        
        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...BROWSER_HEADERS,
                ...getCookieHeader()
            }
        });
        
        if (!pageResponse.ok) return [];
        updateCookies(pageResponse);
        
        let html = await pageResponse.text();
        
        // Se HTML veio comprimido, tentar sem brotli
        let finalHtml = html;
        if (!html.includes('var CSRF_TOKEN') && html.length < 50000) {
            const altResponse = await fetch(pageUrl, {
                headers: {
                    ...BROWSER_HEADERS,
                    ...getCookieHeader(),
                    'Accept-Encoding': 'gzip, deflate'
                }
            });
            if (altResponse.ok) {
                updateCookies(altResponse);
                finalHtml = await altResponse.text();
            }
        }
        
        // 2. Extrair tokens
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) return [];
        SESSION_DATA.csrfToken = csrfMatch[1];
        
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) return [];
        SESSION_DATA.pageToken = pageMatch[1];
        
        // 3. Extrair ALL_EPISODES
        const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
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
        
        if (!optionsResponse.ok) return [];
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) return [];
        
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
        
        if (!sourceResponse.ok) return [];
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        if (!redirectUrl) return [];
        
        // 6. Seguir redirect com headers COMPLETOS de navegador
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...REDIRECT_HEADERS,
                'Referer': pageUrl,
                ...getCookieHeader()
            },
            redirect: 'follow'
        });
        
        if (!redirectResponse.ok) return [];
        
        const playerUrl = redirectResponse.url;
        const playerHash = playerUrl.split('/').pop();
        
        // 7. Obter vídeo final
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', BASE_URL);
        
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        
        if (!videoResponse.ok) return [];
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        if (!finalUrl) return [];
        
        // 8. Qualidade
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
            name: 'SuperFlix',
            title: title,
            url: finalUrl,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': BROWSER_HEADERS['User-Agent']
            }
        }];
        
    } catch (error) {
        return [];
    }
}

module.exports = { getStreams };
