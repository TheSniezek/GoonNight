import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';

// Minimalna cache w memory (resetuje się przy cold start)
const cache = new Map();

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { provider = 'e621', tags = '', page = 1, limit = 50, username, apiKey } = req.query;
    const host = provider === 'e926' ? 'https://e926.net' : 'https://e621.net';
    const cacheKey = `posts:${provider}:${tags}:${page}:${limit}:${username ? `user:${username}` : 'anon'}`;

    // Prosty cache - 60 sekund
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < 60000) {
        console.log('✅ Cache hit:', cacheKey);
        return res.json({ ...data, fromCache: true });
      }
    }

    const auth = username && apiKey ? { username, password: apiKey } : undefined;

    console.log('🔍 Fetching posts:', { tags, page, auth: !!auth });

    const response = await axios.get(`${host}/posts.json`, {
      params: {
        tags,
        limit: Math.min(Number(limit), 320),
        page: Number(page),
      },
      headers: { 'User-Agent': USER_AGENT },
      auth,
      timeout: 15000,
    });

    const posts = (response.data.posts || []).filter(
      (post) => post.file?.ext !== 'swf' && !post.flags?.deleted,
    );

    console.log('✅ Fetched', posts.length, 'posts');

    const payload = {
      posts,
      anonymous: !auth,
      hasMore: posts.length === Number(limit),
    };

    cache.set(cacheKey, { data: payload, timestamp: Date.now() });

    // Cleanup old cache entries (simple memory management)
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(payload);
  } catch (err) {
    console.error('❌ Error fetching posts:', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message || 'Failed to fetch posts',
      posts: [],
    });
  }
}
