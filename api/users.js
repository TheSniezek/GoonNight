import axios from 'axios';

const USER_AGENT = 'GoonNight/2.0 (by maciek)';
const cache = new Map();
const CACHE_TTL = 3600000; // 1h
const PROFILE_CACHE_TTL = 300000; // 5 min dla profilu

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ids = '', username = '', provider = 'e621' } = req.query;
    const host = provider === 'e926' ? 'https://e926.net' : 'https://e621.net';

    // MODE A: ?username=xxx → profil z favorite_count
    if (username) {
      const cacheKey = `profile:${host}:${username.toLowerCase()}`;
      if (cache.has(cacheKey)) {
        const { data, timestamp } = cache.get(cacheKey);
        if (Date.now() - timestamp < PROFILE_CACHE_TTL) {
          return res.json({ ...data, fromCache: true });
        }
      }
      console.log('👤 [Users] Fetching profile for:', username);
      const r = await axios.get(`${host}/users/${encodeURIComponent(username)}.json`, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000,
      });
      const payload = {
        favorite_count: r.data.favorite_count ?? 0,
        post_upload_count: r.data.post_upload_count ?? 0,
        name: r.data.name || username,
      };
      cache.set(cacheKey, { data: payload, timestamp: Date.now() });
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      return res.json(payload);
    }

    // MODE B: ?ids=123,456 → mapa id→name
    if (!ids) return res.json({ users: {} });
    const idList = String(ids).split(',').map(Number).filter(Boolean).slice(0, 10);
    if (!idList.length) return res.json({ users: {} });

    const cacheKey = `users:${host}:${[...idList].sort().join(',')}`;
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < CACHE_TTL) {
        return res.json({ ...data, fromCache: true });
      }
    }

    console.log('👤 [Users] Fetching names for IDs:', idList);
    const results = {};
    for (let i = 0; i < idList.length; i++) {
      if (i > 0) await sleep(600);
      const id = idList[i];
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

    const payload = { users: results };
    cache.set(cacheKey, { data: payload, timestamp: Date.now() });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (err) {
    console.error('❌ [Users] Error:', err.message);
    res.status(err.response?.status || 500).json({ users: {}, favorite_count: 0 });
  }
}
