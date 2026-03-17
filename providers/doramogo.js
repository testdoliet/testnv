const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CDN_PROXY = 'https://ondemand.towns3.shop';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.doramogo.net/'
};

const CACHE = {};

// Função de debug condicional
function debugLog(...args) {
    if (global.DEBUG_MODE || process.env.DEBUG === 'true') {
        console.log('[DEBUG]', ...args);
    }
}

function titleToSlug(title) {
    if (!title) return '';
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function testUrl(url) {
    debugLog(`Testando URL: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: HEADERS
        });
        const ok = response.ok || response.status === 206;
        debugLog(`URL ${url}: ${ok ? '✅' : '❌'} (${response.status})`);
        return ok;
    } catch (error) {
        debugLog(`URL ${url}: ❌ Erro - ${error.message}`);
        return false;
    }
}

async function getTMDBTitle(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    if (CACHE[cacheKey]) {
        debugLog(`Cache hit para TMDB ID ${tmdbId}`);
        return CACHE[cacheKey];
    }

    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;

    debugLog(`Buscando título TMDB: ${url}`);

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

        debugLog(`Título encontrado: "${title}" (${ano || 'sem ano'})`);

        CACHE[cacheKey] = { title, ano };
        return { title, ano };
    } catch (error) {
        debugLog(`Erro ao buscar título TMDB: ${error.message}`);
        return null;
    }
}

// ===== FUNÇÕES PARA DETECÇÃO DE ANIMES =====

async function isAnime(tmdbId, mediaType) {
    if (mediaType !== 'tv') {
        debugLog(`MediaType ${mediaType} não é tv, ignorando detecção de anime`);
        return false;
    }
    
    const cacheKey = `anime_check_${tmdbId}`;
    if (CACHE[cacheKey] !== undefined) {
        debugLog(`Cache hit para anime check: ${CACHE[cacheKey]}`);
        return CACHE[cacheKey];
    }
    
    debugLog(`Verificando se TMDB ID ${tmdbId} é anime...`);
    
    try {
        // Busca keywords do TMDB
        const url = `${TMDB_BASE_URL}/tv/${tmdbId}/keywords?api_key=${TMDB_API_KEY}`;
        debugLog(`Buscando keywords: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            debugLog(`Erro na resposta das keywords: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        const keywords = data.results || [];
        
        debugLog(`Keywords encontradas: ${keywords.map(k => k.name).join(', ') || 'nenhuma'}`);
        
        // Verifica se "anime" está nas keywords
        const hasAnimeKeyword = keywords.some(k => 
            k.name.toLowerCase() === 'anime'
        );
        
        debugLog(`Tem keyword "anime"? ${hasAnimeKeyword ? '✅ SIM' : '❌ NÃO'}`);
        
        CACHE[cacheKey] = hasAnimeKeyword;
        return hasAnimeKeyword;
    } catch (error) {
        debugLog(`Erro na verificação de anime: ${error.message}`);
        CACHE[cacheKey] = false;
        return false;
    }
}

// ===== FUNÇÕES DO ANILIST PARA ANÁLISE POR DATA =====

async function searchAnilistId(title) {
    debugLog(`Buscando ID no AniList para título: "${title}"`);
    
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
                title { romaji english }
            }
        }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });

        if (!response.ok) {
            debugLog(`Erro na resposta do AniList: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const id = data.data?.Media?.id;
        
        if (id) {
            debugLog(`AniList ID encontrado: ${id}`);
            debugLog(`Título AniList: ${data.data.Media.title.romaji || data.data.Media.title.english}`);
        } else {
            debugLog(`Nenhum ID encontrado no AniList`);
        }
        
        return id;
    } catch (error) {
        debugLog(`Erro na busca do AniList: ${error.message}`);
        return null;
    }
}

async function getAnimeDetails(animeId) {
    debugLog(`Buscando detalhes do anime ID: ${animeId}`);
    
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

        if (!response.ok) {
            debugLog(`Erro na resposta dos detalhes: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const media = data.data?.Media;
        
        if (media) {
            debugLog(`Detalhes obtidos: ${media.title.romaji || media.title.english}`);
            if (media.relations?.edges?.length) {
                debugLog(`Relações encontradas: ${media.relations.edges.length}`);
            }
        }
        
        return media;
    } catch (error) {
        debugLog(`Erro nos detalhes do anime: ${error.message}`);
        return null;
    }
}

function dateToTimestamp(date) {
    if (!date || !date.year) return null;
    return new Date(date.year, (date.month || 1) - 1, date.day || 1).getTime();
}

function filterInvalidSeasons(seasons) {
    debugLog(`Filtrando temporadas inválidas. Total: ${seasons.length}`);
    
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
                    debugLog(`Removendo temporada inválida: ${season.title} (${season.episodes} eps)`);
                    continue;
                }
            }
        }

        filtered.push(season);
    }

    debugLog(`Temporadas após filtro: ${filtered.length}`);
    return filtered;
}

async function getAllSeasons(startId) {
    debugLog(`Iniciando busca de todas as temporadas a partir do ID: ${startId}`);
    
    const allSeasons = [];
    const visited = new Set();

    async function followChain(animeId, seasonNum) {
        if (visited.has(animeId)) {
            debugLog(`ID ${animeId} já visitado, ignorando`);
            return;
        }
        visited.add(animeId);

        debugLog(`Buscando temporada ${seasonNum} (ID: ${animeId})...`);

        // Pequeno delay para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 500));

        const anime = await getAnimeDetails(animeId);
        if (!anime) return;

        const seasonData = {
            id: animeId,
            title: anime.title.romaji || anime.title.english,
            date: dateToTimestamp(anime.startDate),
            season: seasonNum,
            episodes: anime.episodes || 0
        };
        
        debugLog(`Temporada ${seasonNum}: "${seasonData.title}" (${seasonData.episodes} eps)`);
        allSeasons.push(seasonData);

        const edges = anime.relations?.edges || [];
        for (const edge of edges) {
            if (edge.relationType === 'SEQUEL') {
                debugLog(`Encontrada sequência: ${edge.relationType}`);
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

    debugLog(`Total de temporadas encontradas: ${filteredSeasons.length}`);
    return filteredSeasons;
}

async function getTMDBEpisodeDate(tmdbId, season, episode) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    debugLog(`Buscando data do episódio: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            debugLog(`Erro ao buscar data do episódio: ${response.status}`);
            return null;
        }
        const data = await response.json();
        const date = data.air_date ? new Date(data.air_date).getTime() : null;
        debugLog(`Data do episódio: ${data.air_date || 'não disponível'}`);
        return date;
    } catch (error) {
        debugLog(`Erro na data do episódio: ${error.message}`);
        return null;
    }
}

function findSeasonByDate(seasons, targetDate) {
    debugLog(`Procurando temporada pela data: ${new Date(targetDate).toISOString()}`);
    
    let closest = null;
    let minDiff = Infinity;

    for (const s of seasons) {
        if (!s.date) continue;
        const diff = Math.abs(targetDate - s.date);
        const days = diff / (1000 * 60 * 60 * 24);

        if (days < 180 && diff < minDiff) {
            minDiff = diff;
            closest = s;
            debugLog(`Candidato: "${s.title}" (diferença: ${Math.round(days)} dias)`);
        }
    }
    
    if (closest) {
        debugLog(`Temporada selecionada: "${closest.title}"`);
    } else {
        debugLog(`Nenhuma temporada encontrada dentro do limite de 180 dias`);
    }
    
    return closest;
}

function analyzeParts(seasons, targetEpisode, episodeDate) {
    debugLog(`Analisando partes para episódio ${targetEpisode} com data ${new Date(episodeDate).toISOString()}`);
    
    const closest = findSeasonByDate(seasons, episodeDate);
    if (!closest) return null;

    // Agrupa por título base (remove apenas sufixos de parte, mantém número da temporada)
    const groups = {};
    for (const s of seasons) {
        // Remove apenas "Part X", "Parte X", "Cour X" do final, mas mantém "Season X"
        let base = s.title
            .replace(/[:\s]*(?:Part|Parte)\s*\d+$/i, '')
            .replace(/[:\s]*(?:Cour)\s*\d+$/i, '')
            .trim();

        if (base.length < 3) base = s.title;

        if (!groups[base]) groups[base] = [];
        groups[base].push(s);
    }

    debugLog(`Grupos encontrados: ${Object.keys(groups).length}`);

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

            debugLog(`Parte encontrada: ${partNumber} de ${group.length}`);
            debugLog(`Episódios antes: ${episodesBefore}, episódio na parte: ${episodeInPart}`);

            return {
                id: closest.id,
                title: closest.title,           // Título ORIGINAL completo
                date: closest.date,
                season: closest.season,
                episodes: closest.episodes,
                baseTitle: base,                 // Título base para agrupamento
                partNumber: partNumber,
                totalParts: group.length,
                hasMultipleParts: hasMultipleParts,
                episodesBefore: episodesBefore,
                episodeInPart: episodeInPart
            };
        }
    }

    // Fallback
    debugLog(`Usando fallback - temporada única`);
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
    debugLog(`Gerando slugs para anime. Título original: "${seasonInfo.title}"`);
    
    const slugs = [];
    const seen = new Set();
    
    function addSlug(slug) {
        if (!seen.has(slug)) {
            seen.add(slug);
            slugs.push(slug);
            debugLog(`  Slug adicionado: ${slug}`);
        } else {
            debugLog(`  Slug duplicado ignorado: ${slug}`);
        }
    }
    
    // ===== PRIORIDADE 1: Título ORIGINAL completo =====
    const originalSlug = titleToSlug(seasonInfo.title);
    addSlug(originalSlug);
    addSlug(originalSlug + '-legendado');
    addSlug(originalSlug + '-dublado');
    
    // ===== PRIORIDADE 2: Base title (se diferente) =====
    const baseSlug = titleToSlug(seasonInfo.baseTitle);
    if (baseSlug !== originalSlug) {
        addSlug(baseSlug);
        addSlug(baseSlug + '-legendado');
        addSlug(baseSlug + '-dublado');
    }
    
    // ===== PRIORIDADE 3: Converter números ordinais para extenso =====
    // 2nd → second, 3rd → third, 4th → fourth
    if (originalSlug.includes('2nd')) {
        const extensoSlug = originalSlug.replace('2nd', 'second');
        addSlug(extensoSlug);
        addSlug(extensoSlug + '-legendado');
        addSlug(extensoSlug + '-dublado');
    }
    if (originalSlug.includes('3rd')) {
        const extensoSlug = originalSlug.replace('3rd', 'third');
        addSlug(extensoSlug);
        addSlug(extensoSlug + '-legendado');
        addSlug(extensoSlug + '-dublado');
    }
    if (originalSlug.includes('4th')) {
        const extensoSlug = originalSlug.replace('4th', 'fourth');
        addSlug(extensoSlug);
        addSlug(extensoSlug + '-legendado');
        addSlug(extensoSlug + '-dublado');
    }
    
    // ===== PRIORIDADE 4: Variações específicas para Haikyuu =====
    // Caso especial: "haikyuu-2nd-season" → "haikyuu-second-season"
    if (originalSlug.includes('haikyuu') && originalSlug.includes('2nd')) {
        addSlug('haikyuu-second-season');
        addSlug('haikyuu-second-season-legendado');
        addSlug('haikyuu-second-season-dublado');
    }
    
    // ===== PRIORIDADE 5: Variação com "season-X" APENAS se necessário =====
    // Só adiciona se o título NÃO contém "season" e a temporada é > 1
    if (!originalSlug.includes('season') && targetSeason > 1) {
        // Não adiciona "season-2" se já tem "2nd"
        if (!originalSlug.includes('2nd') && !originalSlug.includes('3rd') && !originalSlug.includes('4th')) {
            addSlug(originalSlug + '-season-' + targetSeason);
            addSlug(originalSlug + '-season-' + targetSeason + '-legendado');
            addSlug(originalSlug + '-season-' + targetSeason + '-dublado');
        }
    }

    debugLog(`Total de slugs gerados: ${slugs.length}`);
    return slugs;
}

function generateSlugVariations(baseTitle, season, ano) {
    const baseSlug = titleToSlug(baseTitle);
    const variations = [];
    const seen = {};

    function add(slug) {
        if (!seen[slug]) {
            seen[slug] = true;
            variations.push(slug);
        }
    }

    const words = baseSlug.split('-');

    add(baseSlug);

    if (ano) add(baseSlug + '-' + ano);

    add(baseSlug + '-legendado');
    add(baseSlug + '-dublado');

    if (ano) {
        add(baseSlug + '-' + ano + '-legendado');
        add(baseSlug + '-' + ano + '-dublado');
    }

    if (season > 1) {
        add(baseSlug + '-' + season);
        if (ano) add(baseSlug + '-' + ano + '-' + season);
    }

    if (words.length > 3) {
        for (let i = 3; i < words.length; i++) {
            const reduced = words.slice(0, i).join('-');
            add(reduced);
            if (ano) add(reduced + '-' + ano);
            if (season > 1) add(reduced + '-' + season);
        }
    }

    debugLog(`Slugs padrão gerados: ${variations.length} variações`);
    return variations;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    debugLog(`\n${'='.repeat(60)}`);
    debugLog(`🎬 getStreams chamado:`);
    debugLog(`   TMDB ID: ${tmdbId}`);
    debugLog(`   MediaType: ${mediaType}`);
    debugLog(`   Season: ${season}`);
    debugLog(`   Episode: ${episode}`);
    debugLog(`${'='.repeat(60)}\n`);

    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    const seasonPadded = targetSeason.toString().padStart(2, '0');
    const timestamp = Date.now();

    debugLog(`Target Season: ${targetSeason}, Target Episode: ${targetEpisode}`);
    debugLog(`Ep padded: ${epPadded}, Season padded: ${seasonPadded}`);

    const info = await getTMDBTitle(tmdbId, mediaType);
    if (!info) {
        debugLog(`❌ Não foi possível obter título do TMDB`);
        return [];
    }

    const { title, ano } = info;
    debugLog(`Título base: "${title}" (${ano || 'sem ano'})`);
    
    // Verifica se é anime
    const animeDetected = mediaType === 'tv' ? await isAnime(tmdbId, mediaType) : false;
    debugLog(`Anime detectado? ${animeDetected ? '✅ SIM' : '❌ NÃO'}`);
    
    let slugVariations = [];
    let animeInfo = null;
    
    if (animeDetected) {
        debugLog(`\n🔰 MODO ANIME ATIVADO`);
        try {
            const episodeDate = await getTMDBEpisodeDate(tmdbId, targetSeason, targetEpisode);
            
            if (episodeDate) {
                debugLog(`Data do episódio obtida: ${new Date(episodeDate).toISOString()}`);
                
                const anilistId = await searchAnilistId(title);
                
                if (anilistId) {
                    debugLog(`ID AniList encontrado: ${anilistId}`);
                    
                    const allSeasons = await getAllSeasons(anilistId);
                    
                    if (allSeasons.length) {
                        debugLog(`${allSeasons.length} temporadas encontradas no AniList`);
                        
                        const seasonInfo = analyzeParts(allSeasons, targetEpisode, episodeDate);
                        
                        if (seasonInfo) {
                            animeInfo = seasonInfo;
                            debugLog(`Análise de partes concluída:`);
                            debugLog(`  - Título: ${seasonInfo.title}`);
                            debugLog(`  - BaseTitle: ${seasonInfo.baseTitle}`);
                            debugLog(`  - Parte: ${seasonInfo.partNumber}/${seasonInfo.totalParts}`);
                            debugLog(`  - Ep na parte: ${seasonInfo.episodeInPart}`);
                            
                            // Gera slugs baseados no título original
                            slugVariations = generateAnimeSlugs(seasonInfo, targetSeason);
                        }
                    }
                }
            } else {
                debugLog(`⚠️ Não foi possível obter data do episódio`);
            }
        } catch (error) {
            debugLog(`❌ Erro no modo anime: ${error.message}`);
            debugLog(`Usando fallback para método padrão`);
        }
        
        // Se não conseguiu gerar slugs pelo método anime, usa o padrão
        if (slugVariations.length === 0) {
            debugLog(`⚠️ Modo anime falhou, usando método padrão como fallback`);
            slugVariations = generateSlugVariations(title, targetSeason, ano);
        }
    } else {
        // MODO PADRÃO: Usa a lógica original para filmes/séries normais
        debugLog(`\n📺 MODO PADRÃO`);
        slugVariations = generateSlugVariations(title, targetSeason, ano);
    }

    debugLog(`\n🔗 Gerando URLs para teste...`);
    debugLog(`Total de slugs a testar: ${slugVariations.length}`);

    const urls = [];
    const seen = new Set();

    for (const slug of slugVariations) {
        const firstLetter = slug.charAt(0).toUpperCase() || 'T';

        if (mediaType === 'movie') {
            const url = CDN_PROXY + '/' + firstLetter + '/' + slug + '/stream/stream.m3u8?nocache=' + timestamp;
            if (!seen.has(url)) {
                seen.add(url);
                urls.push(url);
                debugLog(`URL gerada (movie): ${url}`);
            }
        } else {
            // PARA ANIMES: Usa sempre "01-temporada" na URL
            // PARA NÃO-ANIMES: Usa a temporada real (seasonPadded)
            const urlSeason = animeDetected ? '01' : seasonPadded;
            const url = CDN_PROXY + '/' + firstLetter + '/' + slug + '/' + urlSeason + '-temporada/' + epPadded + '/stream.m3u8?nocache=' + timestamp;
            if (!seen.has(url)) {
                seen.add(url);
                urls.push(url);
                debugLog(`URL gerada (tv): ${url} [temporada na URL: ${urlSeason}]`);
            }
        }
    }

    debugLog(`\n🔍 Testando ${urls.length} URLs...`);

    for (const url of urls) {
        if (await testUrl(url)) {
            debugLog(`✅ URL válida encontrada: ${url}`);
            
            let displayTitle = mediaType === 'movie' ? title : `${title} S${targetSeason} EP${targetEpisode}`;
            if (animeInfo && animeInfo.episodeInPart !== targetEpisode) {
                displayTitle += ` (Parte ${animeInfo.partNumber} - Ep ${animeInfo.episodeInPart})`;
            }
            
            return [{
                url,
                headers: HEADERS,
                name: animeDetected ? 'Animes 1080p' : 'Doramogo 1080p',
                title: displayTitle
            }];
        }
    }

    debugLog(`❌ Nenhuma URL válida encontrada`);
    return [];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
