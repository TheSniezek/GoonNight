import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, apiKey, blacklist } = req.method === 'GET' ? req.query : req.body;

  if (!username || !apiKey) {
    return res.status(400).json({ error: 'Missing credentials', blacklist: '' });
  }

  try {
    // GET - Pobierz blacklistę
    if (req.method === 'GET') {
      console.log('🚫 Fetching blacklist for:', username);
      
      const response = await axios.get(`https://e621.net/users/${username}.json`, {
        headers: { 'User-Agent': USER_AGENT },
        auth: { username, password: apiKey },
        timeout: 10000,
      });
      
      const userBlacklist = response.data.blacklisted_tags || '';
      console.log('✅ Fetched blacklist');
      
      return res.json({ blacklist: userBlacklist });
    }

    // PUT - Aktualizuj blacklistę
    if (req.method === 'PUT') {
      if (blacklist === undefined) {
        return res.status(400).json({ error: 'Missing blacklist field' });
      }

      console.log('🚫 Updating blacklist for:', username);
      
      await axios.patch(
        `https://e621.net/users/${username}.json`,
        new URLSearchParams({ 'user[blacklisted_tags]': blacklist }).toString(),
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: { username, password: apiKey },
          timeout: 10000,
        }
      );
      
      console.log('✅ Updated blacklist');
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('❌ Blacklist error:', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message || 'Failed to manage blacklist',
      blacklist: '',
    });
  }
}
