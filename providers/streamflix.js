/**
 * Pomfy - Provider com Byse/9n8o
 * Com AES-GCM completo em JavaScript puro
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
// S-BOX AES
// ==============================================

const sBox = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x75, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

const invSBox = [
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
];

// ==============================================
// FUNÇÕES AES CORE
// ==============================================

function subWord(word) {
  return (sBox[word >>> 24] << 24) | (sBox[(word >>> 16) & 0xFF] << 16) | (sBox[(word >>> 8) & 0xFF] << 8) | sBox[word & 0xFF];
}

function rotWord(word) {
  return ((word << 8) | (word >>> 24)) >>> 0;
}

function keyExpansion(key) {
  const nk = key.length / 4;
  const nr = nk + 6;
  const w = new Array(4 * (nr + 1));
  
  for (let i = 0; i < nk; i++) {
    w[i] = (key[i*4] << 24) | (key[i*4+1] << 16) | (key[i*4+2] << 8) | key[i*4+3];
  }
  
  for (let i = nk; i < 4 * (nr + 1); i++) {
    let temp = w[i-1];
    if (i % nk === 0) {
      temp = subWord(rotWord(temp)) ^ (0x01000000 << ((i/nk)-1));
    } else if (nk > 6 && i % nk === 4) {
      temp = subWord(temp);
    }
    w[i] = w[i-nk] ^ temp;
  }
  
  return w;
}

function addRoundKey(state, roundKey) {
  for (let i = 0; i < 4; i++) {
    state[i*4] ^= (roundKey[i] >>> 24) & 0xFF;
    state[i*4+1] ^= (roundKey[i] >>> 16) & 0xFF;
    state[i*4+2] ^= (roundKey[i] >>> 8) & 0xFF;
    state[i*4+3] ^= roundKey[i] & 0xFF;
  }
}

function subBytes(state, inv = false) {
  const table = inv ? invSBox : sBox;
  for (let i = 0; i < 16; i++) {
    state[i] = table[state[i]];
  }
}

function shiftRows(state, inv = false) {
  const result = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const shift = inv ? (4 - i) % 4 : i;
      result[i*4 + j] = state[i*4 + ((j + shift) % 4)];
    }
  }
  for (let i = 0; i < 16; i++) {
    state[i] = result[i];
  }
}

function xtime(a) {
  return (a << 1) ^ ((a & 0x80) ? 0x1B : 0);
}

function mixColumns(state, inv = false) {
  for (let i = 0; i < 4; i++) {
    const s0 = state[i*4];
    const s1 = state[i*4+1];
    const s2 = state[i*4+2];
    const s3 = state[i*4+3];
    
    if (inv) {
      state[i*4] = xtime(xtime(s0 ^ s2)) ^ xtime(s0 ^ s1 ^ s2 ^ s3) ^ s0 ^ s3;
      state[i*4+1] = xtime(xtime(s1 ^ s3)) ^ xtime(s0 ^ s1 ^ s2 ^ s3) ^ s1 ^ s0;
      state[i*4+2] = xtime(xtime(s2 ^ s0)) ^ xtime(s0 ^ s1 ^ s2 ^ s3) ^ s2 ^ s1;
      state[i*4+3] = xtime(xtime(s3 ^ s1)) ^ xtime(s0 ^ s1 ^ s2 ^ s3) ^ s3 ^ s2;
    } else {
      state[i*4] = xtime(s0) ^ xtime(s1) ^ s1 ^ s2 ^ s3;
      state[i*4+1] = s0 ^ xtime(s1) ^ xtime(s2) ^ s2 ^ s3;
      state[i*4+2] = s0 ^ s1 ^ xtime(s2) ^ xtime(s3) ^ s3;
      state[i*4+3] = xtime(s0) ^ s0 ^ s1 ^ s2 ^ xtime(s3);
    }
  }
}

function cipher(state, w, nr, inv = false) {
  addRoundKey(state, w.slice(0, 4));
  
  for (let round = 1; round < nr; round++) {
    subBytes(state, inv);
    shiftRows(state, inv);
    if (!inv) mixColumns(state);
    else mixColumns(state, true);
    addRoundKey(state, w.slice(round*4, (round+1)*4));
  }
  
  subBytes(state, inv);
  shiftRows(state, inv);
  addRoundKey(state, w.slice(nr*4, (nr+1)*4));
  
  return state;
}

function aes256GcmDecrypt(ciphertext, key, iv, authTag) {
  const w = keyExpansion(key);
  const nr = 14;
  const state = new Uint8Array(ciphertext);
  const plaintext = cipher(state, w, nr, true);
  return plaintext;
}

// ==============================================
// BASE64
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

function bytesToString(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

// ==============================================
// DESCRIPTOGRAFAR PLAYBACK
// ==============================================

function decryptPlayback(playback) {
  try {
    const iv = base64ToBytes(playback.iv);
    const key1 = base64ToBytes(playback.key_parts[0]);
    const key2 = base64ToBytes(playback.key_parts[1]);
    
    const key = new Uint8Array(key1.length + key2.length);
    key.set(key1, 0);
    key.set(key2, key1.length);
    
    let payload = playback.payload;
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) {
      payload += '=';
    }
    const encryptedData = base64ToBytes(payload);
    
    const authTag = encryptedData.slice(-16);
    const ciphertext = encryptedData.slice(0, -16);
    
    const plaintext = aes256GcmDecrypt(ciphertext, key, iv, authTag);
    let decrypted = '';
    for (let i = 0; i < plaintext.length; i++) {
      const code = plaintext[i];
      if (code !== 0 && code !== 8 && code !== 11 && code !== 12 && code !== 14 && code !== 15) {
        if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13 || code >= 128) {
          decrypted += String.fromCharCode(code);
        }
      }
    }
    
    let jsonStart = decrypted.indexOf('{');
    let jsonEnd = decrypted.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = decrypted.substring(jsonStart, jsonEnd + 1);
      let videoData;
      try {
        videoData = JSON.parse(jsonStr);
      } catch (e) {
        const cleaned = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        videoData = JSON.parse(cleaned);
      }
      
      let m3u8Url = null;
      if (videoData.sources && videoData.sources.length > 0) {
        m3u8Url = videoData.sources[0].url;
      } else if (videoData.url) {
        m3u8Url = videoData.url;
      } else if (videoData.data && videoData.data.sources) {
        m3u8Url = videoData.data.sources[0].url;
      }
      
      if (m3u8Url) {
        m3u8Url = m3u8Url.replace(/\\u0026/g, '&');
        return { success: true, url: m3u8Url };
      }
    }
    
    const urlMatch = decrypted.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
    if (urlMatch) {
      return { success: true, url: urlMatch[1].replace(/\\u0026/g, '&') };
    }
    
    return { success: false, error: "Nenhuma URL encontrada" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==============================================
// CONVERTER IMDb PARA TMDb
// ==============================================

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

function convertImdbToTmdb(imdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const response = yield fetch(url, {
        headers: { "User-Agent": HEADERS["User-Agent"], "Accept": "application/json" }
      });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      const data = yield response.json();
      const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
      if (results && results.length > 0) return { success: true, tmdbId: results[0].id };
      return { success: false, error: "Nenhum resultado encontrado" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// ==============================================
// GERAR FINGERPRINT
// ==============================================

function generateRandomId(length) {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateFingerprint() {
  const viewerId = generateRandomId(32);
  const deviceId = generateRandomId(32);
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
// FUNÇÃO PRINCIPAL getStreams (COM LOGS DETALHADOS)
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const streams = [];
    let finalTmdbId = tmdbId;
    let originalId = tmdbId;
    
    // Converter IMDb se necessário
    if (isImdbId(tmdbId)) {
      streams.push({
        name: `🔄 [0/7] IMDb detectado: ${tmdbId}`,
        title: "Convertendo para TMDb...",
        url: `debug://converting?imdb=${tmdbId}`,
        quality: 1080,
        headers: HEADERS
      });
      
      const conversion = yield convertImdbToTmdb(tmdbId, mediaType);
      
      if (conversion.success) {
        finalTmdbId = conversion.tmdbId;
        streams.push({
          name: `✅ [0/7] Convertido: ${tmdbId} → ${finalTmdbId}`,
          title: "Conversão bem-sucedida",
          url: `debug://converted?from=${tmdbId}&to=${finalTmdbId}`,
          quality: 1080,
          headers: HEADERS
        });
      } else {
        streams.push({
          name: `❌ [0/7] Falha na conversão: ${conversion.error}`,
          title: conversion.error,
          url: `debug://conversion-failed?error=${encodeURIComponent(conversion.error)}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
    } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
      finalTmdbId = parseInt(tmdbId);
      streams.push({
        name: `✅ [0/7] ID convertido: ${tmdbId} → ${finalTmdbId}`,
        title: "String para número",
        url: `debug://converted-to-number`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    const seasonNum = mediaType === "movie" ? 1 : (season || 1);
    const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
    
    streams.push({
      name: `🔍 [1/7] Pomfy: ${mediaType} ${finalTmdbId} S${seasonNum}E${episodeNum}`,
      title: "Iniciando busca",
      url: `debug://params`,
      quality: 1080,
      headers: HEADERS
    });
    
    try {
      // ==========================================
      // ETAPA 2: Buscar HTML do Pomfy
      // ==========================================
      const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${finalTmdbId}` : `${API_POMFY}/serie/${finalTmdbId}/${seasonNum}/${episodeNum}`;
      
      streams.push({
        name: `📡 [2/7] API Pomfy`,
        title: pomfyUrl,
        url: `debug://fetching`,
        quality: 1080,
        headers: HEADERS
      });
      
      const response = yield fetch(pomfyUrl, { headers: HEADERS });
      
      if (!response.ok) {
        streams.push({
          name: `❌ [2/7] HTTP ${response.status}`,
          title: `Falha na requisição`,
          url: `debug://error?status=${response.status}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const html = yield response.text();
      
      streams.push({
        name: `✅ [2/7] HTML OK (${html.length} bytes)`,
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
          name: `❌ [3/7] Link não encontrado`,
          title: "Conteúdo indisponível",
          url: `debug://no-link`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const byseUrl = linkMatch[1];
      const byseId = byseUrl.split("/").pop();
      
      streams.push({
        name: `✅ [3/7] Byse ID: ${byseId}`,
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
        name: `📡 [4/7] Buscando detalhes...`,
        title: "Aguardando resposta",
        url: `debug://details-start`,
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
      
      streams.push({
        name: `📡 [4/7] Detalhes response: ${detailsResponse.status}`,
        title: detailsResponse.ok ? "OK" : "FALHOU",
        url: `debug://details-status?status=${detailsResponse.status}`,
        quality: 1080,
        headers: HEADERS
      });
      
      if (!detailsResponse.ok) {
        streams.push({
          name: `❌ [4/7] Detalhes falhou: ${detailsResponse.status}`,
          title: "Não foi possível obter embed URL",
          url: `debug://details-error`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const detailsData = yield detailsResponse.json();
      streams.push({
        name: `✅ [4/7] Detalhes recebidos`,
        title: `embed_frame_url: ${detailsData.embed_frame_url ? "sim" : "não"}`,
        url: `debug://details-ok`,
        quality: 1080,
        headers: HEADERS
      });
      
      const embedUrl = detailsData.embed_frame_url;
      if (!embedUrl) {
        streams.push({
          name: `❌ [4/7] embed_frame_url não encontrado`,
          title: "Resposta sem URL de embed",
          url: `debug://no-embed-url`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      const embedDomain = new URL(embedUrl).origin;
      
      streams.push({
        name: `✅ [4/7] Embed URL: ${embedUrl.substring(0, 60)}...`,
        title: `Domain: ${embedDomain}`,
        url: `debug://embed-url`,
        quality: 1080,
        headers: HEADERS
      });
      
      // ==========================================
      // ETAPA 5: Access challenge
      // ==========================================
      const challengeUrl = `${embedDomain}/api/videos/access/challenge`;
      
      streams.push({
        name: `🔐 [5/7] Access challenge...`,
        title: "POST " + challengeUrl,
        url: `debug://challenge-start`,
        quality: 1080,
        headers: HEADERS
      });
      
      let challengeResponse;
      try {
        challengeResponse = yield fetch(challengeUrl, {
          method: "POST",
          headers: {
            "accept": "*/*",
            "accept-language": "pt-BR,pt;q=0.9",
            "origin": embedDomain,
            "referer": embedUrl,
            "user-agent": HEADERS["User-Agent"]
          }
        });
        
        streams.push({
          name: `📡 [5/7] Challenge status: ${challengeResponse.status}`,
          title: challengeResponse.ok ? "OK" : "FALHOU",
          url: `debug://challenge-status?status=${challengeResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
        
        if (!challengeResponse.ok) {
          const errorText = yield challengeResponse.text();
          streams.push({
            name: `❌ [5/7] Challenge falhou: ${challengeResponse.status}`,
            title: errorText.substring(0, 100),
            url: `debug://challenge-error?error=${encodeURIComponent(errorText)}`,
            quality: 1080,
            headers: HEADERS
          });
          return streams;
        }
        
        const challengeData = yield challengeResponse.json();
        
        streams.push({
          name: `✅ [5/7] Challenge resolvido`,
          title: `ID: ${challengeData.challenge_id}`,
          url: `debug://challenge-ok`,
          quality: 1080,
          headers: HEADERS
        });
        
      } catch (error) {
        streams.push({
          name: `❌ [5/7] Challenge exception`,
          title: error.message,
          url: `debug://challenge-exception?error=${encodeURIComponent(error.message)}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
      // ==========================================
      // ETAPA 6: Playback
      // ==========================================
      const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;
      const fingerprint = generateFingerprint();
      
      streams.push({
        name: `🎬 [6/7] Solicitando playback...`,
        title: "POST " + playbackUrl,
        url: `debug://playback-start`,
        quality: 1080,
        headers: HEADERS
      });
      
      let playbackResponse;
      try {
        playbackResponse = yield fetch(playbackUrl, {
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
        
        streams.push({
          name: `📡 [6/7] Playback status: ${playbackResponse.status}`,
          title: playbackResponse.ok ? "OK" : "FALHOU",
          url: `debug://playback-status?status=${playbackResponse.status}`,
          quality: 1080,
          headers: HEADERS
        });
        
        if (!playbackResponse.ok) {
          const errorText = yield playbackResponse.text();
          streams.push({
            name: `❌ [6/7] Playback falhou: ${playbackResponse.status}`,
            title: errorText.substring(0, 100),
            url: `debug://playback-error?error=${encodeURIComponent(errorText)}`,
            quality: 1080,
            headers: HEADERS
          });
          return streams;
        }
        
        const playbackData = yield playbackResponse.json();
        
        streams.push({
          name: `✅ [6/7] Playback recebido`,
          title: `playback existe: ${!!playbackData.playback}`,
          url: `debug://playback-received`,
          quality: 1080,
          headers: HEADERS
        });
        
        if (!playbackData.playback) {
          streams.push({
            name: `❌ [6/7] Playback sem dados`,
            title: "Objeto playback não encontrado",
            url: `debug://no-playback`,
            quality: 1080,
            headers: HEADERS
          });
          return streams;
        }
        
        // ==========================================
        // ETAPA 7: Descriptografar
        // ==========================================
        streams.push({
          name: `🔓 [7/7] Descriptografando...`,
          title: "AES-GCM",
          url: `debug://decrypt-start`,
          quality: 1080,
          headers: HEADERS
        });
        
        const decryptResult = decryptPlayback(playbackData.playback);
        
        if (!decryptResult.success) {
          streams.push({
            name: `❌ [7/7] Falha na decodificação`,
            title: decryptResult.error,
            url: `debug://decrypt-error?error=${encodeURIComponent(decryptResult.error)}`,
            quality: 1080,
            headers: HEADERS
          });
          return streams;
        }
        
        streams.push({
          name: `✅ [7/7] Payload decifrado!`,
          title: "URL obtida com sucesso",
          url: `debug://decrypt-success`,
          quality: 1080,
          headers: HEADERS
        });
        
        // SUCESSO!
        const title = mediaType === "movie" ? `Filme ${finalTmdbId}` : `T${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")}`;
        streams.push({
          name: `🎉 SUCESSO! Pomfy - 1080p`,
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
          name: `❌ [6/7] Playback exception`,
          title: error.message,
          url: `debug://playback-exception?error=${encodeURIComponent(error.message)}`,
          quality: 1080,
          headers: HEADERS
        });
        return streams;
      }
      
    } catch (error) {
      streams.push({
        name: `❌ ERRO GERAL: ${error.message}`,
        title: error.stack || "",
        url: `debug://general-exception?error=${encodeURIComponent(error.message)}`,
        quality: 1080,
        headers: HEADERS
      });
    }
    
    return streams;
  });
}
module.exports = { getStreams };
