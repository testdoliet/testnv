/**
 * streamflix - Debug com Etapa 1, 2 e 3
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
// FUNÇÃO PRINCIPAL - DEBUG ETAPA 1, 2 e 3
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    
    const debugStreams = [];
    
    // ==========================================
    // ETAPA 1: Parâmetros Recebidos
    // ==========================================
    console.log(`[StreamFlix] ETAPA 1 - ID: ${tmdbId}, Type: ${mediaType}, S${season}E${episode}`);
    
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    debugStreams.push({
      name: "🔍 [ETAPA 1/8] Parâmetros Recebidos",
      title: `ID: ${tmdbId} | Type: ${mediaType} | S${seasonNum}E${episodeNum}`,
      url: REAL_VIDEO_URL,
      quality: 1080,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://turbo.fontedosmov.sbs/"
      }
    });
    
    // ==========================================
    // ETAPA 2: Teste de Conexão com StreamFlix
    // ==========================================
    console.log(`[StreamFlix] ETAPA 2 - Testando conexão`);
    
    try {
      const testUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const testResponse = yield fetch(testUrl, { 
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      });
      
      if (testResponse.ok) {
        debugStreams.push({
          name: "✅ [ETAPA 2/8] Conexão StreamFlix OK",
          title: `Status: ${testResponse.status}`,
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://turbo.fontedosmov.sbs/"
          }
        });
      } else {
        debugStreams.push({
          name: "❌ [ETAPA 2/8] Conexão StreamFlix Falhou",
          title: `Status: ${testResponse.status}`,
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://turbo.fontedosmov.sbs/"
          }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: "❌ [ETAPA 2/8] Erro de Conexão",
        title: `Erro: ${e.message}`,
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://turbo.fontedosmov.sbs/"
        }
      });
    }
    
    // ==========================================
    // ETAPA 3: Buscar Título no TMDB
    // ==========================================
    console.log(`[StreamFlix] ETAPA 3 - Buscando TMDB para ID: ${tmdbId}`);
    
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      console.log(`[StreamFlix] TMDB URL: ${tmdbUrl}`);
      
      const tmdbResponse = yield fetch(tmdbUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      });
      
      if (tmdbResponse.ok) {
        const data = yield tmdbResponse.json();
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        
        debugStreams.push({
          name: "✅ [ETAPA 3/8] TMDB Encontrado",
          title: `"${title}" (${year || "sem ano"}) | ID: ${tmdbId}`,
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://turbo.fontedosmov.sbs/"
          }
        });
      } else {
        debugStreams.push({
          name: "❌ [ETAPA 3/8] TMDB Falhou",
          title: `Status: ${tmdbResponse.status} | ID: ${tmdbId}`,
          url: REAL_VIDEO_URL,
          quality: 1080,
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://turbo.fontedosmov.sbs/"
          }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: "❌ [ETAPA 3/8] TMDB Erro",
        title: `Erro: ${e.message}`,
        url: REAL_VIDEO_URL,
        quality: 1080,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://turbo.fontedosmov.sbs/"
        }
      });
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
