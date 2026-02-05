// ============================================================
// GoonNight Backend - FINALNA WERSJA (PROPER RATE LIMITING)
// ============================================================
//
// KLUCZOWE ZMIANY:
// ✅ E621 LIMIT: 2 req/sec (nie 60/min!) - RESPEKTUJE TO
// ✅ Credentials z requesta > .env (LoginModal działa)
// ✅ Agresywna cache invalidation
// ✅ 503 handling (exponential backoff)
// ✅ Request queue z priorytetami
//
// ============================================================

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// ==================== CONFIG ====================
const E621_USER = process.env.E621_USER;
const E621_API_KEY = process.env.E621_API_KEY;
const USER_AGENT = 'GoonNight/2.0 (by maciek; contact: maciek@email.com)';

// ==================== MIDDLEWARE ====================
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic rate limiting (dla backendu, nie dla e621!)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Hojny limit dla frontend → backend
  message: { error: 'Too many requests' },
});
app.use('/api/', apiLimiter);

// ==================== E621 RATE LIMITER ====================
// E621 HARD LIMIT: 2 requesty / sekundę
// BEST PRACTICE: 1 request / sekundę
// 503 = rate limit exceeded → BAN

class E621RateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minInterval = 1200; // 600ms = max ~1.66 req/sec (bezpiecznie < 2)
    console.log('🔒 [E621 RateLimiter] Initialized (max 1.66 req/sec)');
  }

  async execute(fn, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, priority, addedAt: Date.now() });
      this.queue.sort((a, b) => b.priority - a.priority); // Wyższy priorytet najpierw
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Czekaj jeśli za wcześnie
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minInterval - timeSinceLastRequest),
        );
      }

      const { fn, resolve, reject, addedAt } = this.queue.shift();
      const waitTime = Date.now() - addedAt;

      if (waitTime > 100) {
        console.log(`⏱️  [E621] Request waited ${waitTime}ms in queue`);
      }

      try {
        this.lastRequestTime = Date.now();
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}

const e621Limiter = new E621RateLimiter();

// ==================== CACHE ====================
class SmartCache {
  constructor() {
    this.cache = new Map();
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key, maxAge = 30000) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key) {
    this.cache.delete(key);
  }

  // ✅ AGRESYWNE CZYSZCZENIE
  clearPattern(pattern) {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    if (cleared > 0) {
      console.log(`🗑️  [Cache] Cleared ${cleared} entries matching "${pattern}"`);
    }
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > 300000) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 [Cache] Cleaned ${cleaned} old entries`);
    }
  }
}

const cache = new SmartCache();

// ==================== RETRY LOGIC ====================
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // ✅ SPECIAL HANDLING dla 503 (rate limit)
      if (error.response?.status === 503) {
        const backoff = Math.min(5000 * Math.pow(2, attempt), 30000);
        console.warn(`⚠️  [503 Rate Limit] Retry ${attempt + 1}/${maxRetries} after ${backoff}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      // Nie retry client errors (400-499 poza 503)
      if (error.response?.status && error.response.status < 500) {
        throw error;
      }

      // Retry server errors z backoff
      if (attempt < maxRetries - 1) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}

// ==================== ROUTES ====================

// Get posts
app.get('/api/e621', async (req, res) => {
  try {
    const tags = String(req.query.tags ?? '').trim();
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 50), 320);

    // ✅ PRIORYTET: Credentials z requesta > .env (LoginModal!)
    const username = req.query.username || E621_USER;
    const apiKey = req.query.apiKey || E621_API_KEY;

    const cacheKey = `posts:${tags}:${page}:${limit}:${username || 'anon'}`;
    const cached = cache.get(cacheKey, 60000);

    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const auth = username && apiKey ? { username, password: apiKey } : undefined;

    // ✅ RATE LIMITED REQUEST
    const response = await e621Limiter.execute(
      () =>
        retryWithBackoff(() =>
          axios.get('https://e621.net/posts.json', {
            params: { tags, limit, page },
            headers: { 'User-Agent': USER_AGENT },
            auth,
            timeout: 15000,
          }),
        ),
      1, // Normal priority
    );

    const posts = (response.data.posts || []).filter(
      (post) => post.file?.ext !== 'swf' && !post.flags?.deleted,
    );

    console.log('🔍 [/api/e621] Auth:', auth ? 'YES' : 'NO', 'User:', username || 'anonymous');
    console.log('📦 [/api/e621] First post is_favorited:', posts[0]?.is_favorited);

    const payload = { posts, anonymous: !auth, hasMore: posts.length === limit };

    cache.set(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('❌ [Posts]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message || 'Failed to fetch posts',
      posts: [],
    });
  }
});

// Get favorites
app.get('/api/e621/favorites', async (req, res) => {
  try {
    const { username, apiKey, page = 1, limit = 50 } = req.query;

    if (!username || !apiKey) {
      return res.status(400).json({ error: 'Missing credentials', posts: [] });
    }

    const cacheKey = `favorites:${username}:${page}:${limit}`;
    const cached = cache.get(cacheKey, 30000);

    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const response = await e621Limiter.execute(
      () =>
        retryWithBackoff(() =>
          axios.get('https://e621.net/favorites.json', {
            params: { page, limit },
            headers: { 'User-Agent': USER_AGENT },
            auth: { username, password: apiKey },
            timeout: 15000,
          }),
        ),
      2, // Higher priority for favorites
    );

    const payload = {
      posts: response.data.posts ?? [],
      hasMore: (response.data.posts?.length ?? 0) === Number(limit),
    };

    cache.set(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('❌ [Favorites]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to fetch favorites',
      posts: [],
    });
  }
});

// Get ALL favorite IDs (OPTIMIZED: Sequential, not parallel!)
app.get('/api/e621/favorites/ids', async (req, res) => {
  try {
    const { username, apiKey } = req.query;
    if (!username || !apiKey) {
      return res.status(400).json({ error: 'Missing credentials', ids: [] });
    }

    const cacheKey = `favorite-ids:${username}`;
    const cached = cache.get(cacheKey, 120000);

    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const ids = new Set();
    const LIMIT = 320;
    let currentPage = 1;
    let hasMore = true;

    console.log(`📥 [Favorite IDs] Starting fetch for ${username}`);

    // ✅ SEQUENTIAL (nie parallel!) - respektuje rate limit
    while (hasMore && currentPage <= 20) {
      const response = await e621Limiter.execute(
        () =>
          retryWithBackoff(() =>
            axios.get('https://e621.net/favorites.json', {
              params: { page: currentPage, limit: LIMIT },
              headers: { 'User-Agent': USER_AGENT },
              auth: { username, password: apiKey },
              timeout: 15000,
            }),
          ),
        3, // Highest priority
      );

      const posts = response.data.posts ?? [];
      posts.forEach((p) => ids.add(p.id));

      console.log(
        `📄 [Favorite IDs] Page ${currentPage}: ${posts.length} posts (total: ${ids.size})`,
      );

      if (posts.length < LIMIT) {
        hasMore = false;
      }

      currentPage++;
    }

    const payload = { ids: Array.from(ids) };
    cache.set(cacheKey, payload);

    console.log(`✅ [Favorite IDs] Complete: ${ids.size} total`);
    res.json(payload);
  } catch (err) {
    console.error('❌ [Favorite IDs]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to fetch favorite IDs',
      ids: [],
    });
  }
});

// Add favorite
app.post('/api/e621/favorites', async (req, res) => {
  try {
    const { postId, username, apiKey } = req.body;

    console.log('❤️ [Add Favorite] Request:', {
      postId,
      username: username || 'missing',
      hasApiKey: !!apiKey,
    });

    if (!postId || !username || !apiKey) {
      console.error('❌ [Add Favorite] Missing fields:', {
        postId: !!postId,
        username: !!username,
        apiKey: !!apiKey,
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`❤️ [Add Favorite] Adding post ${postId} for user ${username}`);

    const response = await e621Limiter.execute(
      () =>
        retryWithBackoff(() =>
          axios.post(
            'https://e621.net/favorites.json',
            new URLSearchParams({ post_id: String(postId) }).toString(),
            {
              headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              auth: { username, password: apiKey },
              timeout: 10000,
            },
          ),
        ),
      5, // Very high priority
    );

    console.log(
      `✅ [Add Favorite] Success for post ${postId}, response status: ${response.status}`,
    );

    // ✅ INTELIGENTNE CZYSZCZENIE - tylko to co trzeba
    cache.clearPattern(`favorites:${username}`);
    cache.clearPattern(`favorite-ids:${username}`);
    // NIE czyścimy wszystkich postów - za dużo refetcha
    // is_favorited będzie zaktualizowane przez optimistic update w froncie

    res.json({ success: true });
  } catch (err) {
    console.error('❌ [Add Favorite]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to add favorite',
    });
  }
});

// Remove favorite
app.delete('/api/e621/favorites/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { username, apiKey } = req.body;

    if (!postId || !username || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await e621Limiter.execute(
      () =>
        retryWithBackoff(() =>
          axios.delete(`https://e621.net/favorites/${postId}.json`, {
            headers: { 'User-Agent': USER_AGENT },
            auth: { username, password: apiKey },
            timeout: 10000,
          }),
        ),
      5, // Very high priority
    );

    console.log(`✅ [Backend] E621 API responded:`, response.status, response.data);

    // NIE czyść cache postów - to powoduje freeze
    cache.clearPattern(`favorites:${username}`);
    cache.clearPattern(`favorite-ids:${username}`);

    console.log(`✅✅✅ [Backend] Favorite added successfully for ${postId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌❌❌ [Backend] Error adding favorite:', err.message);
    if (err.response) {
      console.error('❌ [Backend] E621 API error:', err.response.status, err.response.data);
    }
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to add favorite',
    });
  }
});

// Tag autocomplete
app.get('/api/e621/tags', async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim();

    if (query.length < 2) {
      return res.json([]);
    }

    const cacheKey = `tags:${query}`;
    const cached = cache.get(cacheKey, 300000);

    if (cached) {
      return res.json(cached);
    }

    const response = await e621Limiter.execute(() =>
      retryWithBackoff(() =>
        axios.get('https://e621.net/tags/autocomplete.json', {
          params: { 'search[name_matches]': `${query}*`, limit: 10 },
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000,
        }),
      ),
    );

    const results = (response.data || []).map((tag) => ({
      id: `tag-${tag.id}`,
      type: 'tag',
      name: tag.name,
      post_count: tag.post_count,
      category: tag.category,
      antecedent_name: tag.antecedent_name || null,
    }));

    cache.set(cacheKey, results);
    res.json(results);
  } catch (err) {
    console.error('❌ [Tags]', err.message);
    res.status(err.response?.status || 500).json([]);
  }
});

// Get blacklist
app.get('/api/e621/blacklist', async (req, res) => {
  try {
    const { username, apiKey } = req.query;

    if (!username || !apiKey) {
      return res.status(400).json({ error: 'Missing credentials', blacklist: '' });
    }

    const cacheKey = `blacklist:${username}`;
    const cached = cache.get(cacheKey, 300000);

    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const response = await e621Limiter.execute(() =>
      retryWithBackoff(() =>
        axios.get(`https://e621.net/users/${username}.json`, {
          headers: { 'User-Agent': USER_AGENT },
          auth: { username, password: apiKey },
          timeout: 10000,
        }),
      ),
    );

    const payload = { blacklist: response.data.blacklisted_tags || '' };
    cache.set(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error('❌ [Blacklist]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to fetch blacklist',
      blacklist: '',
    });
  }
});

// Update blacklist
app.put('/api/e621/blacklist', async (req, res) => {
  try {
    const { username, apiKey, blacklist } = req.body;

    if (!username || !apiKey || blacklist === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await e621Limiter.execute(() =>
      retryWithBackoff(() =>
        axios.patch(
          `https://e621.net/users/${username}.json`,
          new URLSearchParams({ 'user[blacklisted_tags]': blacklist }).toString(),
          {
            headers: {
              'User-Agent': USER_AGENT,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            auth: { username, password: apiKey },
            timeout: 10000,
          },
        ),
      ),
    );

    cache.delete(`blacklist:${username}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ [Update Blacklist]', err.message);
    res.status(err.response?.status || 500).json({
      error: err.message || 'Failed to update blacklist',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cacheSize: cache.cache.size,
    queueSize: e621Limiter.queue.length,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ==================== START ====================
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`✅ GoonNight backend running on port ${PORT}`);
  console.log(`🔒 E621 rate limiter: max 1.66 req/sec (safe < 2)`);
  console.log(`🔑 Credentials priority: Request params > .env`);
  console.log(`📊 Queue status: /health`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    cache.cache.clear();
    process.exit(0);
  });
});

export default app;
