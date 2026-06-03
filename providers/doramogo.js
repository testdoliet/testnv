const TMDB_API_KEY = 'b64d2f3a4212a99d64a7d4485faed7b3';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
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

function b64encode(str) {
    if (typeof btoa !== 'undefined') return btoa(str);
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '';
    var i = 0;
    while (i < str.length) {
        var c1 = str.charCodeAt(i++);
        var c2 = i < str.length ? str.charCodeAt(i++) : 0;
        var c3 = i < str.length ? str.charCodeAt(i++) : 0;
        var e1 = c1 >> 2;
        var e2 = ((c1 & 3) << 4) | (c2 >> 4);
        var e3 = ((c2 & 15) << 2) | (c3 >> 6);
        var e4 = c3 & 63;
        if (isNaN(c2)) { e3 = e4 = 64; }
        else if (isNaN(c3)) { e4 = 64; }
        out += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
    }
    return out;
}

const STOPWORDS = {
    a: 1, o: 1, os: 1, as: 1, de: 1, do: 1, da: 1, dos: 1, das: 1,
    the: 1, of: 1, and: 1, e: 1, no: 1, na: 1, nos: 1, nas: 1,
    to: 1, in: 1, on: 1, at: 1, for: 1, ni: 1, wa: 1, ga: 1, wo: 1, ka: 1,
    em: 1, um: 1, uma: 1, que: 1, com: 1, por: 1, se: 1, mas: 1
};

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[áàâãä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/[:：]/g, ' ')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugify(str) {
    return normalize(str).replace(/\s+/g, '-');
}

function tokensOf(title, minLen) {
    if (!minLen) minLen = 3;
    return normalize(title)
        .split(' ')
        .filter(function (w) { return w && !STOPWORDS[w] && w.length >= minLen; });
}

function slugBody(slug) {
    return slug
        .replace(/-dublado$/, '')
        .replace(/-legendado$/, '')
        .replace(/-online$/, '')
        .replace(/-[0-9]{4}$/, '')
        .replace(/-s\d+$/, '');
}

function stripListSuffix(slug) {
    return slug
        .replace(/-todos-os-episodios$/, '')
        .replace(/-todos-episodios$/, '');
}

function buildExpectedRoots(tmdbInfo) {
    var titles = [tmdbInfo.title, tmdbInfo.originalTitle]
        .concat(tmdbInfo.altTitles || [])
        .filter(Boolean);
    var roots = [];
    var seen = {};
    function push(s) { if (s && !seen[s]) { seen[s] = 1; roots.push(s); } }
    for (var i = 0; i < titles.length; i++) {
        var base = slugify(titles[i]);
        if (!base) continue;
        push(base);
        push(base.replace(/^the-/, ''));
        var afterColon = titles[i].indexOf(':') !== -1
            ? titles[i].split(':').slice(1).join(':')
            : '';
        if (afterColon) {
            var slug = slugify(afterColon);
            if (slug) push(slug);
        }
    }
    return roots;
}

function buildStrongTokens(info) {
    var source = [info.title, info.originalTitle].concat(info.altTitles || []);
    var seen = {};
    var out = [];
    for (var si = 0; si < source.length; si++) {
        var toks = tokensOf(source[si], 4);
        for (var ti = 0; ti < toks.length; ti++) {
            if (!seen[toks[ti]]) { seen[toks[ti]] = 1; out.push(toks[ti]); }
        }
    }
    return out;
}

function isStrictMatch(slug, expectedRoots, strongTokens) {
    if (!slug) return false;
    var body = slugBody(stripListSuffix(slug));

    for (var i = 0; i < expectedRoots.length; i++) {
        var root = expectedRoots[i];
        if (!root) continue;
        if (body === root) return true;
        if (body.indexOf(root + '-') === 0) return true;
    }

    for (var j = 0; j < expectedRoots.length; j++) {
        var r2 = expectedRoots[j];
        if (!r2 || r2.length < 6) continue;
        if (body.indexOf('-' + r2 + '-') !== -1) return true;
        if (body.length > r2.length && body.substring(body.length - r2.length - 1) === '-' + r2) return true;
    }

    if (strongTokens && strongTokens.length >= 2) {
        var hits = 0;
        for (var k = 0; k < strongTokens.length; k++) {
            if (body.indexOf(strongTokens[k]) !== -1) hits++;
        }
        var needed = Math.max(2, Math.ceil(strongTokens.length * 0.5));
        if (hits >= needed) return true;
    }

    return false;
}

function scoreResult(slug, tmdbInfo, expectedRoots, strongTokens, index) {
    var score = 0;
    var body = slugBody(stripListSuffix(slug));

    for (var i = 0; i < expectedRoots.length; i++) {
        var root = expectedRoots[i];
        if (!root) continue;
        if (body === root) { score += 100; break; }
        if (body.indexOf(root + '-') === 0) { score += 90; break; }
        if (body.indexOf('-' + root + '-') !== -1) score += 70;
    }

    if (tmdbInfo.year && slug.indexOf(tmdbInfo.year) !== -1) score += 20;
    if (slug.indexOf('-legendado') !== -1) score += 10;
    if (slug.indexOf('-dublado') !== -1) score += 8;
    score += Math.max(0, 5 - (index || 0));

    return score;
}

const NUMBER_WORDS = {
    '0': 'zero', '1': 'um', '2': 'dois', '3': 'tres',
    '4': 'quatro', '5': 'cinco', '6': 'seis',
    '7': 'sete', '8': 'oito', '9': 'nove', '10': 'dez'
};

function numberToWords(numStr) {
    return numStr.split('').map(function(d) { return NUMBER_WORDS[d] || d; }).join('-');
}

function titleToSlug(title, convertNumbers) {
    if (!title) return '';
    var processed = title;
    if (convertNumbers) {
        processed = title.replace(/\d+/g, function(match) { return numberToWords(match); });
    }
    return processed.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function fetchText(url, opts) {
    if (!opts) opts = {};
    try {
        var r = await fetch(url, {
            method: opts.method || 'GET',
            redirect: 'follow',
            headers: Object.assign({
                'User-Agent': HEADERS['User-Agent'],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Referer': HEADERS['Referer']
            }, opts.headers || {})
        });
        return { status: r.status, text: await r.text() };
    } catch (e) {
        return { status: -1, text: '' };
    }
}

async function testUrl(url) {
    try {
        var response = await fetch(url, { method: 'HEAD', headers: HEADERS });
        return response.ok || response.status === 206;
    } catch (err) {
        return false;
    }
}

async function fetchProxies() {
    if (cachedProxies && Date.now() < proxyExpiry) {
        return cachedProxies;
    }
    try {
        var res = await fetchText(PROXY_SOURCE_URL, { headers: HEADERS });
        if (!res || res.status !== 200) return null;
        var primaryMatch = res.text.match(/const\s+PRIMARY_URL\s*=\s*['"]([^'"]+)['"]/);
        var fallbackMatch = res.text.match(/const\s+FALLBACK_URL\s*=\s*['"]([^'"]+)['"]/);
        var proxies = {
            primary: primaryMatch ? primaryMatch[1] : 'https://ondemand.netflxx.shop',
            fallback: fallbackMatch ? fallbackMatch[1] : 'https://forks-doramas.netflxx.shop'
        };
        cachedProxies = proxies;
        proxyExpiry = Date.now() + PROXY_CACHE_TIME;
        return proxies;
    } catch (err) {
        return null;
    }
}

async function convertImdbToTmdb(imdbId, mediaType) {
    try {
        var url = TMDB_BASE_URL + '/find/' + imdbId + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id';
        var response = await fetch(url, {
            headers: { 'User-Agent': HEADERS['User-Agent'], 'Accept': 'application/json' }
        });
        if (!response.ok) return null;
        var data = await response.json();
        var result = null;
        if (mediaType === 'movie') {
            if (data.movie_results && data.movie_results.length > 0) result = data.movie_results[0].id;
        } else {
            if (data.tv_results && data.tv_results.length > 0) result = data.tv_results[0].id;
        }
        return result;
    } catch (err) {
        return null;
    }
}

async function getTMDBTitle(tmdbId, mediaType) {
    var cacheKey = tmdbId + '_' + mediaType;
    if (CACHE[cacheKey]) {
        return CACHE[cacheKey];
    }
    var endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    var url = TMDB_BASE_URL + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=pt-BR';
    try {
        var response = await fetch(url);
        var data = await response.json();
        var title = mediaType === 'tv' ? data.name : data.title;
        var originalTitle = mediaType === 'tv' ? data.original_name : data.original_title;
        var altTitles = [];
        try {
            var altRes = await fetch(TMDB_BASE_URL + '/' + endpoint + '/' + tmdbId + '/alternative_titles?api_key=' + TMDB_API_KEY);
            var altData = await altRes.json();
            var results = altData.results || altData.titles || [];
            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                if (!r || !r.title) continue;
                var c = (r.iso_3166_1 || '').toUpperCase();
                if (c === 'JP' || c === 'US' || c === 'GB' || c === 'BR' || c === 'PT' || c === 'KR' || c === 'CN') {
                    altTitles.push(r.title);
                }
            }
        } catch (e) { /* ignore */ }
        var ano = null;
        if (mediaType === 'tv' && data.first_air_date) ano = data.first_air_date.substring(0, 4);
        else if (mediaType === 'movie' && data.release_date) ano = data.release_date.substring(0, 4);
        var result = { title: title, originalTitle: originalTitle, altTitles: altTitles, year: ano };
        CACHE[cacheKey] = result;
        return result;
    } catch (err) {
        return null;
    }
}

function generateSlugVariations(baseTitle, season, ano) {
    var baseSlugWords = titleToSlug(baseTitle, true);
    var baseSlugNumbers = titleToSlug(baseTitle, false);
    var variations = [];
    var seen = {};
    function add(slug, source) {
        if (!seen[slug]) {
            seen[slug] = true;
            variations.push({ slug: slug, source: source || 'unknown' });
        }
    }
    var slugBases = baseSlugWords === baseSlugNumbers ? [baseSlugWords] : [baseSlugWords, baseSlugNumbers];
    for (var b = 0; b < slugBases.length; b++) {
        var baseSlug = slugBases[b];
        var words = baseSlug.split('-');
        add(baseSlug, 'base');
        if (ano) add(baseSlug + '-' + ano, 'base+ano');
        add(baseSlug + '-legendado', 'base+legendado');
        add(baseSlug + '-dublado', 'base+dublado');
        if (ano) {
            add(baseSlug + '-' + ano + '-legendado', 'base+ano+legendado');
            add(baseSlug + '-' + ano + '-dublado', 'base+ano+dublado');
        }
        if (season > 1) {
            add(baseSlug + '-' + season, 'base+season');
            if (ano) add(baseSlug + '-' + ano + '-' + season, 'base+ano+season');
        }
        if (words.length > 3) {
            for (var i = 3; i < words.length; i++) {
                var reduced = words.slice(0, i).join('-');
                add(reduced, 'reduced-' + i);
                if (ano) add(reduced + '-' + ano, 'reduced-' + i + '+ano');
                if (season > 1) add(reduced + '-' + season, 'reduced-' + i + '+season');
            }
        }
    }
    return variations;
}

async function searchDoramogo(query) {
    var slugQuery = slugify(query);
    if (!slugQuery) return [];
    var url = DORAMOGO_BASE + '/search/?q=' + encodeURIComponent(query);
    var res = await fetchText(url);
    if (!res || res.status !== 200 || res.text.length < 2000) {
        return [];
    }
    var results = [];
    var seen = {};
    var re = /href=["'](https?:\/\/www\.doramogo\.net\/series\/([a-z0-9-]+))\/?["']/gi;
    var m;
    while ((m = re.exec(res.text)) !== null) {
        var full = m[1];
        var slug = m[2];
        if (seen[slug]) continue;
        seen[slug] = 1;
        results.push({ url: full, slug: slug });
    }
    return results;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    var targetSeason = mediaType === 'movie' ? 1 : season;
    var targetEpisode = mediaType === 'movie' ? 1 : episode;
    var epPadded = targetEpisode.toString().padStart(2, '0');
    var seasonPadded = targetSeason.toString().padStart(2, '0');
    var timestamp = Date.now();

    var proxies = await fetchProxies();
    if (!proxies) {
        proxies = { primary: 'https://ondemand.netflxx.shop', fallback: 'https://forks-doramas.netflxx.shop' };
    }
    var cdnList = [proxies.primary, proxies.fallback];

    var finalId = tmdbId;
    var isImdb = String(tmdbId).toLowerCase().startsWith('tt');
    if (isImdb) {
        var convertedId = await convertImdbToTmdb(tmdbId, mediaType);
        if (convertedId) finalId = convertedId;
        else {
            return [];
        }
    }

    var info = await getTMDBTitle(finalId, mediaType);
    if (!info) {
        return [];
    }

    var expectedRoots = buildExpectedRoots(info);
    var strongTokens = buildStrongTokens(info);

    var directSlugsPT = generateSlugVariations(info.title, targetSeason, info.year);
    var directSlugsOriginal = [];
    if (info.originalTitle && info.originalTitle !== info.title) {
        directSlugsOriginal = generateSlugVariations(info.originalTitle, targetSeason, info.year);
    }
    var allDirectSlugs = directSlugsPT.concat(directSlugsOriginal);

    var directUrls = [];
    var seenDirectUrls = {};
    for (var d = 0; d < allDirectSlugs.length; d++) {
        var slug = allDirectSlugs[d].slug;
        var firstLetter = slug.charAt(0).toUpperCase() || 'T';
        for (var c = 0; c < cdnList.length; c++) {
            var cdn = cdnList[c];
            var url;
            if (mediaType === 'movie') {
                url = cdn + '/' + firstLetter + '/' + slug + '/stream/stream.m3u8?nocache=' + timestamp;
            } else {
                url = cdn + '/' + firstLetter + '/' + slug + '/' + seasonPadded + '-temporada/' + epPadded + '/stream.m3u8?nocache=' + timestamp;
            }
            if (!seenDirectUrls[url]) {
                seenDirectUrls[url] = 1;
                directUrls.push({ url: url, slug: slug, source: 'direct-guess', cdn: cdn });
            }
        }
    }

    for (var du = 0; du < directUrls.length; du++) {
        if (await testUrl(directUrls[du].url)) {
            return [{
                url: directUrls[du].url,
                headers: HEADERS,
                name: 'Doramogo 1080p',
                title: (mediaType === 'movie' ? info.title : info.title + ' S' + targetSeason + ' EP' + targetEpisode)
            }];
        }
    }


    var queries = [];
    var src = [info.title, info.originalTitle].concat(info.altTitles || []);
    for (var qi = 0; qi < src.length; qi++) {
        var t = (src[qi] || '').trim();
        if (t && queries.indexOf(t) === -1) queries.push(t);
    }

    var searchResults = [];
    var seenSearchSlugs = {};
    for (var q = 0; q < queries.length && searchResults.length < 10; q++) {
        var results = await searchDoramogo(queries[q]);
        for (var r = 0; r < results.length; r++) {
            if (seenSearchSlugs[results[r].slug]) continue;
            if (!isStrictMatch(results[r].slug, expectedRoots, strongTokens)) {
                continue;
            }
            seenSearchSlugs[results[r].slug] = 1;
            searchResults.push(results[r]);
        }
    }

    if (searchResults.length === 0) {
        return [];
    }

    for (var s = 0; s < searchResults.length; s++) {
        searchResults[s]._score = scoreResult(searchResults[s].slug, info, expectedRoots, strongTokens, s);
    }
    searchResults.sort(function(a, b) { return b._score - a._score; });

    var searchUrls = [];
    var seenSearchUrls = {};
    var maxResultsToTry = Math.min(searchResults.length, 4);
    for (var sr = 0; sr < maxResultsToTry; sr++) {
        var slug = searchResults[sr].slug;
        var firstLetter = slug.charAt(0).toUpperCase() || 'T';
        for (var c2 = 0; c2 < cdnList.length; c2++) {
            var cdn2 = cdnList[c2];
            var url2;
            if (mediaType === 'movie') {
                url2 = cdn2 + '/' + firstLetter + '/' + slug + '/stream/stream.m3u8?nocache=' + timestamp;
            } else {
                url2 = cdn2 + '/' + firstLetter + '/' + slug + '/' + seasonPadded + '-temporada/' + epPadded + '/stream.m3u8?nocache=' + timestamp;
            }
            if (!seenSearchUrls[url2]) {
                seenSearchUrls[url2] = 1;
                searchUrls.push({ url: url2, slug: slug, score: searchResults[sr]._score, cdn: cdn2 });
            }
        }
    }

    var seenStreamUrl = {};
    for (var su = 0; su < searchUrls.length; su++) {
        if (seenStreamUrl[searchUrls[su].url]) {
            continue;
        }
        seenStreamUrl[searchUrls[su].url] = 1;
        if (await testUrl(searchUrls[su].url)) {
            return [{
                url: searchUrls[su].url,
                headers: HEADERS,
                name: 'Doramogo',
                quality: 1080,
                title: (mediaType === 'movie' ? info.title : info.title + ' S' + targetSeason + ' EP' + targetEpisode),
        }];
        }
    }

    return [];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
p
