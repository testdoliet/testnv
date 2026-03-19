// providers/superflix.js
// SuperFlixAPI Provider for Nuvio

const BASE_URL = "https://warezcdn.site";
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

function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[SuperFlix] Fetching ${mediaType} ${tmdbId} S${season}E${episode}`);
    
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    
    // 1. Acessar página do player
    return fetch(`${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`, { headers: HEADERS })
        .then(function(response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.text();
        })
        .then(function(html) {
            console.log(`[SuperFlix] Page loaded: ${html.length} chars`);
            
            // Extrair CSRF_TOKEN
            const csrfMatch = html.match(/var CSRF_TOKEN\s*=\s*["']([^"']+)["']/);
            if (!csrfMatch) throw new Error('CSRF_TOKEN not found');
            const csrfToken = csrfMatch[1];
            
            // Extrair PAGE_TOKEN
            const pageMatch = html.match(/var PAGE_TOKEN\s*=\s*["']([^"']+)["']/);
            if (!pageMatch) throw new Error('PAGE_TOKEN not found');
            const pageToken = pageMatch[1];
            
            // Extrair ALL_EPISODES
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
            
            // 2. Obter options
            const optionsParams = new URLSearchParams();
            optionsParams.append('contentid', contentId);
            optionsParams.append('type', 'serie');
            optionsParams.append('_token', csrfToken);
            optionsParams.append('page_token', pageToken);
            optionsParams.append('pageToken', pageToken);
            
            const optionsHeaders = {
                ...API_HEADERS,
                'X-Page-Token': pageToken,
                'Referer': `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`
            };
            
            return fetch(`${BASE_URL}/player/options`, {
                method: 'POST',
                headers: optionsHeaders,
                body: optionsParams
            })
            .then(function(res) {
                if (!res.ok) throw new Error(`Options failed: ${res.status}`);
                return res.json();
            })
            .then(function(data) {
                const videoId = data?.data?.options?.[0]?.ID;
                if (!videoId) throw new Error('No video ID found');
                console.log(`[SuperFlix] Video ID: ${videoId}`);
                
                // 3. Obter source
                const sourceParams = new URLSearchParams();
                sourceParams.append('video_id', videoId);
                sourceParams.append('page_token', pageToken);
                sourceParams.append('_token', csrfToken);
                
                const sourceHeaders = {
                    ...API_HEADERS,
                    'Referer': `${BASE_URL}/serie/${tmdbId}/${targetSeason}/${targetEpisode}`
                };
                
                return fetch(`${BASE_URL}/player/source`, {
                    method: 'POST',
                    headers: sourceHeaders,
                    body: sourceParams
                })
                .then(function(res) {
                    if (!res.ok) throw new Error(`Source failed: ${res.status}`);
                    return res.json();
                })
                .then(function(data) {
                    const redirectUrl = data?.data?.video_url;
                    if (!redirectUrl) throw new Error('No redirect URL');
                    console.log(`[SuperFlix] Redirect obtained`);
                    
                    // 4. Seguir redirect
                    return fetch(redirectUrl, {
                        method: 'GET',
                        headers: HEADERS,
                        redirect: 'follow'
                    })
                    .then(function(res) {
                        const playerUrl = res.url;
                        const playerHash = playerUrl.split('/').pop();
                        console.log(`[SuperFlix] Player hash: ${playerHash}`);
                        
                        // 5. Obter dados do vídeo
                        const videoParams = new URLSearchParams();
                        videoParams.append('hash', playerHash);
                        videoParams.append('r', '');
                        
                        const videoHeaders = {
                            'Accept': '*/*',
                            'Accept-Language': 'pt-BR',
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Origin': CDN_BASE,
                            'Referer': `${CDN_BASE}/`,
                            'X-Requested-With': 'XMLHttpRequest',
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
                        };
                        
                        return fetch(`${CDN_BASE}/player/index.php?data=${playerHash}&do=getVideo`, {
                            method: 'POST',
                            headers: videoHeaders,
                            body: videoParams
                        })
                        .then(function(res) {
                            if (!res.ok) throw new Error(`Video data failed: ${res.status}`);
                            return res.json();
                        })
                        .then(function(videoData) {
                            const finalUrl = videoData.securedLink || videoData.videoSource;
                            if (!finalUrl) throw new Error('No video URL found');
                            
                            console.log(`[SuperFlix] SUCCESS!`);
                            
                            // Determinar qualidade
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
                            
                            // Retornar array com um stream
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
                        });
                    });
                });
            });
        })
        .catch(function(error) {
            console.error('[SuperFlix] Error:', error.message);
            return []; // Sempre retornar array vazio em caso de erro
        });
}

module.exports = { getStreams };
