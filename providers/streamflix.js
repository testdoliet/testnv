/**
 * streamflix - Built for CloudStream
 * Generated: 2026-04-21
 */

var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ==============================================
// CONSTANTS
// ==============================================

var BASE_URL = "https://streamflix.live";
var TMDB_API_KEY = "b64d2f3a4212a99d64a7d4485faed7b3";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
  "Accept": "application/json",
  "Referer": "https://streamflix.live/"
};

// ==============================================
// UTILS
// ==============================================

function matchQuality(s) {
  if (!s) return "720p";
  const v = s.toLowerCase();
  if (v.includes("2160") || v.includes("4k")) return "4K";
  if (v.includes("1080")) return "1080p";
  if (v.includes("720")) return "720p";
  if (v.includes("480")) return "480p";
  return "720p";
}

function getQualityNumber(qualityStr) {
  if (qualityStr === "4K") return 2160;
  if (qualityStr === "1080p") return 1080;
  if (qualityStr === "720p") return 720;
  return 720;
}

function normalizeTitle(title) {
  if (!title) return "";
  return title.toLowerCase()
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[:\-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    
    const response = yield fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    
    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`);
    
    const data = yield response.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
    
    return { title, year };
  });
}

function calculateTitleSimilarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  if (norm1 === norm2) return 1;
  
  const words1 = norm1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = norm2.split(/\s+/).filter((w) => w.length > 0);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set2 = new Set(words2);
  const intersection = words1.filter((w) => set2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return intersection.length / union.size;
}

function findBestMatch(mediaInfo, searchResults) {
  if (!searchResults || searchResults.length === 0) return null;
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const result of searchResults) {
    let score = calculateTitleSimilarity(mediaInfo.title, result.name);
    
    if (mediaInfo.year && result.year) {
      if (mediaInfo.year === result.year) score += 0.2;
    }
    
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = result;
    }
  }
  
  return bestMatch;
}

// ==============================================
// STREAMFLIX SPECIFIC FUNCTIONS
// ==============================================

function searchStreamFlix(query) {
  return __async(this, null, function* () {
    console.log(`[StreamFlix] Searching for: "${query}"`);
    
    try {
      // Busca filmes
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl, { headers: HEADERS });
      
      if (!moviesRes.ok) {
        console.log(`[StreamFlix] Movies fetch failed: ${moviesRes.status}`);
        return [];
      }
      
      const movies = yield moviesRes.json();
      console.log(`[StreamFlix] Found ${movies.length} movies`);
      
      // Busca séries
      const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
      const seriesRes = yield fetch(seriesUrl, { headers: HEADERS });
      
      if (!seriesRes.ok) {
        console.log(`[StreamFlix] Series fetch failed: ${seriesRes.status}`);
        return movies;
      }
      
      const series = yield seriesRes.json();
      console.log(`[StreamFlix] Found ${series.length} series`);
      
      // Combina resultados
      const allResults = [...movies, ...series];
      
      // Filtra por título
      const queryLower = query.toLowerCase();
      const filtered = allResults.filter(item => 
        item.name.toLowerCase().includes(queryLower)
      );
      
      console.log(`[StreamFlix] Filtered to ${filtered.length} results`);
      return filtered;
      
    } catch (error) {
      console.error(`[StreamFlix] Search error: ${error.message}`);
      return [];
    }
  });
}

function getVideoUrl(item, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[StreamFlix] Getting URL for: ${item.name} (ID: ${item.stream_id || item.series_id})`);
    
    try {
      let url = "";
      
      if (mediaType === "movie" || item.stream_id) {
        // É filme
        url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${item.stream_id}`;
      } else {
        // É série
        const infoUrl = `${BASE_URL}/api_proxy.php?action=get_series_info&series_id=${item.series_id}`;
        const infoRes = yield fetch(infoUrl, { headers: HEADERS });
        
        if (!infoRes.ok) {
          console.log(`[StreamFlix] Series info fetch failed`);
          return null;
        }
        
        const infoData = yield infoRes.json();
        const episodes = infoData.episodes;
        
        if (episodes && episodes[season]) {
          const episodeData = episodes[season].find((ep) => ep.episode_num == episode);
          if (episodeData) {
            url = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${episodeData.id}`;
          } else {
            console.log(`[StreamFlix] Episode ${episode} not found in season ${season}`);
            return null;
          }
        } else {
          console.log(`[StreamFlix] Season ${season} not found`);
          return null;
        }
      }
      
      if (!url) return null;
      
      const streamRes = yield fetch(url, { headers: HEADERS });
      
      if (!streamRes.ok) {
        console.log(`[StreamFlix] Stream fetch failed: ${streamRes.status}`);
        return null;
      }
      
      const streamData = yield streamRes.json();
      const videoUrl = streamData.stream_url;
      
      console.log(`[StreamFlix] Got URL: ${videoUrl ? videoUrl.substring(0, 80) + "..." : "null"}`);
      return videoUrl;
      
    } catch (error) {
      console.error(`[StreamFlix] Error getting URL: ${error.message}`);
      return null;
    }
  });
}

// ==============================================
// MAIN FUNCTION
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    console.log(`[StreamFlix] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}, S${season}E${episode}`);
    
    try {
      // 1. Buscar título no TMDB
      const mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      console.log(`[StreamFlix] Searching for: "${mediaInfo.title}" (${mediaInfo.year})`);
      
      // 2. Buscar no StreamFlix
      const searchResults = yield searchStreamFlix(mediaInfo.title);
      
      if (searchResults.length === 0) {
        console.log("[StreamFlix] No results found in StreamFlix.");
        return [];
      }
      
      // 3. Encontrar melhor correspondência
      const match = findBestMatch(mediaInfo, searchResults);
      
      if (!match) {
        console.log("[StreamFlix] No confident matches found.");
        return [];
      }
      
      console.log(`[StreamFlix] Match Found: "${match.name}" (ID: ${match.stream_id || match.series_id})`);
      
      // 4. Obter URL do vídeo
      const targetSeason = mediaType === "movie" ? 1 : (season || 1);
      const targetEpisode = mediaType === "movie" ? 1 : (episode || 1);
      
      const videoUrl = yield getVideoUrl(match, mediaType, targetSeason, targetEpisode);
      
      if (!videoUrl) {
        console.log("[StreamFlix] No video URL found.");
        return [];
      }
      
      // 5. Detectar qualidade
      let qualityStr = "720p";
      let qualityNum = 720;
      
      if (videoUrl.includes("2160") || videoUrl.includes("4k")) {
        qualityStr = "4K";
        qualityNum = 2160;
      } else if (videoUrl.includes("1080")) {
        qualityStr = "1080p";
        qualityNum = 1080;
      } else if (videoUrl.includes("720")) {
        qualityStr = "720p";
        qualityNum = 720;
      }
      
      // 6. Definir áudio
      const isLegendado = match.name.includes("[L]") || match.name.toLowerCase().includes("legendado");
      const audioType = isLegendado ? "Legendado" : "Dublado";
      
      // 7. Montar título
      let episodeTitle = "";
      if (mediaType === "movie") {
        episodeTitle = mediaInfo.title;
      } else {
        episodeTitle = `${mediaInfo.title} - S${String(targetSeason).padStart(2, '0')}E${String(targetEpisode).padStart(2, '0')}`;
      }
      
      // 8. Retornar stream
      const streams = [{
        name: `StreamFlix - ${mediaInfo.title} (${audioType})`,
        title: `${episodeTitle} - ${qualityStr}`,
        url: videoUrl,
        quality: qualityNum,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": BASE_URL
        }
      }];
      
      console.log(`[StreamFlix] Successfully found ${streams.length} stream.`);
      return streams;
      
    } catch (error) {
      console.error(`[StreamFlix] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
