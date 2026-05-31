/**
 * PlayerFlix Provider - WatchPlayer + VIP Player
 * Com extração real do .m3u8 do WatchPlayer
 */

async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  const streams = [];

  try {
    // ==============================================
    // 1. Busca a lista de players do playerflix
    // ==============================================
    let ajaxUrl;
    let refererUrl;
    
    if (mediaType === "movie") {
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${tmdbId}&type=movie`;
      refererUrl = `https://playerflix.ink/filme/${tmdbId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${tmdbId}&type=tv&season=${s}&episode=${e}`;
      refererUrl = `https://playerflix.ink/serie/${tmdbId}/${s}/${e}`;
    }
    
    const response = await fetch(ajaxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Referer": refererUrl,
        "Origin": "https://playerflix.ink"
      }
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
    // 3. Processa WatchPlayer (extrai .m3u8 real)
    // ==============================================
    const watchPlayer = players.find(p => p.name === "WatchPlayer");
    if (watchPlayer) {
      let watchUrl = watchPlayer.embedUrl;
      
      // Se for página HTML (watchplayer.xyz), extrai o .m3u8
      if (watchUrl.includes("watchplayer.xyz")) {
        try {
          // Busca o HTML do watchplayer
          const watchHtmlResp = await fetch(watchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Referer": "https://playerflix.ink/",
              "Origin": "https://watchplayer.xyz"
            }
          });
          
          if (watchHtmlResp.ok) {
            const watchHtml = await watchHtmlResp.text();
            let videoId = null;
            
            if (mediaType === "movie") {
              // Filme: extrai data-id
              const dataIdMatch = watchHtml.match(/data-id="(\d+)"/);
              if (dataIdMatch) videoId = dataIdMatch[1];
            } else {
              // Série: extrai content_id
              const s = season || 1;
              const e = episode || 1;
              const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
              const contentMatch = watchHtml.match(pattern);
              
              if (contentMatch) {
                const contentId = contentMatch[1];
                
                // Busca options
                const optsResp = await fetch("https://watchplayer.xyz/api", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                    "User-Agent": "Mozilla/5.0",
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
              // Busca o .m3u8 final
              const playerResp = await fetch("https://watchplayer.xyz/api", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "X-Requested-With": "XMLHttpRequest",
                  "User-Agent": "Mozilla/5.0",
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
        } catch (err) {
          // Fallback: mantém a URL original
        }
      }
      
      streams.push({
        name: "WatchPlayer",
        title: "720p",
        url: watchUrl,
        quality: 720,
        type: "hls",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Encoding": "identity",
          "Referer": "https://watchplayer.xyz/",
          "Origin": "https://watchplayer.xyz"
        }
      });
    }
    
    // ==============================================
    // 4. Processa VIP Player (já dá .m3u8 direto)
    // ==============================================
    const vipPlayer = players.find(p => p.name === "VIP Player");
    if (vipPlayer) {
      const hashMatch = vipPlayer.embedUrl.match(/\/video\/([a-f0-9]+)/);
      if (hashMatch) {
        const videoHash = hashMatch[1];
        
        try {
          const vipResp = await fetch(`https://embedplayer2.xyz/player/index.php?data=${videoHash}&do=getVideo`, {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
              "Origin": "https://embedplayer2.xyz",
              "Referer": `https://embedplayer2.xyz/video/${videoHash}`
            },
            body: `hash=${videoHash}&r=`
          });
          
          if (vipResp.ok) {
            const vipData = await vipResp.json();
            
            if (vipData.securedLink) {
              streams.push({
                name: "VIP Player",
                title: "1080p",
                url: vipData.securedLink,
                quality: 1080,
                type: "hls",
                headers: {
                  "User-Agent": "Mozilla/5.0",
                  "Accept-Encoding": "identity",
                  "Referer": "https://embedplayer2.xyz/",
                  "Origin": "https://embedplayer2.xyz"
                }
              });
            }
          }
        } catch (err) {
          // Falha silenciosa
        }
      }
    }
    
    return streams;
    
  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
