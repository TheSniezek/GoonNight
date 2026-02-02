// ============================================================
// useFavorites.ts - FINALNA WERSJA
// ============================================================================
//
// KLUCZOWE ZMIANY:
// ✅ Bez zmiany key (nie powoduje re-render wszystkich postów)
// ✅ Smart invalidation (tylko zmienione posty)
// ✅ Batch operations z rate limiting
// ✅ Optimistic updates + rollback
// ✅ Zero błędów TypeScript
//
// JAK TO DZIAŁA:
// - favoriteIds jest Set<number>
// - Komponenty używają React.memo + isFavorited prop
// - Tylko zmienione posty re-renderują się
//
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { mapE621Post } from '../api/posts';
import type { Post, Order } from '../api/types';

const API_BASE = 'http://localhost:3001';

// ============================================================================
// TYPES
// ============================================================================
interface FavoriteOperation {
  postId: number;
  action: 'add' | 'remove';
  retries: number;
}

interface QueueCallbacks {
  onSuccess: (postId: number, action: 'add' | 'remove') => void;
  onError: (postId: number, action: 'add' | 'remove', error: Error) => void;
  credentials: () => { username: string; apiKey: string };
}

// ============================================================================
// REQUEST QUEUE (respektuje backend rate limit)
// ============================================================================
class FavoriteOperationQueue {
  private queue: FavoriteOperation[] = [];
  private processing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: QueueCallbacks;

  constructor(callbacks: QueueCallbacks) {
    this.callbacks = callbacks;
  }

  enqueue(postId: number, action: 'add' | 'remove'): void {
    // Usuń duplikaty (jeśli już jest w kolejce)
    this.queue = this.queue.filter((op) => op.postId !== postId);

    // Dodaj nowy
    this.queue.push({ postId, action, retries: 0 });

    // Flush po 200ms (batch multiple clicks)
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 200);
  }

  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    console.log(`🔄 [FavoriteQueue] Flushing ${this.queue.length} operations`);
    this.processing = true;

    // ✅ SEQUENTIAL (backend ma własny rate limiter)
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      await this.executeOperation(op);
    }

    this.processing = false;
  }

  private async executeOperation(op: FavoriteOperation): Promise<void> {
    const { postId, action, retries } = op;
    const { username, apiKey } = this.callbacks.credentials();
    const MAX_RETRIES = 3;

    try {
      if (action === 'add') {
        const response = await fetch(`${API_BASE}/api/e621/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, username, apiKey }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
      } else {
        const response = await fetch(`${API_BASE}/api/e621/favorites/${postId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, apiKey }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
      }

      this.callbacks.onSuccess(postId, action);
      console.log(`✅ [Queue] ${action} ${postId} - SUCCESS`);
    } catch (error) {
      console.error(`❌ [Queue] ${action} ${postId} - ERROR:`, error);

      if (retries < MAX_RETRIES) {
        console.log(`🔄 [Queue] Retry ${retries + 1}/${MAX_RETRIES}`);
        this.queue.unshift({ ...op, retries: retries + 1 });
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      } else {
        this.callbacks.onError(postId, action, error as Error);
      }
    }
  }

  clear(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.queue = [];
    this.processing = false;
  }
}

// ============================================================================
// HOOK
// ============================================================================
interface UseFavoritesParams {
  username: string;
  apiKey: string;
}

export function useFavorites({ username, apiKey }: UseFavoritesParams) {
  const [favoritesMode, setFavoritesMode] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [allFavoritePosts, setAllFavoritePosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchTags, setSearchTags] = useState('');
  const [searchOrder, setSearchOrder] = useState<Order>('id_desc');

  // ✅ SIMPLE SET - React wykrywa zmiany przez referencję
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const [pendingFavorites, setPendingFavorites] = useState<Set<number>>(new Set());

  const isLoggedIn = Boolean(username && apiKey);
  const queueRef = useRef<FavoriteOperationQueue | null>(null);

  // Inicjalizuj queue
  useEffect(() => {
    if (!isLoggedIn) {
      queueRef.current?.clear();
      queueRef.current = null;
      return;
    }

    queueRef.current = new FavoriteOperationQueue({
      onSuccess: (postId) => {
        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      },
      onError: (postId, action, error) => {
        console.error(`❌ [Queue Error] ${action} ${postId}:`, error);

        // Rollback
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (action === 'add') {
            next.delete(postId);
          } else {
            next.add(postId);
          }
          return next;
        });

        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      },
      credentials: () => ({ username, apiKey }),
    });

    return () => {
      queueRef.current?.clear();
    };
  }, [isLoggedIn, username, apiKey]);

  // ============================================================================
  // TOGGLE FAVORITE
  // ============================================================================
  const toggleFavoritePost = useCallback(
    async (postId: number) => {
      if (!isLoggedIn || pendingFavorites.has(postId)) {
        return;
      }

      const isFav = favoriteIds.has(postId);
      console.log(`❤️ [toggleFavoritePost] ${isFav ? 'REMOVE' : 'ADD'} ${postId}`);

      setPendingFavorites((prev) => {
        const next = new Set(prev);
        next.add(postId);
        return next;
      });

      // ✅ OPTIMISTIC UPDATE - WAŻNE: Nowa referencja Set
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next; // Nowa referencja → React wykryje zmianę
      });

      queueRef.current?.enqueue(postId, isFav ? 'remove' : 'add');
    },
    [isLoggedIn, favoriteIds, pendingFavorites],
  );

  // ============================================================================
  // SYNC IDS
  // ============================================================================
  const syncFavoriteIdsFromApi = useCallback(async () => {
    if (!isLoggedIn) return;

    console.log('🔄 [syncFavoriteIds] START');
    try {
      const res = await fetch(
        `${API_BASE}/api/e621/favorites/ids?username=${encodeURIComponent(
          username,
        )}&apiKey=${encodeURIComponent(apiKey)}`,
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log('📥 [syncFavoriteIds] Received', data.ids?.length || 0, 'IDs');

      setFavoriteIds(new Set<number>(data.ids || []));
    } catch (err) {
      console.error('❌ [syncFavoriteIds] ERROR:', err);
    }
  }, [username, apiKey, isLoggedIn]);

  // ============================================================================
  // LOAD FAVORITES
  // ============================================================================
  const loadFavorites = useCallback(
    async (nextPage = page + 1) => {
      if (!isLoggedIn || loading) return;

      console.log('📥 [loadFavorites] page:', nextPage);
      setLoading(true);

      try {
        const endpoint = searchTags
          ? `/api/e621?tags=${encodeURIComponent(
              `fav:${username} ${searchTags}`,
            )}&page=${nextPage}&username=${encodeURIComponent(username)}&apiKey=${encodeURIComponent(
              apiKey,
            )}`
          : `/api/e621/favorites?username=${encodeURIComponent(
              username,
            )}&apiKey=${encodeURIComponent(apiKey)}&page=${nextPage}`;

        const res = await fetch(`${API_BASE}${endpoint}`);
        const data = await res.json();
        const mappedPosts = (data.posts || []).map(mapE621Post);

        setAllFavoritePosts((prev) => [...prev, ...mappedPosts]);
        setPosts((prev) => [...prev, ...mappedPosts]);
        setPage(nextPage);
      } catch (err) {
        console.error('❌ [loadFavorites] ERROR:', err);
      } finally {
        setLoading(false);
      }
    },
    [username, apiKey, page, isLoggedIn, loading, searchTags],
  );

  // ============================================================================
  // TOGGLE MODE
  // ============================================================================
  const toggleFavorites = useCallback(async () => {
    if (!isLoggedIn) return;

    if (!favoritesMode) {
      console.log('📥 [toggleFavorites] Entering favorites mode');
      setPosts([]);
      setAllFavoritePosts([]);
      setPage(1);
      await loadFavorites(1);
      setFavoritesMode(true);
    } else {
      console.log('📤 [toggleFavorites] Exiting favorites mode');
      setFavoritesMode(false);
      setPosts([]);
      setAllFavoritePosts([]);
      setPage(1);
    }
  }, [favoritesMode, isLoggedIn, loadFavorites]);

  // ============================================================================
  // SEARCH FAVORITES
  // ============================================================================
  const searchFavorites = useCallback(
    async (
      newTags: string,
      auth?: { username: string; apiKey: string },
      options?: { order?: Order; clearTags?: boolean },
    ) => {
      const cleanedTags = options?.clearTags ? '' : newTags;
      const newOrder = options?.order ?? searchOrder;

      setSearchTags(cleanedTags);
      setSearchOrder(newOrder);
      setAllFavoritePosts([]);
      setPosts([]);
      setPage(1);

      if (!isLoggedIn || !auth) return;

      setLoading(true);
      try {
        const queryTags = cleanedTags
          ? `fav:${auth.username} ${cleanedTags}`
          : `fav:${auth.username}`;

        const res = await fetch(
          `${API_BASE}/api/e621?tags=${encodeURIComponent(queryTags)}&page=1&username=${encodeURIComponent(
            auth.username,
          )}&apiKey=${encodeURIComponent(auth.apiKey)}`,
        );
        const data = await res.json();
        const mappedPosts = (data.posts || []).map(mapE621Post);

        setAllFavoritePosts(mappedPosts);
        setPosts(mappedPosts);
      } catch (err) {
        console.error('❌ [searchFavorites] ERROR:', err);
      } finally {
        setLoading(false);
      }
    },
    [isLoggedIn, searchOrder],
  );

  // ============================================================================
  // RESET
  // ============================================================================
  const resetFavorites = useCallback(() => {
    setFavoritesMode(false);
    setPosts([]);
    setAllFavoritePosts([]);
    setPage(1);
    setFavoriteIds(new Set());
    setSearchTags('');
    setSearchOrder('id_desc');
    queueRef.current?.clear();
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Sync on login
  useEffect(() => {
    if (isLoggedIn) {
      syncFavoriteIdsFromApi();
    } else {
      resetFavorites();
    }
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // RETURN
  // ============================================================================
  return {
    favoritesMode,
    favoritePosts: posts,
    favoritesPage: page,
    favoritesLoading: loading,
    isLoggedIn,

    toggleFavorites,
    loadFavorites,
    resetFavorites,
    toggleFavoritePost,
    searchFavorites,

    favoriteIds,
    setFavoriteIds,
    syncFavoriteIdsFromApi,
    setFavoritesMode,

    favoritesTags: searchTags,
    favoritesOrder: searchOrder,
    pendingFavorites,
    allFavoritePosts,
  };
}
