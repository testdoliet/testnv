/**
 * WatchPlayer Provider - Versão Estável
 * Qualidade fixa: 720p
 * Anti-detecção leve
 */

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    // Monta URL
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${s}/${e}`;
    }

    // Headers simulando navegador real
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "Referer": "https://playerflix.ink/",
      "Origin": "https://watchplayer.xyz"
    };

    // Busca HTML
    const htmlResp = await fetch(url, { headers });
    if (!htmlResp.ok) return [];

    const html = await htmlResp.text();
    let videoId = null;

    if (mediaType === "movie") {
      // Filmes: pega data-id
      const match = html.match(/data-id="(\d+)"/);
      if (match) videoId = match[1];
    } else {
      // Séries: pega content-id do episódio
      const s = season || 1;
      const e = episode || 1;
      
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
      const match = html.match(pattern);
      
      if (!match) return [];
      
      const contentId = match[1];
      
      // Busca options via API
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": headers["User-Agent"],
          "Referer": url,
          "Origin": "https://watchplayer.xyz"
        },
        body: `action=getOptions&contentid=${contentId}`
      });
      
      if (!optsResp.ok) return [];
      
      const optsData = await optsResp.json();
      
      if (optsData.data?.options?.length) {
        videoId = optsData.data.options[0].ID;
      }
    }

    if (!videoId) return [];

    // Busca URL do player
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": headers["User-Agent"],
        "Referer": url,
        "Origin": "https://watchplayer.xyz"
      },
      body: `action=getPlayer&video_id=${videoId}`
    });
    
    if (!playerResp.ok) return [];
    
    const playerData = await playerResp.json();
    
    if (!playerData.data?.video_url) return [];
    
    const videoUrl = playerData.data.video_url;

    // Headers para o stream (sem compressão)
    const streamHeaders = {
      "User-Agent": headers["User-Agent"],
      "Accept-Encoding": "identity",
      "Accept": "*/*",
      "Origin": "https://watchplayer.xyz",
      "Referer": "https://watchplayer.xyz/",
      "Connection": "keep-alive"
    };

    // Retorna stream com qualidade 720p fixa
    return [{
      name: "WatchPlayer",
      title: "720p",
      url: videoUrl,
      quality: 720,
      type: "hls",
      headers: streamHeaders
    }];

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
