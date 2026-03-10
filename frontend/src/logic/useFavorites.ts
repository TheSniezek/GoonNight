// ============================================================
// useFavorites.ts - NAPRAWIONA WERSJA (VERCEL COMPATIBLE)
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

const IS_PROD = import.meta.env.PROD;
const API_BASE = IS_PROD ? '' : 'http://localhost:3001';
const FAVORITES_ENDPOINT = IS_PROD ? '/api/favorites' : '/api/e621/favorites';

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
  credentials: () => { username: string; apiKey: string; provider: string };
}

// ============================================================================
// REQUEST QUEUE
// ============================================================================
class FavoriteOperationQueue {
  private queue: FavoriteOperation[] = [];
  private processing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: QueueCallbacks;

  constructor(callbacks: QueueCallbacks) {
    this.callbacks = callbacks;
    console.log('🎯 [FavoriteQueue] Initialized');
  }

  enqueue(postId: number, action: 'add' | 'remove'): void {
    // Usuń duplikaty
    this.queue = this.queue.filter((op) => op.postId !== postId);
    this.queue.push({ postId, action, retries: 0 });

    console.log(
      `📝 [FavoriteQueue] Enqueued ${action} ${postId}, queue size: ${this.queue.length}`,
    );

    // ✅ WAŻNE: Clear poprzedni timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // ✅ WAŻNE: Ustaw nowy timer
    this.flushTimer = setTimeout(() => {
      console.log('⏰ [FavoriteQueue] Timer triggered, starting flush');
      this.flush();
    }, 200);
  }

  async flush(): Promise<void> {
    if (this.processing) {
      console.log('⏸️ [FavoriteQueue] Already processing, skipping flush');
      return;
    }

    if (this.queue.length === 0) {
      console.log('🔭 [FavoriteQueue] Queue is empty, nothing to flush');
      return;
    }

    console.log(`🔄 [FavoriteQueue] Starting flush of ${this.queue.length} operations`);
    this.processing = true;

    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      console.log(`🎯 [FavoriteQueue] Processing ${op.action} ${op.postId}`);
      await this.executeOperation(op);
    }

    this.processing = false;
    console.log('✅ [FavoriteQueue] Flush complete');
  }

  private async executeOperation(op: FavoriteOperation): Promise<void> {
    const { postId, action, retries } = op;
    const { username, apiKey, provider } = this.callbacks.credentials();
    const MAX_RETRIES = 3;

    console.log(
      `🚀 [Queue] Executing ${action} ${postId} (attempt ${retries + 1}/${MAX_RETRIES + 1})`,
    );

    try {
      if (action === 'add') {
        console.log(`📤 [Queue] POST to ${FAVORITES_ENDPOINT}`, { postId, username });

        const response = await fetch(`${API_BASE}${FAVORITES_ENDPOINT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, username, apiKey, provider }),
        });

        console.log(`📥 [Queue] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [Queue] Response not OK:`, errorText);
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { error: errorText };
          }
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ [Queue] ADD response:`, result);
      } else {
        // ✅ FIX: Nie dodawaj postId do URL dla Vercel, tylko w body
        console.log(`📤 [Queue] DELETE to ${FAVORITES_ENDPOINT}`, { postId, username });

        const response = await fetch(`${API_BASE}${FAVORITES_ENDPOINT}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, username, apiKey, provider }),
        });

        console.log(`📥 [Queue] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [Queue] Response not OK:`, errorText);
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { error: errorText };
          }
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ [Queue] REMOVE response:`, result);
      }

      this.callbacks.onSuccess(postId, action);
      console.log(`✅✅✅ [Queue] ${action} ${postId} - SUCCESS`);
    } catch (error) {
      console.error(`❌ [Queue] ${action} ${postId} - ERROR:`, error);

      if (error instanceof Error) {
        console.error(`❌ [Queue] Error message:`, error.message);
      }

      if (retries < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retries);
        console.log(`🔄 [Queue] Will retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms`);
        this.queue.unshift({ ...op, retries: retries + 1 });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`❌❌❌ [Queue] Max retries reached for ${action} ${postId}`);
        this.callbacks.onError(postId, action, error as Error);
      }
    }
  }

  clear(): void {
    console.log('🧹 [FavoriteQueue] Clearing queue');
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
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
  provider?: string;
  onPostUpdate: (postId: number, isFavorited: boolean) => void;
}

export function useFavorites({
  username,
  apiKey,
  provider = 'e621',
  onPostUpdate,
}: UseFavoritesParams) {
  const [pendingFavorites, setPendingFavorites] = useState<Set<number>>(new Set());

  const isLoggedIn = Boolean(username && apiKey);
  const queueRef = useRef<FavoriteOperationQueue | null>(null);

  // Inicjalizuj queue
  useEffect(() => {
    console.log('🔧 [useFavorites] useEffect triggered, isLoggedIn:', isLoggedIn);

    if (!isLoggedIn) {
      console.log('🔒 [useFavorites] Not logged in, clearing queue');
      queueRef.current?.clear();
      queueRef.current = null;
      return;
    }

    if (queueRef.current) {
      console.log('♻️ [useFavorites] Queue already exists, skipping initialization');
      return;
    }

    console.log('✨ [useFavorites] Creating new queue');
    queueRef.current = new FavoriteOperationQueue({
      onSuccess: (postId) => {
        console.log(`🎉 [useFavorites] onSuccess for ${postId}`);
        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          console.log(`📊 [useFavorites] Pending favorites after success:`, next.size);
          return next;
        });
      },
      onError: (postId, action, error) => {
        console.error(`💥 [useFavorites] onError for ${postId}:`, error.message);

        // Rollback
        const shouldBeFavorited = action === 'remove';
        console.log(
          `🔄 [useFavorites] Rolling back ${postId} to is_favorited=${shouldBeFavorited}`,
        );
        onPostUpdate(postId, shouldBeFavorited);

        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });

        alert(`Failed to ${action} favorite. Please try again.`);
      },
      credentials: () => {
        console.log('🔑 [useFavorites] Getting credentials:', { username, hasApiKey: !!apiKey });
        return { username, apiKey, provider };
      },
    });

    return () => {
      console.log('🧹 [useFavorites] Cleanup - clearing queue');
      queueRef.current?.clear();
    };
  }, [isLoggedIn, username, apiKey, onPostUpdate]);

  // ============================================================================
  // TOGGLE FAVORITE
  // ============================================================================
  const toggleFavoritePost = useCallback(
    async (postId: number, currentIsFavorited: boolean) => {
      console.log('🎯 [toggleFavoritePost] Called:', { postId, currentIsFavorited, isLoggedIn });

      if (!isLoggedIn) {
        console.warn('⚠️ [toggleFavoritePost] Not logged in');
        alert('Please log in first');
        return;
      }

      if (pendingFavorites.has(postId)) {
        console.warn('⚠️ [toggleFavoritePost] Already pending:', postId);
        return;
      }

      if (!queueRef.current) {
        console.error('❌ [toggleFavoritePost] Queue is null!');
        return;
      }

      const action = currentIsFavorited ? 'REMOVE' : 'ADD';
      console.log(`❤️ [toggleFavoritePost] ${action} ${postId}`);

      // Dodaj do pending
      setPendingFavorites((prev) => {
        const next = new Set(prev);
        next.add(postId);
        console.log(`📊 [toggleFavoritePost] Pending favorites:`, next.size);
        return next;
      });

      // Optimistic update
      console.log(`✨ [toggleFavoritePost] Optimistic update: ${postId} -> ${!currentIsFavorited}`);
      onPostUpdate(postId, !currentIsFavorited);

      // Dodaj do queue
      console.log(`➕ [toggleFavoritePost] Enqueueing ${action} ${postId}`);
      queueRef.current.enqueue(postId, currentIsFavorited ? 'remove' : 'add');
      console.log(`✅ [toggleFavoritePost] Enqueued successfully`);
    },
    [isLoggedIn, pendingFavorites, onPostUpdate],
  );

  return {
    isLoggedIn,
    toggleFavoritePost,
    pendingFavorites,
  };
}
