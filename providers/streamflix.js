/**
 * pomfy - Built: 2026-05-30T14:22:53.369Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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

// src/pomfy/http.js
var UA = "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
var DOMAINS = {
  pomfy: "https://api.pomfy.stream",
  cdn: "https://pomfy-cdn.shop",
  attest: "https://9n8o.com"
};
var HEADERS_BASE = {
  "User-Agent": UA,
  "Accept": "application/json, text/html, application/xhtml+xml, */*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache"
};

function createCookieJar() {
  return { _jar: {} };
}

function storeCookies(jar, domain, setCookieHeaders) {
  if (!setCookieHeaders) return;
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  if (!jar._jar[domain]) jar._jar[domain] = {};
  for (const raw of arr) {
    if (!raw) continue;
    const firstSemi = raw.indexOf(";");
    const pair = firstSemi >= 0 ? raw.substring(0, firstSemi) : raw;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.substring(0, eq).trim();
    const value = pair.substring(eq + 1).trim();
    if (name) jar._jar[domain][name] = value;
  }
}

function buildCookieHeader(jar, domain) {
  if (!jar._jar[domain]) return null;
  const entries = Object.entries(jar._jar[domain]);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

function headersForDomain(domain, extra) {
  const h = Object.assign({}, HEADERS_BASE);
  if (domain === DOMAINS.cdn) {
    h["Origin"] = DOMAINS.cdn;
    h["Referer"] = DOMAINS.cdn + "/";
    h["X-Embed-Origin"] = "api.pomfy.stream";
    h["X-Embed-Referer"] = "https://api.pomfy.stream/";
  } else if (domain === DOMAINS.attest) {
    h["Origin"] = DOMAINS.attest;
    h["X-Embed-Origin"] = "api.pomfy.stream";
    h["X-Embed-Referer"] = "https://api.pomfy.stream/";
  }
  if (extra) Object.assign(h, extra);
  return h;
}

function request(url, opts) {
  const options = opts || {};
  const jar = options.jar;
  const domain = options.domain;
  const headers = headersForDomain(domain, options.headers || {});
  if (jar && domain) {
    const cookieHdr = buildCookieHeader(jar, domain);
    if (cookieHdr) headers["Cookie"] = cookieHdr;
  }
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body || null,
      redirect: options.redirect || "follow"
    }).then((res) => {
      if (jar && domain && res.headers) {
        try {
          const sc = res.headers.get("set-cookie");
          if (sc) storeCookies(jar, domain, sc);
        } catch (e) {
        }
      }
      resolve(res);
    }).catch((err) => reject(err));
  });
}

function postJson(url, payload, opts) {
  const options = opts || {};
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  return request(url, Object.assign({}, options, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  }));
}

function postEmpty(url, opts) {
  const options = opts || {};
  const headers = options.headers || {};
  headers["Content-Length"] = "0";
  return request(url, Object.assign({}, options, {
    method: "POST",
    headers,
    body: null
  }));
}

function randomHex(len) {
  let out = "";
  const chars = "0123456789abcdef";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += chars[buf[i] & 15];
  } else {
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

function uuidv4() {
  const h8 = randomHex(8);
  const h4 = randomHex(4);
  const h4b = "4" + randomHex(3);
  const h4c = (parseInt(randomHex(1), 16) & 3 | 8).toString(16) + randomHex(3);
  const h12 = randomHex(12);
  return `${h8}-${h4}-${h4b}-${h4c}-${h12}`;
}

function createSessionIdentity() {
  return {
    viewerId: uuidv4(),
    deviceId: uuidv4()
  };
}

var import_p256 = require("@noble/curves/p256.js");
var import_sha256 = require("@noble/hashes/sha256.js");

function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateKeyPair() {
  const privBytes = import_p256.p256.utils.randomPrivateKey();
  const pubBytes = import_p256.p256.getPublicKey(privBytes, false);
  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);
  return {
    privateKey: privBytes,
    publicKeyJWK: {
      alg: "ES256",
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: bytesToB64url(x),
      y: bytesToB64url(y)
    }
  };
}

function signNonce(privateKey, nonce) {
  const msgBytes = new TextEncoder().encode(nonce);
  const hash = (0, import_sha256.sha256)(msgBytes);
  const sig = import_p256.p256.sign(hash, privateKey, { lowS: true });
  return bytesToB64url(sig.toCompactRawBytes());
}

var import_sha2562 = require("@noble/hashes/sha256.js");

function bytesToB64url2(bytes) {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256B64url(input) {
  const bytes = (0, import_sha2562.sha256)(input);
  return bytesToB64url2(bytes);
}

function collectFingerprint() {
  const canvasHash = sha256B64url("canvas-pomfy-mock-v1");
  const audioHash = sha256B64url("audio-pomfy-mock-v1");
  const fontsHash = sha256B64url("DejaVu Sans;Liberation Sans;Noto Sans;sans-serif;monospace");
  const codecsHash = sha256B64url("h264,aac,opus,vp9,av1");
  return {
    user_agent: "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
    pixel_ratio: 2,
    screen_width: 931,
    screen_height: 896,
    color_depth: 24,
    languages: ["pt-BR", "pt", "en-US", "en"],
    timezone: "Atlantic/Reykjavik",
    hardware_concurrency: 4,
    touch_points: 5,
    canvas_hash: canvasHash,
    audio_hash: audioHash,
    fonts_hash: fontsHash,
    codecs_hash: codecsHash,
    media_devices: "ai1ao0vi1",
    pointer_type: "fine,hover,touch",
    extra: {
      vendor: "",
      appVersion: "5.0 (X11)"
    }
  };
}

function entropyLevel(fingerprint) {
  if (!fingerprint) return "low";
  const hasCanvas = !!fingerprint.canvas_hash;
  const hasAudio = !!fingerprint.audio_hash;
  const hasFonts = !!fingerprint.fonts_hash;
  const hasCodecs = !!fingerprint.codecs_hash;
  const hasScreen = !!fingerprint.screen_width && !!fingerprint.screen_height;
  const hasLang = Array.isArray(fingerprint.languages) && fingerprint.languages.length > 0;
  const score = [hasCanvas, hasAudio, hasFonts, hasCodecs, hasScreen, hasLang].filter(Boolean).length;
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

var import_aes = require("@noble/ciphers/aes.js");

function b64urlToBytes(str) {
  if (!str) return new Uint8Array(0);
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - b64.length % 4) % 4;
  b64 += "=".repeat(pad);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function utf8Decode(bytes) {
  let str = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b = bytes[i++];
    if (b < 128) str += String.fromCharCode(b);
    else if (b < 224) str += String.fromCharCode((b & 31) << 6 | bytes[i++] & 63);
    else if (b < 240) str += String.fromCharCode((b & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
    else {
      let cp = (b & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
      cp -= 65536;
      str += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
    }
  }
  return str;
}

function buildVersionMap() {
  const map = {};
  for (let n = 1; n <= 20; n += 1) {
    const i = n ^ 0;
    const a = 31 - n ^ 0;
    map[String(n)] = [i, a];
  }
  return map;
}

function getIndicesForVersion(version, arrayLength) {
  const map = buildVersionMap();
  const indices = map[String(version)];
  if (!indices || !Array.isArray(indices)) return [];
  for (const idx of indices) {
    if (idx < 1 || idx > arrayLength) return [];
  }
  return indices;
}

function selectKeyParts(payload) {
  const keyParts = Array.isArray(payload.key_parts) ? payload.key_parts : [];
  const indices = getIndicesForVersion(payload.version, keyParts.length);
  if (indices.length === 0) return keyParts;
  const selected = indices.map((i) => Number(i)).filter((i) => Number.isInteger(i) && i >= 1 && i <= keyParts.length).map((i) => keyParts[i - 1]).filter((p) => typeof p === "string" && p.length > 0);
  return selected.length > 0 ? selected : keyParts;
}

function concatDecodedParts(parts) {
  const decoded = parts.filter((p) => typeof p === "string" && p.length > 0).map((p) => b64urlToBytes(p));
  const total = decoded.reduce((acc, arr) => acc + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of decoded) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function reconstructKey(payload) {
  if (!payload || !Array.isArray(payload.key_parts) || payload.key_parts.length === 0) {
    throw new Error("Invalid payload: missing key_parts");
  }
  const selected = selectKeyParts(payload);
  const keyBytes = concatDecodedParts(selected);
  if (keyBytes.length < 16) {
    throw new Error(`Reconstructed key too short: ${keyBytes.length} bytes`);
  }
  return keyBytes;
}

function decryptPlayback(playback) {
  if (!playback || playback.algorithm !== "AES-256-GCM") {
    throw new Error(`Unsupported algorithm: ${playback && playback.algorithm}`);
  }
  const keyBytes = reconstructKey(playback);
  const iv = b64urlToBytes(playback.iv);
  const ciphertext = b64urlToBytes(playback.payload);
  if (iv.length !== 12) throw new Error(`Invalid IV length: ${iv.length}, expected 12`);
  if (ciphertext.length < 16) throw new Error(`Ciphertext too short: ${ciphertext.length}`);
  try {
    const plaintext = (0, import_aes.gcm)(keyBytes, iv).decrypt(ciphertext);
    if (!plaintext || plaintext.length === 0) {
      throw new Error("Decrypt returned empty plaintext");
    }
    let txt = utf8Decode(plaintext);
    if (txt.charCodeAt(0) === 65279) txt = txt.slice(1);
    return JSON.parse(txt);
  } catch (err) {
    throw new Error("AES-256-GCM decrypt failed: " + err.message);
  }
}

function extractStatusToken(html) {
  const patterns = [
    /statusToken["']?\s*[:=]\s*["']([^"']+)["']/,
    /["']statusToken["']\s*:\s*["']([^"']+)["']/,
    /data-status-token=["']([^"']+)["']/,
    /window\.__STATUS_TOKEN__\s*=\s*["']([^"']+)["']/
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function fetchPlaybackData(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const jar = createCookieJar();
    const identity = createSessionIdentity();
    const keyPair = generateKeyPair();
    const fingerprint = collectFingerprint();
    const pagePath = mediaType === "tv" ? `/serie/${tmdbId}/${season}/${episode}` : `/filme/${tmdbId}`;
    const pageUrl = `${DOMAINS.pomfy}${pagePath}`;
    const pageResponse = yield request(pageUrl, {
      jar,
      domain: DOMAINS.pomfy,
      headers: {
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site"
      }
    });
    const html = yield pageResponse.text();
    const statusToken = extractStatusToken(html);
    if (!statusToken) throw new Error("statusToken not found in HTML");
    const playTokenUrl = `${DOMAINS.pomfy}/api/play-token?t=${statusToken}`;
    const playTokenResponse = yield request(playTokenUrl, {
      jar,
      domain: DOMAINS.pomfy,
      headers: headersForDomain(DOMAINS.pomfy)
    });
    if (!playTokenResponse.ok) throw new Error(`play-token failed: ${playTokenResponse.status}`);
    const playTokenData = yield playTokenResponse.json();
    const byseUrl = playTokenData.byseUrl;
    if (!byseUrl) throw new Error("byseUrl not found in play-token response");
    const videoIdMatch = byseUrl.match(/\/e\/([^/?]+)/);
    if (!videoIdMatch) throw new Error("Could not extract video ID from byseUrl");
    const videoId = videoIdMatch[1];
    const detailsUrl = `${DOMAINS.cdn}/api/videos/${videoId}/embed/details`;
    const detailsResponse = yield request(detailsUrl, {
      jar,
      domain: DOMAINS.cdn,
      headers: headersForDomain(DOMAINS.cdn)
    });
    if (!detailsResponse.ok) throw new Error(`embed/details failed: ${detailsResponse.status}`);
    yield detailsResponse.json();
    const challengeUrl = `${DOMAINS.attest}/api/videos/access/challenge`;
    const challengeResponse = yield postEmpty(challengeUrl, {
      jar,
      domain: DOMAINS.attest,
      headers: headersForDomain(DOMAINS.attest)
    });
    if (!challengeResponse.ok) throw new Error(`challenge failed: ${challengeResponse.status}`);
    const challengeData = yield challengeResponse.json();
    const { challenge_id: challengeId, nonce } = challengeData;
    if (!challengeId || !nonce) throw new Error("challenge_id or nonce not found in challenge response");
    const signature = signNonce(keyPair.privateKey, nonce);
    const attestPayload = {
      viewer_id: identity.viewerId,
      device_id: identity.deviceId,
      challenge_id: challengeId,
      nonce,
      signature,
      public_key: keyPair.publicKeyJWK,
      client: fingerprint,
      storage: {
        viewer_id: identity.viewerId,
        device_id: identity.deviceId,
        first_seen: Date.now() - Math.floor(Math.random() * 864e5 * 30),
        visit_count: Math.floor(Math.random() * 50) + 5,
        last_visit: Date.now() - Math.floor(Math.random() * 36e5 * 24)
      },
      attributes: { entropy: entropyLevel(fingerprint) }
    };
    const attestUrl = `${DOMAINS.attest}/api/videos/access/attest`;
    const attestResponse = yield postJson(attestUrl, attestPayload, {
      jar,
      domain: DOMAINS.attest,
      headers: headersForDomain(DOMAINS.attest)
    });
    if (!attestResponse.ok) throw new Error(`attest failed: HTTP ${attestResponse.status}`);
    const attestData = yield attestResponse.json();
    const token = attestData.token;
    if (!token) throw new Error("token not found in attest response");
    const attestCookies = jar._jar[DOMAINS.attest] || {};
    const attestViewerId = attestCookies.byse_viewer_id || "";
    const attestDeviceId = attestCookies.byse_device_id || "";
    const playbackUrl = `${DOMAINS.attest}/api/videos/${videoId}/embed/playback`;
    const embedParentUrl = `${DOMAINS.cdn}/e/${videoId}`;
    const playbackHeaders = headersForDomain(DOMAINS.attest, {
      "X-Embed-Parent": embedParentUrl,
      "Referer": embedParentUrl
    });
    const playbackPayload = {
      fingerprint: {
        token,
        viewer_id: attestViewerId,
        device_id: attestDeviceId,
        confidence: 0.68
      }
    };
    const playbackResponse = yield postJson(playbackUrl, playbackPayload, {
      jar,
      domain: DOMAINS.attest,
      headers: playbackHeaders
    });
    if (!playbackResponse.ok) throw new Error(`playback failed: ${playbackResponse.status}`);
    const playbackData = yield playbackResponse.json();
    const encryptedPlayback = playbackData.playback;
    if (!encryptedPlayback) throw new Error("Missing playback data in response");
    return decryptPlayback(encryptedPlayback);
  });
}

function normalizeHeaders(srcHeaders) {
  const headers = __spreadValues({}, srcHeaders);
  if (!headers.Origin) headers.Origin = DOMAINS.cdn;
  if (!headers.Referer) headers.Referer = `${DOMAINS.cdn}/`;
  return headers;
}

function extractQuality(src) {
  var _a, _b, _c;
  const val = (_c = (_b = (_a = src.quality) != null ? _a : src.resolution) != null ? _b : src.height) != null ? _c : 0;
  if (typeof val === "number" && val > 0) return val;
  const match = String(val).match(/(\d{3,4})/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractLanguage(src, preferredLang) {
  const lang = src.language || src.lang || src.label || preferredLang || "pt";
  return lang;
}

function extractStreams(playbackData, preferredLang) {
  return __async(this, null, function* () {
    if (!playbackData || !playbackData.sources || !Array.isArray(playbackData.sources)) {
      return [];
    }
    const sources = playbackData.sources;
    const tracks = playbackData.tracks || [];
    const baseHeaders = headersForDomain(DOMAINS.cdn);
    const seen = /* @__PURE__ */ new Set();
    const streams = [];
    for (const src of sources) {
      const url = src.url || src.src || src.file;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const quality = extractQuality(src);
      const lang = extractLanguage(src, preferredLang);
      const isHls = (src.type || "").toLowerCase().includes("hls") || url.includes(".m3u8");
      const finalHeaders = normalizeHeaders(src.headers || baseHeaders);
      const subtitles = [];
      for (const track of tracks) {
        if (track.kind === "subtitles" || track.kind === "captions") {
          subtitles.push({
            language: track.language || "und",
            title: track.title || track.language || "Subtitle",
            url: track.url,
            default: track.default || false
          });
        }
      }
      const qualityLabel = quality > 0 ? `${quality}p` : "Auto";
      streams.push({
        name: "Pomfy",
        title: `Pomfy (${qualityLabel} ${lang})`,
        url,
        quality: quality || 1080,
        type: isHls ? "hls" : "mp4",
        group: lang,
        provider: "pomfy",
        headers: finalHeaders
      });
    }
    return streams;
  });
}

function getStreams(tmdbId, mediaType, season, episode, options) {
  return __async(this, null, function* () {
    try {
      const playbackData = yield fetchPlaybackData(tmdbId, mediaType, season, episode);
      const streams = yield extractStreams(playbackData, options == null ? void 0 : options.language);
      return streams;
    } catch (e) {
      return [];
    }
  });
}

module.exports = { getStreams };
global.getStreams = getStreams;
