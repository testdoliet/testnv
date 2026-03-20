// providers/superflix.js
// SuperFlixAPI Provider - Versão com debug ultra detalhado no stream

const BASE_URL = "https://warezcdn.site";
const CDN_BASE = "https://llanfairpwllgwyngy.com";

let SESSION_DATA = {
    cookies: '',
    csrfToken: '',
    pageToken: ''
};

// HEADERS COMPLETOS
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
    
    // Array para armazenar TODOS os logs detalhados
    const logs = [];
    const startTime = Date.now();
    
    function addLog(step, data, isError = false) {
        const timestamp = Date.now() - startTime;
        let logStr = `[${timestamp}ms][${step}] `;
        if (typeof data === 'object') {
            try {
                logStr += JSON.stringify(data).substring(0, 500);
            } catch(e) {
                logStr += String(data);
            }
        } else {
            logStr += String(data);
        }
        logs.push(logStr);
        if (isError) logs.push(`[${timestamp}ms][ERROR] ${step} failed`);
    }
    
    try {
        addLog('INICIO', { tmdbId, mediaType, season: targetSeason, episode: targetEpisode, timestamp: new Date().toISOString() });
        
        // ==================== PASSO 1: PÁGINA INICIAL ====================
        const pageUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
        addLog('PASSO1_URL', pageUrl);
        addLog('PASSO1_HEADERS', Object.keys(BROWSER_HEADERS).join(','));
        
        const pageStart = Date.now();
        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...BROWSER_HEADERS,
                ...getCookieHeader()
            }
        });
        const pageTime = Date.now() - pageStart;
        
        addLog('PASSO1_RESPOSTA', {
            status: pageResponse.status,
            statusText: pageResponse.statusText,
            ok: pageResponse.ok,
            timeMs: pageTime,
            headers: Object.fromEntries(pageResponse.headers.entries())
        });
        
        if (!pageResponse.ok) {
            addLog('PASSO1_FALHA', pageResponse.status, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_FAILED_STEP1', quality: 0, type: 'debug' }];
        }
        
        updateCookies(pageResponse);
        addLog('PASSO1_COOKIES_RECEBIDOS', { cookiesSet: !!SESSION_DATA.cookies, cookieLength: SESSION_DATA.cookies?.length });
        
        const html = await pageResponse.text();
        addLog('PASSO1_HTML', { length: html.length, preview: html.substring(0, 500) });
        
        const hasCsrf = html.includes('var CSRF_TOKEN');
        const hasPageToken = html.includes('var PAGE_TOKEN');
        const hasDoctype = html.includes('<!DOCTYPE');
        addLog('PASSO1_HTML_ANALISE', { hasCsrf, hasPageToken, hasDoctype, isReadable: hasCsrf || hasDoctype });
        
        let finalHtml = html;
        if (!hasCsrf && !hasDoctype) {
            addLog('PASSO1_TENTANDO_SEM_BROTLI', true);
            const altStart = Date.now();
            const altResponse = await fetch(pageUrl, {
                headers: {
                    ...BROWSER_HEADERS,
                    ...getCookieHeader(),
                    'Accept-Encoding': 'gzip, deflate'
                }
            });
            const altTime = Date.now() - altStart;
            
            if (altResponse.ok) {
                updateCookies(altResponse);
                finalHtml = await altResponse.text();
                addLog('PASSO1_ALT_HTML', { length: finalHtml.length, timeMs: altTime });
            }
        }
        
        // ==================== PASSO 2: EXTRAIR TOKENS ====================
        addLog('PASSO2_INICIO', 'Extraindo CSRF_TOKEN');
        
        const csrfMatch = finalHtml.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!csrfMatch) {
            addLog('PASSO2_CSRF_NAO_ENCONTRADO', finalHtml.match(/CSRF_TOKEN/g)?.length || 0, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_CSRF', quality: 0, type: 'debug' }];
        }
        SESSION_DATA.csrfToken = csrfMatch[1];
        addLog('PASSO2_CSRF_TOKEN', { token: SESSION_DATA.csrfToken, length: SESSION_DATA.csrfToken.length });
        
        addLog('PASSO2_INICIO_PAGE', 'Extraindo PAGE_TOKEN');
        const pageMatch = finalHtml.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
        if (!pageMatch) {
            addLog('PASSO2_PAGE_NAO_ENCONTRADO', finalHtml.match(/PAGE_TOKEN/g)?.length || 0, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_PAGE', quality: 0, type: 'debug' }];
        }
        SESSION_DATA.pageToken = pageMatch[1];
        addLog('PASSO2_PAGE_TOKEN', { token: SESSION_DATA.pageToken.substring(0, 50) + '...', length: SESSION_DATA.pageToken.length });
        
        // ==================== PASSO 3: EPISÓDIOS ====================
        addLog('PASSO3_INICIO', 'Buscando ALL_EPISODES');
        
        const epMatch = finalHtml.match(/var ALL_EPISODES\s*=\s*(\{.*?\});/s);
        if (!epMatch) {
            addLog('PASSO3_ALL_EPISODES_NAO_ENCONTRADO', true, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_EPISODES', quality: 0, type: 'debug' }];
        }
        addLog('PASSO3_ALL_EPISODES', { length: epMatch[1].length, preview: epMatch[1].substring(0, 200) });
        
        let contentId = null;
        try {
            const episodes = JSON.parse(epMatch[1]);
            addLog('PASSO3_EPISODES_PARSE', { seasons: Object.keys(episodes) });
            
            const seasonData = episodes[targetSeason.toString()];
            if (seasonData) {
                addLog('PASSO3_TEMPORADA', { season: targetSeason, episodeCount: seasonData.length, episodes: seasonData.map(e => ({ num: e.epi_num, id: e.ID })) });
                
                for (let i = 0; i < seasonData.length; i++) {
                    if (seasonData[i].epi_num === targetEpisode) {
                        contentId = seasonData[i].ID?.toString();
                        addLog('PASSO3_EPISODIO_ENCONTRADO', { episode: targetEpisode, contentId, index: i });
                        break;
                    }
                }
            } else {
                addLog('PASSO3_TEMPORADA_NAO_ENCONTRADA', { season: targetSeason, available: Object.keys(episodes) });
            }
        } catch (e) {
            addLog('PASSO3_PARSE_ERROR', { error: e.message, stack: e.stack }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_PARSE_ERROR', quality: 0, type: 'debug' }];
        }
        
        if (!contentId) {
            addLog('PASSO3_CONTENT_ID_NAO_ENCONTRADO', { targetEpisode, targetSeason }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_CONTENT_ID', quality: 0, type: 'debug' }];
        }
        addLog('PASSO3_CONTENT_ID', contentId);
        
        // ==================== PASSO 4: OPTIONS ====================
        addLog('PASSO4_INICIO', { contentId, csrfToken: SESSION_DATA.csrfToken.substring(0, 20) + '...' });
        
        const optionsParams = new URLSearchParams();
        optionsParams.append('contentid', contentId);
        optionsParams.append('type', 'serie');
        optionsParams.append('_token', SESSION_DATA.csrfToken);
        optionsParams.append('page_token', SESSION_DATA.pageToken);
        optionsParams.append('pageToken', SESSION_DATA.pageToken);
        
        addLog('PASSO4_PARAMS', optionsParams.toString().substring(0, 300));
        
        const optionsHeaders = {
            ...API_HEADERS,
            'X-Page-Token': SESSION_DATA.pageToken,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        addLog('PASSO4_HEADERS', Object.keys(optionsHeaders).join(','));
        
        const optionsStart = Date.now();
        const optionsResponse = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: optionsHeaders,
            body: optionsParams.toString()
        });
        const optionsTime = Date.now() - optionsStart;
        
        addLog('PASSO4_RESPOSTA', {
            status: optionsResponse.status,
            ok: optionsResponse.ok,
            timeMs: optionsTime,
            headers: Object.fromEntries(optionsResponse.headers.entries())
        });
        
        if (!optionsResponse.ok) {
            const errorText = await optionsResponse.text();
            addLog('PASSO4_ERROR', { status: optionsResponse.status, body: errorText.substring(0, 500) }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_OPTIONS_FAIL', quality: 0, type: 'debug' }];
        }
        
        const optionsData = await optionsResponse.json();
        addLog('PASSO4_JSON', optionsData);
        
        const videoId = optionsData?.data?.options?.[0]?.ID;
        if (!videoId) {
            addLog('PASSO4_VIDEO_ID_NAO_ENCONTRADO', optionsData, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_VIDEO_ID', quality: 0, type: 'debug' }];
        }
        addLog('PASSO4_VIDEO_ID', videoId);
        
        // ==================== PASSO 5: SOURCE ====================
        addLog('PASSO5_INICIO', { videoId });
        
        const sourceParams = new URLSearchParams();
        sourceParams.append('video_id', videoId);
        sourceParams.append('page_token', SESSION_DATA.pageToken);
        sourceParams.append('_token', SESSION_DATA.csrfToken);
        
        addLog('PASSO5_PARAMS', sourceParams.toString().substring(0, 200));
        
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
        
        addLog('PASSO5_RESPOSTA', {
            status: sourceResponse.status,
            ok: sourceResponse.ok,
            timeMs: sourceTime,
            headers: Object.fromEntries(sourceResponse.headers.entries())
        });
        
        if (!sourceResponse.ok) {
            const errorText = await sourceResponse.text();
            addLog('PASSO5_ERROR', { status: sourceResponse.status, body: errorText.substring(0, 500) }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_SOURCE_FAIL', quality: 0, type: 'debug' }];
        }
        
        const sourceData = await sourceResponse.json();
        addLog('PASSO5_JSON', sourceData);
        
        const redirectUrl = sourceData?.data?.video_url;
        if (!redirectUrl) {
            addLog('PASSO5_REDIRECT_URL_NAO_ENCONTRADO', sourceData, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_REDIRECT', quality: 0, type: 'debug' }];
        }
        addLog('PASSO5_REDIRECT_URL', redirectUrl);
        
        // ==================== PASSO 6: REDIRECT ====================
        addLog('PASSO6_INICIO', { redirectUrl: redirectUrl.substring(0, 150) });
        
        const redirectHeaders = {
            ...REDIRECT_HEADERS,
            'Referer': pageUrl,
            ...getCookieHeader()
        };
        addLog('PASSO6_HEADERS', Object.keys(redirectHeaders).join(','));
        
        const redirectStart = Date.now();
        const redirectResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: redirectHeaders,
            redirect: 'follow'
        });
        const redirectTime = Date.now() - redirectStart;
        
        addLog('PASSO6_RESPOSTA', {
            status: redirectResponse.status,
            ok: redirectResponse.ok,
            timeMs: redirectTime,
            url: redirectResponse.url,
            headers: Object.fromEntries(redirectResponse.headers.entries())
        });
        
        if (!redirectResponse.ok) {
            const errorText = await redirectResponse.text();
            addLog('PASSO6_ERROR', { status: redirectResponse.status, body: errorText.substring(0, 500) }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_REDIRECT_FAIL', quality: 0, type: 'debug' }];
        }
        
        const playerUrl = redirectResponse.url;
        const playerHash = playerUrl.split('/').pop();
        addLog('PASSO6_PLAYER_URL', playerUrl);
        addLog('PASSO6_PLAYER_HASH', playerHash);
        
        // ==================== PASSO 7: VÍDEO FINAL ====================
        addLog('PASSO7_INICIO', { hash: playerHash });
        
        const videoParams = new URLSearchParams();
        videoParams.append('hash', playerHash);
        videoParams.append('r', BASE_URL);
        
        addLog('PASSO7_PARAMS', videoParams.toString());
        
        const videoStart = Date.now();
        const videoResponse = await fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
            method: 'POST',
            headers: VIDEO_HEADERS,
            body: videoParams.toString()
        });
        const videoTime = Date.now() - videoStart;
        
        addLog('PASSO7_RESPOSTA', {
            status: videoResponse.status,
            ok: videoResponse.ok,
            timeMs: videoTime,
            headers: Object.fromEntries(videoResponse.headers.entries())
        });
        
        if (!videoResponse.ok) {
            const errorText = await videoResponse.text();
            addLog('PASSO7_ERROR', { status: videoResponse.status, body: errorText.substring(0, 500) }, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_VIDEO_FAIL', quality: 0, type: 'debug' }];
        }
        
        const videoData = await videoResponse.json();
        addLog('PASSO7_VIDEO_DATA', videoData);
        
        const finalUrl = videoData.securedLink || videoData.videoSource;
        if (!finalUrl) {
            addLog('PASSO7_FINAL_URL_NAO_ENCONTRADO', videoData, true);
            return [{ name: 'SuperFlix_Debug', title: logs.join(' | '), url: 'DEBUG_NO_FINAL_URL', quality: 0, type: 'debug' }];
        }
        
        // ==================== PASSO 8: SUCESSO ====================
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
        
        const totalTime = Date.now() - startTime;
        addLog('SUCESSO', { 
            totalTimeMs: totalTime, 
            quality, 
            finalUrl: finalUrl.substring(0, 150),
            fullUrlLength: finalUrl.length
        });
        
        // Retorna com TODOS os logs no título
        return [{
            name: 'SuperFlix',
            title: title + ' | ' + logs.join(' | '),
            url: finalUrl,
            quality: quality,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': BROWSER_HEADERS['User-Agent']
            }
        }];
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        addLog('ERRO_CATCH', { 
            message: error.message, 
            stack: error.stack?.substring(0, 300),
            totalTimeMs: totalTime
        }, true);
        
        return [{
            name: 'SuperFlix_Debug',
            title: logs.join(' | '),
            url: 'DEBUG_CATCH_ERROR',
            quality: 0,
            type: 'debug'
        }];
    }
}

module.exports = { getStreams };
