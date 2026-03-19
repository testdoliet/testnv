// SuperFlixAPI - Conversão direta do script Python
// Para usar no Nuvio

const BASE_URL = "https://warezcdn.site";
const API_OPTIONS = `${BASE_URL}/player/options`;
const API_SOURCE = `${BASE_URL}/player/source`;
const CDN_BASE = "https://llanfairpwllgwyngy.com";

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR',
    'Referer': 'https://lospobreflix.site/',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
};

const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
};

// Cache simples
const CACHE = {};

// ===== FUNÇÕES AUXILIARES (IGUAIS AO PYTHON) =====

function extractFromHTML(html) {
    const data = {};
    
    // ALL_EPISODES
    const epPattern = /var ALL_EPISODES\s*=\s*(\{.*?\});/s;
    const epMatch = html.match(epPattern);
    if (epMatch) {
        try {
            data.episodes = JSON.parse(epMatch[1]);
            console.log("✅ ALL_EPISODES encontrado");
        } catch {
            console.log("❌ Erro ao parsear ALL_EPISODES");
        }
    }
    
    // CSRF_TOKEN
    const csrfPattern = /var CSRF_TOKEN\s*=\s*["']([^"']+)["']/;
    const csrfMatch = html.match(csrfPattern);
    if (csrfMatch) {
        data.csrf_token = csrfMatch[1];
        console.log(`✅ CSRF_TOKEN: ${data.csrf_token}`);
    }
    
    // PAGE_TOKEN
    const pagePattern = /var PAGE_TOKEN\s*=\s*["']([^"']+)["']/;
    const pageMatch = html.match(pagePattern);
    if (pageMatch) {
        data.page_token = pageMatch[1];
        console.log(`✅ PAGE_TOKEN: ${data.page_token.substring(0, 50)}...`);
    }
    
    return data;
}

async function getOptions(contentId, csrf_token, page_token) {
    console.log(`\n🔧 Buscando options para content_id: ${contentId}`);
    
    const params = new URLSearchParams();
    params.append('contentid', contentId);
    params.append('type', 'serie');
    params.append('_token', csrf_token);
    params.append('page_token', page_token);
    params.append('pageToken', page_token);
    
    const headers = {
        ...API_HEADERS,
        'X-Page-Token': page_token,
        'Referer': `${BASE_URL}/serie/1429/1/1`,
    };
    
    try {
        const response = await fetch(API_OPTIONS, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
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

async function getSource(videoId, csrf_token, page_token) {
    console.log(`\n🎬 Buscando source para video_id: ${videoId}`);
    
    const params = new URLSearchParams();
    params.append('video_id', videoId);
    params.append('page_token', page_token);
    params.append('_token', csrf_token);
    
    const headers = {
        ...API_HEADERS,
        'Referer': `${BASE_URL}/serie/1429/1/1`,
    };
    
    try {
        const response = await fetch(API_SOURCE, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            console.log(`❌ Erro: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`📄 Resposta: ${JSON.stringify(data, null, 2)}`);
        
        const video_url = data.data?.video_url;
        if (video_url) {
            console.log(`✅ URL encontrada: ${video_url}`);
            return video_url;
        }
        
        return null;
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return null;
    }
}

async function followRedirect(redirect_url) {
    console.log(`\n🔄 Seguindo redirect: ${redirect_url}`);
    
    try {
        const response = await fetch(redirect_url, {
            method: 'GET',
            headers: HEADERS,
            redirect: 'follow'
        });
        
        console.log(`📊 Status code final: ${response.status}`);
        console.log(`📍 URL final: ${response.url}`);
        
        return response.url;
        
    } catch (e) {
        console.log(`❌ Erro no redirect: ${e.message}`);
        return redirect_url;
    }
}

async function getVideoData(player_hash) {
    console.log(`\n🎯 Obtendo dados do vídeo para hash: ${player_hash}`);
    
    const url = `${CDN_BASE}/player/index.php?data=${player_hash}&do=getVideo`;
    
    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'pt-BR',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': CDN_BASE,
        'Referer': `${CDN_BASE}/`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
    };
    
    const params = new URLSearchParams();
    params.append('hash', player_hash);
    params.append('r', '');
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: params
        });
        
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

// ===== FUNÇÃO PRINCIPAL (MESMA ESTRUTURA DO PYTHON) =====

async function getStreams(tmdb_id, media_type = 'tv', season = 1, episode = 1) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Extraindo: TMDB ID ${tmdb_id} S${season}E${episode}`);
    console.log(`${'='.repeat(70)}`);
    
    // Para filmes, ignorar season/episode
    const targetSeason = media_type === 'movie' ? 1 : season;
    const targetEpisode = media_type === 'movie' ? 1 : episode;
    
    try {
        // 1. Acessar página do player
        const player_url = `${BASE_URL}/serie/${tmdb_id}/${targetSeason}/${targetEpisode}`;
        console.log(`\n🌐 Acessando: ${player_url}`);
        
        const response = await fetch(player_url, {
            method: 'GET',
            headers: HEADERS
        });
        
        console.log(`📊 Status code: ${response.status}`);
        
        if (response.status !== 200) {
            console.log(`❌ Erro: ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        console.log(`✅ Página carregada: ${html.length} caracteres`);
        
        // 2. Extrair tokens e episódios
        const extracted = extractFromHTML(html);
        
        if (!extracted.csrf_token || !extracted.page_token) {
            console.log("❌ Tokens não encontrados");
            return [];
        }
        
        if (!extracted.episodes) {
            console.log("❌ ALL_EPISODES não encontrado");
            return [];
        }
        
        // 3. Encontrar content_id
        const seasonStr = targetSeason.toString();
        if (!extracted.episodes[seasonStr]) {
            console.log(`❌ Temporada ${targetSeason} não encontrada`);
            return [];
        }
        
        let content_id = null;
        for (const ep of extracted.episodes[seasonStr]) {
            if (ep.epi_num === targetEpisode) {
                content_id = ep.ID?.toString();
                console.log(`✅ Content ID encontrado: ${content_id}`);
                break;
            }
        }
        
        if (!content_id) {
            console.log(`❌ Episódio ${targetEpisode} não encontrado`);
            return [];
        }
        
        // 4. Obter options
        const options = await getOptions(content_id, extracted.csrf_token, extracted.page_token);
        
        if (!options || options.length === 0) {
            console.log("❌ Nenhuma opção encontrada");
            return [];
        }
        
        // 5. Usar a primeira opção
        if (options && options.length > 0) {
            const video_id = options[0].ID;
            const redirect_url = await getSource(video_id, extracted.csrf_token, extracted.page_token);
            
            if (redirect_url) {
                // 6. Seguir redirect até o player
                const player_page_url = await followRedirect(redirect_url);
                
                // 7. Extrair hash da URL do player
                const player_hash = player_page_url.split('/').pop();
                console.log(`✅ Hash do player extraído da URL: ${player_hash}`);
                
                // 8. Obter dados do vídeo via POST
                const video_data = await getVideoData(player_hash);
                
                if (video_data) {
                    // 9. Extrair informações
                    const secured_link = video_data.securedLink;
                    const video_source = video_data.videoSource;
                    
                    // 10. URL final
                    const video_url = secured_link || video_source;
                    
                    if (video_url) {
                        // Buscar título do TMDB (opcional)
                        let displayTitle = `TMDB ${tmdb_id}`;
                        if (media_type !== 'movie') {
                            displayTitle = `S${targetSeason}E${targetEpisode}`;
                        }
                        
                        console.log(`\n${'='.repeat(70)}`);
                        console.log("RESULTADO:");
                        console.log(`${'='.repeat(70)}`);
                        console.log(`✅ SUCESSO!`);
                        console.log(`📹 URL do vídeo: ${video_url}`);
                        
                        return [{
                            url: video_url,
                            headers: {
                                'Referer': `${CDN_BASE}/`,
                                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
                            },
                            name: 'SuperFlix 1080p',
                            title: displayTitle
                        }];
                    }
                }
            }
        }
        
        return [];
        
    } catch (e) {
        console.log(`❌ Erro: ${e.message}`);
        return [];
    }
}

// Exportação para Nuvio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
