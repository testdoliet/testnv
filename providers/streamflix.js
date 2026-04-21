/**
 * streamflix - Debug Version
 * Retorna streams de debug para cada etapa
 */

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

var BASE_URL = "https://streamflix.live";
var TMDB_API_KEY = "b64d2f3a4212a99d64a7d4485faed7b3";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ==============================================
// FUNÇÃO PRINCIPAL - RETORNA DEBUGS COMO STREAMS
// ==============================================

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    
    const debugStreams = [];
    const fakeUrl = "https://debug.streamflix.com/fake-stream.m3u8";
    
    // ==========================================
    // STREAM 1 - INÍCIO DA EXECUÇÃO
    // ==========================================
    debugStreams.push({
      name: "🔍 [DEBUG 1/8] StreamFlix Iniciado",
      title: `Parâmetros: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`,
      url: fakeUrl,
      quality: 360,
      headers: { "User-Agent": "Debug/1.0" }
    });
    
    // ==========================================
    // STREAM 2 - TESTE DE CONEXÃO
    // ==========================================
    try {
      const testUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const testResponse = yield fetch(testUrl, { method: "HEAD" });
      
      debugStreams.push({
        name: testResponse.ok ? "✅ [DEBUG 2/8] StreamFlix Conectado" : "❌ [DEBUG 2/8] StreamFlix Offline",
        title: testResponse.ok ? `Status: ${testResponse.status}` : `Erro: ${testResponse.status}`,
        url: fakeUrl,
        quality: 360,
        headers: { "User-Agent": "Debug/1.0" }
      });
    } catch (e) {
      debugStreams.push({
        name: "❌ [DEBUG 2/8] Falha na Conexão",
        title: `Erro: ${e.message}`,
        url: fakeUrl,
        quality: 360,
        headers: { "User-Agent": "Debug/1.0" }
      });
    }
    
    // ==========================================
    // STREAM 3 - BUSCA TMDB
    // ==========================================
    let mediaInfo = null;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const tmdbUrl = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const tmdbResponse = yield fetch(tmdbUrl);
      
      if (tmdbResponse.ok) {
        const data = yield tmdbResponse.json();
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        mediaInfo = { title, year };
        
        debugStreams.push({
          name: "✅ [DEBUG 3/8] TMDB Encontrado",
          title: `"${title}" (${year || "sem ano"})`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
      } else {
        debugStreams.push({
          name: "❌ [DEBUG 3/8] TMDB Falhou",
          title: `Status: ${tmdbResponse.status}`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: "❌ [DEBUG 3/8] TMDB Erro",
        title: `Erro: ${e.message}`,
        url: fakeUrl,
        quality: 480,
        headers: { "User-Agent": "Debug/1.0" }
      });
    }
    
    // ==========================================
    // STREAM 4 - BUSCANDO FILMES
    // ==========================================
    let movies = [];
    try {
      const moviesUrl = `${BASE_URL}/api_proxy.php?action=get_vod_streams`;
      const moviesRes = yield fetch(moviesUrl);
      
      if (moviesRes.ok) {
        movies = yield moviesRes.json();
        debugStreams.push({
          name: "✅ [DEBUG 4/8] Filmes Carregados",
          title: `Total: ${movies.length} filmes disponíveis`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
        
        // Mostra primeiros 3 filmes
        for (let i = 0; i < Math.min(3, movies.length); i++) {
          debugStreams.push({
            name: `📽️ Exemplo Filme ${i+1}`,
            title: movies[i].name.substring(0, 60),
            url: fakeUrl,
            quality: 480,
            headers: { "User-Agent": "Debug/1.0" }
          });
        }
      } else {
        debugStreams.push({
          name: "❌ [DEBUG 4/8] Erro Filmes",
          title: `Status: ${moviesRes.status}`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: "❌ [DEBUG 4/8] Erro Filmes",
        title: `Erro: ${e.message}`,
        url: fakeUrl,
        quality: 480,
        headers: { "User-Agent": "Debug/1.0" }
      });
    }
    
    // ==========================================
    // STREAM 5 - BUSCANDO SÉRIES
    // ==========================================
    let series = [];
    try {
      const seriesUrl = `${BASE_URL}/api_proxy.php?action=get_series`;
      const seriesRes = yield fetch(seriesUrl);
      
      if (seriesRes.ok) {
        series = yield seriesRes.json();
        debugStreams.push({
          name: "✅ [DEBUG 5/8] Séries Carregadas",
          title: `Total: ${series.length} séries disponíveis`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
        
        // Mostra primeiras 3 séries
        for (let i = 0; i < Math.min(3, series.length); i++) {
          debugStreams.push({
            name: `📺 Exemplo Série ${i+1}`,
            title: series[i].name.substring(0, 60),
            url: fakeUrl,
            quality: 480,
            headers: { "User-Agent": "Debug/1.0" }
          });
        }
      } else {
        debugStreams.push({
          name: "❌ [DEBUG 5/8] Erro Séries",
          title: `Status: ${seriesRes.status}`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
      }
    } catch (e) {
      debugStreams.push({
        name: "❌ [DEBUG 5/8] Erro Séries",
        title: `Erro: ${e.message}`,
        url: fakeUrl,
        quality: 480,
        headers: { "User-Agent": "Debug/1.0" }
      });
    }
    
    // ==========================================
    // STREAM 6 - BUSCANDO CORRESPONDÊNCIA
    // ==========================================
    if (mediaInfo && movies.length > 0) {
      const searchTerm = mediaInfo.title.toLowerCase().substring(0, 20);
      let found = null;
      
      for (const movie of movies) {
        if (movie.name.toLowerCase().includes(searchTerm)) {
          found = movie;
          break;
        }
      }
      
      if (found) {
        debugStreams.push({
          name: "✅ [DEBUG 6/8] Correspondência Encontrada",
          title: `"${found.name}" (ID: ${found.stream_id})`,
          url: fakeUrl,
          quality: 720,
          headers: { "User-Agent": "Debug/1.0" }
        });
        
        // ==========================================
        // STREAM 7 - TENTANDO OBTER URL REAL
        // ==========================================
        try {
          const streamUrl = `${BASE_URL}/api_proxy.php?action=get_stream_url&type=movie&id=${found.stream_id}`;
          const streamRes = yield fetch(streamUrl);
          
          if (streamRes.ok) {
            const streamData = yield streamRes.json();
            const realVideoUrl = streamData.stream_url;
            
            if (realVideoUrl) {
              // Detecta qualidade real
              let qualityStr = "720p";
              let qualityNum = 720;
              if (realVideoUrl.includes("2160") || realVideoUrl.includes("4k")) {
                qualityStr = "4K";
                qualityNum = 2160;
              } else if (realVideoUrl.includes("1080")) {
                qualityStr = "1080p";
                qualityNum = 1080;
              }
              
              // STREAM REAL ENCONTRADO!
              debugStreams.push({
                name: `🎯 STREAM REAL - ${mediaInfo.title} (Dublado)`,
                title: `${mediaType === "movie" ? "Filme" : `S${season}E${episode}`} - ${qualityStr}`,
                url: realVideoUrl,
                quality: qualityNum,
                headers: {
                  "User-Agent": "Mozilla/5.0",
                  "Referer": BASE_URL
                }
              });
            } else {
              debugStreams.push({
                name: "❌ [DEBUG 7/8] URL não obtida",
                title: "stream_url veio vazio",
                url: fakeUrl,
                quality: 480,
                headers: { "User-Agent": "Debug/1.0" }
              });
            }
          } else {
            debugStreams.push({
              name: "❌ [DEBUG 7/8] Erro ao obter stream",
              title: `Status: ${streamRes.status}`,
              url: fakeUrl,
              quality: 480,
              headers: { "User-Agent": "Debug/1.0" }
            });
          }
        } catch (e) {
          debugStreams.push({
            name: "❌ [DEBUG 7/8] Exceção",
            title: e.message,
            url: fakeUrl,
            quality: 480,
            headers: { "User-Agent": "Debug/1.0" }
          });
        }
      } else {
        debugStreams.push({
          name: "❌ [DEBUG 6/8] Nenhuma Correspondência",
          title: `Procurando por: "${searchTerm}"`,
          url: fakeUrl,
          quality: 480,
          headers: { "User-Agent": "Debug/1.0" }
        });
      }
    } else {
      debugStreams.push({
        name: "⚠️ [DEBUG 6/8] Pulando busca",
        title: "Sem TMDB ou filmes disponíveis",
        url: fakeUrl,
        quality: 480,
        headers: { "User-Agent": "Debug/1.0" }
      });
    }
    
    // ==========================================
    // STREAM 8 - FIM DA EXECUÇÃO
    // ==========================================
    debugStreams.push({
      name: "🏁 [DEBUG 8/8] Execução Finalizada",
      title: `Total de ${debugStreams.length} streams gerados`,
      url: fakeUrl,
      quality: 360,
      headers: { "User-Agent": "Debug/1.0" }
    });
    
    // ==========================================
    // STREAM FALLBACK (sempre funciona)
    // ==========================================
    debugStreams.push({
      name: "🎬 STREAM FALLBACK (Sempre disponível)",
      title: "Teste de qualidade 1080p - URL direta",
      url: "http://p2toptz.pro:80/movie/573468/697200/4713.mp4",
      quality: 1080,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": BASE_URL
      }
    });
    
    return debugStreams;
  });
}

module.exports = { getStreams };
