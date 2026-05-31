/**
 * WatchPlayer Provider - Versão Completa
 * Anti-detecção inspirada no Pomfy + Detecção REAL de qualidade
 * Funciona no quick.js (Nuvio)
 */

// ==============================================
// CACHE
// ==============================================
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ==============================================
// ANTI-DETECÇÃO (inspirado no Pomfy)
// ==============================================

// Delay aleatório entre requisições
const randomDelay = (min = 100, max = 800) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Gera ID aleatório (hex)
const generateRandomId = (length) => {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Gera fingerprint igual ao Pomfy
const generateFingerprint = () => {
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
  
  return {
    token: Buffer.from(JSON.stringify(payload)).toString('base64'),
    viewer_id: viewerId,
    device_id: deviceId
  };
};

// User-Agent rotativo
const getUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

// Headers para HTML (navegador real)
const getHtmlHeaders = (referer) => {
  const userAgent = getUserAgent();
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Referer": referer || "https://playerflix.ink/",
    "Origin": "https://watchplayer.xyz",
    "X-Fingerprint": fingerprint.token
  };
};

// Headers para API (XHR/fetch)
const getApiHeaders = (referer) => {
  const userAgent = getUserAgent();
  const fingerprint = generateFingerprint();
  
  return {
    "User-Agent": userAgent,
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://watchplayer.xyz",
    "Referer": referer,
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "X-Requested-With": "XMLHttpRequest",
    "X-Fingerprint": fingerprint.token
  };
};

// Headers para stream (.m3u8)
const getStreamHeaders = () => {
  const userAgent = getUserAgent();
  
  return {
    "User-Agent": userAgent,
    "Accept-Encoding": "identity",  // ESSENCIAL: sem compressão
    "Accept": "*/*",
    "Origin": "https://watchplayer.xyz",
    "Referer": "https://watchplayer.xyz/",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache"
  };
};

// ==============================================
// DETECÇÃO REAL DE QUALIDADE
// ==============================================

/**
 * Extrai resolução de um segmento .ts analisando SPS (Sequence Parameter Set)
 * Retorna { width, height, qualityLabel }
 */
function extractResolutionFromTs(tsBuffer) {
  const bytes = new Uint8Array(tsBuffer);
  
  // Procura por NAL unit start code: 0x00 0x00 0x01
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x00 && bytes[i+1] === 0x00 && bytes[i+2] === 0x01) {
      const nalType = bytes[i+3] & 0x1F;
      
      // NAL type 7 = SPS (Sequence Parameter Set)
      if (nalType === 7) {
        // Extrai payload do SPS
        let pos = i + 4;
        const spsPayload = [];
        
        while (pos < bytes.length && spsPayload.length < 100) {
          if (bytes[pos] === 0x00 && bytes[pos+1] === 0x00 && bytes[pos+2] === 0x01) break;
          spsPayload.push(bytes[pos]);
          pos++;
        }
        
        if (spsPayload.length < 10) continue;
        
        // Parse do SPS para extrair resolução
        // Baseado na especificação H.264
        let offset = 1; // Pula o primeiro byte
        
        // Função para ler Exponential Golomb (ue(v))
        const readUE = () => {
          let leadingZeros = 0;
          while (offset < spsPayload.length && spsPayload[offset] === 0) {
            leadingZeros++;
            offset++;
          }
          let value = (1 << leadingZeros) - 1;
          for (let i = 0; i < leadingZeros; i++) {
            value = (value << 1) | (spsPayload[offset] & 1);
            offset++;
          }
          return value;
        };
        
        // profile_idc (8 bits)
        offset++;
        // constraint_flags (8 bits)
        offset++;
        // level_idc (8 bits)
        offset++;
        
        // seq_parameter_set_id
        readUE();
        
        // log2_max_frame_num_minus4
        readUE();
        
        // pic_order_cnt_type
        const pocType = readUE();
        
        if (pocType === 0) {
          // log2_max_pic_order_cnt_lsb_minus4
          readUE();
        } else if (pocType === 1) {
          // delta_pic_order_always_zero_flag
          offset++;
          // offset_for_non_ref_pic
          readUE();
          // offset_for_top_to_bottom_field
          readUE();
          // num_ref_frames_in_pic_order_cnt_cycle
          const numRefFrames = readUE();
          for (let i = 0; i < numRefFrames; i++) {
            readUE(); // offset_for_ref_frame[i]
          }
        }
        
        // max_num_ref_frames
        readUE();
        
        // gaps_in_frame_num_value_allowed_flag
        offset++;
        
        // Largura: pic_width_in_mbs_minus1
        const picWidthInMbs = readUE() + 1;
        const width = picWidthInMbs * 16;
        
        // Altura: pic_height_in_map_units_minus1
        let picHeightInMapUnits = readUE() + 1;
        
        // frame_mbs_only_flag
        const frameMbsOnlyFlag = (spsPayload[offset] & 1);
        offset++;
        
        if (!frameMbsOnlyFlag) {
          // mb_adaptive_frame_field_flag
          offset++;
        }
        
        let height = picHeightInMapUnits * 16;
        if (!frameMbsOnlyFlag) {
          height *= 2;
        }
        
        if (width > 0 && height > 0) {
          // Classifica qualidade
          let qualityLabel = '';
          if (height >= 2160) qualityLabel = '4K';
          else if (height >= 1080) qualityLabel = '1080p';
          else if (height >= 720) qualityLabel = '720p';
          else if (height >= 480) qualityLabel = '480p';
          else if (height >= 360) qualityLabel = '360p';
          else qualityLabel = `${height}p`;
          
          return { width, height, qualityLabel };
        }
      }
    }
  }
  
  return null;
}

/**
 * Detecta qualidade real baixando 1 segmento do .m3u8
 */
async function detectRealQuality(m3u8Url, headers) {
  try {
    // Baixa o .m3u8
    const m3u8Resp = await fetch(m3u8Url, { headers });
    if (!m3u8Resp.ok) return null;
    
    const m3u8Content = await m3u8Resp.text();
    
    // Extrai o primeiro segmento .ts
    const lines = m3u8Content.split('\n');
    let firstSegment = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.ts')) {
        firstSegment = trimmed;
        break;
      }
    }
    
    if (!firstSegment) return null;
    
    // Constrói URL do segmento
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    const segmentUrl = baseUrl + firstSegment;
    
    // Baixa os primeiros 200KB do segmento (suficiente para análise)
    const segmentResp = await fetch(segmentUrl, { 
      headers,
      // @ts-ignore
      size: 200 * 1024 // Limita a 200KB
    });
    
    if (!segmentResp.ok) return null;
    
    // Converte para ArrayBuffer
    const buffer = await segmentResp.arrayBuffer();
    
    // Extrai resolução
    const resolution = extractResolutionFromTs(buffer);
    
    if (resolution) {
      return resolution;
    }
    
    return null;
  } catch (err) {
    return null;
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  const debug = [];

  const addDebug = (title, content) => {
    debug.push({ title, content: String(content).substring(0, 200) });
  };

  addDebug("🔍 INICIANDO", `${mediaType} ${tmdbId}`);

  try {
    // Verifica cache
    const cacheKey = `${mediaType}:${tmdbId}:${season}:${episode}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        addDebug("💾 CACHE", "Usando resultado em cache");
        return cached.data;
      }
    }

    // Delay inicial
    await randomDelay(100, 300);

    // Monta URL
    let url;
    if (mediaType === "movie") {
      url = `https://watchplayer.xyz/movie/${tmdbId}`;
      addDebug("📡 FILME", url);
    } else {
      const s = season || 1;
      const e = episode || 1;
      url = `https://watchplayer.xyz/tvshow/${tmdbId}/${s}/${e}`;
      addDebug("📡 SÉRIE", `${url} (T${s}E${e})`);
    }

    // Busca HTML
    const htmlResp = await fetch(url, { headers: getHtmlHeaders(url) });
    if (!htmlResp.ok) {
      addDebug("❌ HTTP", `Status ${htmlResp.status}`);
      return [];
    }

    const html = await htmlResp.text();
    addDebug("📄 HTML", `${html.length} bytes`);

    let videoId = null;

    if (mediaType === "movie") {
      // FILMES: pega data-id direto
      const match = html.match(/<div class="player_select_item" data-id="(\d+)">/);
      if (match) {
        videoId = match[1];
        addDebug("✅ VIDEO_ID", videoId);
      }
    } else {
      // SÉRIES: content_id + options
      const s = season || 1;
      const e = episode || 1;
      
      const pattern = new RegExp(`data-contentid="(\\d+)"[^>]*data-season="${s}"[^>]*data-episode="${e}"`);
      const match = html.match(pattern);
      
      if (!match) {
        addDebug("❌ CONTENT_ID", `T${s}E${e} não encontrado`);
        return [];
      }
      
      const contentId = match[1];
      addDebug("✅ CONTENT_ID", contentId);
      
      await randomDelay(150, 400);
      
      // Busca options
      const optsResp = await fetch("https://watchplayer.xyz/api", {
        method: "POST",
        headers: getApiHeaders(url),
        body: `action=getOptions&contentid=${contentId}`
      });
      
      if (!optsResp.ok) {
        addDebug("❌ OPTIONS", `HTTP ${optsResp.status}`);
        return [];
      }
      
      const optsData = await optsResp.json();
      
      if (optsData.data?.options?.length) {
        videoId = optsData.data.options[0].ID;
        addDebug("✅ VIDEO_ID", videoId);
      }
    }

    if (!videoId) {
      addDebug("❌ VIDEO_ID", "Não encontrado");
      return [];
    }

    await randomDelay(100, 250);

    // Busca URL do player
    const playerResp = await fetch("https://watchplayer.xyz/api", {
      method: "POST",
      headers: getApiHeaders(url),
      body: `action=getPlayer&video_id=${videoId}`
    });
    
    if (!playerResp.ok) {
      addDebug("❌ PLAYER", `HTTP ${playerResp.status}`);
      return [];
    }
    
    const playerData = await playerResp.json();
    
    if (!playerData.data?.video_url) {
      addDebug("❌ URL", "Não encontrada");
      return [];
    }
    
    const videoUrl = playerData.data.video_url;
    addDebug("✅ URL", videoUrl.substring(0, 80));

    // ========== DETECÇÃO REAL DE QUALIDADE ==========
    addDebug("🎯 DETECTANDO", "Qualidade real...");
    
    const streamHeaders = getStreamHeaders();
    let quality = { label: '1080p', value: 1080 };
    
    try {
      const realQuality = await detectRealQuality(videoUrl, streamHeaders);
      if (realQuality && realQuality.width > 0) {
        quality = {
          label: realQuality.qualityLabel,
          value: realQuality.height
        };
        addDebug("✅ QUALIDADE REAL", `${realQuality.width}x${realQuality.height} -> ${quality.label}`);
      } else {
        addDebug("⚠️ FALLBACK", "Usando detecção por padrão da URL");
        
        // Fallback: detecta por padrão na URL
        const urlLower = videoUrl.toLowerCase();
        if (urlLower.includes('1080') || urlLower.includes('fhd')) {
          quality = { label: '1080p', value: 1080 };
        } else if (urlLower.includes('720') || urlLower.includes('hd')) {
          quality = { label: '720p', value: 720 };
        } else if (urlLower.includes('480')) {
          quality = { label: '480p', value: 480 };
        }
      }
    } catch (err) {
      addDebug("⚠️ ERRO DETECÇÃO", err.message);
    }

    // Monta resultado
    const result = [{
      name: "WatchPlayer",
      title: quality.label,
      url: videoUrl,
      quality: quality.value,
      type: "hls",
      headers: streamHeaders
    }];

    // Salva cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    addDebug("🎉 SUCESSO", `${result.length} stream(s) - ${quality.label}`);
    
    return result;

  } catch (err) {
    addDebug("❌ ERRO", err.message);
    return [];
  }
}

module.exports = { getStreams };
