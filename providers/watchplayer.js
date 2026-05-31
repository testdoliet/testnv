/**
 * PlayerFlix Provider - Completo para Filmes e Séries
 * Integra WatchPlayer e VIP Player
 */

async function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  const streams = [];
  const debug = [];

  const addDebug = (title, content) => {
    debug.push({ title, content: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content) });
    streams.push({
      name: "PlayerFlix [DEBUG]",
      title: title,
      url: typeof content === 'object' ? JSON.stringify(content) : String(content),
      quality: 0,
      headers: {}
    });
  };

  addDebug("🔍 INICIANDO BUSCA", `ID: ${tmdbId} | Tipo: ${mediaType} | S${season}E${episode}`);

  try {
    // ==============================================
    // 1. Monta URL correta baseada no tipo
    // ==============================================
    let ajaxUrl;
    let refererUrl;
    
    if (mediaType === "movie") {
      // Para FILMES: type=movie (sem season/episode)
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${tmdbId}&type=movie`;
      refererUrl = `https://playerflix.ink/filme/${tmdbId}`;
      addDebug("📡 [1/4] TIPO FILME", `URL: ${ajaxUrl}`);
    } else {
      // Para SÉRIES: type=tv com season e episode
      const s = season || 1;
      const e = episode || 1;
      ajaxUrl = `https://playerflix.ink/pages/ajax.php?id=${tmdbId}&type=tv&season=${s}&episode=${e}`;
      refererUrl = `https://playerflix.ink/serie/${tmdbId}/${s}/${e}`;
      addDebug("📡 [1/4] TIPO SÉRIE", `URL: ${ajaxUrl}`);
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

    if (!response.ok) {
      addDebug("❌ [1/4] FALHA HTTP", `Status: ${response.status}`);
      return streams;
    }

    const html = await response.text();
    addDebug("✅ [1/4] HTML RECEBIDO", `${html.length} bytes`);

    // ==============================================
    // 2. Extrai todos os players com data-embed
    // ==============================================
    const players = [];
    
    // Padrão universal para player-option
    const playerRegex = /<div class="player-option"[^>]*data-embed="([^"]+)"[^>]*>[\s\S]*?<div class="player-name">([^<]+)<\/div>/g;
    
    let match;
    addDebug("🔎 [2/4] EXTRAINDO PLAYERS", "Procurando players no HTML...");
    
    while ((match = playerRegex.exec(html)) !== null) {
      const embedBase64 = match[1];
      const playerName = match[2].trim();
      
      let embedUrl = "";
      try {
        embedUrl = atob(embedBase64);
        addDebug(`📦 PLAYER ENCONTRADO`, `${playerName} | URL: ${embedUrl.substring(0, 80)}...`);
      } catch (e) {
        addDebug(`⚠️ ERRO DECODIFICANDO`, `${playerName}: ${e.message}`);
        continue;
      }
      
      players.push({
        name: playerName,
        embedUrl: embedUrl
      });
    }
    
    addDebug("✅ [2/4] TOTAL PLAYERS", `${players.length} players encontrados`);

    if (players.length === 0) {
      addDebug("❌ NENHUM PLAYER ENCONTRADO", "Verifique se o HTML contém a classe 'player-option'");
      addDebug("📄 HTML SAMPLE", html.substring(0, 1000));
      return streams;
    }

    // ==============================================
    // 3. Processa cada player
    // ==============================================
    addDebug("🎬 [3/4] PROCESSANDO PLAYERS", `Total: ${players.length}`);
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      addDebug(`🔄 PLAYER ${i+1}/${players.length}`, player.name);
      
      // ===== WatchPlayer =====
      if (player.name === "WatchPlayer") {
        addDebug(`🎥 WATCHPLAYER`, `URL: ${player.embedUrl}`);
        
        streams.push({
          name: "WatchPlayer",
          title: "720p",
          url: player.embedUrl,
          quality: 720,
          type: "hls",
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept-Encoding": "identity",
            "Referer": "https://watchplayer.xyz/",
            "Origin": "https://watchplayer.xyz"
          }
        });
        addDebug(`✅ WATCHPLAYER ADICIONADO`, `Stream 720p`);
      }
      
      // ===== VIP Player =====
      if (player.name === "VIP Player") {
        addDebug(`🎥 VIP PLAYER`, `Embed URL: ${player.embedUrl}`);
        
        // Extrai o hash da URL
        const hashMatch = player.embedUrl.match(/\/video\/([a-f0-9]+)/);
        
        if (!hashMatch) {
          addDebug(`❌ VIP HASH`, `Não encontrado em: ${player.embedUrl}`);
          continue;
        }
        
        const videoHash = hashMatch[1];
        addDebug(`🔑 VIP HASH`, videoHash);
        
        try {
          const apiUrl = `https://embedplayer2.xyz/player/index.php?data=${videoHash}&do=getVideo`;
          addDebug(`📡 VIP API`, apiUrl);
          
          const vipResp = await fetch(apiUrl, {
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
          
          if (!vipResp.ok) {
            addDebug(`❌ VIP API`, `HTTP ${vipResp.status}`);
            continue;
          }
          
          const vipData = await vipResp.json();
          addDebug(`📦 VIP DATA`, vipData);
          
          if (vipData.securedLink) {
            addDebug(`✅ VIP LINK`, vipData.securedLink);
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
            addDebug(`✅ VIP ADICIONADO`, `Stream 1080p`);
          } else if (vipData.videoSource) {
            addDebug(`⚠️ VIP SOURCE`, vipData.videoSource);
            streams.push({
              name: "VIP Player",
              title: "720p",
              url: vipData.videoSource,
              quality: 720,
              type: "hls",
              headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Encoding": "identity"
              }
            });
          } else {
            addDebug(`❌ VIP SEM LINK`, `Resposta sem securedLink ou videoSource`);
          }
        } catch (err) {
          addDebug(`❌ VIP ERRO`, err.message);
        }
      }
      
      // ===== Premium =====
      if (player.name === "Premium") {
        addDebug(`🎥 PREMIUM`, `URL: ${player.embedUrl}`);
        streams.push({
          name: "Premium",
          title: "480p",
          url: player.embedUrl,
          quality: 480,
          type: "iframe",
          headers: {}
        });
        addDebug(`✅ PREMIUM ADICIONADO`, `Stream 480p (iframe)`);
      }
    }
    
    // ==============================================
    // 4. RESULTADO FINAL
    // ==============================================
    const realStreams = streams.filter(s => s.name !== "PlayerFlix [DEBUG]");
    addDebug("🎉 [4/4] FINALIZADO", `${realStreams.length} streams disponíveis`);
    
    if (realStreams.length === 0) {
      addDebug("⚠️ NENHUM STREAM", "Tente novamente mais tarde");
    } else {
      addDebug("📋 STREAMS", realStreams.map(s => `${s.name} (${s.title})`).join(", "));
    }
    
    return streams;
    
  } catch (err) {
    addDebug("❌ ERRO CRÍTICO", err.message);
    return streams;
  }
}

module.exports = { getStreams };
