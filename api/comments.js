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
    const { provider = 'e621', postId, username, apiKey } = req.query;
    const host = provider === 'e926' ? 'https://e926.net' : 'https://e621.net';

    if (!postId) {
      return res.status(400).json({ error: 'Missing postId', comments: [] });
    }

    const cacheKey = `comments:${postId}`;

    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < 300000) {
        // 5 min cache
        return res.json(data);
      }
    }

    const auth = username && apiKey ? { username, password: apiKey } : undefined;

    console.log('💬 Fetching comments for post:', postId);

    const response = await axios.get(`${host}/comments.json`, {
      params: {
        'search[post_id]': postId,
        limit: 100,
      },
      headers: { 'User-Agent': USER_AGENT },
      auth,
      timeout: 10000,
    });

    const comments = (response.data || []).map((c) => ({
      id: c.id,
      post_id: c.post_id,
      creator_id: c.creator_id,
      creator_name: c.creator_name,
      body: c.body,
      score: c.score,
      created_at: c.created_at,
      is_hidden: c.is_hidden || false,
    }));

    console.log('✅ Fetched', comments.length, 'comments');

    const payload = { comments };
    cache.set(cacheKey, { data: payload, timestamp: Date.now() });

    if (cache.size > 200) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(payload);
  } catch (err) {
    console.error('❌ Comments error:', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message || 'Failed to fetch comments',
      comments: [],
    });
  }
}
