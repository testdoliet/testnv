/**
 * streamflix - Debug com Resposta da API no URL
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

// Headers mais completos
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://streamflix.live/",
  "Origin": "https://streamflix.live",
  "Connection": "keep-alive"
};

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    
    const debugStreams = [];
    
    // ==========================================
    // ETAPA 1: Parâmetros Recebidos
    // ==========================================
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    debugStreams.push({
      name: `🔍 [1/4] ID:${tmdbId} Type:${mediaType} S${seasonNum}E${episodeNum}`,
      title: "StreamFlix - Parâmetros",
      url: `debug://params?tmdbId=${tmdbId}&type=${mediaType}&season=${seasonNum}&episode=${episodeNum}`,
      quality: 1080,
      headers: HEADERS
    });
    
    // ==========================================
    // ETAPA 2: Buscar TMDB
    // ==========================================
    let tmdbTitle = null;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const tmdbResponse = yield fetch(tmdbUrl, { headers: HEADERS });
      
      if (tmdbResponse.ok) {
        const data = yield tmdbResponse.json();
        tmdbTitle = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        
        debugStreams.push({
          name: `✅ [2/4] TMDB: ${tmdbTitle} (${year || "?"})`,
          title: "Título encontrado",
          url: `debug://tmdb?title=${encodeURIComponent(tmdbTitle)}&year=${year || ""}`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        debugStreams.push({
          name: `❌ [2/4] TMDB Falhou: ${tmdbResponse.status}`,
          title: "Erro TMDB",
          url: `debug://tmdb-error?status=${tmdbResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [2/4] TMDB Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção TMDB",
        url: `debug://tmdb-exception?msg=${encodeURIComponent(e.message)}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 3: Buscar FILMES no StreamFlix
    // ==========================================
    try {
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl, { headers: HEADERS });
      const moviesText = yield moviesRes.text();
      
      // Tenta formatar a resposta
      let formattedResponse = moviesText;
      try {
        const parsed = JSON.parse(moviesText);
        formattedResponse = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Mantém o texto original
      }
      
      // Limita o tamanho para não estourar
      const maxLength = 800;
      const displayText = formattedResponse.length > maxLength 
        ? formattedResponse.substring(0, maxLength) + "...\n[TRUNCADO]"
        : formattedResponse;
      
      debugStreams.push({
        name: `📽️ [3/4] FILMES - Status: ${moviesRes.status}`,
        title: `Resposta da API de filmes (${moviesText.length} bytes)`,
        url: `data:text/plain,${encodeURIComponent(displayText)}`,
        quality: 1080,
        headers: HEADERS
      });
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [3/4] FILMES Erro: ${e.message.substring(0, 40)}`,
        title: "Erro na requisição",
        url: `debug://movies-error?msg=${encodeURIComponent(e.message)}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 4: Buscar SÉRIES no StreamFlix
    // ==========================================
    try {
      const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
      const seriesRes = yield fetch(seriesUrl, { headers: HEADERS });
      const seriesText = yield seriesRes.text();
      
      // Tenta formatar a resposta
      let formattedResponse = seriesText;
      try {
        const parsed = JSON.parse(seriesText);
        formattedResponse = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Mantém o texto original
      }
      
      // Limita o tamanho para não estourar
      const maxLength = 800;
      const displayText = formattedResponse.length > maxLength 
        ? formattedResponse.substring(0, maxLength) + "...\n[TRUNCADO]"
        : formattedResponse;
      
      debugStreams.push({
        name: `📺 [4/4] SÉRIES - Status: ${seriesRes.status}`,
        title: `Resposta da API de séries (${seriesText.length} bytes)`,
        url: `data:text/plain,${encodeURIComponent(displayText)}`,
        quality: 1080,
        headers: HEADERS
      });
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [4/4] SÉRIES Erro: ${e.message.substring(0, 40)}`,
        title: "Erro na requisição",
        url: `debug://series-error?msg=${encodeURIComponent(e.message)}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
