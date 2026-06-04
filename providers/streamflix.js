/**
 * iptv-m3u - Built from src/iptv-m3u/
 * Generated: 2026-06-03T17:12:23.060Z
 */
"use strict";
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
// DEBUG SYSTEM
// ==============================================
var DEBUG_LOGS = [];

function log(label, data) {
  var ts = new Date().toISOString();
  var entry = { time: ts, label: label };
  if (data !== undefined) entry.data = data;
  DEBUG_LOGS.push(entry);
}

function logError(label, err) {
  var ts = new Date().toISOString();
  DEBUG_LOGS.push({ time: ts, label: "ERROR: " + label, error: err && err.message ? err.message : String(err) });
}

function buildDebugUrl() {
  var lines = [];
  for (var i = 0; i < DEBUG_LOGS.length; i++) {
    var e = DEBUG_LOGS[i];
    var line = "[" + e.time + "] " + e.label;
    if (e.data !== undefined) {
      line += ": " + (typeof e.data === "object" ? JSON.stringify(e.data) : String(e.data));
    }
    if (e.error !== undefined) line += " | ERR: " + e.error;
    lines.push(line);
  }
  var body = lines.join("\n");
  return "data:text/plain;base64," + btoa(body);
}

function makeDebugStream(title, subtitle) {
  return [{
    url: buildDebugUrl(),
    name: "Debug Log",
    title: (title || "IPTV-M3U") + (subtitle ? " - " + subtitle : ""),
    headers: {},
    type: "text/plain"
  }];
}

// src/iptv-m3u/index.js
var TMDB_KEY = "c6c6f4c1cb446e0d5c305f3fa7eeb4a9";
var M3U_LISTS = [
  "https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/Lista%20Mundial01.m3u",
  "https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/Lista%20Mundial02.m3u",
  "https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/Lista%20Mundial03.m3u",
  "https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/Lista%20Mundial04.m3u",
  "https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/Lista%20Mundial05.m3u"
];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};
var FETCH_TIMEOUT_MS = 8e3;
var _m3uCache = null;
var _m3uPromise = null;

function normalizeName(name) {
  return (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function getCleanName(name) {
  return normalizeName((name || "").replace(/\[L\]/gi, "").replace(/\[LEG\]/gi, "").replace(/\[XL\]/gi, "").replace(/\(Legendado\)/gi, "").replace(/ ?-? ?Legendado/gi, ""));
}

function parseM3U(text, map) {
  const lines = text.split("\n");
  let name = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const tvg = line.match(/tvg-name="([^"]+)"/);
      if (tvg)
        name = tvg[1];
      else {
        const parts = line.split(",");
        name = parts[parts.length - 1].trim();
      }
    } else if (line && !line.startsWith("#")) {
      if (name) {
        const norm = normalizeName(name);
        if (norm && !map.has(norm))
          map.set(norm, line);
        const noYear = norm.replace(/\s*\b(19|20)\d{2}\b\s*/g, " ").replace(/\s+/g, " ").trim();
        if (noYear && noYear !== norm && !map.has(noYear))
          map.set(noYear, line);
        name = "";
      }
    }
  }
}

function fetchAllLists() {
  return __async(this, null, function* () {
    if (_m3uCache)
      return _m3uCache;
    if (_m3uPromise)
      return _m3uPromise;
    _m3uPromise = (() => __async(this, null, function* () {
      const map = /* @__PURE__ */ new Map();
      log("fetchAllLists start", { totalLists: M3U_LISTS.length });
      const texts = yield Promise.all(
        M3U_LISTS.map(function(url) {
          return fetchWithTimeout(url, FETCH_TIMEOUT_MS).then(
            function(t) {
              return { url, text: t };
            },
            function() {
              return { url, text: null };
            }
          );
        })
      );
      for (let i = 0; i < texts.length; i++) {
        const item = texts[i];
        if (!item || !item.text) {
          log("fetchAllLists failed", { url: item.url.split("/").pop() });
          continue;
        }
        if (item.text.indexOf("#EXTINF") === -1) {
          log("fetchAllLists no EXTINF", { url: item.url.split("/").pop() });
          continue;
        }
        const before = map.size;
        parseM3U(item.text, map);
        log("fetchAllLists parsed", { url: item.url.split("/").pop(), added: map.size - before, total: map.size });
      }
      log("fetchAllLists complete", { totalItems: map.size });
      _m3uCache = map;
      return map;
    }))();
    return _m3uPromise;
  });
}

function fetchWithTimeout(url, ms) {
  const fetchP = fetch(url, { headers: HEADERS }).then(function(res) {
    if (!res.ok)
      return null;
    return res.text();
  });
  const timeoutP = new Promise(function(resolve) {
    setTimeout(function() {
      resolve(null);
    }, ms);
  });
  return Promise.race([fetchP, timeoutP]).catch(function() {
    return null;
  });
}

function findMatch(name, tmdbTitle, map) {
  if (!name)
    return void 0;
  let m = map.get(normalizeName(name));
  if (m)
    return m;
  if (/\[(LEG|L|XL|SUB)\]/i.test(name) || /Legendado/i.test(name)) {
    const c = getCleanName(name);
    for (const v of [c + " l", c + " leg", c + " legendado", c + " legendadas", c + " xl", c + " sub"]) {
      m = map.get(normalizeName(v));
      if (m)
        return m;
    }
  }
  const clean = getCleanName(name);
  m = map.get(clean);
  if (m)
    return m;
  const noYear = clean.replace(/\d{4}/, "").trim();
  if (noYear !== clean) {
    m = map.get(normalizeName(noYear));
    if (m)
      return m;
  }
  if (tmdbTitle) {
    m = map.get(normalizeName(tmdbTitle));
    if (m)
      return m;
  }
  const er = normalizeName(name).match(/(.*?)s(\d+)\s*e(\d+)/i);
  if (er) {
    const [, serie, season, ep] = er;
    const s = season.padStart(2, "0"), e = ep.padStart(2, "0");
    for (const v of [`${serie} s${s}e${e}`, `${serie} s${s} e${e}`, `${serie} t${s}e${e}`, `${serie} ${s}x${e}`]) {
      m = map.get(v.trim());
      if (m)
        return m;
    }
  }
  return void 0;
}

function guessQuality(url) {
  if (/1080|fhd|full ?hd/i.test(url))
    return "1080p";
  if (/720|hd/i.test(url))
    return "720p";
  if (/2160|4k|uhd/i.test(url))
    return "4K";
  return "720p";
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    DEBUG_LOGS.length = 0;
    log("getStreams START", { tmdbId: tmdbId, mediaType: mediaType, season: season, episode: episode });

    if (!["movie", "tv"].includes(mediaType)) {
      log("getStreams invalid mediaType", mediaType);
      return makeDebugStream("IPTV-M3U", "Invalid mediaType: " + mediaType);
    }

    try {
      const t = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = "https://api.themoviedb.org/3/" + t + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=pt-BR";
      log("getStreams tmdbUrl", tmdbUrl);

      const tmdb = yield fetch(tmdbUrl).then((r) => r.json());
      const ptTitle = tmdb.name || tmdb.title || "";
      const origTitle = tmdb.original_name || tmdb.original_title || "";
      log("getStreams tmdbInfo", { ptTitle: ptTitle, origTitle: origTitle, releaseDate: tmdb.release_date, firstAirDate: tmdb.first_air_date });

      if (!ptTitle && !origTitle) {
        log("getStreams no tmdb title");
        return makeDebugStream("IPTV-M3U", "No TMDB title found for " + tmdbId);
      }

      const map = yield fetchAllLists();
      if (!map.size) {
        log("getStreams no lists loaded");
        return makeDebugStream("IPTV-M3U", "No M3U lists loaded");
      }

      const candidates = [];
      if (mediaType === "tv") {
        const s = String(season).padStart(2, "0"), e = String(episode).padStart(2, "0");
        for (const base of [ptTitle, origTitle]) {
          if (!base)
            continue;
          candidates.push(`${base} S${s}E${e}`, `${base} S${s} E${e}`, `${base} ${season}x${episode}`);
        }
      } else {
        const year = (tmdb.release_date || "").substring(0, 4);
        for (const base of [ptTitle, origTitle]) {
          if (!base)
            continue;
          candidates.push(base, year ? `${base} ${year}` : base);
        }
      }
      log("getStreams candidates", candidates);

      const found = [], seen = /* @__PURE__ */ new Set();
      for (const c of candidates) {
        for (const variant of [c, c + " [L]", c + " [LEG]", c + " Legendado"]) {
          const url = findMatch(variant, origTitle, map);
          if (url && !seen.has(url)) {
            seen.add(url);
            const isLeg = /\[(LEG|L|XL|SUB)\]|legendado/i.test(variant);
            found.push({
              name: "IPTV M3U",
              title: ptTitle + (mediaType === "tv" ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "") + (isLeg ? " [LEG]" : " [DUB]"),
              url,
              quality: guessQuality(url),
              headers: HEADERS
            });
          }
        }
      }

      log("getStreams result", { found: found.length });

      if (found.length === 0) {
        log("getStreams no matches");
        return makeDebugStream(ptTitle || "IPTV-M3U", "No M3U matches found for " + (ptTitle || origTitle));
      }

      return found;
    } catch (e) {
      logError("getStreams", e);
      return makeDebugStream("IPTV-M3U", "Exception: " + (e.message || String(e)));
    }
  });
}

module.exports = { getStreams };
