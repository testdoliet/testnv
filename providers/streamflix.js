/**
 * streamflix - Debug com Etapa 1, 2, 3 e 4
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

// URL real que funciona para debug
var REAL_VIDEO_URL = "https://turbo.fontedosmov.sbs/t/1776772682.c04d541256c935f0cd473e080bf19fdc408c79e345578e5464df5254308d227f/Nacionais/Central%20do%20Brasil.mp4";

// ==============================================
// FUNÇÃO PRINCIPAL - DEBUG ETAPA 1, 2, 3 e 4
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
      name: `🔍 [1/8] ID:${tmdbId} Type:${mediaType} S${seasonNum}E${episodeNum}`,
      title: "StreamFlix - Parâmetros recebidos",
      url: REAL_VIDEO_URL,
      quality: 1080,
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
    });
    
    // ==========================================
    // ETAPA 2: Teste de Conexão com StreamFlix
    // ==========================================
    try {
      const testUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const testResponse = yield fetch(testUrl, { 
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      });
      
      debugStreams.push({
        name: testResponse.ok ? `✅ [2/8] StreamFlix OK Status:${testResponse.status}` : `❌ [2/8] StreamFlix Falhou Status:${testResponse.status}`,
        title: "Teste de conexão",
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
      });
    } catch (e) {
      debugStreams.push({
        name: `❌ [2/8] Erro: ${e.message.substring(0, 50)}`,
        title: "Erro de conexão",
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
      });
    }
    
    // ==========================================
    // ETAPA 3: Buscar Título no TMDB
    // ==========================================
    let tmdbTitle = null;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const tmdbResponse = yield fetch(tmdbUrl, {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      });
      
      if (tmdbResponse.ok) {
        const data = yield tmdbResponse.json();
        tmdbTitle = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        
        debugStreams.push({
          name: `✅ [3/8] TMDB: ${tmdbTitle} (${year || "?"})`,
          title: "Título encontrado no TMDB",
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
        });
      } else {
        debugStreams.push({
          name: `❌ [3/8] TMDB Falhou Status:${tmdbResponse.status}`,
          title: "Erro ao buscar TMDB",
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [3/8] TMDB Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção no TMDB",
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
      });
    }
    
    // ==========================================
    // ETAPA 4: Buscar Filmes no StreamFlix
    // ==========================================
    try {
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      });
      
      if (moviesRes.ok) {
        const movies = yield moviesRes.json();
        const movieCount = movies ? movies.length : 0;
        
        debugStreams.push({
          name: `✅ [4/8] Filmes: ${movieCount} filmes carregados`,
          title: "Lista de filmes obtida",
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
        });
        
        // Mostra os primeiros 5 filmes como streams separados
        if (movies && movies.length > 0) {
          for (let i = 0; i < Math.min(5, movies.length); i++) {
            const movie = movies[i];
            const movieName = movie.name ? movie.name.substring(0, 50) : "Sem nome";
            debugStreams.push({
              name: `📽️ Ex${i+1}: ${movieName}`,
              title: `ID: ${movie.stream_id || "?"}`,
              url: REAL_VIDEO_URL,
              quality: 1080,
              headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
            });
          }
        }
        
        // Tenta encontrar correspondência com o título do TMDB
        if (tmdbTitle) {
          const searchTerm = tmdbTitle.toLowerCase().substring(0, 20);
          let found = null;
          
          for (const movie of movies) {
            if (movie.name && movie.name.toLowerCase().includes(searchTerm)) {
              found = movie;
              break;
            }
          }
          
          if (found) {
            debugStreams.push({
              name: `🎯 Match: ${found.name.substring(0, 45)}`,
              title: `ID: ${found.stream_id} - Correspondência encontrada!`,
              url: REAL_VIDEO_URL,
              quality: 1080,
              headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
            });
          } else {
            debugStreams.push({
              name: `⚠️ Sem match para: ${tmdbTitle.substring(0, 30)}`,
              title: "Nenhuma correspondência encontrada",
              url: REAL_VIDEO_URL,
              quality: 1080,
              headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
            });
          }
        }
      } else {
        debugStreams.push({
          name: `❌ [4/8] Filmes Falhou Status:${moviesRes.status}`,
          title: "Erro ao buscar filmes",
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [4/8] Filmes Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção ao buscar filmes",
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://turbo.fontedosmov.sbs/" }
      });
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
