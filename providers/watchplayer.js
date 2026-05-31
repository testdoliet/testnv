/**
 * WatchPlayer Provider - Versão Final Corrigida
 * Funciona para Filmes e Séries
 */

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];

  const addDebug = (title, content) => {
    streams.push({
      name: "WatchPlayer [DEBUG]",
      title: title,
      url: typeof content === 'object' ? JSON.stringify(content) : String(content),
      quality: 0,
      headers: {}
    });
  };

  addDebug(`🔍 INICIANDO BUSCA`, `${mediaType} ${tmdbId}`);

  try {
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
      addDebug(`📡 BUSCANDO FILME`, url);
    } else {
      const seasonNum = season || 1;
      const episodeNum = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${seasonNum}/${episodeNum}`;
      addDebug(`📡 BUSCANDO SÉRIE`, `${url} (T${seasonNum}E${episodeNum})`);
    }

    const htmlResp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) Chrome/127.0.0.0",
        "Referer": "https://playerflix.ink/",
        "Accept": "text/html"
      }
    });

    if (!htmlResp.ok) {
      addDebug(`❌ FALHA HTTP`, `Status: ${htmlResp.status}`);
      return streams;
    }

    const html = await htmlResp.text();
    addDebug(`📄 HTML`, `${html.length} bytes`);

    let videoId = null;

    if (mediaType === "movie") {
      // FILMES: extrai data-id
      const movieMatch = html.match(/<div class="player_select_item" data-id="(\d+)">/);
      if (movieMatch) {
        videoId = movieMatch[1];
        addDebug(`✅ VIDEO_ID ENCONTRADO (FILME)`, videoId);
      }
    } else {
      // SÉRIES: extrai content_id (funciona com qualquer ordem dos atributos)
      const seasonNum = season || 1;
      const episodeNum = episode || 1;
      
      // Padrão que funciona independente da ordem: data-contentid="X" data-season="Y" data-episode="Z"
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${seasonNum}"[^>]*data-episode="${episodeNum}"`);
      const match = html.match(pattern);
      
      if (!match) {
        addDebug(`❌ CONTENT_ID NÃO ENCONTRADO`, `T${seasonNum}E${episodeNum}`);
        return streams;
      }
      
      const contentId = match[1];
      addDebug(`✅ CONTENT_ID ENCONTRADO (SÉRIE)`, contentId);
      
      // Busca options via API
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0",
          "Referer": url,
          "Origin": "https://watchplayer.xyz"
        },
        body: `action=getOptions&contentid=${contentId}`
      });
      
      const optsData = await optsResp.json();
      addDebug(`📦 OPTIONS RESPONSE`, optsData);
      
      if (!optsData.data?.options?.length) {
        addDebug(`❌ NENHUMA OPÇÃO DISPONÍVEL`, optsData);
        return streams;
      }
      
      videoId = optsData.data.options[0].ID;
      addDebug(`✅ VIDEO_ID VIA OPTIONS`, videoId);
    }

    if (!videoId) {
      addDebug(`❌ VIDEO_ID NÃO ENCONTRADO`, `Tipo: ${mediaType}`);
      return streams;
    }

    // Busca a URL do player
    addDebug(`📡 BUSCANDO PLAYER`, `video_id: ${videoId}`);
    
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
        "Referer": url,
        "Origin": "https://watchplayer.xyz"
      },
      body: `action=getPlayer&video_id=${videoId}`
    });

    const playerData = await playerResp.json();
    addDebug(`📦 PLAYER RESPONSE`, playerData);
    
    if (!playerData.data?.video_url) {
      addDebug(`❌ URL NÃO ENCONTRADA`, playerData);
      return streams;
    }

    const videoUrl = playerData.data.video_url;
    addDebug(`✅ URL OBTIDA`, videoUrl);

    // Remove debug streams
    streams.length = 0;

    // Adiciona stream principal
    streams.push({
      name: "WatchPlayer",
      title: "1080p",
      url: videoUrl,
      quality: 1080,
      type: "hls",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Encoding": "identity",
        "Referer": "https://watchplayer.xyz/",
        "Origin": "https://watchplayer.xyz"
      }
    });

    return streams;

  } catch (e) {
    addDebug(`❌ ERRO`, e.message);
    return streams;
  }
}

module.exports = { getStreams };
