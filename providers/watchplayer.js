const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

let uaIndex = 0;
const getUA = () => {
  const ua = USER_AGENTS[uaIndex];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return ua;
};

const getHeaders = (referer, isApi = false) => {
  const ua = getUA();
  return isApi ? {
    "User-Agent": ua,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "https://embedplayer2.xyz",
    "Referer": referer
  } : {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://playerflix.ink"
  };
};

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const res = await fetch(url, { headers: { "User-Agent": getUA(), "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (mediaType === "movie") return data.movie_results?.[0]?.id || null;
    return data.tv_results?.[0]?.id || null;
  } catch { return null; }
}

async function getTMDBTitle(tmdbId, mediaType) {
  try {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const res = await fetch(url, { headers: { "User-Agent": getUA(), "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return mediaType === 'tv' ? data.name : data.title;
  } catch {
    return null;
  }
}

async function detectQuality(m3u8Url) {
  try {
    const res = await fetch(m3u8Url, { headers: { "User-Agent": getUA() } });
    if (!res.ok) return { label: "720p", value: "720p"};
    const text = await res.text();
    let maxH = 0;
    text.split('\n').forEach(line => {
      const m = line.match(/RESOLUTION=\d+x(\d+)/);
      if (m) maxH = Math.max(maxH, parseInt(m[1]));
    });
    if (maxH >= 1080) return { label: "1080p", value: "1080p" };
    if (maxH >= 720) return { label: "720p", value: "720p" };
    return { label: "480p", value: "480p"};
  } catch { return { label: "720p", value: "720p"}; }
}

async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  const streams = [];
  try {
    let finalId = tmdbId;
    if (String(tmdbId).toLowerCase().startsWith("tt")) {
      const converted = await convertImdbToTmdb(tmdbId, mediaType);
      if (converted) finalId = converted;
      else return [];
    }

    const s = season || 1;
    const e = episode || 1;
    
    // Buscar título para formatação
    const contentTitle = await getTMDBTitle(finalId, mediaType) || (mediaType === 'movie' ? 'Filme' : 'Série');
    const displayTitle = mediaType === 'movie' 
      ? contentTitle 
      : `${contentTitle} S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;

    const ajaxUrl = mediaType === "movie"
      ? `https://playerflix.ink/pages/ajax.php?id=${finalId}&type=movie`
      : `https://playerflix.ink/pages/ajax.php?id=${finalId}&type=tv&season=${s}&episode=${e}`;
    
    const refererUrl = mediaType === "movie"
      ? `https://playerflix.ink/filme/${finalId}`
      : `https://playerflix.ink/serie/${finalId}/${s}/${e}`;

    const res = await fetch(ajaxUrl, { headers: getHeaders(refererUrl) });
    if (!res.ok) return [];
    
    const html = await res.text();
    const players = [];
    const regex = /<div class="player-option"[^>]*data-embed="([^"]+)"[^>]*>[\s\S]*?<div class="player-name">([^<]+)<\/div>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        players.push({ name: match[2].trim(), url: atob(match[1]) });
      } catch {}
    }

    // WatchPlayer
    const wp = players.find(p => p.name === "WatchPlayer");
    if (wp && wp.url.includes("watchplayer.xyz")) {
      try {
        let wUrl = wp.url;
        const wRes = await fetch(wUrl, { headers: getHeaders("https://playerflix.ink/") });
        if (wRes.ok) {
          const wHtml = await wRes.text();
          let videoId = null;
          
          if (mediaType === "movie") {
            const m = wHtml.match(/data-id="(\d+)"/);
            if (m) videoId = m[1];
          } else {
            const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
            const cm = wHtml.match(pattern);
            if (cm) {
              const optsRes = await fetch("https://watchplayer.xyz/api", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", "User-Agent": getUA(), "Referer": wUrl, "Origin": "https://watchplayer.xyz" },
                body: `action=getOptions&contentid=${cm[1]}`
              });
              if (optsRes.ok) {
                const optsData = await optsRes.json();
                if (optsData.data?.options?.length) videoId = optsData.data.options[0].ID;
              }
            }
          }

          if (videoId) {
            const pRes = await fetch("https://watchplayer.xyz/api", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", "User-Agent": getUA(), "Referer": wUrl, "Origin": "https://watchplayer.xyz" },
              body: `action=getPlayer&video_id=${videoId}`
            });
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.data?.video_url) wUrl = pData.data.video_url;
            }
          }
        }
        
        if (wUrl.includes('.m3u8') || wUrl.includes('/hls/')) {
          streams.push({
            name: "WatchPlayer",
            title: displayTitle,
            url: wUrl,
            quality: '720p',
            headers: {},
            subtitles: [],
            provider: "playerflix"
          });
        }
      } catch {}
    }

    // VIP Player
    const vip = players.find(p => p.name === "VIP Player");
    if (vip) {
      try {
        const hashMatch = vip.url.match(/\/video\/([a-f0-9]+)/);
        if (hashMatch) {
          const hash = hashMatch[1];
          const vipRes = await fetch(`https://embedplayer2.xyz/player/index.php?data=${hash}&do=getVideo`, {
            method: "POST",
            headers: getHeaders(`https://embedplayer2.xyz/video/${hash}`, true),
            body: `hash=${hash}&r=`
          });
          if (vipRes.ok) {
            const vipData = await vipRes.json();
            if (vipData.securedLink) {
              const q = await detectQuality(vipData.securedLink);
              streams.push({
                name: "VIP Player",
                title: displayTitle,
                url: vipData.securedLink,
                quality: q.value,
                headers: {},
                subtitles: [],
                provider: "playerflix"
              });
            }
          }
        }
      } catch {}
    }

    return streams;
  } catch { return []; }
}

module.exports = { getStreams };
