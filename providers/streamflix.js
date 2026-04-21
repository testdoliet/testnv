/**
 * streamflix - Debug para Contar Filmes Carregados
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
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Referer": "https://streamflix.live/"
};

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    
    const debugStreams = [];
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    // ==========================================
    // ETAPA 1: Parâmetros
    // ==========================================
    debugStreams.push({
      name: `🔍 [1/6] ID:${tmdbId} Type:${mediaType} S${seasonNum}E${episodeNum}`,
      title: "StreamFlix - Parâmetros",
      url: `debug://params`,
      quality: 1080,
      headers: HEADERS
    });
    
    // ==========================================
    // ETAPA 2: TMDB
    // ==========================================
    let tmdbTitle = null;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const tmdbResponse = yield fetch(tmdbUrl, { headers: HEADERS });
      
      if (tmdbResponse.ok) {
        const data = yield tmdbResponse.json();
        tmdbTitle = mediaType === "tv" ? data.name : data.title;
        debugStreams.push({
          name: `✅ [2/6] TMDB: ${tmdbTitle}`,
          title: "Título encontrado",
          url: `debug://tmdb`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        debugStreams.push({
          name: `❌ [2/6] TMDB Falhou: ${tmdbResponse.status}`,
          title: "Erro TMDB",
          url: `debug://tmdb-error`,
          quality: 1080,
          headers: HEADERS
        });
        return debugStreams;
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [2/6] TMDB Erro`,
        title: e.message.substring(0, 50),
        url: `debug://tmdb-error`,
        quality: 1080,
        headers: HEADERS
      });
      return debugStreams;
    }
    
    // ==========================================
    // ETAPA 3: Buscar Filmes e CONTAR
    // ==========================================
    try {
      debugStreams.push({
        name: `📥 [3/6] Baixando filmes...`,
        title: `URL: ${BASE_URL}/api_proxy.php?action=get_vod_streams`,
        url: `debug://downloading-movies`,
        quality: 1080,
        headers: HEADERS
      });
      
      const moviesRes = yield fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`, { headers: HEADERS });
      const moviesText = yield moviesRes.text();
      const moviesSize = moviesText.length;
      
      debugStreams.push({
        name: `📊 [3/6] Tamanho da resposta: ${(moviesSize / 1024 / 1024).toFixed(2)} MB`,
        title: `${moviesSize} bytes`,
        url: `debug://movies-size`,
        quality: 1080,
        headers: HEADERS
      });
      
      // Tenta contar quantos filmes
      let moviesCount = 0;
      let isArray = false;
      let firstItem = "";
      
      try {
        const parsed = JSON.parse(moviesText);
        isArray = Array.isArray(parsed);
        
        if (isArray) {
          moviesCount = parsed.length;
          if (parsed.length > 0) {
            firstItem = JSON.stringify(parsed[0]).substring(0, 100);
          }
        } else if (parsed && typeof parsed === "object") {
          // Procura por array dentro do objeto
          for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
              moviesCount = parsed[key].length;
              isArray = true;
              firstItem = JSON.stringify(parsed[key][0]).substring(0, 100);
              break;
            }
          }
        }
      } catch (e) {
        debugStreams.push({
          name: `❌ [3/6] Erro ao parsear JSON: ${e.message}`,
          title: "JSON inválido",
          url: `debug://json-error`,
          quality: 1080,
          headers: HEADERS
        });
      }
      
      if (isArray) {
        debugStreams.push({
          name: `✅ [3/6] Filmes: ${moviesCount} filmes encontrados!`,
          title: `É um array com ${moviesCount} itens`,
          url: `debug://movies-count-${moviesCount}`,
          quality: 1080,
          headers: HEADERS
        });
        
        if (firstItem) {
          debugStreams.push({
            name: `📋 [3/6] Exemplo do primeiro filme:`,
            title: firstItem,
            url: `debug://first-movie`,
            quality: 1080,
            headers: HEADERS
          });
        }
      } else {
        debugStreams.push({
          name: `⚠️ [3/6] Resposta NÃO é um array!`,
          title: `Tipo: ${typeof parsed}`,
          url: `debug://not-array`,
          quality: 1080,
          headers: HEADERS
        });
      }
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [3/6] Erro ao buscar filmes: ${e.message}`,
        title: "Exceção",
        url: `debug://movies-exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 4: Buscar Séries e CONTAR
    // ==========================================
    try {
      debugStreams.push({
        name: `📥 [4/6] Baixando séries...`,
        title: `URL: ${BASE_URL}/api_proxy.php?action=get_series`,
        url: `debug://downloading-series`,
        quality: 1080,
        headers: HEADERS
      });
      
      const seriesRes = yield fetch(`${BASE_URL}/api_proxy.php?action=get_series`, { headers: HEADERS });
      const seriesText = yield seriesRes.text();
      const seriesSize = seriesText.length;
      
      debugStreams.push({
        name: `📊 [4/6] Tamanho da resposta: ${(seriesSize / 1024 / 1024).toFixed(2)} MB`,
        title: `${seriesSize} bytes`,
        url: `debug://series-size`,
        quality: 1080,
        headers: HEADERS
      });
      
      let seriesCount = 0;
      let isArray = false;
      
      try {
        const parsed = JSON.parse(seriesText);
        isArray = Array.isArray(parsed);
        
        if (isArray) {
          seriesCount = parsed.length;
        } else if (parsed && typeof parsed === "object") {
          for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
              seriesCount = parsed[key].length;
              isArray = true;
              break;
            }
          }
        }
      } catch (e) {}
      
      if (isArray) {
        debugStreams.push({
          name: `✅ [4/6] Séries: ${seriesCount} séries encontradas!`,
          title: `É um array com ${seriesCount} itens`,
          url: `debug://series-count-${seriesCount}`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        debugStreams.push({
          name: `⚠️ [4/6] Resposta NÃO é um array!`,
          title: "Verifique estrutura",
          url: `debug://series-not-array`,
          quality: 1080,
          headers: HEADERS
        });
      }
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [4/6] Erro ao buscar séries: ${e.message}`,
        title: "Exceção",
        url: `debug://series-exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 5: Buscar Stream URL (se encontrou título)
    // ==========================================
    if (tmdbTitle) {
      debugStreams.push({
        name: `🔎 [5/6] Buscando stream para: ${tmdbTitle.substring(0, 30)}`,
        title: "Aguardando...",
        url: `debug://searching`,
        quality: 1080,
        headers: HEADERS
      });
      
      // Tenta usar ID fixo para teste (Central do Brasil = 821786)
      if (tmdbTitle.toLowerCase().includes("central")) {
        try {
          const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=821786`;
          const streamRes = yield fetch(streamUrl, { headers: HEADERS });
          
          if (streamRes.ok) {
            const streamData = yield streamRes.json();
            const videoUrl = streamData.stream_url;
            
            if (videoUrl) {
              debugStreams.push({
                name: `🎬 [6/6] STREAM ENCONTRADO! (ID fixo)`,
                title: `Central do Brasil - 720p`,
                url: videoUrl,
                quality: 720,
                headers: HEADERS
              });
            }
          }
        } catch (e) {}
      }
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
