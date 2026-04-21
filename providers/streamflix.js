/**
 * streamflix - Debug com Etapa 5 (Buscar URL Real)
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
    // ETAPA 3: Buscar Filmes no StreamFlix
    // ==========================================
    let movies = [];
    try {
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl, { headers: HEADERS });
      
      if (moviesRes.ok) {
        const data = yield moviesRes.json();
        if (Array.isArray(data)) {
          movies = data;
          debugStreams.push({
            name: `✅ [3/5] Filmes: ${movies.length} filmes carregados`,
            title: "API de filmes OK",
            url: `debug://movies?count=${movies.length}`,
            quality: 1080,
            headers: HEADERS
          });
        } else {
          debugStreams.push({
            name: `⚠️ [3/5] Filmes: Resposta não é array`,
            title: "Formato inesperado",
            url: `debug://movies-invalid`,
            quality: 1080,
            headers: HEADERS
          });
        }
      } else {
        debugStreams.push({
          name: `❌ [3/5] Filmes HTTP ${moviesRes.status}`,
          title: "Erro na requisição",
          url: `debug://movies-http-error`,
          quality: 1080,
          headers: HEADERS
        });
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
    // ETAPA 4: Buscar Séries no StreamFlix
    // ==========================================
    let series = [];
    try {
      const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
      const seriesRes = yield fetch(seriesUrl, { headers: HEADERS });
      
      if (seriesRes.ok) {
        const data = yield seriesRes.json();
        if (Array.isArray(data)) {
          series = data;
          debugStreams.push({
            name: `✅ [4/5] Séries: ${series.length} séries carregadas`,
            title: "API de séries OK",
            url: `debug://series?count=${series.length}`,
            quality: 1080,
            headers: HEADERS
          });
        } else {
          debugStreams.push({
            name: `⚠️ [4/5] Séries: Resposta não é array`,
            title: "Formato inesperado",
            url: `debug://series-invalid`,
            quality: 1080,
            headers: HEADERS
          });
        }
      } else {
        debugStreams.push({
          name: `❌ [4/5] Séries HTTP ${seriesRes.status}`,
          title: "Erro na requisição",
          url: `debug://series-http-error`,
          quality: 1080,
          headers: HEADERS
        });
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
    // ETAPA 5: Buscar URL Real do Vídeo
    // ==========================================
    if (tmdbTitle) {
      const searchTerm = tmdbTitle.toLowerCase().substring(0, 25);
      let foundItem = null;
      
      // Busca primeiro em filmes
      for (const movie of movies) {
        if (movie.name && movie.name.toLowerCase().includes(searchTerm)) {
          foundItem = movie;
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
      
      // Se não achou, busca em séries
      if (!foundItem && mediaType === "tv") {
        for (const serie of series) {
          if (serie.name && serie.name.toLowerCase().includes(searchTerm)) {
            foundItem = serie;
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
      
      // Se encontrou, tenta obter a URL real
      if (foundItem) {
        try {
          let videoUrl = null;
          
          if (foundItem.stream_id) {
            // É filme
            const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${foundItem.stream_id}`;
            const streamRes = yield fetch(streamUrl, { headers: HEADERS });
            
            if (streamRes.ok) {
              const streamData = yield streamRes.json();
              videoUrl = streamData.stream_url;
              
              if (videoUrl) {
                const quality = getQuality(videoUrl);
                debugStreams.push({
                  name: `🎬 [5/5] STREAM ENCONTRADO!`,
                  title: `${tmdbTitle} - ${quality}p`,
                  url: videoUrl,
                  quality: quality,
                  headers: HEADERS
                });
              } else {
                debugStreams.push({
                  name: `❌ [5/5] URL vazia para ${foundItem.name.substring(0, 30)}`,
                  title: "stream_url não retornado",
                  url: `debug://no-url`,
                  quality: 1080,
                  headers: HEADERS
                });
              }
            } else {
              debugStreams.push({
                name: `❌ [5/5] HTTP ${streamRes.status} ao buscar stream`,
                title: `ID: ${foundItem.stream_id || foundItem.series_id}`,
                url: `debug://stream-http-error`,
                quality: 1080,
                headers: HEADERS
              });
            }
          } else if (foundItem.series_id && mediaType === "tv") {
            // É série - precisa buscar episódio específico
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
                    videoUrl = streamData.stream_url;
                    
                    if (videoUrl) {
                      const quality = getQuality(videoUrl);
                      debugStreams.push({
                        name: `🎬 [5/5] STREAM SÉRIE ENCONTRADO!`,
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
                    title: `Temporada ${seasonNum} existe, mas episódio não`,
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
            } else {
              debugStreams.push({
                name: `❌ [5/5] Erro ao buscar info da série`,
                title: `HTTP ${infoRes.status}`,
                url: `debug://series-info-error`,
                quality: 1080,
                headers: HEADERS
              });
            }
          }
        } catch (e) {
          debugStreams.push({
            name: `❌ [5/5] Exceção: ${e.message.substring(0, 40)}`,
            title: "Erro ao buscar URL",
            url: `debug://exception`,
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

function getQuality(url) {
  if (!url) return 720;
  const v = url.toLowerCase();
  if (v.includes("2160") || v.includes("4k")) return 2160;
  if (v.includes("1080")) return 1080;
  if (v.includes("720")) return 720;
  return 720;
}

module.exports = { getStreams };
