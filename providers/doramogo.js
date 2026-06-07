const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MEGACINE_BASE = 'https://www.megacine.online';
const DORAMOGO_BASE = 'https://www.doramogo.net';
const PROXY_SOURCE_URL = DORAMOGO_BASE + '/series/dream-stage-2026-legendado/temporada-1/episodio-1';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.doramogo.net/'
};

const CACHE = {};
let cachedProxies = null;
let proxyExpiry = 0;
const PROXY_CACHE_TIME = 60 * 60 * 1000;

// Mapeamento de números para comparação
const NUMBER_MAP = {
    '1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth',
    '6th': 'sixth', '7th': 'seventh', '8th': 'eighth', '9th': 'ninth', '10th': 'tenth',
    '11th': 'eleventh', '12th': 'twelfth',
    '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
    '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
    '11': 'eleven', '12': 'twelve'
};

// Logger
let debugLogs = [];

function log(title, value = '') {
    debugLogs.push({ title, value });
    console.log(`[*] ${title}${value ? ': ' + value : ''}`);
}

function clearLogs() {
    debugLogs = [];
}

// FUNÇÃO PARA MOSTRAR STREAMS NO FORMATO SIMPLES (IGUAL O EXEMPLO)
function showStreams(streams) {
    if (!streams || streams.length === 0) {
        console.log(`\n❌ NENHUM STREAM ENCONTRADO\n`);
        return;
    }
    
    console.log(`\n📺 STREAMS ENCONTRADOS:`);
    streams.forEach((stream, i) => {
        console.log(`[${i + 1}] ${stream.name} | ${stream.title}`);
        console.log(`    ${stream.url}`);
    });
    console.log(``);
}

function normalizeForComparison(text) {
    if (!text) return "";
    
    let normalized = text.toLowerCase();
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    normalized = normalized.replace(/\b(dublado|legendado|online|hd|4k|completo|dual|audio)\b/g, '');
    
    for (const [num, word] of Object.entries(NUMBER_MAP)) {
        const regex = new RegExp(`\\b${num}\\b`, 'gi');
        normalized = normalized.replace(regex, ` ${word} `);
    }
    
    normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
}

function levenshteinRatio(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    const matrix = Array(len1 + 1);
    for (let i = 0; i <= len1; i++) {
        matrix[i] = Array(len2 + 1);
        matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    
    const distance = matrix[len1][len2];
    return 1.0 - (distance / Math.max(len1, len2));
}

function titleToSlug(title, convertNumbers) {
    if (!title) return '';
    let text = title.toLowerCase();
    
    if (convertNumbers) {
        const numMap = {'0':'zero','1':'um','2':'dois','3':'tres','4':'quatro','5':'cinco','6':'seis','7':'sete','8':'oito','9':'nove'};
        text = text.replace(/\d/g, m => numMap[m] || m);
    }
    
    return text.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateSlugVariations(baseTitle, season, ano) {
    const variations = [];
    const seen = new Set();
    const slugBases = [titleToSlug(baseTitle, false), titleToSlug(baseTitle, true)];
    
    const add = (s) => { if (!seen.has(s)) { seen.add(s); variations.push(s); } };

    slugBases.forEach(base => {
        add(base);
        if (ano) add(`${base}-${ano}`);
        add(`${base}-legendado`);
        add(`${base}-dublado`);
        if (ano) {
            add(`${base}-${ano}-legendado`);
            add(`${base}-${ano}-dublado`);
        }
        if (season > 1) {
            add(`${base}-${season}`);
            if (ano) add(`${base}-${ano}-${season}`);
        }
    });
    return variations;
}

async function getAnilistTitles(title, airDateStr) {
    if (!airDateStr) return [];
    
    log(`Sincronizando data (${airDateStr}) com AniList...`);
    
    const targetDt = new Date(airDateStr);
    const query = `query ($search: String) {
        Page(perPage: 15) { media(search: $search, type: ANIME) {
            title { romaji english }
            startDate { year month day }
            relations { edges { node { title { romaji english } startDate { year month day } } relationType } }
        } }
    }`;
    
    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });
        
        const data = await response.json();
        const media = data.data?.Page?.media || [];
        
        const allEntries = [];
        for (const entry of media) {
            allEntries.push(entry);
            for (const edge of entry.relations?.edges || []) {
                allEntries.push(edge.node);
            }
        }
        
        let bestEntry = null;
        let minDiff = Infinity;
        
        for (const cand of allEntries) {
            const sd = cand.startDate;
            if (!sd || !sd.year) continue;
            
            try {
                const startDt = new Date(sd.year, (sd.month || 1) - 1, sd.day || 1);
                if (startDt <= targetDt) {
                    const diff = targetDt - startDt;
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestEntry = cand;
                    }
                }
            } catch (e) {}
        }
        
        if (bestEntry) {
            const titles = [bestEntry.title.romaji, bestEntry.title.english].filter(Boolean);
            log(`AniList encontrado: ${titles[0]}`);
            return titles;
        }
    } catch (e) {}
    
    return [];
}

async function testUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', headers: HEADERS });
        return response.ok || response.status === 206;
    } catch (err) {
        return false;
    }
}

async function fetchProxies() {
    if (cachedProxies && Date.now() < proxyExpiry) return cachedProxies;
    
    try {
        const res = await fetch(PROXY_SOURCE_URL);
        const text = await res.text();
        
        const primaryMatch = text.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        const fallbackMatch = text.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        
        cachedProxies = { 
            primary: primaryMatch ? primaryMatch[1] : 'https://ondemand.netflxx.shop', 
            fallback: fallbackMatch ? fallbackMatch[1] : 'https://forks-doramas.netflxx.shop' 
        };
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        return cachedProxies;
    } catch (e) {
        return null;
    }
}

// --- EXTRAÇÃO PRINCIPAL ---

async function getStreams(tmdbId, mediaType, season, episode) {
    clearLogs();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 INICIANDO BUSCA`);
    console.log(`${'='.repeat(60)}`);
    log(`Tipo: ${mediaType}`);
    log(`ID TMDB: ${tmdbId}`);
    
    let airDate = null;
    
    if (mediaType === 'tv') {
        log(`Temporada: ${season}, Episódio: ${episode}`);
        
        const epUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
        const epRes = await (await fetch(epUrl)).json();
        airDate = epRes.air_date;
        
        var tmdbUrl = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    } else {
        var tmdbUrl = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    }
    
    const tvRes = await (await fetch(tmdbUrl)).json();
    const namePt = tvRes.name || tvRes.title;
    const nameOrig = tvRes.original_name || tvRes.original_title;
    const year = (tvRes.first_air_date || tvRes.release_date || "").substring(0, 4);
    
    log(`TMDB: ${namePt} (${year})`);
    
    const proxies = await fetchProxies() || { primary: 'https://ondemand.netflxx.shop', fallback: 'https://forks-doramas.netflxx.shop' };
    const cdnList = [proxies.primary, proxies.fallback];
    
    const epPadded = episode.toString().padStart(2, '0');
    const seasonPadded = season.toString().padStart(2, '0');
    const timestamp = Date.now();
    
    // ============================================
    // PASSO 1: DIRECT GUESS
    // ============================================
    log("Tentando Direct Guess...");
    
    const guessSlugs = generateSlugVariations(namePt, season, year);
    
    for (const slug of guessSlugs) {
        const firstLetter = slug.charAt(0).toUpperCase();
        for (const cdn of cdnList) {
            let url;
            if (mediaType === 'movie') {
                url = `${cdn}/${firstLetter}/${slug}/stream/stream.m3u8?nocache=${timestamp}`;
            } else {
                url = `${cdn}/${firstLetter}/${slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
            }
            
            if (await testUrl(url)) {
                const label = slug.includes('-dublado') ? "Dublado" : "Legendado";
                const stream = {
                    name: `Doramogo [${label}]`,
                    title: `${namePt} (${label})`,
                    url: url,
                    quality: '1080p',
                    headers: HEADERS
                };
                
                console.log(`\n✅ DIRECT GUESS ENCONTRADO!`);
                showStreams([stream]);
                return [stream];
            }
        }
    }
    
    log("Direct Guess falhou, iniciando busca no Megacine...");
    
    // ============================================
    // PASSO 2: Busca no Megacine
    // ============================================
    
    let aniTitles = [];
    if (mediaType === 'tv' && tvRes.original_language === 'ja') {
        aniTitles = await getAnilistTitles(nameOrig, airDate);
    }
    
    let finalTargets = [];
    if (aniTitles.length > 0) {
        finalTargets = aniTitles;
    } else {
        finalTargets = [namePt];
    }
    
    const normalizedTargets = finalTargets.map(t => normalizeForComparison(t));
    log(`Alvos de Similitude: ${normalizedTargets.join(', ')}`);
    
    const searchUrl = `${MEGACINE_BASE}/search/?q=${encodeURIComponent(namePt)}`;
    const html = await (await fetch(searchUrl, { headers: HEADERS })).text();
    
    const regex = /href="https:\/\/www\.megacine\.online\/(series|filmes)\/([^"]+)".*?card-title">([^<]+)<\/h3>/gs;
    
    let match;
    const candidates = [];
    
    while ((match = regex.exec(html)) !== null) {
        const [_, siteType, slug, display] = match;
        
        let slugForComparison = slug.replace(/-(dublado|legendado)$/, '');
        slugForComparison = slugForComparison.replace(/-\d{4}$/, '');
        slugForComparison = slugForComparison.replace(/-/g, ' ');
        
        const normSlug = normalizeForComparison(slugForComparison);
        const normDisplay = normalizeForComparison(display);
        
        let bestSim = 0;
        for (const target of normalizedTargets) {
            const sim = Math.max(
                levenshteinRatio(normSlug, target),
                levenshteinRatio(normDisplay, target)
            );
            if (sim > bestSim) bestSim = sim;
        }
        
        if (bestSim >= 0.95) {
            candidates.push({ slug, display, similarity: bestSim });
            log(`✓ Candidato aceito: ${slug} (${(bestSim * 100).toFixed(2)}%)`);
        }
    }
    
    if (candidates.length === 0) {
        log("❌ Nenhum candidato com 95%+ de similaridade");
        return [];
    }
    
    // ============================================
    // PASSO 3: Testar URLs e criar streams
    // ============================================
    log("Testando URLs dos candidatos...");
    
    const validStreams = [];
    
    for (const cand of candidates) {
        const firstLetter = cand.slug.charAt(0).toUpperCase();
        
        for (const cdn of cdnList) {
            let url;
            if (mediaType === 'movie') {
                url = `${cdn}/${firstLetter}/${cand.slug}/stream/stream.m3u8?nocache=${timestamp}`;
            } else {
                url = `${cdn}/${firstLetter}/${cand.slug}/${seasonPadded}-temporada/${epPadded}/stream.m3u8?nocache=${timestamp}`;
            }
            
            if (await testUrl(url)) {
                const isDubbed = cand.slug.includes('-dublado');
                const isSubbed = cand.slug.includes('-legendado');
                let label = "";
                if (isDubbed) label = "Dublado";
                else if (isSubbed) label = "Legendado";
                
                const stream = {
                    name: `Megacine [${label || "Stream"}]`,
                    title: `${cand.display}${label ? ` (${label})` : ''}`,
                    url: url,
                    quality: '1080p',
                    headers: HEADERS
                };
                
                validStreams.push(stream);
                log(`✓ URL válida: ${cand.slug}`);
            }
        }
    }
    
    if (validStreams.length === 0) {
        log("❌ Nenhuma URL válida encontrada");
        return [];
    }
    
    // MOSTRAR STREAMS VÁLIDOS ENCONTRADOS
    console.log(`\n📊 STREAMS VÁLIDOS ENCONTRADOS:`);
    showStreams(validStreams);
    
    // ============================================
    // PASSO 4: Agrupar e aplicar lógica de dublado/legendado
    // ============================================
    const slugMap = new Map();
    
    for (const stream of validStreams) {
        const urlParts = stream.url.split('/');
        const slugIndex = urlParts.findIndex(part => part === 'S' || part === 'T') + 1;
        const slug = urlParts[slugIndex];
        
        const baseSlug = slug.replace(/-(dublado|legendado)$/, '');
        const type = slug.includes('-dublado') ? 'dublado' : 
                     (slug.includes('-legendado') ? 'legendado' : 'indefinido');
        
        if (!slugMap.has(baseSlug)) {
            slugMap.set(baseSlug, {
                baseSlug: baseSlug,
                variants: {},
                display: stream.title
            });
        }
        
        slugMap.get(baseSlug).variants[type] = stream;
    }
    
    const finalStreams = [];
    
    for (const [baseSlug, data] of slugMap) {
        const variants = data.variants;
        
        if (variants.dublado && variants.legendado) {
            log(`✓ Adicionando DUBLADO e LEGENDADO para: ${baseSlug}`);
            finalStreams.push(variants.dublado, variants.legendado);
        } else if (variants.dublado && !variants.legendado) {
            log(`✓ Adicionando apenas DUBLADO para: ${baseSlug}`);
            finalStreams.push(variants.dublado);
        } else if (variants.legendado && !variants.dublado) {
            log(`✓ Adicionando apenas LEGENDADO para: ${baseSlug}`);
            finalStreams.push(variants.legendado);
        } else if (variants.indefinido) {
            log(`✓ Adicionando versão SEM ESPECIFICAÇÃO para: ${baseSlug}`);
            finalStreams.push(variants.indefinido);
        }
    }
    
    // MOSTRAR STREAMS FINAIS (IGUAL O EXEMPLO)
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 RESULTADO FINAL - STREAMS RETORNADOS`);
    console.log(`${'='.repeat(60)}`);
    showStreams(finalStreams);
    
    log(`✅ Total de streams gerados: ${finalStreams.length}`);
    
    return finalStreams;
}

module.exports = { getStreams };
