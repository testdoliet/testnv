const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CDN_PROXY = 'https://ondemand.netflxx.shop';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.doramogo.net/'
};

const CACHE = {};

// Conversão de números para palavras (0-10)
const NUMBER_WORDS = {
    '0': 'zero', '1': 'um', '2': 'dois', '3': 'tres', 
    '4': 'quatro', '5': 'cinco', '6': 'seis', 
    '7': 'sete', '8': 'oito', '9': 'nove', '10': 'dez'
};

function numberToWords(numStr) {
    return numStr.split('').map(d => NUMBER_WORDS[d] || d).join('-');
}

function titleToSlug(title, convertNumbers = false) {
    if (!title) return '';
    
    let processed = title;
    if (convertNumbers) {
        processed = title.replace(/\d+/g, match => numberToWords(match));
    }
    
    return processed.toLowerCase()
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

// ==================== CONVERSOR IMDb → TMDB ====================

async function convertImdbToTmdb(imdbId, mediaType) {
    try {
        const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url, {
            headers: { 
                "User-Agent": HEADERS['User-Agent'], 
                "Accept": "application/json" 
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (mediaType === "movie") {
            if (data.movie_results && data.movie_results.length > 0) {
                return data.movie_results[0].id;
            }
        } else {
            if (data.tv_results && data.tv_results.length > 0) {
                return data.tv_results[0].id;
            }
        }
        
        return null;
    } catch {
        return null;
    }
}

// ==================== FUNÇÕES TMDB ====================

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

// ==================== GERAÇÃO DE SLUGS ====================

function generateSlugVariations(baseTitle, season, ano) {
    const baseSlugWords = titleToSlug(baseTitle, true);   // números → palavras
    const baseSlugNumbers = titleToSlug(baseTitle, false); // números originais
    
    const variations = [];
    const seen = {};

    function add(slug) {
        if (!seen[slug]) {
            seen[slug] = true;
            variations.push(slug);
        }
    }

    // Se forem diferentes, adiciona os dois
    const slugBases = baseSlugWords === baseSlugNumbers 
        ? [baseSlugWords] 
        : [baseSlugWords, baseSlugNumbers];
    
    for (const baseSlug of slugBases) {
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
    }

    return variations;
}

// ==================== FUNÇÃO PRINCIPAL ====================

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetSeason = mediaType === 'movie' ? 1 : season;
    const targetEpisode = mediaType === 'movie' ? 1 : episode;
    const epPadded = targetEpisode.toString().padStart(2, '0');
    const seasonPadded = targetSeason.toString().padStart(2, '0');
    const timestamp = Date.now();

    // Conversão IMDb → TMDB
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
        const convertedId = await convertImdbToTmdb(tmdbId, mediaType);
        if (convertedId) {
            finalId = convertedId;
        } else {
            return [];
        }
    }

    const info = await getTMDBTitle(finalId, mediaType);
    if (!info) return [];
    
    const { title, ano } = info;

    const slugVariations = generateSlugVariations(title, targetSeason, ano);

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
                name: 'Doramogo 1080p',
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
