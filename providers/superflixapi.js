// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão sem redirect automático

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
        console.log(`[SuperFlix] Cookies atualizados`);
    }
}

// Função para obter header de cookies para requisições
function getCookieHeader() {
    return SESSION_DATA.cookies ? { 'Cookie': SESSION_DATA.cookies } : {};
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[SuperFlix] Fetching ${mediaType} ${tmdbId} S${season}E${episode}`);

    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;

    try {
        // ==================== PASSO 1: CARREGAR PÁGINA ====================
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        console.log(`[SuperFlix] Loading page: ${pageUrl}`);

        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            }
        });

        if (!pageResponse.ok) {
            throw new Error(`HTTP ${pageResponse.status}`);
        }

        updateCookies(pageResponse);
        const html = await pageResponse.text();
        console.log(`[SuperFlix] Page loaded: ${html.length} chars`);

        // ==================== PASSO 2: EXTRAIR TOKENS ====================
        const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) throw new Error('CSRF_TOKEN not found');
        SESSION_DATA.csrfToken = csrfMatch[1];
        console.log(`[SuperFlix] CSRF_TOKEN found`);

        const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) throw new Error('PAGE_TOKEN not found');
        SESSION_DATA.pageToken = pageMatch[1];
        console.log(`[SuperFlix] PAGE_TOKEN found`);

        // ==================== PASSO 3: EXTRAIR EPISÓDIOS ====================
        const epMatch = html.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) throw new Error('ALL_EPISODES not found');

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
            throw new Error('Failed to parse episodes');
        }

        if (!contentId) throw new Error('Content ID not found');
        console.log(`[SuperFlix] Content ID: ${contentId}`);

        // ==================== PASSO 4: POST /player/options ====================
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

        console.log(`[SuperFlix] Requesting options...`);

        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams.toString()
        });

        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            console.error(`[SuperFlix] Options error (${optionsResponse.status}): ${errorText}`);
            throw new Error(`Options failed: ${optionsResponse.status}`);
        }

        const optionsData = await optionsResponse.json();
        console.log(`[SuperFlix] Options response received`);

        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) throw new Error('No video ID found');
        console.log(`[SuperFlix] Video ID: ${videoId}`);

        // ==================== PASSO 5: POST /player/source ====================
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);

        const sourceHeaders = {
            ...API_HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };

        console.log(`[SuperFlix] Requesting source...`);

        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: sourceHeaders,
            body: sourceParams.toString()
        });

        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            console.error(`[SuperFlix] Source error (${sourceResponse.status}): ${errorText}`);
            throw new Error(`Source failed: ${sourceResponse.status}`);
        }

        const sourceData = await sourceResponse.json();
        console.log(`[SuperFlix] Source response received`);

        const redirectUrl = sourceData?.data?.video_url;
        if (!redirectUrl) throw new Error('No redirect URL');
        console.log(`[SuperFlix] Redirect URL obtained`);

        // ==================== PASSO 6: SEGUIR REDIRECT MANUALMENTE ====================
        // IMPORTANTE: NÃO usar redirect: 'follow' - igual ao Python com allow_redirects=False
        console.log(`[SuperFlix] Following redirect manually (no auto-follow)...`);

        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            },
            redirect: 'manual'  // NÃO segue automaticamente
        });

        console.log(`[SuperFlix] Redirect status: ${redirectResponse.status}`);

        // Extrair Location do header
        let playerUrl = redirectResponse.headers.get('location');

        // Se não tiver Location, tentar extrair do meta refresh no HTML
        if (!playerUrl) {
            const htmlRedirect = await redirectResponse.text();
            console.log(`[SuperFlix] No Location header, trying meta refresh...`);
            
            // Tenta vários padrões de meta refresh
            let metaMatch = htmlRedirect.match(/url=["']?([^"'>]+)["']?/i);
            if (!metaMatch) {
                metaMatch = htmlRedirect.match(/URL=([^\s"']+)/i);
            }
            if (!metaMatch) {
                metaMatch = htmlRedirect.match(/content="0;url='([^']+)'/i);
            }
            
            if (metaMatch) {
                playerUrl = metaMatch[1];
                console.log(`[SuperFlix] URL found in meta refresh: ${playerUrl}`);
            }
        }

        if (!playerUrl) {
            console.error(`[SuperFlix] Could not find redirect URL`);
            throw new Error('Could not find redirect URL');
        }

        console.log(`[SuperFlix] Player URL extracted: ${playerUrl}`);

        // ==================== PASSO 7: ACESSAR PLAYER ====================
        const playerResponse = await fetch(playerUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            }
        });

        if (!playerResponse.ok) {
            throw new Error(`Player page failed: ${playerResponse.status}`);
        }

        const playerHash = playerUrl.split('/').pop();
        console.log(`[SuperFlix] Player hash: ${playerHash}`);

        // ==================== PASSO 8: OBTER URL FINAL DO VÍDEO ====================
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');

        console.log(`[SuperFlix] Requesting final video...`);

        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });

        if (!videoResponse.ok) {
            throw new Error(`Video data failed: ${videoResponse.status}`);
        }

        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        if (!finalUrl) throw new Error('No video URL found');

        console.log(`[SuperFlix] SUCCESS! Video URL obtained`);

        // ==================== PASSO 9: DETERMINAR QUALIDADE ====================
        let quality = '1080p';
        if (finalUrl.includes('2160') || finalUrl.includes('4k')) quality = '2160p';
        else if (finalUrl.includes('1440')) quality = '1440p';
        else if (finalUrl.includes('1080')) quality = '1080p';
        else if (finalUrl.includes('720')) quality = '720p';
        else if (finalUrl.includes('480')) quality = '480p';

        // Formatar título
        let title = `TMDB ${tmdbId}`;
        if (mediaType === 'tv') {
            title = `S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
        }

        // ==================== PASSO 10: RETORNAR STREAM ====================
        return [{
            name: 'SuperFlix',
            title: title,
            url: finalUrl,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        }];

    } catch (error) {
        console.error('[SuperFlix] Error:', error.message);
        return [];
    }
}

module.exports = { getStreams };
