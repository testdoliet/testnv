const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
];

let uaIndex = 0;
const getUA = () => {
  const ua = USER_AGENTS[uaIndex];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return ua;
};

const getHeaders = (referer, isJson = false) => ({
  "User-Agent": getUA(),
  "Accept": isJson ? "*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": referer || "https://pomfy.online/",
  "Sec-Fetch-Dest": isJson ? "empty" : "iframe",
  "Sec-Fetch-Mode": isJson ? "cors" : "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": isJson ? undefined : "1",
  "Content-Type": isJson ? "application/json" : undefined
});

// ==============================================
// BASE64 & AES MANUAL
// ==============================================

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const SBOX = [
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
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];
const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function base64ToBytes(b64) {
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
  const len = b64.length;
  let outLen = (len * 3) >> 2;
  if (b64[len - 1] === '=') outLen--;
  if (b64[len - 2] === '=') outLen--;
  const bytes = new Uint8Array(outLen);
  let idx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)], b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)], d = lookup[b64.charCodeAt(i + 3)];
    if (idx < outLen) bytes[idx++] = (a << 2) | (b >> 4);
    if (idx < outLen) bytes[idx++] = ((b & 0x0f) << 4) | (c >> 2);
    if (idx < outLen) bytes[idx++] = ((c & 0x03) << 6) | d;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let res = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < len ? bytes[i + 1] : 0, b2 = i + 2 < len ? bytes[i + 2] : 0;
    res += BASE64_CHARS[b0 >> 2];
    res += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    res += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    res += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return res;
}

function utf8BytesToString(bytes) {
  let str = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { str += String.fromCharCode(b); i++; }
    else if ((b & 0xe0) === 0xc0) { str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if ((b & 0xf0) === 0xe0) { str += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      str += String.fromCharCode(0xd800 + Math.floor((cp - 0x10000) / 0x400), 0xdc00 + ((cp - 0x10000) % 0x400));
      i += 4;
    }
  }
  return str;
}

class AES256GCM {
  constructor(key) { this.rk = this._expandKey(key); }
  _expandKey(key) {
    let w = new Uint32Array(60);
    for (let i = 0; i < 8; i++) w[i] = (key[i*4]<<24)|(key[i*4+1]<<16)|(key[i*4+2]<<8)|key[i*4+3];
    for (let i = 8; i < 60; i++) {
      let t = w[i-1];
      if (i%8===0) {
        t = ((t<<8)|(t>>>24))>>>0;
        t = (SBOX[t>>>24]<<24)|(SBOX[(t>>>16)&0xff]<<16)|(SBOX[(t>>>8)&0xff]<<8)|SBOX[t&0xff];
        t ^= (RCON[i/8]<<24)>>>0;
      } else if (i%8===4) {
        t = (SBOX[t>>>24]<<24)|(SBOX[(t>>>16)&0xff]<<16)|(SBOX[(t>>>8)&0xff]<<8)|SBOX[t&0xff];
      }
      w[i] = (w[i-8]^t)>>>0;
    }
    return w;
  }
  _gMult(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      const h = a & 0x80;
      a = (a << 1) & 0xff;
      if (h) a ^= 0x1b;
      b >>= 1;
    }
    return p;
  }
  _encBlock(block) {
    let s = Array.from({length:4}, (_,r) => Array.from({length:4}, (_,c) => block[r+c*4]));
    const ark = (idx) => {
      for (let c=0; c<4; c++) {
        const rk = this.rk[idx*4+c];
        for (let r=0; r<4; r++) s[r][c] ^= (rk>>>(24-8*r))&0xff;
      }
    };
    ark(0);
    for (let r=1; r<14; r++) {
      for (let i=0; i<4; i++) for (let j=0; j<4; j++) s[i][j] = SBOX[s[i][j]];
      const t1=s[1], t2=s[2], t3=s[3];
      s[1]=[t1[1],t1[2],t1[3],t1[0]]; s[2]=[t2[2],t2[3],t2[0],t2[1]]; s[3]=[t3[3],t3[0],t3[1],t3[2]];
      for (let c=0; c<4; c++) {
        const [s0,s1,s2,s3] = [s[0][c],s[1][c],s[2][c],s[3][c]];
        s[0][c] = this._gMult(2,s0)^this._gMult(3,s1)^s2^s3;
        s[1][c] = s0^this._gMult(2,s1)^this._gMult(3,s2)^s3;
        s[2][c] = s0^s1^this._gMult(2,s2)^this._gMult(3,s3);
        s[3][c] = this._gMult(3,s0)^s1^s2^this._gMult(2,s3);
      }
      ark(r);
    }
    for (let i=0; i<4; i++) for (let j=0; j<4; j++) s[i][j] = SBOX[s[i][j]];
    const t1=s[1], t2=s[2], t3=s[3];
    s[1]=[t1[1],t1[2],t1[3],t1[0]]; s[2]=[t2[2],t2[3],t2[0],t2[1]]; s[3]=[t3[3],t3[0],t3[1],t3[2]];
    ark(14);
    const res = new Uint8Array(16);
    for (let c=0; c<4; c++) for (let r=0; r<4; r++) res[c*4+r] = s[r][c];
    return res;
  }
  decrypt(iv, ct) {
    const ctr = new Uint8Array(16); ctr.set(iv); ctr[15] = 2;
    const pt = new Uint8Array(ct.length);
    for (let i=0; i<ct.length; i+=16) {
      const ks = this._encBlock(ctr);
      for (let j=0; j<16 && (i+j)<ct.length; j++) pt[i+j] = ct[i+j] ^ ks[j];
      for (let j=15; j>=12; j--) { ctr[j]++; if (ctr[j]!==0) break; }
    }
    return utf8BytesToString(pt);
  }
}

function buildVersionMap() {
  const map = {};
  for (let n = 1; n <= 30; n++) map[String(n)] = [n ^ 0, 31 - n ^ 0];
  return map;
}

function reconstructKey(payload) {
  const keyParts = payload.key_parts || [];
  const map = buildVersionMap();
  const indices = map[String(payload.version)] || [];
  const selected = indices.map(i => keyParts[i-1]).filter(p => p);
  const parts = selected.length > 0 ? selected : keyParts.slice(0, 2);

  const decoded = parts.map(p => base64ToBytes(p));
  const total = decoded.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const arr of decoded) { out.set(arr, off); off += arr.length; }
  return out.slice(0, 32);
}

function decryptPlayback(playback) {
  try {
    const key = reconstructKey(playback);
    const iv = base64ToBytes(playback.iv);
    const data = base64ToBytes(playback.payload);
    const ct = data.slice(0, -16);
    const plain = new AES256GCM(key).decrypt(iv, ct);
    const json = JSON.parse(plain);
    const url = json.url || json.sources?.[0]?.url || json.data?.sources?.[0]?.url;
    return url ? { success: true, url: url.replace(/\u0026/g, '&') } : { success: false };
  } catch { return { success: false }; }
}

function generateFingerprint() {
  const rand = (l) => Array.from({length:l}, () => 'abcdef0123456789'[Math.floor(Math.random()*16)]).join('');
  const ts = Math.floor(Date.now()/1000);
  const payload = { viewer_id: rand(32), device_id: rand(32), confidence: 0.93, iat: ts, exp: ts+600 };
  return { token: bytesToBase64(new TextEncoder().encode(JSON.stringify(payload))), ...payload };
}

async function convertImdbToTmdb(id, type) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`, { headers: { "User-Agent": getUA() } });
    const data = await res.json();
    return type === "tv" ? data.tv_results?.[0]?.id : data.movie_results?.[0]?.id;
  } catch { return null; }
}

function getOrigin(url) {
  try {
    if (typeof URL !== 'undefined') return new URL(url).origin;
  } catch(e) {}
  const m = url.match(/^https?:\/\/[^\/]+/);
  return m ? m[0] : '';
}

async function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  try {
    let id = tmdbId;
    if (String(tmdbId).toLowerCase().startsWith("tt")) {
      const converted = await convertImdbToTmdb(tmdbId, mediaType);
      if (!converted) return [];
      id = converted;
    }

    const s = mediaType === "movie" ? 1 : season;
    const e = mediaType === "movie" ? 1 : episode;
    const baseUrl = mediaType === "movie" ? `${API_POMFY}/filme/${id}` : `${API_POMFY}/serie/${id}/${s}/${e}`;

    // 1. Get HTML & Token
    const htmlRes = await fetch(baseUrl, { headers: getHeaders(baseUrl) });
    if (!htmlRes.ok) return [];
    const html = await htmlRes.text();
    const tokenMatch = html.match(/const statusToken="([^"]+)"/) || html.match(/statusToken["']?\s*[:=]\s*["']([^"']+)["']/);
    if (!tokenMatch) return [];
    const token = tokenMatch[1];

    // 2. Play Token
    const ptRes = await fetch(`${API_POMFY}/api/play-token?t=${token}`, {
      headers: { "accept": "*/*", "cookie": COOKIE, "referer": baseUrl, "user-agent": getUA() }
    });
    if (!ptRes.ok) return [];
    const ptData = await ptRes.json();
    if (!ptData.byseUrl) return [];
    const byseId = ptData.byseUrl.split('/').pop();

    // 3. Embed Details
    const detRes = await fetch(`https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`, {
      headers: { "referer": ptData.byseUrl, "x-embed-origin": "api.pomfy.stream", "user-agent": getUA() }
    });
    if (!detRes.ok) return [];
    const detData = await detRes.json();
    if (!detData.embed_frame_url) return [];
    const pDomain = getOrigin(detData.embed_frame_url);

    // 4. Challenge (Optional but good for health)
    try {
      await fetch(`${pDomain}/api/videos/access/challenge`, {
        method: 'POST',
        headers: { 'accept': '*/*', 'origin': pDomain, 'referer': detData.embed_frame_url, 'user-agent': getUA() }
      });
    } catch {}

    // 5. Playback
    const fp = generateFingerprint();
    const pbRes = await fetch(`${pDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: { 
        "content-type": "application/json", "origin": pDomain, 
        "referer": detData.embed_frame_url, "user-agent": getUA(),
        "x-embed-origin": "api.pomfy.stream", "x-embed-parent": ptData.byseUrl
      },
      body: JSON.stringify({ fingerprint: fp })
    });
    if (!pbRes.ok) return [];
    const pbData = await pbRes.json();
    if (!pbData.playback) return [];

    const dec = decryptPlayback(pbData.playback);
    if (dec.success) {
      return [{
        name: "Pomfy",
        title: '1080p',
        url: dec.url,
        quality: 1080,
        type: "hls",
        headers: {
          "User-Agent": getUA(),
          "Referer": pDomain + "/",
          "Origin": pDomain,
          "Accept": "*/*",
          "Accept-Language": "pt-BR,pt;q=0.9"
        },
        behaviorHints: {
          notWebReady: true,
          bingeGroup: "pomfy-" + byseId
        }
      }];
    }
    return [];
  } catch {
    return [];
  }
}

module.exports = { getStreams };
