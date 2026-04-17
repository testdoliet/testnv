const API_URL = 'https://reidosembeds.com/api';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://reidosembeds.com/'
};

const CACHE = {};
const BLOCKED_CATEGORIES = ['Adulto', 'adulto', 'ADULTO'];

async function fetchJson(url) {
    const response = await fetch(url, { headers: HEADERS });
    return response.json();
}

async function getCategories() {
    if (CACHE.categories) return CACHE.categories;
    
    const data = await fetchJson(`${API_URL}/channels/categories`);
    const categories = data.data.filter(cat => !BLOCKED_CATEGORIES.includes(cat.name));
    
    CACHE.categories = categories;
    return categories;
}

async function getChannelsByCategory(categoryId) {
    const cacheKey = `category_${categoryId}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];
    
    const data = await fetchJson(`${API_URL}/channels?category=${encodeURIComponent(categoryId)}`);
    const channels = data.data;
    
    CACHE[cacheKey] = channels;
    return channels;
}

async function getAllChannels() {
    if (CACHE.allChannels) return CACHE.allChannels;
    
    const data = await fetchJson(`${API_URL}/channels`);
    const channels = data.data.filter(ch => !BLOCKED_CATEGORIES.includes(ch.category));
    
    CACHE.allChannels = channels;
    return channels;
}

function fixImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    return url;
}

async function getChannelStreamUrl(channelUrl) {
    const cacheKey = `stream_${channelUrl}`;
    if (CACHE[cacheKey]) return CACHE[cacheKey];
    
    const response = await fetch(channelUrl, {
        headers: {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://rde.buzz/'
        }
    });
    
    const html = await response.text();
    
    const iframeMatch = html.match(/<iframe[^>]*src="([^"]*__play[^"]*)"[^>]*>/);
    if (!iframeMatch) return null;
    
    const playerUrl = iframeMatch[1].replace(/&amp;/g, '&');
    
    const playerResponse = await fetch(playerUrl, {
        headers: {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': channelUrl
        }
    });
    
    const playerHtml = await playerResponse.text();
    
    const sourcesMatch = playerHtml.match(/var sources\s*=\s*(\[.*?\]);/s);
    if (!sourcesMatch) return null;
    
    const sources = JSON.parse(sourcesMatch[1]);
    
    for (const source of sources) {
        let streamUrl = source.src.replace(/\\\//g, '/');
        
        const testResponse = await fetch(streamUrl, {
            method: 'HEAD',
            headers: {
                'Referer': playerUrl,
                'Origin': 'https://rde.buzz'
            }
        });
        
        if (testResponse.ok || testResponse.status === 206) {
            CACHE[cacheKey] = streamUrl;
            return streamUrl;
        }
    }
    
    return null;
}

async function getMainPage() {
    const categories = await getCategories();
    const allChannels = await getAllChannels();
    
    const pages = [];
    
    pages.push({
        title: '📺 Todos',
        items: allChannels.map(channel => ({
            name: channel.name,
            url: channel.embed_url,
            poster: fixImageUrl(channel.logo_url),
            type: 'live'
        }))
    });
    
    for (const category of categories) {
        const channels = await getChannelsByCategory(category.id);
        
        if (channels.length > 0) {
            pages.push({
                title: category.name,
                items: channels.map(channel => ({
                    name: channel.name,
                    url: channel.embed_url,
                    poster: fixImageUrl(channel.logo_url),
                    type: 'live'
                }))
            });
        }
    }
    
    return pages;
}

async function search(query) {
    const data = await fetchJson(`${API_URL}/pesquisa?q=${encodeURIComponent(query)}`);
    
    const results = [];
    
    for (const channel of data.data.channels) {
        if (!BLOCKED_CATEGORIES.includes(channel.category)) {
            results.push({
                name: channel.name,
                url: channel.embed_url,
                poster: fixImageUrl(channel.logo_url),
                type: 'live'
            });
        }
    }
    
    for (const event of data.data.events) {
        if (event.embeds && event.embeds.length > 0) {
            results.push({
                name: event.title,
                url: event.embeds[0].embed_url,
                poster: fixImageUrl(event.poster),
                type: 'live'
            });
        }
    }
    
    return results;
}

async function load(url) {
    const streamUrl = await getChannelStreamUrl(url);
    
    if (!streamUrl) return null;
    
    return {
        url: streamUrl,
        headers: {
            'Referer': url,
            'Origin': 'https://rde.buzz',
            'User-Agent': HEADERS['User-Agent']
        },
        name: 'Rei dos Embeds',
        title: url.split('/').pop().replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getMainPage, search, load };
} else {
    global.getMainPage = getMainPage;
    global.search = search;
    global.load = load;
}
