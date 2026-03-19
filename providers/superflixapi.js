// ==Plugin==
// @name SuperFlixAPI
// @author Seu Nome
// @description Extrai links do SuperFlixAPI via TMDB ID
// @version 1.0.0
// @namespace https://warezcdn.site
// @priority 5
// @nuvio true
// ==/Plugin==

const BASE_URL = 'https://warezcdn.site';
const API_OPTIONS = `${BASE_URL}/player/options`;
const API_SOURCE = `${BASE_URL}/player/source`;
const CDN_BASE = 'https://llanfairpwllgwyngy.com';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://lospobreflix.site/',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1'
};

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`
};

const CACHE = {};

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
            const response = await fetch(url, options);
            if (response.ok) return response;
        } catch (e) {
            console.log(`Tentativa ${i + 1} falhou: ${e.message}`);
        }
        if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
    return null;
}

async function getOptions(contentId, csrfToken, pageToken) {
    console.log(`\n🔧 Buscando options para content_id: ${contentId}`);
    
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
            console.log(`❌ Erro: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`📄 Resposta: ${JSON.stringify(data, null, 2)}`);
        
        const options = data.data?.options || [];
        console.log(`✅ Encontradas ${options.length} opções`);
        
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
            console.log(`❌ Erro: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`📄 Resposta: ${JSON.stringify(data, null, 2)}`);
        
        const videoUrl = data.data?.video_url;
        if (videoUrl) {
            console.log(`✅ URL encontrada: ${videoUrl}`);
            return videoUrl;
        }
        
        return null;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function followRedirect(redirectUrl) {
    console.log(`\n🔄 Seguindo redirect: ${redirectUrl}`);
    
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
        console.log(`📄 Resposta: ${JSON.stringify(data, null, 2)}`);
        
        return data;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Extraindo: TMDB ID ${tmdbId} S${season}E${episode}`);
    console.log(`${'='.repeat(70)}`);
    
    // Para filmes, ignorar season/episode
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
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
        
        // 2. Extrair tokens e episódios
        const extracted = extractFromHTML(html);
        
        if (!extracted.csrfToken || !extracted.pageToken) {
            console.log('❌ Tokens não encontrados');
            return [];
        }
        
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
        
        // 9. Extrair informações
        const securedLink = videoData.securedLink;
        const videoSource = videoData.videoSource;
        const thumb = videoData.videoImage;
        
        // Extrair hash do CDN da URL
        let cdnHash = null;
        if (videoSource) {
            const cdnMatch = videoSource.match(/\/([a-f0-9]{32,})\//);
            if (cdnMatch) {
                cdnHash = cdnMatch[1];
            }
        }
        
        // Buscar título do TMDB para o resultado
        const titleEndpoint = mediaType === 'movie' ? 'movie' : 'tv';
        const titleUrl = `https://api.themoviedb.org/3/${titleEndpoint}/${tmdbId}?api_key=b64d2f3a4212a99d64a7d4485faed7b3&language=pt-BR`;
        
        let displayTitle = `TMDB ${tmdbId}`;
        try {
            const titleResponse = await fetch(titleUrl);
            const titleData = await titleResponse.json();
            if (mediaType === 'movie') {
                displayTitle = titleData.title || displayTitle;
            } else {
                displayTitle = titleData.name || displayTitle;
            }
        } catch (e) {
            console.log(`⚠️ Não foi possível obter título do TMDB: ${e.message}`);
        }
        
        if (mediaType !== 'movie') {
            displayTitle = `${displayTitle} S${targetSeason}E${targetEpisode}`;
        }
        
        console.log(`\n${'='.repeat(70)}`);
        console.log('RESULTADO:');
        console.log(`${'='.repeat(70)}`);
        console.log(`✅ SUCESSO!`);
        console.log(`📹 URL do vídeo: ${securedLink}`);
        
        return [{
            url: securedLink,
            headers: {
                'Referer': `${CDN_BASE}/`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            name: 'SuperFlix 1080p',
            title: displayTitle
        }];
        
    } catch (e) {
        console.log(`❌ Erro geral: ${e.message}`);
        return [];
    }
}

// Suporte para Node.js e ambiente global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
