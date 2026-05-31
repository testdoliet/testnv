/**
 * PlayerFlix Provider - WatchPlayer + VIP Player
 * Com anti-detecção (sem delays)
 */

const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ==============================================
// ANTI-DETECÇÃO (sem delays)
// ==============================================

// User-Agent rotativo
const getUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

// Headers padrão (simulam navegador real)
const getHeaders = (referer, isApi = false) => {
  const userAgent = getUserAgent();
  
  const common = {
    "User-Agent": userAgent,
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"'
  };
  
  if (isApi) {
    return {
      ...common,
      "Accept": "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://embedplayer2.xyz",
      "Referer": referer
    };
  }
  
  return {
    ...common,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://playerflix.ink"
  };
};

// ==============================================
// FUNÇÃO: Converter IMDb para TMDB
// ==============================================
async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": getUserAgent(),
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (mediaType === "movie") {
      if (data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id;
      }
    } else {
      if (data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id;
      }
    }
    
    return null;
  } catch (err) {
    return null;
  }
}

// ==============================================
// FUNÇÃO: Extrair todas as qualidades do .m3u8
// ==============================================
async function extractAllQualities(m3u8Url, headers) {
  const qualities = [];
  
  try {
    const resp = await fetch(m3u8Url, { headers });
    if (!resp.ok) return qualities;
    
    const content = await resp.text();
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('#EXT-X-STREAM-INF')) {
        const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        const nameMatch = line.match(/NAME="([^"]+)"/);
        const urlLine = lines[i + 1]?.trim();
        
        if (resolutionMatch && urlLine && !urlLine.startsWith('#')) {
          const height = parseInt(resolutionMatch[2]);
          const name = nameMatch ? nameMatch[1] : `${height}p`;
          
          let fullUrl = urlLine;
          if (!urlLine.startsWith('http')) {
            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
            fullUrl = baseUrl + urlLine;
          }
          
          qualities.push({
            label: name,
            url: fullUrl,
            quality: height
          });
        }
      }
    }
    
    qualities.sort((a, b) => a.quality - b.quality);
    return qualities;
  } catch (err) {
    return qualities;
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================
async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  const streams = [];

  try {
    // ==============================================
    // 0. Converte IMDb para TMDB se necessário
    // ==============================================
    let finalId = tmdbId;
    const isImdb = String(tmdbId).toLowerCase().startsWith("tt");
    
    if (isImdb) {
      const convertedId = await convertImdbToTmdb(tmdbId, mediaType);
      if (convertedId) {
        finalId = convertedId;
      } else {
        return [];
      }
    }
    
    // ==============================================
    // 1. Busca a lista de players do playerflix
    // ==============================================
    let ajaxUrl;
    let refererUrl;
    
    if (mediaType === "movie") {
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${finalId}&type=movie`;
      refererUrl = `https://playerflix.ink/filme/${finalId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${finalId}&type=tv&season=${s}&episode=${e}`;
      refererUrl = `https://playerflix.ink/serie/${finalId}/${s}/${e}`;
    }
    
    const response = await fetch(ajaxUrl, {
      headers: getHeaders(refererUrl)
    });

    if (!response.ok) return [];
    
    const html = await response.text();
    
    // ==============================================
    // 2. Extrai WatchPlayer e VIP Player
    // ==============================================
    const players = [];
    const playerRegex = /<div class="player-option"[^>]*data-embed="([^"]+)"[^>]*>[\s\S]*?<div class="player-name">([^<]+)<\/div>/g;
    
    let match;
    while ((match = playerRegex.exec(html)) !== null) {
      const embedBase64 = match[1];
      const playerName = match[2].trim();
      
      let embedUrl = "";
      try {
        embedUrl = atob(embedBase64);
      } catch (e) {
        continue;
      }
      
      players.push({ name: playerName, embedUrl });
    }
    
    // ==============================================
    // 3. Processa WatchPlayer
    // ==============================================
    const watchPlayer = players.find(p => p.name === "WatchPlayer");
    if (watchPlayer) {
      try {
        let watchUrl = watchPlayer.embedUrl;
        
        if (watchUrl.includes("watchplayer.xyz")) {
          const watchHtmlResp = await fetch(watchUrl, {
            headers: getHeaders("https://playerflix.ink/")
          });
          
          if (watchHtmlResp.ok) {
            const watchHtml = await watchHtmlResp.text();
            let videoId = null;
            
            if (mediaType === "movie") {
              const dataIdMatch = watchHtml.match(/data-id="(\d+)"/);
              if (dataIdMatch) videoId = dataIdMatch[1];
            } else {
              const s = season || 1;
              const e = episode || 1;
              const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
              const contentMatch = watchHtml.match(pattern);
              
              if (contentMatch) {
                const contentId = contentMatch[1];
                
                const optsResp = await fetch("https://watchplayer.xyz/api", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                    "User-Agent": getUserAgent(),
                    "Referer": watchUrl,
                    "Origin": "https://watchplayer.xyz"
                  },
                  body: `action=getOptions&contentid=${contentId}`
                });
                
                if (optsResp.ok) {
                  const optsData = await optsResp.json();
                  if (optsData.data?.options?.length) {
                    videoId = optsData.data.options[0].ID;
                  }
                }
              }
            }
            
            if (videoId) {
              const playerResp = await fetch("https://watchplayer.xyz/api", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "X-Requested-With": "XMLHttpRequest",
                  "User-Agent": getUserAgent(),
                  "Referer": watchUrl,
                  "Origin": "https://watchplayer.xyz"
                },
                body: `action=getPlayer&video_id=${videoId}`
              });
              
              if (playerResp.ok) {
                const playerData = await playerResp.json();
                if (playerData.data?.video_url) {
                  watchUrl = playerData.data.video_url;
                }
              }
            }
          }
        }
        
        if (watchUrl.includes('.m3u8') || watchUrl.includes('/hls/')) {
          streams.push({
            name: "WatchPlayer",
            title: "720p",
            url: watchUrl,
            quality: 720,
            type: "hls",
            headers: {
              "User-Agent": getUserAgent(),
              "Accept-Encoding": "identity",
              "Referer": "https://watchplayer.xyz/",
              "Origin": "https://watchplayer.xyz"
            }
          });
        }
      } catch (err) {
        // WatchPlayer falhou silenciosamente
      }
    }
    
    // ==============================================
    // 4. Processa VIP Player
    // ==============================================
    const vipPlayer = players.find(p => p.name === "VIP Player");
    if (vipPlayer) {
      try {
        const hashMatch = vipPlayer.embedUrl.match(/\/video\/([a-f0-9]+)/);
        if (hashMatch) {
          const videoHash = hashMatch[1];
          
          const vipResp = await fetch(`https://embedplayer2.xyz/player/index.php?data=${videoHash}&do=getVideo`, {
            method: "POST",
            headers: getHeaders(`https://embedplayer2.xyz/video/${videoHash}`, true),
            body: `hash=${videoHash}&r=`
          });
          
          if (vipResp.ok) {
            const vipData = await vipResp.json();
            
            if (vipData.securedLink) {
              const qualities = await extractAllQualities(vipData.securedLink, {
                "User-Agent": getUserAgent(),
                "Accept-Encoding": "identity"
              });
              
              if (qualities.length > 0) {
                for (const q of qualities) {
                  streams.push({
                    name: "VIP Player",
                    title: q.label,
                    url: q.url,
                    quality: q.quality,
                    type: "hls",
                    headers: {
                      "User-Agent": getUserAgent(),
                      "Accept-Encoding": "identity",
                      "Referer": "https://embedplayer2.xyz/",
                      "Origin": "https://embedplayer2.xyz"
                    }
                  });
                }
              } else {
                streams.push({
                  name: "VIP Player",
                  title: "720p",
                  url: vipData.securedLink,
                  quality: 720,
                  type: "hls",
                  headers: {
                    "User-Agent": getUserAgent(),
                    "Accept-Encoding": "identity",
                    "Referer": "https://embedplayer2.xyz/",
                    "Origin": "https://embedplayer2.xyz"
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        // VIP Player falhou silenciosamente
      }
    }
    
    return streams;
    
  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
