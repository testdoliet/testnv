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
    
    const data = await fetchJson(`${API_URL
