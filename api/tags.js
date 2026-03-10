import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';
const cache = new Map();

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = String(req.query.q || '').trim();

    if (query.length < 2) {
      return res.json([]);
    }

    const provider = String(req.query.provider || 'e621');
    const host = provider === 'e926' ? 'https://e926.net' : 'https://e621.net';
    const cacheKey = `tags:${host}:${query}`;

    // Cache na 5 minut dla tagów (nie zmieniają się często)
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < 300000) {
        return res.json(data);
      }
    }

    console.log('🏷️  Searching tags:', query, 'host:', host);

    const response = await axios.get(`${host}/tags/autocomplete.json`, {
      params: { 'search[name_matches]': `${query}*`, limit: 10 },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });

    const results = (response.data || []).map((tag) => ({
      id: `tag-${tag.id}`,
      type: 'tag',
      name: tag.name,
      post_count: tag.post_count,
      category: tag.category,
      antecedent_name: tag.antecedent_name || null,
    }));

    cache.set(cacheKey, { data: results, timestamp: Date.now() });

    // Cleanup
    if (cache.size > 50) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Tags error:', err.message);
    res.status(500).json([]);
  }
}
