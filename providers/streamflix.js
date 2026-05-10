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
// FUNÇÃO AUXILIAR: GERAR FINGERPRINT
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
  
  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  
  return {
    token: token,
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93
  };
}

// ==============================================
// FUNÇÃO AUXILIAR: DESCRIPTOGRAFAR PLAYBACK
// ==============================================

function decryptPlayback(playback) {
  try {
    const crypto = require("crypto");
    
    // Decodificar base64
    const iv = Buffer.from(playback.iv, "base64");
    const key1 = Buffer.from(playback.key_parts[0], "base64");
    const key2 = Buffer.from(playback.key_parts[1], "base64");
    const key = Buffer.concat([key1, key2]);
    
    // Ajustar payload URL-safe
    let payload = playback.payload;
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) {
      payload += "=";
    }
    const encryptedData = Buffer.from(payload, "base64");
    
    // Extrair auth tag (últimos 16 bytes)
    const authTag = encryptedData.slice(-16);
    const ciphertext = encryptedData.slice(0, -16);
    
    // Descriptografar
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, "", "utf8");
    decrypted += decipher.final("utf8");
    
    const videoData = JSON.parse(decrypted);
    
    // Extrair URL .m3u8
    let m3u8Url = null;
    if (videoData.sources && videoData.sources.length > 0) {
      m3u8Url = videoData.sources[0].url;
    } else if (videoData.url) {
      m3u8Url = videoData.url;
    } else if (videoData.data && videoData.data.sources) {
      m3u8Url = videoData.data.sources[0].url;
    }
    
    if (m3u8Url) {
      m3u8Url = m3u8Url.replace(/\\u0026/g, "&");
      return m3u8Url;
    }
    
    return null;
  } catch (error) {
    console.log(`[Pomfy] Decrypt error: ${error.message}`);
    return null;
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const streams = [];
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    // ==========================================
    // ETAPA 1: Parâmetros
    // ==========================================
    streams.push({
      name: `🔍 [1/6] Pomfy: ${mediaType} ${tmdbId} S${seasonNum}E${episodeNum}`,
      title: "Iniciando busca",
      url: `debug://params`,
      quality: 1080,
      headers: HEADERS
    });
    
    try {
      // ==========================================
      // ETAPA 2: Buscar HTML do Pomfy
      // ==========================================
      const pomfyUrl = mediaType === "movie" 
        ? `${API_POMFY}/filme/${tmdbId}`
        : `${API_POMFY}/serie/${tmdbId}/${seasonNum}/${episodeNum}`;
      
      streams.push({
        name: `📡 [2/6] API Pomfy: ${pomfyUrl}`,
        title: "Aguardando resposta...",
        url: `debug://fetching`,
        quality: 1080,
        headers: HEADERS
      });
      
      const response = yield fetch(pomfyUrl, { headers: HEADERS });
      
      if (!response.ok) {
        streams.push({
          name: `❌ [2/6] HTTP ${response.status}`,
          title: "Falha na requisição",
          url: `debug://error`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const html = yield response.text();
      
      streams.push({
        name: `✅ [2/6] HTML recebido: ${html.length} bytes`,
        title: "Página carregada",
        url: `debug://html-loaded`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 3: Extrair link do vídeo
      // ==========================================
      const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
      if (!linkMatch) {
        streams.push({
          name: `❌ [3/6] Link não encontrado no HTML`,
          title: "Conteúdo indisponível no Pomfy",
          url: `debug://no-link`,
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
        url: `debug://byse-id`,
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
          title: "Não foi possível obter embed URL",
          url: `debug://details-error`,
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
        url: `debug://embed-url`,
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
          "origin": embedDomain,
          "referer": embedUrl,
          "user-agent": HEADERS["User-Agent"]
        }
      });
      
      if (!challengeResponse.ok) {
        streams.push({
          name: `❌ [5/6] Challenge falhou: ${challengeResponse.status}`,
          title: "Não foi possível resolver o desafio",
          url: `debug://challenge-error`,
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
        title: "Aguardando link do vídeo",
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
          title: "Não foi obter o link",
          url: `debug://playback-error`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const playbackData = yield playbackResponse.json();
      const m3u8Url = decryptPlayback(playbackData.playback);
      
      if (!m3u8Url) {
        streams.push({
          name: `❌ [6/6] Falha na descriptografia`,
          title: "Não foi possível decodificar o payload",
          url: `debug://decrypt-error`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      // ==========================================
      // SUCESSO! Adicionar stream final
      // ==========================================
      const title = mediaType === "movie"
        ? `Filme ${tmdbId}`
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
        name: `❌ ERRO: ${error.message}`,
        title: "Exceção capturada",
        url: `debug://exception`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return streams;
  });
}

module.exports = { getStreams };
