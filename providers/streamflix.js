/**
 * streamflix - Debug com Resposta Completa da API
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

// Headers completos (iguais aos que funcionaram)
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
      name: `🔍 [1/5] ID:${tmdbId} Type:${mediaType} S${seasonNum}E${episodeNum}`,
      title: "StreamFlix - Parâmetros",
      url: `debug://params?tmdbId=${tmdbId}&type=${mediaType}`,
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
        debugStreams.push({
          name: `✅ [2/5] TMDB: ${tmdbTitle}`,
          title: "Título encontrado",
          url: `debug://tmdb?title=${encodeURIComponent(tmdbTitle)}`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        debugStreams.push({
          name: `❌ [2/5] TMDB Falhou: ${tmdbResponse.status}`,
          title: "Erro TMDB",
          url: `debug://tmdb-error?status=${tmdbResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [2/5] TMDB Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção TMDB",
        url: `debug://tmdb-exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 3: Buscar Filmes (com resposta completa)
    // ==========================================
    try {
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl, { headers: HEADERS });
      const moviesText = yield moviesRes.text();
      
      // Tenta formatar JSON bonito
      let formattedMovies = moviesText;
      try {
        const parsed = JSON.parse(moviesText);
        formattedMovies = JSON.stringify(parsed, null, 2);
      } catch (e) {}
      
      // Limita tamanho
      const maxLen = 800;
      const displayMovies = formattedMovies.length > maxLen 
        ? formattedMovies.substring(0, maxLen) + "\n... [TRUNCADO]"
        : formattedMovies;
      
      debugStreams.push({
        name: `📽️ [3/5] FILMES - Status: ${moviesRes.status}`,
        title: `Resposta da API (${moviesText.length} bytes)`,
        url: `data:text/plain,${encodeURIComponent(displayMovies)}`,
        quality: 1080,
        headers: HEADERS
      });
      
      // Tenta extrair array se for objeto
      let moviesArray = [];
      try {
        const parsed = JSON.parse(moviesText);
        if (Array.isArray(parsed)) {
          moviesArray = parsed;
        } else if (parsed && typeof parsed === "object") {
          // Procura por arrays dentro do objeto
          for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
              moviesArray = parsed[key];
              debugStreams.push({
                name: `📦 [3/5] Array encontrado na chave: ${key}`,
                title: `${moviesArray.length} itens`,
                url: `debug://array-key?key=${key}`,
                quality: 1080,
                headers: HEADERS
              });
              break;
            }
          }
        }
      } catch (e) {}
      
      // Mostra primeiros itens do array
      if (moviesArray.length > 0) {
        for (let i = 0; i < Math.min(3, moviesArray.length); i++) {
          const item = moviesArray[i];
          debugStreams.push({
            name: `📽️ Ex${i+1}: ${item.name ? item.name.substring(0, 40) : "Sem nome"}`,
            title: `ID: ${item.stream_id || item.series_id || "?"}`,
            url: `debug://movie-item?name=${encodeURIComponent(item.name || "")}`,
            quality: 1080,
            headers: HEADERS
          });
        }
      }
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [3/5] Filmes Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção",
        url: `debug://movies-exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 4: Buscar Séries (com resposta completa)
    // ==========================================
    try {
      const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
      const seriesRes = yield fetch(seriesUrl, { headers: HEADERS });
      const seriesText = yield seriesRes.text();
      
      // Tenta formatar JSON bonito
      let formattedSeries = seriesText;
      try {
        const parsed = JSON.parse(seriesText);
        formattedSeries = JSON.stringify(parsed, null, 2);
      } catch (e) {}
      
      // Limita tamanho
      const maxLen = 800;
      const displaySeries = formattedSeries.length > maxLen 
        ? formattedSeries.substring(0, maxLen) + "\n... [TRUNCADO]"
        : formattedSeries;
      
      debugStreams.push({
        name: `📺 [4/5] SÉRIES - Status: ${seriesRes.status}`,
        title: `Resposta da API (${seriesText.length} bytes)`,
        url: `data:text/plain,${encodeURIComponent(displaySeries)}`,
        quality: 1080,
        headers: HEADERS
      });
      
      // Tenta extrair array se for objeto
      let seriesArray = [];
      try {
        const parsed = JSON.parse(seriesText);
        if (Array.isArray(parsed)) {
          seriesArray = parsed;
        } else if (parsed && typeof parsed === "object") {
          for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
              seriesArray = parsed[key];
              debugStreams.push({
                name: `📦 [4/5] Array encontrado na chave: ${key}`,
                title: `${seriesArray.length} itens`,
                url: `debug://array-key?key=${key}`,
                quality: 1080,
                headers: HEADERS
              });
              break;
            }
          }
        }
      } catch (e) {}
      
      // Mostra primeiros itens do array
      if (seriesArray.length > 0) {
        for (let i = 0; i < Math.min(3, seriesArray.length); i++) {
          const item = seriesArray[i];
          debugStreams.push({
            name: `📺 Ex${i+1}: ${item.name ? item.name.substring(0, 40) : "Sem nome"}`,
            title: `ID: ${item.stream_id || item.series_id || "?"}`,
            url: `debug://series-item?name=${encodeURIComponent(item.name || "")}`,
            quality: 1080,
            headers: HEADERS
          });
        }
      }
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [4/5] Séries Erro: ${e.message.substring(0, 40)}`,
        title: "Exceção",
        url: `debug://series-exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 5: Buscar URL Real (com debug)
    // ==========================================
    if (tmdbTitle) {
      debugStreams.push({
        name: `🔎 [5/5] Buscando match para: ${tmdbTitle.substring(0, 35)}`,
        title: "Procurando nos filmes/séries",
        url: `debug://searching?q=${encodeURIComponent(tmdbTitle)}`,
        quality: 1080,
        headers: HEADERS
      });
    } else {
      debugStreams.push({
        name: `⚠️ [5/5] Sem TMDB, pulando busca`,
        title: "TMDB não retornou título",
        url: `debug://no-tmdb`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
