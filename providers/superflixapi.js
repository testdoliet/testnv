// ==Plugin==
// @name SuperFlixAPI
// @author Seu Nome
// @description Extrai links do SuperFlixAPI via TMDB ID
// @version 3.0.0
// @namespace https://warezcdn.site
// @priority 5
// @nuvio true
// ==/Plugin==

const BASE_URL = 'https://warezcdn.site';
const API_OPTIONS = `${BASE_URL}/player/options`;
const API_SOURCE = `${BASE_URL}/player/source`;
const CDN_BASE = 'https://llanfairpwllgwyngy.com';

// Headers IGUAIS ao Python (completos!)
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR',
    'Referer': 'https://lospobreflix.site/',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0'
};

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'Connection': 'keep-alive'
};

// Cache simples
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Função para simular uma sessão (mantém cookies)
const cookieJar = new Map();

async function fetchWithSession(url, options = {}) {
    const headers = {
        ...options.headers,
        'Cookie': Array.from(cookieJar.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // Salvar cookies da resposta
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        const matches = setCookie.match(/([^=]+)=([^;]+)/);
        if (matches) {
            cookieJar.set(matches[1], matches[2]);
        }
    }
    
    return response;
}

function extractFromHTML(html) {
    const data = {};
    
    // ALL_EPISODES
    const epPattern = /var ALL_EPISODES\s*=\s*(\{.*?\});/s;
    const epMatch = html.match(epPattern);
    if (epMatch) {
        try {
            data.episodes = JSON.parse(epMatch[1]);
            console.log('✅ ALL_EPISODES encontrado');
        } catch (e) {
            console.log('❌ Erro ao parsear ALL_EPISODES');
        }
    }
    
    // CSRF_TOKEN
    const csrfPattern = /var CSRF_TOKEN\s*=\s*["']([^"']+)["']/;
    const csrfMatch = html.match(csrfPattern);
    if (csrfMatch) {
        data.csrfToken = csrfMatch[1];
        console.log(`✅ CSRF_TOKEN: ${data.csrfToken}`);
    }
    
    // PAGE_TOKEN
    const pagePattern = /var PAGE_TOKEN\s*=\s*["']([^"']+)["']/;
    const pageMatch = html.match(pagePattern);
    if (pageMatch) {
        data.pageToken = pageMatch[1];
        console.log(`✅ PAGE_TOKEN: ${data.pageToken.substring(0, 50)}...`);
    }
    
    return data;
}

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetchWithSession(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) return response;
            
            const text = await response.text();
            console.log(`📄 Resposta (${response.status}): ${text.substring(0, 200)}`);
            
            if (response.status === 429) {
                console.log(`⚠️ Rate limit, aguardando ${(i + 1) * 2}s...`);
                await new Promise(r => setTimeout(r, (i + 1) * 2000));
                continue;
            }
            
            // Se for 403/401, pode ser problema de autenticação
            if (response.status === 403 || response.status === 401) {
                console.log('🔐 Possível problema de autenticação');
                return null;
            }
            
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log(`⏱️ Timeout na tentativa ${i + 1}`);
            } else {
                console.log(`❌ Tentativa ${i + 1} falhou: ${e.message}`);
            }
        }
        
        if (i < retries - 1) {
            const waitTime = (i + 1) * 2000;
            console.log(`⏳ Aguardando ${waitTime/1000}s antes da próxima tentativa...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
    return null;
}

async function getOptions(contentId, csrfToken, pageToken) {
    console.log(`\n🔧 Buscando options para content_id: ${contentId}`);
    
    // Verificar cache
    const cacheKey = `options_${contentId}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Usando cache (${Math.round((Date.now() - cached.timestamp) / 1000)}s atrás)`);
        return cached.data;
    }
    
    const params = new URLSearchParams({
        'contentid': contentId,
        'type': 'serie',
        '_token': csrfToken,
        'page_token': pageToken,
        'pageToken': pageToken
    });
    
    const headers = {
        ...API_HEADERS,
        'X-Page-Token': pageToken,
        'Referer': `${BASE_URL}/serie/1429/1/1`
    };
    
    try {
        const response = await fetchWithRetry(API_OPTIONS, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
        if (!response) {
            console.log('❌ Falha na requisição após retries');
            return null;
        }
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            const text = await response.text();
            console.log(`❌ Erro ${response.status}: ${text.substring(0, 200)}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`📄 Resposta recebida`);
        
        const options = data.data?.options || [];
        console.log(`✅ Encontradas ${options.length} opções`);
        
        // Salvar no cache
        CACHE.set(cacheKey, {
            timestamp: Date.now(),
            data: options
        });
        
        return options;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function getSource(videoId, csrfToken, pageToken) {
    console.log(`\n🎬 Buscando source para video_id: ${videoId}`);
    
    const params = new URLSearchParams({
        'video_id': videoId,
        'page_token': pageToken,
        '_token': csrfToken
    });
    
    const headers = {
        ...API_HEADERS,
        'Referer': `${BASE_URL}/serie/1429/1/1`
    };
    
    try {
        const response = await fetchWithRetry(API_SOURCE, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
        if (!response) {
            console.log('❌ Falha na requisição após retries');
            return null;
        }
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            const text = await response.text();
            console.log(`❌ Erro ${response.status}: ${text.substring(0, 200)}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`📄 Resposta recebida`);
        
        const videoUrl = data.data?.video_url;
        if (videoUrl) {
            console.log(`✅ URL encontrada: ${videoUrl.substring(0, 100)}...`);
            return videoUrl;
        }
        
        console.log('❌ video_url não encontrado na resposta');
        return null;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function followRedirect(redirectUrl) {
    console.log(`\n🔄 Seguindo redirect: ${redirectUrl.substring(0, 100)}...`);
    
    try {
        const response = await fetchWithRetry(redirectUrl, {
            method: 'GET',
            headers: HEADERS,
            redirect: 'follow'
        });
        
        if (!response) {
            console.log('❌ Falha no redirect');
            return redirectUrl;
        }
        
        console.log(`📊 Status code final: ${response.status}`);
        console.log(`📍 URL final: ${response.url}`);
        
        return response.url;
        
    } catch (e) {
        console.log(`❌ Erro no redirect: ${e.message}`);
        return redirectUrl;
    }
}

async function getVideoData(playerHash) {
    console.log(`\n🎯 Obtendo dados do vídeo para hash: ${playerHash}`);
    
    const url = `${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`;
    
    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'pt-BR',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': CDN_BASE,
        'Referer': `${CDN_BASE}/`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
    };
    
    const params = new URLSearchParams({
        'hash': playerHash,
        'r': ''
    });
    
    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
        if (!response) {
            console.log('❌ Falha na requisição de dados do vídeo');
            return null;
        }
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            console.log(`❌ Erro: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`✅ Dados do vídeo obtidos!`);
        
        return data;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function getTMDBTitle(tmdbId, mediaType) {
    const API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${API_KEY}&language=pt-BR`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return mediaType === 'movie' ? data.title : data.name;
    } catch {
        return null;
    }
}

async function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Extraindo: TMDB ID ${tmdbId} S${season}E${episode}`);
    console.log(`${'='.repeat(70)}`);
    
    // Limpar cookies a cada nova busca (simula nova sessão)
    cookieJar.clear();
    
    // Para filmes, ignorar season/episode
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
    // Buscar título do TMDB
    const tmdbTitle = await getTMDBTitle(tmdbId, mediaType);
    const displayTitle = mediaType === 'movie' 
        ? tmdbTitle || `TMDB ${tmdbId}`
        : `${tmdbTitle || `TMDB ${tmdbId}`} S${targetSeason}E${targetEpisode}`;
    
    // 1. Acessar página do player
    const playerUrl = `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`;
    console.log(`\n🌐 Acessando: ${playerUrl}`);
    
    try {
        const response = await fetchWithRetry(playerUrl, {
            method: 'GET',
            headers: HEADERS
        });
        
        if (!response) {
            console.log('❌ Falha ao acessar página do player');
            return [];
        }
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            console.log(`❌ Erro: ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        console.log(`✅ Página carregada: ${html.length} caracteres`);
        
        // Verificar se caiu na página de embed
        if (html.includes('Visualização Externa') || html.includes('Acesso Restrito')) {
            console.log('⚠️ Página de embed detectada! Tentando novamente com headers diferentes...');
            
            // Tentar com headers mais completos
            const altHeaders = {
                ...HEADERS,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            };
            
            const retryResponse = await fetchWithRetry(playerUrl, {
                method: 'GET',
                headers: altHeaders
            });
            
            if (!retryResponse) {
                console.log('❌ Falha na segunda tentativa');
                return [];
            }
            
            const retryHtml = await retryResponse.text();
            console.log(`✅ Segunda tentativa: ${retryHtml.length} caracteres`);
            
            // Extrair tokens do HTML da segunda tentativa
            const extracted = extractFromHTML(retryHtml);
            
            if (!extracted.csrfToken || !extracted.pageToken) {
                console.log('❌ Tokens não encontrados mesmo na segunda tentativa');
                return [];
            }
            
            // Continuar com os tokens extraídos
            return await processWithTokens(extracted, targetSeason, targetEpisode, displayTitle);
        }
        
        // 2. Extrair tokens e episódios
        const extracted = extractFromHTML(html);
        
        if (!extracted.csrfToken || !extracted.pageToken) {
            console.log('❌ Tokens não encontrados');
            return [];
        }
        
        return await processWithTokens(extracted, targetSeason, targetEpisode, displayTitle);
        
    } catch (e) {
        console.log(`❌ Erro geral: ${e.message}`);
        if (e.stack) console.log(e.stack);
        return [];
    }
}

async function processWithTokens(extracted, targetSeason, targetEpisode, displayTitle) {
    if (!extracted.episodes) {
        console.log('❌ ALL_EPISODES não encontrado');
        return [];
    }
    
    // 3. Encontrar content_id
    const seasonStr = targetSeason.toString();
    if (!extracted.episodes[seasonStr]) {
        console.log(`❌ Temporada ${targetSeason} não encontrada`);
        return [];
    }
    
    let contentId = null;
    for (const ep of extracted.episodes[seasonStr]) {
        if (ep.epi_num === targetEpisode) {
            contentId = ep.ID.toString();
            console.log(`✅ Content ID encontrado: ${contentId}`);
            break;
        }
    }
    
    if (!contentId) {
        console.log(`❌ Episódio ${targetEpisode} não encontrado`);
        return [];
    }
    
    // 4. Obter options
    const options = await getOptions(contentId, extracted.csrfToken, extracted.pageToken);
    
    if (!options || options.length === 0) {
        console.log('❌ Nenhuma opção encontrada');
        return [];
    }
    
    // 5. Usar a primeira opção
    const videoId = options[0].ID;
    const redirectUrl = await getSource(videoId, extracted.csrfToken, extracted.pageToken);
    
    if (!redirectUrl) {
        console.log('❌ Não foi possível obter URL de redirect');
        return [];
    }
    
    // 6. Seguir redirect até o player
    const playerPageUrl = await followRedirect(redirectUrl);
    
    // 7. Extrair hash da URL do player
    const playerHash = playerPageUrl.split('/').pop();
    console.log(`✅ Hash do player extraído da URL: ${playerHash}`);
    
    // 8. Obter dados do vídeo via POST
    const videoData = await getVideoData(playerHash);
    
    if (!videoData) {
        console.log('❌ Não foi possível obter dados do vídeo');
        return [];
    }
    
    // 9. Extrair URL do vídeo
    const videoUrl = videoData.securedLink || videoData.videoSource;
    
    if (!videoUrl) {
        console.log('❌ Nenhuma URL de vídeo encontrada na resposta');
        return [];
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ SUCESSO!');
    console.log(`📹 URL: ${videoUrl}`);
    
    // 10. Retornar no formato do Nuvio
    return [{
        url: videoUrl,
        headers: {
            'Referer': `${CDN_BASE}/`,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
        },
        name: 'SuperFlix 1080p',
        title: displayTitle
    }];
}

// Suporte para Node.js e ambiente global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
