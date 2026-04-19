module.exports = {
    getStreams: function(tmdbId, mediaType, season, episode) {
        return [{
            name: "Teste Plugin",
            title: "Funcionou!",
            url: "http://p2toptz.pro:80/movie/573468/697200/4713.mp4",
            quality: 1080,
            headers: {}
        }];
    }
};
