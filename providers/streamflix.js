/**
 * Pomfy - Provider com Byse/9n8o
 * Com conversão IMDb → TMDb e AES-GCM
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
// IMPORTAÇÃO DO AES-GCM
// ==============================================

const { decryptPlayback } = require('./crypto/aes-gcm.js');

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
      
      let results = [];
      if (mediaType === "tv") {
        results = data.tv_results || [];
      } else {
        results = data.movie_results || [];
      }
      
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
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const streams = [];
    let finalTmdbId = tmdbId;
    let originalId = tmdbId;
    
    // ==========================================
    // ETAPA 0: Converter IMDb para TMDb
    // ==========================================
    
    if (isImdbId(tmdbId)) {
      streams.push({
        name: `🔄 [0/6] IMDb detectado: ${tmdbId}`,
        title: "Convertendo para TMDb...",
        url: `debug://converting?imdb=${tmdbId}`,
        quality: 1080,
        headers: HEADERS
      });
      
      const conversion = yield convertImdbToTmdb(tmdbId, mediaType);
      
      if (conversion.success) {
        finalTmdbId = conversion.tmdbId;
        streams.push({
          name: `✅ [0/6] Convertido: ${tmdbId} → ${finalTmdbId}`,
          title: "Conversão bem-sucedida",
          url: `debug://converted?from=${tmdbId}&to=${finalTmdbId}`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        streams.push({
          name: `❌ [0/6] Falha na conversão`,
          title: conversion.error,
          url: `debug://conversion-failed?error=${encodeURIComponent(conversion.error)}&imdb=${tmdbId}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
    } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
      finalTmdbId = parseInt(tmdbId);
      streams.push({
        name: `✅ [0/6] ID convertido: ${tmdbId} → ${finalTmdbId}`,
        title: "String para número",
        url: `debug://converted-to-number?from=${tmdbId}&to=${finalTmdbId}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    // ==========================================
    // ETAPA 1: Parâmetros
    // ==========================================
    streams.push({
      name: `🔍 [1/6] Pomfy: ${mediaType} ${finalTmdbId} S${seasonNum}E${episodeNum}`,
      title: originalId !== finalTmdbId ? `Original: ${originalId}` : "Iniciando busca",
      url: `debug://params?mediaType=${mediaType}&tmdbId=${finalTmdbId}&season=${seasonNum}&episode=${episodeNum}`,
      quality: 1080,
      headers: HEADERS
    });
    
    try {
      // ==========================================
      // ETAPA 2: Buscar HTML do Pomfy
      // ==========================================
      const pomfyUrl = mediaType === "movie" 
        ? `${API_POMFY}/filme/${finalTmdbId}`
        : `${API_POMFY}/serie/${finalTmdbId}/${seasonNum}/${episodeNum}`;
      
      streams.push({
        name: `📡 [2/6] API Pomfy`,
        title: pomfyUrl,
        url: `debug://fetching?url=${encodeURIComponent(pomfyUrl)}`,
        quality: 1080,
        headers: HEADERS
      });
      
      const response = yield fetch(pomfyUrl, { headers: HEADERS });
      
      if (!response.ok) {
        streams.push({
          name: `❌ [2/6] HTTP ${response.status}`,
          title: `Falha na requisição: ${response.status} ${response.statusText}`,
          url: `debug://error?status=${response.status}&url=${encodeURIComponent(pomfyUrl)}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const html = yield response.text();
      
      streams.push({
        name: `✅ [2/6] HTML recebido: ${html.length} bytes`,
        title: "Página carregada com sucesso",
        url: `debug://html-loaded?size=${html.length}`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 3: Extrair link do vídeo
      // ==========================================
      const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
      if (!linkMatch) {
        streams.push({
          name: `❌ [3/6] Link não encontrado`,
          title: "Conteúdo indisponível no Pomfy",
          url: `debug://no-link?tmdbId=${finalTmdbId}&season=${seasonNum}&episode=${episodeNum}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const byseUrl = linkMatch[1];
      const byseId = byseUrl.split("/").pop();
      
      streams.push({
        name: `✅ [3/6] Byse ID: ${byseId}`,
        title: byseUrl,
        url: `debug://byse-id?id=${byseId}`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 4: Buscar detalhes do vídeo
      // ==========================================
      const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;
      
      streams.push({
        name: `📡 [4/6] Buscando detalhes...`,
        title: detailsUrl,
        url: `debug://details`,
        quality: 1080,
        headers: HEADERS
      });
      
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
      
      if (!detailsResponse.ok) {
        streams.push({
          name: `❌ [4/6] Detalhes falhou: ${detailsResponse.status}`,
          title: `HTTP ${detailsResponse.status}`,
          url: `debug://details-error?status=${detailsResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const detailsData = yield detailsResponse.json();
      const embedUrl = detailsData.embed_frame_url;
      const embedDomain = new URL(embedUrl).origin;
      
      streams.push({
        name: `✅ [4/6] Embed URL obtida`,
        title: embedUrl,
        url: `debug://embed-url?domain=${embedDomain}`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 5: Access challenge
      // ==========================================
      const challengeUrl = `${embedDomain}/api/videos/access/challenge`;
      
      streams.push({
        name: `🔐 [5/6] Access challenge...`,
        title: "Resolvendo desafio",
        url: `debug://challenge`,
        quality: 1080,
        headers: HEADERS
      });
      
      const challengeResponse = yield fetch(challengeUrl, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "accept-language": "pt-BR,pt;q=0.9",
          "origin": embedDomain,
          "referer": embedUrl,
          "user-agent": HEADERS["User-Agent"]
        }
      });
      
      if (!challengeResponse.ok) {
        streams.push({
          name: `❌ [5/6] Challenge falhou: ${challengeResponse.status}`,
          title: `HTTP ${challengeResponse.status}`,
          url: `debug://challenge-error?status=${challengeResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const challengeData = yield challengeResponse.json();
      
      streams.push({
        name: `✅ [5/6] Challenge resolvido`,
        title: `ID: ${challengeData.challenge_id}`,
        url: `debug://challenge-ok`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 6: Requisitar playback
      // ==========================================
      const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;
      const fingerprint = generateFingerprint();
      
      streams.push({
        name: `🎬 [6/6] Solicitando playback...`,
        title: "Aguardando link",
        url: `debug://playback`,
        quality: 1080,
        headers: HEADERS
      });
      
      const playbackResponse = yield fetch(playbackUrl, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "accept-language": "pt-BR,pt;q=0.9",
          "content-type": "application/json",
          "origin": embedDomain,
          "referer": embedUrl,
          "x-embed-origin": "api.pomfy.stream",
          "x-embed-parent": byseUrl,
          "user-agent": HEADERS["User-Agent"]
        },
        body: JSON.stringify({ fingerprint: fingerprint })
      });
      
      if (!playbackResponse.ok) {
        streams.push({
          name: `❌ [6/6] Playback falhou: ${playbackResponse.status}`,
          title: `HTTP ${playbackResponse.status}`,
          url: `debug://playback-error?status=${playbackResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const playbackData = yield playbackResponse.json();
      
      // USAR O DECRYPTPLAYBACK DO ARQUIVO AES-GCM (SEM FALLBACK)
      const decryptResult = yield decryptPlayback(playbackData.playback);
      
      if (!decryptResult.success) {
        streams.push({
          name: `❌ [6/6] Falha na decodificação AES-GCM`,
          title: decryptResult.error,
          url: `debug://decrypt-error?error=${encodeURIComponent(decryptResult.error)}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const m3u8Url = decryptResult.url;
      
      // ==========================================
      // SUCESSO!
      // ==========================================
      const title = mediaType === "movie"
        ? `Filme ${finalTmdbId}`
        : `T${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")}`;
      
      streams.push({
        name: `🎉 SUCESSO! Pomfy - 1080p`,
        title: title,
        url: m3u8Url,
        quality: 1080,
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          "Referer": embedUrl,
          "Accept": "*/*",
          "Accept-Language": "pt-BR,pt;q=0.9"
        }
      });
      
    } catch (error) {
      streams.push({
        name: `❌ ERRO: ${error.name || "Exception"}`,
        title: error.message,
        url: `debug://exception?error=${encodeURIComponent(error.message)}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return streams;
  });
}

module.exports = { getStreams };
