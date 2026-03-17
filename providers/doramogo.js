const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CDN_PROXY = 'https://ondemand.towns3.shop';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.doramogo.net/'
};

const CACHE = {};

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
            headers: HEADERS
        });
        return response.ok || response.status === 206;
    } catch {
        return false;
    }
}

async function getTMDBTitle(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const title = mediaType === 'tv' ? data.name : data.title;

        let ano = null;
        if (mediaType === 'tv' && data.first_air_date) {
            ano = data.first_air_date.substring(0, 4);
        } else if (mediaType === 'movie' && data.release_date) {
            ano = data.release_date.substring(0, 4);
        }

        CACHE[cacheKey] = { title, ano };
        return { title, ano };
    } catch {
        return null;
    }
}

// ===== FUNÇÕES PARA DETECÇÃO DE ANIMES =====

async function isAnime(tmdbId, mediaType) {
    if (mediaType !== 'tv') return false;
    
    const cacheKey = `anime_check_${tmdbId}`;
    if (CACHE[cacheKey] !== undefined) return CACHE[cacheKey];
    
    try {
        // Busca keywords do TMDB
        const url = `${TMDB_BASE_URL}/tv/${tmdbId}/keywords?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return false;
        
        const data = await response.json();
        const keywords = data.results || [];
        
        // Verifica se "anime" está nas keywords
        const hasAnimeKeyword = keywords.some(k => 
            k.name.toLowerCase() === 'anime'
        );
        
        CACHE[cacheKey] = hasAnimeKeyword;
        return hasAnimeKeyword;
    } catch {
        CACHE[cacheKey] = false;
        return false;
    }
}

// ===== FUNÇÕES DO ANILIST PARA ANÁLISE POR DATA =====

async function searchAnilistId(title) {
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.data && data.data.Media ? data.data.Media.id : null;
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
                startDate { year month day }
                episodes
                relations {
                    edges {
                        node {
                            id
                            title { romaji english }
                            startDate { year month day }
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

function dateToTimestamp(date) {
    if (!date || !date.year) return null;
    return new Date(date.year, (date.month || 1) - 1, date.day || 1).getTime();
}

function filterInvalidSeasons(seasons) {
    if (seasons.length <= 2) return seasons;

    const filtered = [];

    for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        const isLastSeason = i === seasons.length - 1;

        if (season.episodes <= 1) {
            if (i > 0 && !isLastSeason) {
                const prevSeason = seasons[i - 1];
                const nextSeason = seasons[i + 1];

                if (prevSeason.episodes > 1 && nextSeason.episodes > 1) {
                    continue;
                }
            }
        }

        filtered.push(season);
    }

    return filtered;
}

async function getAllSeasons(startId) {
    const allSeasons = [];
    const visited = new Set();

    async function followChain(animeId, seasonNum) {
        if (visited.has(animeId)) return;
        visited.add(animeId);

        // Pequeno delay para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 500));

        const anime = await getAnimeDetails(animeId);
        if (!anime) return;

        allSeasons.push({
            id: animeId,
            title: anime.title.romaji || anime.title.english,
            date: dateToTimestamp(anime.startDate),
            season: seasonNum,
            episodes: anime.episodes || 0
        });

        const edges = anime.relations?.edges || [];
        for (const edge of edges) {
            if (edge.relationType === 'SEQUEL') {
                await followChain(edge.node.id, seasonNum + 1);
                break;
            }
        }
    }

    await followChain(startId, 1);

    allSeasons.sort((a, b) => (a.date || 0) - (b.date || 0));

    for (let i = 0; i < allSeasons.length; i++) {
        allSeasons[i].season = i + 1;
    }

    const filteredSeasons = filterInvalidSeasons(allSeasons);

    for (let i = 0; i < filteredSeasons.length; i++) {
        filteredSeasons[i].season = i + 1;
    }

    return filteredSeasons;
}

async function getTMDBEpisodeDate(tmdbId, season, episode) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.air_date ? new Date(data.air_date).getTime() : null;
    } catch {
        return null;
    }
}

function findSeasonByDate(seasons, targetDate) {
    let closest = null;
    let minDiff = Infinity;

    for (const s of seasons) {
        if (!s.date) continue;
        const diff = Math.abs(targetDate - s.date);
        const days = diff / (1000 * 60 * 60 * 24);

        if (days < 180 && diff < minDiff) {
            minDiff = diff;
            closest = s;
        }
    }
    return closest;
}

function analyzeParts(seasons, targetEpisode, episodeDate) {
    const closest = findSeasonByDate(seasons, episodeDate);
    if (!closest) return null;

    const groups = {};
    for (const s of seasons) {
        let base = s.title
            .replace(/[:\s]*(?:Part|Parte)\s*\d+$/i, '')
            .replace(/\s+\d+$/, '')
            .replace(/[:\s]*(?:Season|Cour)\s*\d+$/, '')
            .trim();

        if (base.length < 3) base = s.title;

        if (!groups[base]) groups[base] = [];
        groups[base].push(s);
    }

    for (const base in groups) {
        groups[base].sort((a, b) => (a.date || 0) - (b.date || 0));
    }

    for (const base in groups) {
        const group = groups[base];
        const index = group.findIndex(s => s.id === closest.id);

        if (index !== -1) {
            const hasMultipleParts = group.length > 1;
            const partNumber = index + 1;

            let episodesBefore = 0;
            for (let k = 0; k < index; k++) {
                episodesBefore += group[k].episodes;
            }

            const episodeInPart = targetEpisode - episodesBefore;

            return {
                id: closest.id,
                title: closest.title,
                date: closest.date,
                season: closest.season,
                episodes: closest.episodes,
                baseTitle: base,
                partNumber: partNumber,
                totalParts: group.length,
                hasMultipleParts: hasMultipleParts,
                episodesBefore: episodesBefore,
                episodeInPart: episodeInPart
            };
        }
    }

    return {
        id: closest.id,
        title: closest.title,
        date: closest.date,
        season: closest.season,
        episodes: closest.episodes,
        baseTitle: closest.title,
        partNumber: 1,
        totalParts: 1,
        hasMultipleParts: false,
        episodesBefore: 0,
        episodeInPart: targetEpisode
    };
}

function generateAnimeSlugs(seasonInfo, targetSeason) {
    const slugs = [];

    const baseTitle = seasonInfo.baseTitle || 
                   seasonInfo.title.replace(/[:\s]*(?:Part|Parte)?\s*\d+/i, '').trim();
    const baseSlug = titleToSlug(baseTitle);

    if (seasonInfo.hasMultipleParts) {
        if (seasonInfo.partNumber === 1) {
            slugs.push(baseSlug);
            slugs.push(baseSlug + '-legendado');
            slugs.push(baseSlug + '-dublado');
        } else {
            slugs.push(baseSlug + '-' + seasonInfo.partNumber);
            slugs.push(baseSlug + '-' + seasonInfo.partNumber + '-legendado');
            slugs.push(baseSlug + '-' + seasonInfo.partNumber + '-dublado');
        }
    } else {
        slugs.push(baseSlug);
        slugs.push(baseSlug + '-legendado');
        slugs.push(baseSlug + '-dublado');
        
        if (targetSeason > 1) {
            slugs.push(baseSlug + '-' + targetSeason);
            slugs.push(baseSlug + '-' + targetSeason + '-legendado');
            slugs.push(baseSlug + '-' + targetSeason + '-dublado');
        }
    }

    return [...new Set(slugs)];
}

// ===== FUNÇÃO PRINCIPAL MODIFICADA =====

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    const seasonPadded = targetSeason.toString().padStart(2, '0');
    const timestamp = Date.now();

    const info = await getTMDBTitle(tmdbId, mediaType);
    if (!info) return [];

    const { title, ano } = info;
    
    // Verifica se é anime
    const animeDetected = mediaType === 'tv' ? await isAnime(tmdbId, mediaType) : false;
    
    let slugVariations = [];
    
    if (animeDetected) {
        // MODO ANIME: Usa análise por data para encontrar o título romanji correto
        try {
            const episodeDate = await getTMDBEpisodeDate(tmdbId, targetSeason, targetEpisode);
            
            if (episodeDate) {
                const anilistId = await searchAnilistId(title);
                
                if (anilistId) {
                    const allSeasons = await getAllSeasons(anilistId);
                    
                    if (allSeasons.length) {
                        const seasonInfo = analyzeParts(allSeasons, targetEpisode, episodeDate);
                        
                        if (seasonInfo) {
                            // Gera slugs baseados no título romanji
                            slugVariations = generateAnimeSlugs(seasonInfo, targetSeason);
                            
                            // Se encontrou episodeInPart diferente, ajusta o epPadded
                            if (seasonInfo.episodeInPart && seasonInfo.episodeInPart !== targetEpisode) {
                                // Nota: Não alteramos epPadded aqui porque ele é usado depois
                                // Mas você pode querer usar seasonInfo.episodeInPart para gerar a URL
                                console.log(`Episódio ${targetEpisode} corresponde ao episódio ${seasonInfo.episodeInPart} da parte ${seasonInfo.partNumber}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Se falhar, fallback para o método padrão
            slugVariations = generateSlugVariations(title, targetSeason, ano);
        }
        
        // Se não conseguiu gerar slugs pelo método anime, usa o padrão
        if (slugVariations.length === 0) {
            slugVariations = generateSlugVariations(title, targetSeason, ano);
        }
    } else {
        // MODO PADRÃO: Usa a lógica original para filmes/séries normais
        slugVariations = generateSlugVariations(title, targetSeason, ano);
    }

    const urls = [];
    const seen = new Set();

    for (const slug of slugVariations) {
        const firstLetter = slug.charAt(0).toUpperCase() || 'T';

        if (mediaType === 'movie') {
            const url = CDN_PROXY + '/' + firstLetter + '/' + slug + '/stream/stream.m3u8?nocache=' + timestamp;
            if (!seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        } else {
            const url = CDN_PROXY + '/' + firstLetter + '/' + slug + '/' + seasonPadded + '-temporada/' + epPadded + '/stream.m3u8?nocache=' + timestamp;
            if (!seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        }
    }

    for (const url of urls) {
        if (await testUrl(url)) {
            return [{
                url,
                headers: HEADERS,
                name: animeDetected ? 'Animes 1080p' : 'Doramogo 1080p',
                title: mediaType === 'movie' ? title : `${title} S${targetSeason} EP${targetEpisode}`
            }];
        }
    }

    return [];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
