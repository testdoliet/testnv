/**
 * streamflix - Busca URL Real com Resposta da API no Debug
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
      name: `🔍 [1/5] ID:${tmdbId} Type:${mediaType} S${seasonNum}E${episodeNum}`,
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
          name: `✅ [2/5] TMDB: ${tmdbTitle}`,
          title: "Título encontrado",
          url: `debug://tmdb`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        debugStreams.push({
          name: `❌ [2/5] TMDB Falhou: ${tmdbResponse.status}`,
          title: "Erro TMDB",
          url: `debug://tmdb-error`,
          quality: 1080,
          headers: HEADERS
        });
      }
    } catch (e) {
      debugStreams.push({
        name: `❌ [2/5] TMDB Erro`,
        title: e.message.substring(0, 50),
        url: `debug://tmdb-error`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    // ==========================================
    // ETAPA 3: Buscar Filmes (com resposta completa no URL)
    // ==========================================
    try {
      const moviesRes = yield fetch(`${BASE_URL}/api_proxy.php?action=get_vod_streams`, { headers: HEADERS });
      const moviesText = yield moviesRes.text();
      
      // Formata JSON bonito
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
      
      // Processa os filmes para busca
      let movies = [];
      try {
        const parsed = JSON.parse(moviesText);
        if (Array.isArray(parsed)) {
          movies = parsed;
        } else if (parsed && typeof parsed === "object") {
          for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
              movies = parsed[key];
              break;
            }
          }
        }
      } catch (e) {}
      
      // ==========================================
      // ETAPA 4: Buscar Séries (com resposta completa no URL)
      // ==========================================
      try {
        const seriesRes = yield fetch(`${BASE_URL}/api_proxy.php?action=get_series`, { headers: HEADERS });
        const seriesText = yield seriesRes.text();
        
        let formattedSeries = seriesText;
        try {
          const parsed = JSON.parse(seriesText);
          formattedSeries = JSON.stringify(parsed, null, 2);
        } catch (e) {}
        
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
        
        // Processa as séries para busca
        let series = [];
        try {
          const parsed = JSON.parse(seriesText);
          if (Array.isArray(parsed)) {
            series = parsed;
          } else if (parsed && typeof parsed === "object") {
            for (const key in parsed) {
              if (Array.isArray(parsed[key])) {
                series = parsed[key];
                break;
              }
            }
          }
        } catch (e) {}
        
        // ==========================================
        // ETAPA 5: Buscar URL Real
        // ==========================================
        if (tmdbTitle) {
          const searchTerm = tmdbTitle.toLowerCase().substring(0, 25);
          let foundItem = null;
          let foundType = null;
          
          // Busca em filmes
          for (const movie of movies) {
            if (movie.name && movie.name.toLowerCase().includes(searchTerm)) {
              foundItem = movie;
              foundType = "movie";
              debugStreams.push({
                name: `🎯 [5/5] Match Filme: ${movie.name.substring(0, 40)}`,
                title: `ID: ${movie.stream_id}`,
                url: `debug://match-movie?id=${movie.stream_id}`,
                quality: 1080,
                headers: HEADERS
              });
              break;
            }
          }
          
          // Busca em séries se não achou
          if (!foundItem && mediaType === "tv") {
            for (const serie of series) {
              if (serie.name && serie.name.toLowerCase().includes(searchTerm)) {
                foundItem = serie;
                foundType = "series";
                debugStreams.push({
                  name: `🎯 [5/5] Match Série: ${serie.name.substring(0, 40)}`,
                  title: `ID: ${serie.series_id}`,
                  url: `debug://match-series?id=${serie.series_id}`,
                  quality: 1080,
                  headers: HEADERS
                });
                break;
              }
            }
          }
          
          // Tenta obter URL do vídeo
          if (foundItem && foundType === "movie") {
            try {
              const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${foundItem.stream_id}`;
              const streamRes = yield fetch(streamUrl, { headers: HEADERS });
              
              if (streamRes.ok) {
                const streamData = yield streamRes.json();
                const videoUrl = streamData.stream_url;
                
                if (videoUrl) {
                  let quality = 720;
                  if (videoUrl.includes("1080")) quality = 1080;
                  if (videoUrl.includes("2160") || videoUrl.includes("4k")) quality = 2160;
                  
                  debugStreams.push({
                    name: `🎬 STREAM ENCONTRADO!`,
                    title: `${tmdbTitle} - ${quality}p`,
                    url: videoUrl,
                    quality: quality,
                    headers: HEADERS
                  });
                } else {
                  debugStreams.push({
                    name: `❌ [5/5] URL vazia`,
                    title: `stream_url não retornado`,
                    url: `debug://no-url`,
                    quality: 1080,
                    headers: HEADERS
                  });
                }
              } else {
                debugStreams.push({
                  name: `❌ [5/5] HTTP ${streamRes.status}`,
                  title: `Erro ao buscar stream`,
                  url: `debug://stream-http-error`,
                  quality: 1080,
                  headers: HEADERS
                });
              }
            } catch (e) {
              debugStreams.push({
                name: `❌ [5/5] Exceção: ${e.message.substring(0, 40)}`,
                title: "Erro",
                url: `debug://exception`,
                quality: 1080,
                headers: HEADERS
              });
            }
          } else if (foundItem && foundType === "series") {
            try {
              const infoUrl = `${BASE_URL}/api_proxy.php?action=get_series_info&series_id=${foundItem.series_id}`;
              const infoRes = yield fetch(infoUrl, { headers: HEADERS });
              
              if (infoRes.ok) {
                const infoData = yield infoRes.json();
                const episodes = infoData.episodes;
                
                if (episodes && episodes[seasonNum]) {
                  const episodeData = episodes[seasonNum].find(ep => ep.episode_num == episodeNum);
                  if (episodeData) {
                    const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=series&id=${episodeData.id}`;
                    const streamRes = yield fetch(streamUrl, { headers: HEADERS });
                    
                    if (streamRes.ok) {
                      const streamData = yield streamRes.json();
                      const videoUrl = streamData.stream_url;
                      
                      if (videoUrl) {
                        let quality = 720;
                        if (videoUrl.includes("1080")) quality = 1080;
                        if (videoUrl.includes("2160") || videoUrl.includes("4k")) quality = 2160;
                        
                        debugStreams.push({
                          name: `🎬 STREAM SÉRIE ENCONTRADO!`,
                          title: `${tmdbTitle} S${seasonNum}E${episodeNum} - ${quality}p`,
                          url: videoUrl,
                          quality: quality,
                          headers: HEADERS
                        });
                      }
                    }
                  } else {
                    debugStreams.push({
                      name: `⚠️ [5/5] Episódio ${episodeNum} não encontrado`,
                      title: `Temporada ${seasonNum} existe`,
                      url: `debug://episode-not-found`,
                      quality: 1080,
                      headers: HEADERS
                    });
                  }
                } else {
                  debugStreams.push({
                    name: `⚠️ [5/5] Temporada ${seasonNum} não encontrada`,
                    title: `Série: ${foundItem.name.substring(0, 30)}`,
                    url: `debug://season-not-found`,
                    quality: 1080,
                    headers: HEADERS
                  });
                }
              }
            } catch (e) {
              debugStreams.push({
                name: `❌ [5/5] Exceção série: ${e.message.substring(0, 40)}`,
                title: "Erro",
                url: `debug://series-exception`,
                quality: 1080,
                headers: HEADERS
              });
            }
          } else {
            debugStreams.push({
              name: `⚠️ [5/5] Nenhum match para "${tmdbTitle.substring(0, 30)}"`,
              title: "Tente buscar manualmente",
              url: `debug://no-match`,
              quality: 1080,
              headers: HEADERS
            });
          }
        } else {
          debugStreams.push({
            name: `⚠️ [5/5] Sem TMDB, pulando`,
            title: "TMDB não retornou título",
            url: `debug://no-tmdb`,
            quality: 1080,
            headers: HEADERS
          });
        }
        
      } catch (e) {
        debugStreams.push({
          name: `❌ [4/5] Séries Erro`,
          title: e.message.substring(0, 50),
          url: `debug://series-error`,
          quality: 1080,
          headers: HEADERS
        });
      }
      
    } catch (e) {
      debugStreams.push({
        name: `❌ [3/5] Filmes Erro`,
        title: e.message.substring(0, 50),
        url: `debug://movies-error`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return debugStreams;
  });
}

module.exports = { getStreams };
