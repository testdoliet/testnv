// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão final com suporte a filmes

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
    
    try {
        // 1. Acessar página do player (URL diferente para filmes)
        let pageUrl;
        if (mediaType === 'movie') {
            pageUrl = `${BASE_URL}/filme/${tmdbId}`;
        } else {
            pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        }
        
        const pageResponse = await fetch(pageUrl, {
            headers: { ...HEADERS, ...getCookieHeader() }
        });
        
        if (!pageResponse.ok) return [];
        updateCookies(pageResponse);
        
        let html = await pageResponse.text();
        
        // Se não estiver legível, tentar sem Accept-Encoding br
        let finalHtml = html;
        if (!html.includes('var CSRF_TOKEN') && !html.includes('<!DOCTYPE')) {
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
            }
        }
        
        // 2. Extrair tokens
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) return [];
        SESSION_DATA.csrfToken = csrfMatch[1];
        
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) return [];
        SESSION_DATA.pageToken = pageMatch[1];
        
        // 3. Extrair contentId (diferente para filmes)
        let contentId = null;
        
        if (mediaType === 'movie') {
            // Para filmes: procurar data-contentid ou ID no HTML
            const contentIdMatch = finalHtml.match(/data-contentid=["'](\d+)["']/);
            if (contentIdMatch) {
                contentId = contentIdMatch[1];
            } else {
                // Tentar extrair do ALL_EPISODES (filmes são tratados como temporada 1 episódio 1)
                const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
                if (epMatch) {
                    try {
                        const episodes = JSON.parse(epMatch[1]);
                        const seasonData = episodes["1"];
                        if (seasonData && seasonData.length > 0) {
                            contentId = seasonData[0].ID?.toString();
                        }
                    } catch (e) {}
                }
            }
        } else {
            // Para séries: extrair do ALL_EPISODES
            const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
            if (epMatch) {
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
                } catch (e) {}
            }
        }
        
        if (!contentId) return [];
        
        // 4. Options
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', mediaType === 'movie' ? 'filme' : 'serie');
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
        
        // 6. Seguir redirect
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
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
        videoParams.append('r', '');
        
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        
        if (!videoResponse.ok) return [];
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        if (!finalUrl) return [];
        
        // 8. Determinar qualidade
        let quality = 720;
        if (finalUrl.includes('2160') || finalUrl.includes('4k')) quality = 2160;
        else if (finalUrl.includes('1440')) quality = 1440;
        else if (finalUrl.includes('1080')) quality = 1080;
        else if (finalUrl.includes('720')) quality = 720;
        else if (finalUrl.includes('480')) quality = 480;
        
        let title;
        if (mediaType === 'movie') {
            title = `Filme ${tmdbId}`;
        } else {
            title = `S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
        }
        
        return [{
            name: `SuperFlixAPI ${quality}p`,
            title: title,
            url: finalUrl,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        }];
        
    } catch (error) {
        return [];
    }
}

module.exports = { getStreams };
