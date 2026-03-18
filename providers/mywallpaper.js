const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CDN_BASE = 'https://cdn-s01.mywallpaper-4k-image.net';

// ==================== FUNÇÕES UTILITÁRIAS BÁSICAS ====================

function titleToSlug(title) {
    if (!title) return '';
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function testUrl(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return response.ok || response.status === 206;
    } catch (error) {
        return false;
    }
}

// ==================== FUNÇÕES TMDB ====================

async function getTMDBSeasonName(tmdbId, seasonNumber) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.name || null;
    } catch {
        return null;
    }
}

async function getTMDBOriginalTitle(tmdbId) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.original_name || data.name || null;
    } catch {
        return null;
    }
}

// ==================== FUNÇÕES ANILIST ====================

async function searchAnilistByTitle(searchQuery) {
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
                title { romaji english }
                episodes
                relations {
                    edges {
                        node {
                            id
                            title { romaji english }
                            episodes
                        }
                        relationType
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: searchQuery } })
        });
        
        if (!response.ok) return null;
        const data = await response.json();
        return data.data ? data.data.Media : null;
    } catch {
        return null;
    }
}

async function getAnimeDetails(animeId) {
    const query = `
        query ($id: Int) {
            Media(id: $id) {
                id
                title { romaji english }
                episodes
                relations {
                    edges {
                        node {
                            id
                            title { romaji english }
                            episodes
                        }
                        relationType
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: animeId } })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.data ? data.data.Media : null;
    } catch {
        return null;
    }
}

// ==================== FUNÇÕES DE ANÁLISE DE PARTES ====================

async function getAllPartsFromSequel(initialAnime) {
    const allParts = [];
    const visited = new Set();
    
    async function followChain(anime, partNum) {
        if (!anime || visited.has(anime.id)) return;
        visited.add(anime.id);
        
        allParts.push({
            id: anime.id,
            title: anime.title.romaji || anime.title.english,
            episodes: anime.episodes || 0,
            partNumber: partNum
        });
        
        const edges = anime.relations?.edges || [];
        for (const edge of edges) {
            if (edge.relationType === 'SEQUEL') {
                const nextAnime = await getAnimeDetails(edge.node.id);
                if (nextAnime) {
                    await followChain(nextAnime, partNum + 1);
                    break;
                }
            }
        }
    }
    
    await followChain(initialAnime, 1);
    return allParts;
}

function findTargetPart(parts, targetEpisode) {
    if (!parts || parts.length === 0) return null;
    
    // Ordena por número da parte
    parts.sort((a, b) => a.partNumber - b.partNumber);
    
    let episodesBefore = 0;
    for (const part of parts) {
        if (targetEpisode <= episodesBefore + part.episodes) {
            // Episódio está nesta parte
            return {
                ...part,
                episodeInPart: targetEpisode - episodesBefore,
                episodesBefore: episodesBefore,
                totalParts: parts.length
            };
        }
        episodesBefore += part.episodes;
    }
    
    return null;
}

// ==================== FUNÇÕES DE GERAÇÃO DE SLUGS ====================

function generateSeasonSlugs(romajiSlug, seasonNumber) {
    if (seasonNumber < 2) return [romajiSlug]; // Season 1 só o slug base
    
    const variations = [];
    const seen = new Set();
    
    function add(slug) {
        if (!seen.has(slug)) {
            seen.add(slug);
            variations.push(slug);
        }
    }
    
    // Mapeamento de números ordinais
    const ordinalMap = {
        2: { word: 'second', suffix: '2nd' },
        3: { word: 'third', suffix: '3rd' },
        4: { word: 'fourth', suffix: '4th' },
        5: { word: 'fifth', suffix: '5th' },
        6: { word: 'sixth', suffix: '6th' },
        7: { word: 'seventh', suffix: '7th' },
        8: { word: 'eighth', suffix: '8th' },
        9: { word: 'ninth', suffix: '9th' },
        10: { word: 'tenth', suffix: '10th' }
    };
    
    const ordinal = ordinalMap[seasonNumber];
    
    if (ordinal) {
        // 1. Apenas com o número
        add(`${romajiSlug}-${seasonNumber}`);
        
        // 2. Com "season" + número
        add(`${romajiSlug}-season-${seasonNumber}`);
        
        // 3. Com ordinal por extenso + "season"
        add(`${romajiSlug}-${ordinal.word}-season`);
        
        // 4. Com ordinal abreviado + "season"
        add(`${romajiSlug}-${ordinal.suffix}-season`);
    }
    
    return variations;
}

function generatePartSlugs(romajiSlug, partInfo) {
    if (!partInfo) return [];
    
    const variations = [];
    const seen = new Set();
    
    function add(slug) {
        if (!seen.has(slug)) {
            seen.add(slug);
            variations.push(slug);
        }
    }
    
    // Slug base da parte (usa o título completo da parte)
    const partSlug = titleToSlug(partInfo.title);
    add(partSlug);
    
    // Se tem múltiplas partes, também tenta com -part-{numero}
    if (partInfo.totalParts > 1) {
        add(`${romajiSlug}-part-${partInfo.partNumber}`);
    }
    
    return variations;
}

// ==================== FUNÇÃO PRINCIPAL ====================

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    
    try {
        let validStreams = [];
        
        // ========== PASSO 1: PEGAR NOMES DO TMDB ==========
        const tmdbOriginalTitle = await getTMDBOriginalTitle(tmdbId);
        const tmdbSeasonName = await getTMDBSeasonName(tmdbId, targetSeason);
        
        if (!tmdbOriginalTitle) return [];
        
        // ========== PASSO 2: PESQUISAR NO ANILIST ==========
        // Tenta pesquisa com título original + nome da temporada
        let anilistData = null;
        
        if (tmdbSeasonName && tmdbSeasonName !== tmdbOriginalTitle) {
            // Ex: "Dr. Stone" + "NEW WORLD"
            anilistData = await searchAnilistByTitle(`${tmdbOriginalTitle} ${tmdbSeasonName}`);
        }
        
        // Se não achou, tenta só com o título original
        if (!anilistData) {
            anilistData = await searchAnilistByTitle(tmdbOriginalTitle);
        }
        
        if (!anilistData) return [];
        
        const romajiTitle = anilistData.title?.romaji || anilistData.title?.english;
        if (!romajiTitle) return [];
        
        const romajiSlug = titleToSlug(romajiTitle);
        
        // ========== PASSO 3: TESTAR SLUG BASE (PRIMEIRA TEMPORADA) ==========
        const firstLetter = romajiSlug.charAt(0) || 't';
        
        // Testa legendado
        const legBaseUrl = `${CDN_BASE}/stream/${firstLetter}/${romajiSlug}/${epPadded}.mp4/index.m3u8`;
        if (await testUrl(legBaseUrl)) {
            validStreams.push({
                url: legBaseUrl,
                name: `My Wallpaper Legendado 1080p`,
                title: `${romajiTitle} EP${targetEpisode}`,
                quality: 1080,
                type: 'hls'
            });
        }
        
        // Testa dublado
        const dubBaseUrl = `${CDN_BASE}/stream/${firstLetter}/${romajiSlug}-dublado/${epPadded}.mp4/index.m3u8`;
        if (await testUrl(dubBaseUrl)) {
            validStreams.push({
                url: dubBaseUrl,
                name: `My Wallpaper Dublado 1080p`,
                title: `${romajiTitle} EP${targetEpisode}`,
                quality: 1080,
                type: 'hls'
            });
        }
        
        // Se já achou, retorna
        if (validStreams.length > 0) {
            return validStreams;
        }
        
        // ========== PASSO 4: SE FOR TEMPORADA 2+, TESTAR VARIAÇÕES ==========
        if (targetSeason >= 2) {
            const seasonVariations = generateSeasonSlugs(romajiSlug, targetSeason);
            
            for (const slug of seasonVariations) {
                const firstLetter = slug.charAt(0) || 't';
                
                // Testa legendado
                const legUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}/${epPadded}.mp4/index.m3u8`;
                if (await testUrl(legUrl)) {
                    validStreams.push({
                        url: legUrl,
                        name: `My Wallpaper Legendado 1080p`,
                        title: `${romajiTitle} S${targetSeason} EP${targetEpisode}`,
                        quality: 1080,
                        type: 'hls'
                    });
                }
                
                // Testa dublado
                const dubUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}-dublado/${epPadded}.mp4/index.m3u8`;
                if (await testUrl(dubUrl)) {
                    validStreams.push({
                        url: dubUrl,
                        name: `My Wallpaper Dublado 1080p`,
                        title: `${romajiTitle} S${targetSeason} EP${targetEpisode}`,
                        quality: 1080,
                        type: 'hls'
                    });
                }
                
                if (validStreams.length > 0) break;
            }
        }
        
        // Se já achou, retorna
        if (validStreams.length > 0) {
            return validStreams;
        }
        
        // ========== PASSO 5: ANÁLISE DE PARTES ==========
        // Pega todas as partes via relações SEQUEL
        const allParts = await getAllPartsFromSequel(anilistData);
        
        if (allParts.length > 0) {
            // Encontra em qual parte cai o episódio alvo
            const targetPart = findTargetPart(allParts, targetEpisode);
            
            if (targetPart) {
                const partSlugs = generatePartSlugs(romajiSlug, targetPart);
                const partEpPadded = targetPart.episodeInPart.toString().padStart(2, '0');
                
                for (const slug of partSlugs) {
                    const firstLetter = slug.charAt(0) || 't';
                    
                    // Testa legendado
                    const legUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}/${partEpPadded}.mp4/index.m3u8`;
                    if (await testUrl(legUrl)) {
                        validStreams.push({
                            url: legUrl,
                            name: `My Wallpaper Legendado 1080p`,
                            title: `${targetPart.title} EP${targetPart.episodeInPart} (Parte ${targetPart.partNumber})`,
                            quality: 1080,
                            type: 'hls'
                        });
                    }
                    
                    // Testa dublado
                    const dubUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}-dublado/${partEpPadded}.mp4/index.m3u8`;
                    if (await testUrl(dubUrl)) {
                        validStreams.push({
                            url: dubUrl,
                            name: `My Wallpaper Dublado 1080p`,
                            title: `${targetPart.title} EP${targetPart.episodeInPart} (Parte ${targetPart.partNumber})`,
                            quality: 1080,
                            type: 'hls'
                        });
                    }
                    
                    if (validStreams.length > 0) break;
                }
            }
        }
        
        validStreams.sort((a, b) => b.quality - a.quality);
        return validStreams;
        
    } catch (error) {
        console.error('Erro em getStreams:', error);
        return [];
    }
}

// ==================== EXPORTS ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
