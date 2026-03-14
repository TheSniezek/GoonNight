import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';
const cache = new Map();
const CACHE_TTL = 3600000; // 1h - usernames don't change often

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Czeka określoną liczbę ms
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { ids = '', provider = 'e621' } = req.query;
    const host = provider === 'e926' ? 'https://e926.net' : 'https://e621.net';

    if (!ids) return res.json({ users: {} });

    const idList = String(ids)
      .split(',')
      .map(Number)
      .filter(Boolean)
      .slice(0, 10); // max 10 na raz

    if (!idList.length) return res.json({ users: {} });

    const cacheKey = `users:${host}:${idList.sort().join(',')}`;

    // Sprawdź cache
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('✅ [Users] Cache hit:', cacheKey);
        return res.json({ ...data, fromCache: true });
      }
    }

    console.log('👤 [Users] Fetching names for IDs:', idList);

    const results = {};

    for (let i = 0; i < idList.length; i++) {
      const id = idList[i];
      // Respektuj rate limit e621: max 2 req/s, czekaj 600ms między requestami
      if (i > 0) await sleep(600);

      try {
        const r = await axios.get(`${host}/users/${id}.json`, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 8000,
        });
        results[id] = r.data.name || `User #${id}`;
      } catch (err) {
        console.warn(`⚠️ [Users] Failed for ID ${id}:`, err.message);
        results[id] = `User #${id}`;
      }
    }

    console.log('✅ [Users] Resolved:', results);

    const payload = { users: results };
    cache.set(cacheKey, { data: payload, timestamp: Date.now() });

    // Prosty cleanup pamięci
    if (cache.size > 200) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(payload);
  } catch (err) {
    console.error('❌ [Users] Error:', err.message);
    res.status(500).json({ users: {} });
  }
}
