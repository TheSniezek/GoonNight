import { useEffect, useRef, useState } from 'react';
import { fetchPosts, mapE621Post } from '../api/posts';
import type { E621Post, Order, Post } from '../api/types';

interface Auth {
  username: string;
  apiKey: string;
}

export function usePosts(
  initialTags: string,
  options?: {
    hideFavorites?: boolean;
    username?: string;
    postsPerPage: number;
    infiniteScroll?: boolean;
  },
) {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState(() => {
    return localStorage.getItem('searchTags') || initialTags;
  });
  const postsPerPage = options?.postsPerPage ?? 50;
  const [uiPage, setUiPage] = useState(1);
  const [apiPage, setApiPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [hasNextApiPage, setHasNextApiPage] = useState(true);

  const [isViewingRealFavorites, setIsViewingRealFavorites] = useState(false);

  const [maximizedPostId, setMaximizedPostId] = useState<number | null>(null);
  const [pendingNextPage, setPendingNextPage] = useState(false);
  const [order, setOrder] = useState<Order>('id_desc');

  const observer = useRef<IntersectionObserver | null>(null);
  const scrollBeforeMaximize = useRef(0);

  // Usuwa order: z tagów jeśli istnieje
  const stripOrderFromTags = (baseTags: string) => {
    return baseTags
      .split(' ')
      .filter((tag) => !tag.startsWith('order:'))
      .join(' ')
      .trim();
  };

  const buildApiTags = (baseTags: string, currentOrder: Order) => {
    // Najpierw usuń wszystkie order: z tagów
    let result = stripOrderFromTags(baseTags);

    // Dodaj aktualny order
    result += ` order:${currentOrder}`;

    // ✅ POPRAWIONE - Hide favorites tylko gdy NIE przeglądasz favorites
    if (
      options?.hideFavorites &&
      options?.username &&
      options?.infiniteScroll &&
      !isViewingRealFavorites
    ) {
      result += ` -fav:${options.username}`;
    }

    return result.trim();
  };

  // ---------------- API FETCH ----------------
  const fetchNextApiPage = async (auth?: Auth) => {
    if (loading || !hasNextApiPage) {
      return;
    }

    setLoading(true);

    try {
      let newPosts: Post[];

      // ✅ SPRAWDŹ CZY JESTEŚ W TRYBIE FAVORITES
      if (isViewingRealFavorites) {
        console.log('⭐ [fetchNextApiPage] Fetching FAVORITES page:', apiPage);

        // Użyj dedykowanego endpointu favorites
        const username = auth?.username || options?.username || '';
        const apiKey = auth?.apiKey || '';

        if (!username || !apiKey) {
          throw new Error('Missing credentials for favorites');
        }

        const response = await fetch(
          `http://localhost:3001/api/e621/favorites?username=${encodeURIComponent(username)}&apiKey=${encodeURIComponent(apiKey)}&page=${apiPage}&limit=50`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        newPosts = (data.posts || []).map((post: E621Post) => mapE621Post(post));

        // Zaktualizuj hasMore na podstawie odpowiedzi
        if (!data.hasMore || newPosts.length < 50) {
          setHasNextApiPage(false);
        }
      } else {
        // Normalny fetch przez tagi
        console.log('🔍 [fetchNextApiPage] Fetching NORMAL page:', apiPage);
        const apiTags = buildApiTags(tags, order);
        newPosts = await fetchPosts(apiTags, apiPage, auth);

        if (newPosts.length < 50) {
          setHasNextApiPage(false);
        }
      }

      setAllPosts((prev) => [...prev, ...newPosts]);
      setApiPage((p) => p + 1);
    } catch (error) {
      console.error('❌ [fetchNextApiPage] Error:', error);
      setHasNextApiPage(false);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- NEW SEARCH ----------------

  const newSearch = async (
    newTags: string,
    auth?: Auth,
    options?: { order?: Order; clearTags?: boolean },
  ) => {
    // Jeśli clearTags = true, wyczyść tagi całkowicie
    const cleanedTags = options?.clearTags ? '' : stripOrderFromTags(newTags);
    const newOrder = options?.order ?? order;

    setTags(cleanedTags);
    setOrder(newOrder);

    // ✅ RESET FLAGI przy nowym searchu
    setIsViewingRealFavorites(false);

    setAllPosts([]);
    setUiPage(1);
    setApiPage(1);
    setHasNextApiPage(true);

    setLoading(true);
    try {
      const apiTags = buildApiTags(cleanedTags, newOrder);
      console.log('🔍 [newSearch] Fetching with tags:', apiTags); // ✅ DODAJ
      console.log('🔍 [newSearch] Auth:', auth); // ✅ DODAJ
      const firstPage = await fetchPosts(apiTags, 1, auth);

      console.log('📦 [newSearch] Got posts:', firstPage.length); // ✅ DODAJ
      console.log('📦 [newSearch] First post is_favorited:', firstPage[0]?.is_favorited); // ✅ DODAJ

      setAllPosts(firstPage);
      if (firstPage.length < 50) setHasNextApiPage(false);
      setApiPage(2);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI PAGINATION ----------------

  const nextUiPage = async (postsPerPage: number, auth?: Auth) => {
    const neededPosts = (uiPage + 1) * postsPerPage;

    if (neededPosts > allPosts.length && hasNextApiPage) {
      setPendingNextPage(true);
      await fetchNextApiPage(auth);
      return;
    }

    setUiPage((p) => p + 1);
  };

  const prevUiPage = () => {
    setUiPage((p) => Math.max(1, p - 1));
  };

  // ---------------- MAXIMIZE ----------------

  const toggleMaximize = (postId: number) => {
    setMaximizedPostId((prev) => {
      if (prev === postId) {
        window.scrollTo({ top: scrollBeforeMaximize.current });
        return null;
      }
      scrollBeforeMaximize.current = window.scrollY;
      setTimeout(() => {
        document.getElementById(`post-${postId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 50);
      return postId;
    });
  };

  // ---------------- LAZY LOAD ----------------

  const observeLazy = (el: HTMLImageElement | HTMLVideoElement) => {
    if (!observer.current) {
      observer.current = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLImageElement | HTMLVideoElement;
            if (target.dataset.src) {
              target.src = target.dataset.src;
              target.removeAttribute('data-src');
            }
            observer.current?.unobserve(target);
          }
        });
      });
    }
    observer.current.observe(el);
  };

  const getMaximizedIndex = () => allPosts.findIndex((p) => p.id === maximizedPostId);

  const goNextPost = () => {
    if (maximizedPostId === null) return;
    const index = getMaximizedIndex();
    if (index >= 0 && index < allPosts.length - 1) {
      toggleMaximize(allPosts[index + 1].id);
    }
  };

  const goPrevPost = () => {
    if (maximizedPostId === null) return;
    const index = getMaximizedIndex();
    if (index > 0) {
      toggleMaximize(allPosts[index - 1].id);
    }
  };

  useEffect(() => {
    if (maximizedPostId === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNextPost();
      if (e.key === 'ArrowLeft') goPrevPost();
      if (e.key === 'Escape') toggleMaximize(maximizedPostId);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximizedPostId, allPosts]);

  useEffect(() => {
    newSearch(tags);
  }, []);

  useEffect(() => {
    localStorage.setItem('searchTags', tags);
  }, [tags]);

  useEffect(() => {
    if (!pendingNextPage) return;

    const neededPosts = (uiPage + 1) * postsPerPage;

    if (neededPosts <= allPosts.length) {
      setPendingNextPage(false);
      setUiPage((p) => p + 1);
    }
  }, [allPosts, pendingNextPage, uiPage, postsPerPage]);

  return {
    // data
    allPosts,
    setAllPosts,
    tags,

    // pagination
    uiPage,
    loading,
    hasNextApiPage,

    // actions
    newSearch,
    nextUiPage,
    prevUiPage,

    // ui
    maximizedPostId,
    toggleMaximize,
    observeLazy,
    goPrevPost,
    goNextPost,

    order,
    setOrder,
    setApiPage,
    setHasNextApiPage,
    setLoading,
    setUiPage,

    // ✅ DODAJ TO
    setIsViewingRealFavorites,
    setTags,
  };
}
