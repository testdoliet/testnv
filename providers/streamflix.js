/**
 * Pomfy - Provider com Byse/9n8o
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

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://pomfy.online/",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
  "Cookie": COOKIE
};

// ==============================================
// FUNÇÃO: BASE64
// ==============================================

function base64ToBytes(base64) {
  let clean = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4) {
    clean += '=';
  }
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ==============================================
// FUNÇÃO: CONVERTER IMDb PARA TMDb
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

function convertImdbToTmdb(imdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      const data = yield response.json();
      let results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
      if (results && results.length > 0) {
        return { success: true, tmdbId: results[0].id };
      }
      return { success: false, error: "Nenhum resultado encontrado" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// ==============================================
// FUNÇÃO: GERAR FINGERPRINT
// ==============================================

function generateFingerprint() {
  const generateId = (len) => {
    const chars = "abcdef0123456789";
    let result = "";
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  const viewerId = generateId(32);
  const deviceId = generateId(32);
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93,
    iat: timestamp,
    exp: timestamp + 600
  };
  const token = btoa(JSON.stringify(payload));
  return {
    token: token,
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93
  };
}

// ==============================================
// FUNÇÃO: DESCRIPTOGRAFAR PLAYBACK
// ==============================================

function decryptPlayback(playback) {
  return __async(this, null, function* () {
    try {
      const { decryptPayload } = require('./crypto/aes-gcm.js');
      const result = yield decryptPayload(playback);
      return result;
    } catch (error) {
      // Fallback: tentar decodificar como base64 simples
      try {
        let clean = playback.payload.replace(/-/g, '+').replace(/_/g, '/');
        while (clean.length % 4) clean += '=';
        const decoded = atob(clean);
        const data = JSON.parse(decoded);
        let m3u8Url = data.sources?.[0]?.url || data.url;
        if (m3u8Url) {
          m3u8Url = m3u8Url.replace(/\\u0026/g, '&');
          return { success: true, url: m3u8Url };
        }
        return { success: false, error: "Nenhuma URL encontrada" };
      } catch (e) {
        return { success: false, error: error.message };
      }
    }
  });
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const streams = [];
    let finalTmdbId = tmdbId;
    
    // ==========================================
    // ETAPA 0: Converter IMDb para TMDb
    // ==========================================
    
    if (isImdbId(tmdbId)) {
      const conversion = yield convertImdbToTmdb(tmdbId, mediaType);
      if (!conversion.success) {
        streams.push({
          name: `❌ Falha conversão: ${conversion.error}`,
          title: "",
          url: `debug://conversion-failed`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      finalTmdbId = conversion.tmdbId;
      streams.push({
        name: `✅ Convertido: ${tmdbId} → ${finalTmdbId}`,
        title: "",
        url: `debug://converted`,
        quality: 1080,
        headers: HEADERS
      });
    } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
      finalTmdbId = parseInt(tmdbId);
    }
    
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    try {
      // ==========================================
      // ETAPA 1: Buscar HTML do Pomfy
      // ==========================================
      const pomfyUrl = mediaType === "movie" 
        ? `${API_POMFY}/filme/${finalTmdbId}`
        : `${API_POMFY}/serie/${finalTmdbId}/${seasonNum}/${episodeNum}`;
      
      const response = yield fetch(pomfyUrl, { headers: HEADERS });
      if (!response.ok) return streams;
      
      const html = yield response.text();
      const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
      if (!linkMatch) return streams;
      
      const byseUrl = linkMatch[1];
      const byseId = byseUrl.split("/").pop();
      
      streams.push({
        name: `✅ Byse ID: ${byseId}`,
        title: "",
        url: `debug://byse`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 2: Buscar detalhes
      // ==========================================
      const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;
      const detailsResponse = yield fetch(detailsUrl, {
        headers: {
          "accept": "*/*",
          "referer": byseUrl,
          "x-embed-origin": "api.pomfy.stream",
          "x-embed-parent": byseUrl,
          "user-agent": HEADERS["User-Agent"],
          "Cookie": COOKIE
        }
      });
      if (!detailsResponse.ok) return streams;
      
      const detailsData = yield detailsResponse.json();
      const embedUrl = detailsData.embed_frame_url;
      const embedDomain = new URL(embedUrl).origin;
      
      // ==========================================
      // ETAPA 3: Access challenge
      // ==========================================
      yield fetch(`${embedDomain}/api/videos/access/challenge`, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "origin": embedDomain,
          "referer": embedUrl,
          "user-agent": HEADERS["User-Agent"]
        }
      });
      
      // ==========================================
      // ETAPA 4: Playback
      // ==========================================
      const playbackResponse = yield fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": embedDomain,
          "referer": embedUrl,
          "user-agent": HEADERS["User-Agent"]
        },
        body: JSON.stringify({ fingerprint: generateFingerprint() })
      });
      if (!playbackResponse.ok) return streams;
      
      const playbackData = yield playbackResponse.json();
      const decryptResult = yield decryptPlayback(playbackData.playback);
      
      if (!decryptResult.success) {
        streams.push({
          name: `❌ Decrypt: ${decryptResult.error}`,
          title: "",
          url: `debug://decrypt-error`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      // ==========================================
      // SUCESSO!
      // ==========================================
      const title = mediaType === "movie"
        ? `Filme ${finalTmdbId}`
        : `T${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")}`;
      
      streams.push({
        name: `🎉 Pomfy 1080p`,
        title: title,
        url: decryptResult.url,
        quality: 1080,
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          "Referer": embedUrl,
          "Accept": "*/*"
        }
      });
      
    } catch (error) {
      streams.push({
        name: `❌ Erro: ${error.message}`,
        title: "",
        url: `debug://exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return streams;
  });
}

module.exports = { getStreams };
