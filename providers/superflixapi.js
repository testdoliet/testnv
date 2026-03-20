// providers/superflix.js
// SuperFlixAPI Provider for Nuvio - Versão com logs técnicos detalhados no stream

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
    
    // Array para armazenar logs detalhados
    const logs = [];
    
    function addLog(step, data) {
        let logStr = `[${step}] `;
        if (typeof data === 'object') {
            try {
                logStr += JSON.stringify(data).substring(0, 300);
            } catch(e) {
                logStr += String(data);
            }
        } else {
            logStr += String(data);
        }
        logs.push(logStr);
    }
    
    function addTimedLog(step, data, timeMs) {
        let logStr = `[${step}] ⏱️${timeMs}ms | `;
        if (typeof data === 'object') {
            try {
                logStr += JSON.stringify(data).substring(0, 250);
            } catch(e) {
                logStr += String(data);
            }
        } else {
            logStr += String(data);
        }
        logs.push(logStr);
    }
    
    const startTime = Date.now();
    addLog('🚀INICIO', { tmdbId, mediaType, season: targetSeason, episode: targetEpisode, timestamp: new Date().toISOString() });
    
    try {
        // ==================== PASSO 1: PÁGINA INICIAL ====================
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addLog('📡PASSO1_URL', pageUrl);
        
        const pageStartTime = Date.now();
        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            }
        });
        const pageTime = Date.now() - pageStartTime;
        
        addTimedLog('📡PASSO1_RESPOSTA', { status: pageResponse.status, ok: pageResponse.ok }, pageTime);
        
        if (!pageResponse.ok) {
            addLog('❌PASSO1_FALHOU', pageResponse.status);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_FAILED', quality: 0, type: 'debug' }];
        }
        
        updateCookies(pageResponse);
        addLog('🍪COOKIES_SET', !!SESSION_DATA.cookies);
        
        const html = await pageResponse.text();
        addLog('📄HTML_LEN', html.length);
        
        const isReadable = html.includes('var CSRF_TOKEN') || html.includes('<!DOCTYPE');
        addLog('📖HTML_LEGIVEL', isReadable);
        
        let finalHtml = html;
        if (!isReadable) {
            addLog('🔄TENTANDO_SEM_BROTLI', true);
            
            const altStartTime = Date.now();
            const altResponse = await fetch(pageUrl, {
                headers: {
                    ...HEADERS,
                    ...getCookieHeader(),
                    'Accept-Encoding': 'gzip, deflate'
                }
            });
            const altTime = Date.now() - altStartTime;
            
            if (altResponse.ok) {
                updateCookies(altResponse);
                finalHtml = await altResponse.text();
                addTimedLog('📄ALT_HTML', { len: finalHtml.length }, altTime);
            }
        }
        
        // ==================== PASSO 2: EXTRAIR TOKENS ====================
        addLog('🔐PASSO2_TOKENS', 'iniciando extração');
        
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            addLog('❌CSRF_TOKEN_NAO_ENCONTRADO', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_CSRF', quality: 0, type: 'debug' }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addLog('🔑CSRF_TOKEN', `${SESSION_DATA.csrfToken.substring(0, 30)}... (${SESSION_DATA.csrfToken.length} chars)`);
        
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            addLog('❌PAGE_TOKEN_NAO_ENCONTRADO', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_PAGE', quality: 0, type: 'debug' }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addLog('🔑PAGE_TOKEN', `${SESSION_DATA.pageToken.substring(0, 30)}... (${SESSION_DATA.pageToken.length} chars)`);
        
        // ==================== PASSO 3: EXTRAIR EPISÓDIOS ====================
        addLog('📺PASSO3_EPISODIOS', 'iniciando extração');
        
        const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            addLog('❌ALL_EPISODES_NAO_ENCONTRADO', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_EPISODES', quality: 0, type: 'debug' }];
        }
        addLog('📊ALL_EPISODES_LEN', epMatch[1].length);
        
        let contentId = null;
        try {
            const episodes = JSON.parse(epMatch[1]);
            addLog('📅TEMPORADAS', Object.keys(episodes).join(','));
            
            const seasonData = episodes[targetSeason.toString()];
            if (seasonData) {
                addLog('📅TEMP_' + targetSeason, `${seasonData.length} episódios`);
                for (let i = 0; i < seasonData.length; i++) {
                    if (seasonData[i].epi_num === targetEpisode) {
                        contentId = seasonData[i].ID?.toString();
                        addLog('✅EPISODIO_ENCONTRADO', { ep: targetEpisode, id: contentId });
                        break;
                    }
                }
            }
        } catch (e) {
            addLog('❌PARSE_ERROR', e.message);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_PARSE', quality: 0, type: 'debug' }];
        }
        
        if (!contentId) {
            addLog('❌CONTENT_ID_NAO_ENCONTRADO', targetEpisode);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_CONTENT', quality: 0, type: 'debug' }];
        }
        addLog('📌CONTENT_ID', contentId);
        
        // ==================== PASSO 4: REQUISIÇÃO OPTIONS ====================
        addLog('⚙️PASSO4_OPTIONS', { contentId });
        
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        addLog('📦OPTIONS_PARAMS', optionsParams.toString().substring(0, 100));
        
        const optionsHeaders = {
            ...API_HEADERS,
            'X-Page-Token': SESSION_DATA.pageToken,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        const optionsStartTime = Date.now();
        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams.toString()
        });
        const optionsTime = Date.now() - optionsStartTime;
        
        addTimedLog('⚙️OPTIONS_STATUS', { status: optionsResponse.status }, optionsTime);
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addLog('❌OPTIONS_ERROR', { status: optionsResponse.status, error: errorText.substring(0, 100) });
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_OPTIONS_FAIL', quality: 0, type: 'debug' }];
        }
        
        const optionsData = await optionsResponse.json();
        const videoId = optionsData?.data?.options?.[0]?.ID;
        
        if (!videoId) {
            addLog('❌VIDEO_ID_NAO_ENCONTRADO', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_VIDEO', quality: 0, type: 'debug' }];
        }
        addLog('🎬VIDEO_ID', videoId);
        
        // ==================== PASSO 5: REQUISIÇÃO SOURCE ====================
        addLog('🔗PASSO5_SOURCE', { videoId });
        
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        const sourceHeaders = {
            ...API_HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        
        const sourceStartTime = Date.now();
        const sourceResponse = await fetch(`${BASE_URL}/player/source`, {
            method: 'POST',
            headers: sourceHeaders,
            body: sourceParams.toString()
        });
        const sourceTime = Date.now() - sourceStartTime;
        
        addTimedLog('🔗SOURCE_STATUS', { status: sourceResponse.status }, sourceTime);
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addLog('❌SOURCE_ERROR', { status: sourceResponse.status, error: errorText.substring(0, 100) });
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_SOURCE_FAIL', quality: 0, type: 'debug' }];
        }
        
        const sourceData = await sourceResponse.json();
        const redirectUrl = sourceData?.data?.video_url;
        
        addLog('🔀REDIRECT_URL', redirectUrl ? redirectUrl.substring(0, 100) + '...' : 'null');
        
        if (!redirectUrl) {
            addLog('❌NO_REDIRECT_URL', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_REDIRECT', quality: 0, type: 'debug' }];
        }
        
        // ==================== PASSO 6: SEGUIR REDIRECT ====================
        addLog('🔄PASSO6_REDIRECT', redirectUrl.substring(0, 80));
        
        const redirectStartTime = Date.now();
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                ...HEADERS,
                ...getCookieHeader()
            },
            redirect: 'follow'
        });
        const redirectTime = Date.now() - redirectStartTime;
        
        addTimedLog('🔄REDIRECT_STATUS', { status: redirectResponse.status }, redirectTime);
        addLog('🔗REDIRECT_URL_FINAL', redirectResponse.url);
        
        if (!redirectResponse.ok) {
            addLog('❌REDIRECT_FAILED', redirectResponse.status);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_REDIRECT_FAIL', quality: 0, type: 'debug' }];
        }
        
        const playerUrl = redirectResponse.url;
        const playerHash = playerUrl.split('/').pop();
        addLog('🎯PLAYER_HASH', playerHash);
        
        // ==================== PASSO 7: OBTER VÍDEO FINAL ====================
        addLog('🎥PASSO7_VIDEO', { hash: playerHash });
        
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', '');
        
        const videoStartTime = Date.now();
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        const videoTime = Date.now() - videoStartTime;
        
        addTimedLog('🎥VIDEO_STATUS', { status: videoResponse.status }, videoTime);
        
        if (!videoResponse.ok) {
            addLog('❌VIDEO_FAILED', videoResponse.status);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_VIDEO_FAIL', quality: 0, type: 'debug' }];
        }
        
        const videoData = await videoResponse.json();
        const finalUrl = videoData.securedLink || videoData.videoSource;
        
        if (!finalUrl) {
            addLog('❌NO_FINAL_URL', true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_FINAL', quality: 0, type: 'debug' }];
        }
        
        addLog('🎬FINAL_URL', finalUrl.substring(0, 100) + '...');
        
        // ==================== PASSO 8: FORMATAR RESPOSTA ====================
        let quality = '1080p';
        if (finalUrl.includes('2160') || finalUrl.includes('4k')) quality = '2160p';
        else if (finalUrl.includes('1440')) quality = '1440p';
        else if (finalUrl.includes('1080')) quality = '1080p';
        else if (finalUrl.includes('720')) quality = '720p';
        else if (finalUrl.includes('480')) quality = '480p';
        
        addLog('📺QUALIDADE', quality);
        
        let title = `TMDB ${tmdbId}`;
        if (mediaType === 'tv') {
            title = `S${targetSeason.toString().padStart(2, '0')}E${targetEpisode.toString().padStart(2, '0')}`;
        }
        
        const totalTime = Date.now() - startTime;
        addLog('✅SUCESSO', { tempo_total_ms: totalTime, url: finalUrl.substring(0, 80) });
        
        // Retorna o stream com todos os logs no título
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
        const totalTime = Date.now() - startTime;
        addLog('❌CATCH_ERROR', { message: error.message, time_ms: totalTime });
        return [{
            name: 'SuperFlix_Debug',
            title: logs.join(' | '),
            url: 'DEBUG_CATCH',
            quality: 0,
            type: 'debug'
        }];
    }
}

module.exports = { getStreams };
