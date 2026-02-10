import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, apiKey, postId } = req.method === 'GET' ? req.query : req.body;

  if (!username || !apiKey) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    // GET - Pobierz listę ulubionych
    if (req.method === 'GET') {
      const { page = 1, limit = 50 } = req.query;
      
      console.log('💖 Fetching favorites for:', username);
      
      const response = await axios.get('https://e621.net/favorites.json', {
        params: { page: Number(page), limit: Number(limit) },
        headers: { 'User-Agent': USER_AGENT },
        auth: { username, password: apiKey },
        timeout: 15000,
      });
      
      const posts = (response.data.posts || []).filter(
        (post) => post.file?.ext !== 'swf' && !post.flags?.deleted
      );
      
      console.log('✅ Fetched', posts.length, 'favorites');
      return res.json({ posts });
    }

    // POST - Dodaj do ulubionych
    if (req.method === 'POST') {
      if (!postId) {
        return res.status(400).json({ error: 'Missing postId' });
      }
      
      console.log('💖 Adding favorite:', postId);
      
      await axios.post(
        `https://e621.net/favorites.json`,
        new URLSearchParams({ post_id: postId }).toString(),
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: { username, password: apiKey },
          timeout: 10000,
        }
      );
      
      console.log('✅ Added favorite:', postId);
      return res.json({ success: true });
    }

    // DELETE - Usuń z ulubionych
    if (req.method === 'DELETE') {
      if (!postId) {
        return res.status(400).json({ error: 'Missing postId' });
      }
      
      console.log('💔 Removing favorite:', postId);
      
      await axios.delete(`https://e621.net/favorites/${postId}.json`, {
        headers: { 'User-Agent': USER_AGENT },
        auth: { username, password: apiKey },
        timeout: 10000,
      });
      
      console.log('✅ Removed favorite:', postId);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('❌ Favorites error:', err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.message || err.message 
    });
  }
}
