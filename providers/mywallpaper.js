// ==================== CONFIGURAÇÕES ====================
const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CDN_BASE = 'https://cdn-s01.mywallpaper-4k-image.net';

// Ativar logs detalhados
const DEBUG = true;

function log(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// ==================== FUNÇÕES UTILITÁRIAS BÁSICAS ====================

function titleToSlug(title) {
    if (!title) return '';
    
    // Converte × especial para x normal
    const normalized = title.replace(/×/g, 'x');
    
    return normalized.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function testUrl(url) {
    log('🔍 Testando URL:', url.substring(0, 80) + '...');
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const ok = response.ok || response.status === 206;
        log(ok ? '   ✅ OK' : '   ❌ Falhou', `(status: ${response.status})`);
        return ok;
    } catch (error) {
        log('   ❌ Erro:', error.message);
        return false;
    }
}

// ==================== FUNÇÕES TMDB ====================

async function getTMDBSeasonName(tmdbId, seasonNumber) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`;
    log(`📥 Buscando temporada ${seasonNumber} no TMDB...`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            log('   ❌ TMDB erro:', response.status);
            return null;
        }
        const data = await response.json();
        log(`   ✅ Nome da temporada: "${data.name || 'não encontrado'}"`);
        return data.name || null;
    } catch (error) {
        log('   ❌ TMDB erro:', error.message);
        return null;
    }
}

async function getTMDBEnglishTitle(tmdbId) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    log('📥 Buscando título em inglês no TMDB...');
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            log('   ❌ TMDB erro:', response.status);
            return null;
        }
        const data = await response.json();
        log(`   ✅ Título em inglês: "${data.name}"`);
        return data.name || null;
    } catch (error) {
        log('   ❌ TMDB erro:', error.message);
        return null;
    }
}

async function getTMDBOriginalTitle(tmdbId) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=ja`;
    log('📥 Buscando título original (japonês) no TMDB...');
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            log('   ❌ TMDB erro:', response.status);
            return null;
        }
        const data = await response.json();
        log(`   ✅ Título original: "${data.original_name || data.name}"`);
        return data.original_name || data.name || null;
    } catch (error) {
        log('   ❌ TMDB erro:', error.message);
        return null;
    }
}

async function getTMDBSeasonsInfo(tmdbId) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        
        const seasons = data.seasons || [];
        const seasonsInfo = [];
        let totalEpisodesBefore = 0;
        
        seasons.sort((a, b) => a.season_number - b.season_number);
        
        for (const season of seasons) {
            if (season.season_number > 0) {
                seasonsInfo.push({
                    seasonNumber: season.season_number,
                    episodeCount: season.episode_count || 0,
                    totalBefore: totalEpisodesBefore
                });
                totalEpisodesBefore += season.episode_count || 0;
            }
        }
        
        return seasonsInfo;
    } catch (error) {
        return null;
    }
}

function calculateAbsoluteEpisode(seasonsInfo, targetSeason, targetEpisode) {
    if (!seasonsInfo) return null;
    const seasonInfo = seasonsInfo.find(s => s.seasonNumber === targetSeason);
    if (!seasonInfo) return null;
    return seasonInfo.totalBefore + targetEpisode;
}

async function getTMDBTitle(tmdbId) {
    const url = TMDB_BASE_URL + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.name;
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

    log(`📥 Pesquisando Anilist: "${searchQuery}"`);

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: searchQuery } })
        });
        
        if (!response.ok) {
            log('   ❌ Anilist erro:', response.status);
            return null;
        }
        
        const data = await response.json();
        const media = data.data?.Media;
        
        if (media) {
            const title = media.title?.romaji || media.title?.english;
            log(`   ✅ Encontrado: "${title}" (ID: ${media.id}, eps: ${media.episodes || '?'})`);
        } else {
            log('   ❌ Nenhum resultado');
        }
        
        return media || null;
    } catch (error) {
        log('   ❌ Anilist erro:', error.message);
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

    log(`📥 Buscando detalhes do anime ID: ${animeId}`);

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: animeId } })
        });

        if (!response.ok) {
            log('   ❌ Anilist erro:', response.status);
            return null;
        }
        
        const data = await response.json();
        const media = data.data?.Media;
        
        if (media) {
            const title = media.title?.romaji || media.title?.english;
            log(`   ✅ Carregado: "${title}" (eps: ${media.episodes || '?'})`);
        }
        
        return media || null;
    } catch (error) {
        log('   ❌ Anilist erro:', error.message);
        return null;
    }
}

async function searchAnilistId(title) {
    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
            }
        }
    `;

    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { search: title } })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data && data.data.Media ? data.data.Media.id : null;
}

async function getAllSeasons(startId) {
    const allSeasons = [];
    const visited = new Set();

    async function followChain(animeId, seasonNum) {
        if (visited.has(animeId)) return;
        visited.add(animeId);

        await new Promise(r => setTimeout(r, 1000));

        const anime = await getAnimeDetails(animeId);
        if (!anime) return;

        allSeasons.push({
            id: animeId,
            title: anime.title.romaji || anime.title.english,
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
    
    // Ordena por temporada
    allSeasons.sort((a, b) => a.season - b.season);
    
    return allSeasons;
}

// ==================== FUNÇÕES DE GERAÇÃO DE SLUGS ====================

function generateSeasonSlugs(baseSlug, seasonNumber) {
    log(`📥 Gerando slugs para temporada ${seasonNumber}...`);
    
    if (seasonNumber < 2) {
        log('   → Temporada 1: apenas slug base');
        return [baseSlug];
    }
    
    const variations = [];
    const seen = new Set();
    
    function add(slug) {
        if (!seen.has(slug)) {
            seen.add(slug);
            variations.push(slug);
        }
    }
    
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
        add(`${baseSlug}-${seasonNumber}`);
        add(`${baseSlug}-season-${seasonNumber}`);
        add(`${baseSlug}-${ordinal.word}-season`);
        add(`${baseSlug}-${ordinal.suffix}-season`);
        log(`   → Gerados ${variations.length} slugs`);
    }
    
    return variations;
}

// Função para remover "Part" do título
function removePartFromTitle(title) {
    if (!title) return '';
    
    // Remove "Part X", "Parte X", etc do título
    return title
        .replace(/[:\s]*(Part|Parte)\s*\d+.*$/i, '') // Remove "Part 2" do final
        .replace(/\s*-\s*.*$/, '') // Remove " - Kanketsu-hen" etc
        .trim();
}

// Função para extrair o número da parte do título
function extractPartNumberFromTitle(title) {
    if (!title) return null;
    
    // Procura por "Part X", "Parte X" no título
    const match = title.match(/[:\s]*(Part|Parte)\s*(\d+)/i);
    if (match) {
        return parseInt(match[2], 10);
    }
    return null;
}

// ==================== FUNÇÃO PRINCIPAL ====================

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = season;
    const targetEpisode = episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 BUSCANDO STREAMS');
    console.log('='.repeat(60));
    console.log(`📺 TMDB ID: ${tmdbId}`);
    console.log(`📅 Temporada: ${targetSeason}`);
    console.log(`🎯 Episódio: ${targetEpisode}`);
    console.log('-'.repeat(40));
    
    try {
        let validStreams = [];
        
        // ========== PASSO 1: TMDB ==========
        console.log('\n📥 PASSO 1: Buscando TMDB...');
        const tmdbEnglishTitle = await getTMDBEnglishTitle(tmdbId);
        const tmdbOriginalTitle = await getTMDBOriginalTitle(tmdbId);
        const tmdbSeasonName = await getTMDBSeasonName(tmdbId, targetSeason);
        
        if (!tmdbEnglishTitle && !tmdbOriginalTitle) {
            console.log('❌ Erro: Título TMDB não encontrado');
            return [];
        }
        
        // ========== PASSO 1.5: TESTE DIRETO COM SLUG DO TMDB ==========
        console.log('\n📥 PASSO 1.5: Testando slug direto do TMDB...');
        
        const tmdbBaseSlug = titleToSlug(tmdbEnglishTitle);
        let tmdbSlug = tmdbBaseSlug;
        
        // Se não for temporada 1, adiciona o número da temporada
        if (targetSeason > 1) {
            tmdbSlug = `${tmdbBaseSlug}-${targetSeason}`;
        }
        
        const firstLetter = tmdbSlug.charAt(0) || 't';
        
        // Testa legendado
        const legTmdbUrl = `${CDN_BASE}/stream/${firstLetter}/${tmdbSlug}/${epPadded}.mp4/index.m3u8`;
        console.log(`   📍 TMDB Legendado: ${legTmdbUrl.substring(0, 70)}...`);
        if (await testUrl(legTmdbUrl)) {
            validStreams.push({
                url: legTmdbUrl,
                name: `My Wallpaper Legendado 1080p`,
                title: `${tmdbEnglishTitle} S${targetSeason} EP${targetEpisode}`,
                quality: 1080,
                type: 'hls'
            });
        }
        
        // Testa dublado
        const dubTmdbUrl = `${CDN_BASE}/stream/${firstLetter}/${tmdbSlug}-dublado/${epPadded}.mp4/index.m3u8`;
        console.log(`   📍 TMDB Dublado: ${dubTmdbUrl.substring(0, 70)}...`);
        if (await testUrl(dubTmdbUrl)) {
            validStreams.push({
                url: dubTmdbUrl,
                name: `My Wallpaper Dublado 1080p`,
                title: `${tmdbEnglishTitle} S${targetSeason} EP${targetEpisode}`,
                quality: 1080,
                type: 'hls'
            });
        }
        
        if (validStreams.length > 0) {
            console.log(`\n✅ Encontrados ${validStreams.length} streams no PASSO 1.5`);
            return validStreams;
        }
        
        // ========== PASSO 2: ANILIST (DUAS PESQUISAS) ==========
        console.log('\n📥 PASSO 2: Buscando Anilist...');
        
        // 2.1 PESQUISA PELO NOME DA TEMPORADA (para análise de partes)
        let seasonAnimeData = null;
        if (targetSeason === 1) {
            // Temporada 1: pesquisa só o nome base
            if (tmdbEnglishTitle) {
                seasonAnimeData = await searchAnilistByTitle(tmdbEnglishTitle);
            }
        } else {
            // Temporada 2+: pesquisa nome base + nome da temporada
            if (tmdbEnglishTitle && tmdbSeasonName) {
                seasonAnimeData = await searchAnilistByTitle(`${tmdbEnglishTitle} ${tmdbSeasonName}`);
            }
        }
        
        // Fallback para seasonAnimeData
        if (!seasonAnimeData && tmdbEnglishTitle) {
            seasonAnimeData = await searchAnilistByTitle(tmdbEnglishTitle);
        }
        if (!seasonAnimeData && tmdbOriginalTitle) {
            seasonAnimeData = await searchAnilistByTitle(tmdbOriginalTitle);
        }
        
        // 2.2 PESQUISA PELO NOME BASE (para gerar slugs)
        let baseAnimeData = null;
        if (tmdbEnglishTitle) {
            baseAnimeData = await searchAnilistByTitle(tmdbEnglishTitle);
        }
        if (!baseAnimeData && tmdbOriginalTitle) {
            baseAnimeData = await searchAnilistByTitle(tmdbOriginalTitle);
        }
        
        if (!seasonAnimeData || !baseAnimeData) {
            console.log('❌ Nenhum resultado no Anilist');
            return [];
        }
        
        // Slug da temporada específica (para análise de partes)
        const seasonRomajiTitle = seasonAnimeData.title?.romaji || seasonAnimeData.title?.english;
        const seasonRomajiSlug = titleToSlug(seasonRomajiTitle);
        console.log(`   ✅ Slug da temporada: ${seasonRomajiSlug}`);
        
        // Slug base em romaji (para gerar variações)
        const baseRomajiTitle = baseAnimeData.title?.romaji || baseAnimeData.title?.english;
        const baseRomajiSlug = titleToSlug(baseRomajiTitle);
        console.log(`   ✅ Slug base (romaji): ${baseRomajiSlug}`);
        
        // ========== PASSO 3: SLUG BASE (APENAS TEMPORADA 1) ==========
        if (targetSeason === 1) {
            console.log('\n📥 PASSO 3: Testando slug base (temporada 1)...');
            const firstLetter = baseRomajiSlug.charAt(0) || 't';
            
            const legBaseUrl = `${CDN_BASE}/stream/${firstLetter}/${baseRomajiSlug}/${epPadded}.mp4/index.m3u8`;
            console.log(`   📍 Legendado: ${legBaseUrl.substring(0, 70)}...`);
            if (await testUrl(legBaseUrl)) {
                validStreams.push({
                    url: legBaseUrl,
                    name: `My Wallpaper Legendado 1080p`,
                    title: `${baseRomajiTitle} EP${targetEpisode}`,
                    quality: 1080,
                    type: 'hls'
                });
            }
            
            const dubBaseUrl = `${CDN_BASE}/stream/${firstLetter}/${baseRomajiSlug}-dublado/${epPadded}.mp4/index.m3u8`;
            console.log(`   📍 Dublado: ${dubBaseUrl.substring(0, 70)}...`);
            if (await testUrl(dubBaseUrl)) {
                validStreams.push({
                    url: dubBaseUrl,
                    name: `My Wallpaper Dublado 1080p`,
                    title: `${baseRomajiTitle} EP${targetEpisode}`,
                    quality: 1080,
                    type: 'hls'
                });
            }
            
            if (validStreams.length > 0) {
                console.log(`\n✅ Encontrados ${validStreams.length} streams no PASSO 3`);
                return validStreams;
            }
        }
        
        // ========== PASSO 4: VARIAÇÕES DE TEMPORADA (PARA TEMPORADAS 2+) ==========
        if (targetSeason >= 2) {
            console.log(`\n📥 PASSO 4: Testando variações para temporada ${targetSeason}...`);
            
            // USA O SLUG BASE EM ROMAJI, NÃO O SLUG DA TEMPORADA!
            const seasonVariations = generateSeasonSlugs(baseRomajiSlug, targetSeason);
            
            for (const slug of seasonVariations) {
                const firstLetter = slug.charAt(0) || 't';
                
                const legUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}/${epPadded}.mp4/index.m3u8`;
                console.log(`   📍 Testando: ${slug}`);
                if (await testUrl(legUrl)) {
                    validStreams.push({
                        url: legUrl,
                        name: `My Wallpaper Legendado 1080p`,
                        title: `${baseRomajiTitle} S${targetSeason} EP${targetEpisode}`,
                        quality: 1080,
                        type: 'hls'
                    });
                    break;
                }
                
                const dubUrl = `${CDN_BASE}/stream/${firstLetter}/${slug}-dublado/${epPadded}.mp4/index.m3u8`;
                if (await testUrl(dubUrl)) {
                    validStreams.push({
                        url: dubUrl,
                        name: `My Wallpaper Dublado 1080p`,
                        title: `${baseRomajiTitle} S${targetSeason} EP${targetEpisode}`,
                        quality: 1080,
                        type: 'hls'
                    });
                    break;
                }
            }
        }
        
        if (validStreams.length > 0) {
            console.log(`\n✅ Encontrados ${validStreams.length} streams no PASSO 4`);
            return validStreams;
        }
        
        // ========== PASSO 5: ANÁLISE DE PARTES COM SEQUEL ==========
        console.log('\n📥 PASSO 5: Tentando análise de partes via SEQUEL...');
        
        // Segue as relações SEQUEL para encontrar todas as partes
        let allParts = [];
        let currentAnime = seasonAnimeData;
        let visited = new Set();
        let partNum = 1;
        
        while (currentAnime && !visited.has(currentAnime.id)) {
            visited.add(currentAnime.id);
            
            allParts.push({
                id: currentAnime.id,
                title: currentAnime.title?.romaji || currentAnime.title?.english,
                episodes: currentAnime.episodes || 0,
                partNumber: partNum
            });
            
            // Procura por SEQUEL
            const sequel = currentAnime.relations?.edges?.find(e => e.relationType === 'SEQUEL');
            if (!sequel) break;
            
            currentAnime = await getAnimeDetails(sequel.node.id);
            partNum++;
        }
        
        if (allParts.length > 0) {
            log(`   ✅ Total de partes encontradas: ${allParts.length}`);
            
            // Encontra em qual parte cai o episódio
            let episodesBefore = 0;
            let targetPart = null;
            
            for (const part of allParts) {
                if (targetEpisode <= episodesBefore + part.episodes) {
                    targetPart = {
                        ...part,
                        episodeInPart: targetEpisode - episodesBefore
                    };
                    break;
                }
                episodesBefore += part.episodes;
            }
            
            if (targetPart) {
                console.log(`   ✅ Episódio ${targetEpisode} → Parte ${targetPart.partNumber}, ep ${targetPart.episodeInPart}`);
                
                // Extrai o número da parte do título (se existir)
                const partNumberFromTitle = extractPartNumberFromTitle(targetPart.title);
                const finalPartNumber = partNumberFromTitle || targetPart.partNumber;
                
                // Remove "Part" do título
                const titleWithoutPart = removePartFromTitle(targetPart.title);
                let finalSlug = titleToSlug(titleWithoutPart);
                
                // Adiciona o número da parte (usando o número do título, não da sequência)
                if (finalPartNumber > 1 || partNumberFromTitle) {
                    finalSlug = `${finalSlug}-${finalPartNumber}`;
                }
                
                const partEpPadded = targetPart.episodeInPart.toString().padStart(2, '0');
                const firstLetter = finalSlug.charAt(0) || 't';
                
                console.log(`   📍 Testando slug: ${finalSlug}`);
                
                const legUrl = `${CDN_BASE}/stream/${firstLetter}/${finalSlug}/${partEpPadded}.mp4/index.m3u8`;
                if (await testUrl(legUrl)) {
                    validStreams.push({
                        url: legUrl,
                        name: `My Wallpaper Legendado 1080p`,
                        title: `${targetPart.title} EP${targetPart.episodeInPart}`,
                        quality: 1080,
                        type: 'hls'
                    });
                }
                
                const dubUrl = `${CDN_BASE}/stream/${firstLetter}/${finalSlug}-dublado/${partEpPadded}.mp4/index.m3u8`;
                if (await testUrl(dubUrl)) {
                    validStreams.push({
                        url: dubUrl,
                        name: `My Wallpaper Dublado 1080p`,
                        title: `${targetPart.title} EP${targetPart.episodeInPart}`,
                        quality: 1080,
                        type: 'hls'
                    });
                }
            }
        }
        
        if (validStreams.length > 0) {
            console.log(`\n✅ Encontrados ${validStreams.length} streams no PASSO 5`);
            return validStreams;
        }
        
        // ========== PASSO 6: ÚLTIMO RECURSO - EPISÓDIOS ABSOLUTOS ==========
        console.log('\n📥 PASSO 6: Tentando com episódios absolutos...');
        
        const seasonsInfo = await getTMDBSeasonsInfo(tmdbId);
        
        if (seasonsInfo?.length) {
            const absoluteEpisode = calculateAbsoluteEpisode(seasonsInfo, targetSeason, targetEpisode);
            
            if (absoluteEpisode) {
                console.log(`   📊 Episódio absoluto TMDB: ${absoluteEpisode}`);
                
                // Pega todas as temporadas/partes do Anilist (começando do base)
                const anilistId = baseAnimeData?.id;
                
                if (anilistId) {
                    const anilistParts = await getAllSeasons(anilistId);
                    
                    if (anilistParts.length) {
                        log(`   ✅ Total de partes no Anilist: ${anilistParts.length}`);
                        
                        // Encontra em qual parte cai o episódio absoluto
                        let episodesBefore = 0;
                        let targetAbsolutePart = null;
                        
                        for (const part of anilistParts) {
                            if (absoluteEpisode <= episodesBefore + (part.episodes || 0)) {
                                targetAbsolutePart = {
                                    ...part,
                                    episodeInPart: absoluteEpisode - episodesBefore,
                                    partNumber: part.season
                                };
                                break;
                            }
                            episodesBefore += part.episodes || 0;
                        }
                        
                        if (targetAbsolutePart) {
                            console.log(`   ✅ Episódio absoluto ${absoluteEpisode} → Parte ${targetAbsolutePart.partNumber}, ep ${targetAbsolutePart.episodeInPart}`);
                            
                            // Extrai o número da parte do título (se existir)
                            const partNumberFromTitle = extractPartNumberFromTitle(targetAbsolutePart.title);
                            const finalPartNumber = partNumberFromTitle || targetAbsolutePart.partNumber;
                            
                            // Remove "Part" do título
                            const titleWithoutPart = removePartFromTitle(targetAbsolutePart.title);
                            let finalSlug = titleToSlug(titleWithoutPart);
                            
                            // Adiciona o número da parte (usando o número do título, não da sequência)
                            if (finalPartNumber > 1 || partNumberFromTitle) {
                                finalSlug = `${finalSlug}-${finalPartNumber}`;
                            }
                            
                            const partEpPadded = targetAbsolutePart.episodeInPart.toString().padStart(2, '0');
                            const firstLetter = finalSlug.charAt(0) || 't';
                            
                            console.log(`   📍 Testando slug: ${finalSlug}`);
                            
                            const legUrl = `${CDN_BASE}/stream/${firstLetter}/${finalSlug}/${partEpPadded}.mp4/index.m3u8`;
                            if (await testUrl(legUrl)) {
                                validStreams.push({
                                    url: legUrl,
                                    name: `My Wallpaper Legendado 1080p`,
                                    title: `${targetAbsolutePart.title} EP${targetAbsolutePart.episodeInPart}`,
                                    quality: 1080,
                                    type: 'hls'
                                });
                            }
                            
                            const dubUrl = `${CDN_BASE}/stream/${firstLetter}/${finalSlug}-dublado/${partEpPadded}.mp4/index.m3u8`;
                            if (await testUrl(dubUrl)) {
                                validStreams.push({
                                    url: dubUrl,
                                    name: `My Wallpaper Dublado 1080p`,
                                    title: `${targetAbsolutePart.title} EP${targetAbsolutePart.episodeInPart}`,
                                    quality: 1080,
                                    type: 'hls'
                                });
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`\n📊 RESULTADO FINAL: ${validStreams.length} streams encontrados`);
        return validStreams;
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        return [];
    }
}

// ==================== EXPORTS ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
