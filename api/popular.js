import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';

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
    const { date, scale = 'day', username, apiKey } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    if (!['day', 'week', 'month'].includes(scale)) {
      return res.status(400).json({ error: 'Scale must be day, week, or month' });
    }

    const auth = username && apiKey ? { username, password: apiKey } : undefined;
    
    // Format daty dla e621: YYYY-MM-DD HH:MM:SS +ZONE
    const formattedDate = `${date} 00:00:00 +0000`;

    console.log('⭐ Fetching popular:', { date: formattedDate, scale, auth: !!auth });

    const response = await axios.get('https://e621.net/popular.json', {
      params: { 
        date: formattedDate, 
        scale 
      },
      headers: { 'User-Agent': USER_AGENT },
      auth,
      timeout: 15000,
    });

    const posts = (response.data.posts || []).filter(
      (post) => post.file?.ext !== 'swf' && !post.flags?.deleted
    );

    console.log('✅ Fetched', posts.length, 'popular posts');

    res.json({ posts, anonymous: !auth });
  } catch (err) {
    console.error('❌ Popular error:', err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.message || err.message || 'Failed to fetch popular posts',
      posts: [] 
    });
  }
}
