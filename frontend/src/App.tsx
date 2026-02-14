import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/App.scss';
import SearchBar from './components/SearchBar';
import MobileBottomNav from './components/MobileBottomNav';
import PageButtonsTop from './components/PageButtons/PageButtonsTop';
import PageButtonsBottom from './components/PageButtons/PageButtonsBottom';
import type { Order, Post, PostTag, PopularScale } from './api/types';
import { fetchPostsForMultipleTags, mapE621Post, fetchPopularPosts } from './api/posts';
import { useSettings } from './logic/useSettings';
import { useObservedTags } from './logic/useObservedTags';
import { usePosts } from './logic/usePosts';
import SettingsModal from './components/SettingsModal';
import NewsModal from './components/NewsModal';
import LoginModal from './components/LoginModal';
import { useFavorites } from './logic/useFavorites';
import { useBlacklist } from './logic/useBlacklist';
import { filterPostsByBlacklist, filterPostsBySexSearch } from './logic/blacklistFilter';
import BlacklistModal from './components/BlacklistModal';

const IS_PROD = import.meta.env.PROD;
const BASE_URL = IS_PROD ? '' : 'http://localhost:3001';
const FAVORITES_ENDPOINT = IS_PROD ? '/api/favorites' : '/api/e621/favorites';

function App() {
  const [e621User, setE621User] = useState(localStorage.getItem('e621User') || '');
  const [e621ApiKey, setE621ApiKey] = useState(localStorage.getItem('e621ApiKey') || '');

  const {
    defaultVolume,
    setDefaultVolume,
    autoPlayOnMaximize,
    setAutoPlayOnMaximize,
    autoPauseOnMinimize,
    setAutoPauseOnMinimize,
    pauseVideoOutOfFocus,
    setPauseVideoOutOfFocus,
    layout,
    setLayout,
    postColumns,
    setPostColumns,
    newsLayout,
    setNewsLayout,
    newsPostColumns,
    setNewsPostColumns,
    fixedHeader,
    setFixedHeader,
    postsPerPage,
    setPostsPerPage,
    hideFavorites,
    setHideFavorites,
    loopVideos,
    setLoopVideos,
    videoResolution,
    setVideoResolution,
    infiniteScroll,
    setInfiniteScroll,
    gifsAutoplay,
    setGifsAutoplay,
    hideNavArrows,
    setHideNavArrows,
    postButtonsPosition,
    setPostButtonsPosition,
    maximizedButtonsPosition,
    setMaximizedButtonsPosition,
    sexSearch,
    setSexSearch,
  } = useSettings();

  const { observedTags, toggleTag } = useObservedTags();

  const {
    blacklistLines,
    loading: blacklistLoading,
    updateBlacklist,
    toggleLine,
    addLine,
    removeLine,
    editLine,
  } = useBlacklist({
    username: e621User,
    apiKey: e621ApiKey,
  });

  const {
    allPosts,
    setAllPosts,
    tags,
    uiPage,
    loading,
    hasNextApiPage,
    maximizedPostId,
    toggleMaximize,
    newSearch,
    nextUiPage,
    prevUiPage,
    observeLazy,
    order,
    setOrder,
    setApiPage,
    setHasNextApiPage,
    setLoading,
    setUiPage,
    setTags,
    setIsViewingRealFavorites, // ✅ DODAJ TO
    isViewingRealFavorites, // ⭐ DODANE
  } = usePosts('', {
    hideFavorites,
    username: e621User,
    postsPerPage,
    infiniteScroll,
    sexSearch, // 🔥 DODANE - przekazuj sexSearch do usePosts
  });

  // ✅ NOWY hook useFavorites - tylko do toggle'owania
  const { isLoggedIn, toggleFavoritePost, pendingFavorites } = useFavorites({
    username: e621User,
    apiKey: e621ApiKey,
    onPostUpdate: (postId, isFavorited) => {
      // ✅ Aktualizuj is_favorited w allPosts
      setAllPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_favorited: isFavorited } : p)),
      );
      // ✅ Aktualizuj is_favorited w newsPosts
      setNewsPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_favorited: isFavorited } : p)),
      );
      // 🔥 NOWE - Aktualizuj is_favorited w newsCache
      Object.keys(newsCache.current).forEach((key) => {
        newsCache.current[key] = newsCache.current[key].map((p) =>
          p.id === postId ? { ...p, is_favorited: isFavorited } : p,
        );
      });
      console.log(
        `🔄 [onPostUpdate] Updated post ${postId} is_favorited=${isFavorited} in all caches`,
      );
    },
  });

  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 🔥 Sprawdzanie rozmiaru ekranu
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showTagsFor, setShowTagsFor] = useState<number | null>(null);
  const [showInfoFor, setShowInfoFor] = useState<number | null>(null);
  const tagsPopupRef = useRef<HTMLDivElement | null>(null);
  const infoPopupRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const prevMaximizedPostId = useRef<number | null>(null);
  const [showNewsPopup, setShowNewsPopup] = useState(false);
  const [newsPosts, setNewsPosts] = useState<Post[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const scrollBeforeMaximize = useRef<number>(0);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const newsCache = useRef<Record<string, Post[]>>({});
  const infiniteTriggerRef = useRef<HTMLDivElement | null>(null);
  const savedOrderRef = useRef<Order | null>(null);

  // 🌟 Popular mode state
  const [isPopularMode, setIsPopularMode] = useState(false);
  const [popularDate, setPopularDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [popularScale, setPopularScale] = useState<PopularScale>('day');
  const [shouldRestorePopular, setShouldRestorePopular] = useState(false);

  // 🔥 Parsuj popular mode z tags przy inicjalizacji (po odświeżeniu)
  useEffect(() => {
    const savedTags = localStorage.getItem('searchTags') || '';
    const popularMatch = savedTags.match(/^popular:(day|week|month):(\d{4}-\d{2}-\d{2})$/);

    if (popularMatch) {
      const [, scale, date] = popularMatch;
      setIsPopularMode(true);
      setPopularScale(scale as PopularScale);
      setPopularDate(date);
      setShouldRestorePopular(true);

      console.log('🔄 Preparing to restore popular mode:', scale, date);
    }
  }, []); // Tylko przy mount

  useEffect(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.volume = defaultVolume;
    });
  }, [defaultVolume]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showTagsFor !== null) {
        const popup = tagsPopupRef.current;
        const button = document.getElementById(`post-${showTagsFor}`)?.querySelector('.tags-btn');

        if (popup && !popup.contains(target) && button && !button.contains(target)) {
          setShowTagsFor(null);
        }
      }
      if (showInfoFor !== null) {
        const popup = infoPopupRef.current;
        const button = document.getElementById(`post-${showInfoFor}`)?.querySelector('.info-btn');

        if (popup && !popup.contains(target) && button && !button.contains(target)) {
          setShowInfoFor(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagsFor, showInfoFor, maximizedPostId]);

  useEffect(() => {
    console.log('Current E621 login:', e621User, e621ApiKey);
  }, [e621User, e621ApiKey]);

  useEffect(() => {
    localStorage.setItem('newsPostColumns', String(newsPostColumns));
  }, [newsPostColumns]);

  useEffect(() => {
    const prevId = prevMaximizedPostId.current;

    if (prevId !== null && prevId !== maximizedPostId && autoPauseOnMinimize) {
      const prevVideo = videoRefs.current[prevId];
      prevVideo?.pause();
    }

    if (maximizedPostId !== null && autoPlayOnMaximize) {
      const video = videoRefs.current[maximizedPostId];
      video?.play().catch(() => {});
    }

    prevMaximizedPostId.current = maximizedPostId;
  }, [maximizedPostId, autoPlayOnMaximize, autoPauseOnMinimize]);

  // 🔥 NOWY useEffect - Pause video out of focus
  useEffect(() => {
    if (!pauseVideoOutOfFocus) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (!video.paused && !entry.isIntersecting) {
            video.pause();
          }
        });
      },
      {
        threshold: 0.5, // Video musi być przynajmniej w 50% w viewport
      },
    );

    // Obserwuj wszystkie wideo
    Object.values(videoRefs.current).forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => {
      observer.disconnect();
    };
  }, [pauseVideoOutOfFocus, allPosts]); // Re-run gdy zmienią się posty

  // ⚡ CLEANUP - usuń stare video refs gdy posty się zmienią
  useEffect(() => {
    const currentPostIds = new Set(allPosts.map((p) => p.id));

    // Usuń refs dla postów które już nie istnieją
    Object.keys(videoRefs.current).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!currentPostIds.has(id)) {
        const video = videoRefs.current[id];
        if (video) {
          // Pause i wyczyść src aby zwolnić pamięć
          video.pause();
          video.src = '';
          video.load();
        }
        delete videoRefs.current[id];
      }
    });
  }, [allPosts]);

  const handleSearch = useCallback(
    async (searchTags: string, newOrder?: Order, clearTags?: boolean) => {
      console.log('🔍 [App.handleSearch]', searchTags, newOrder, clearTags);

      // Close popups when searching
      setShowTagsFor(null);
      setShowInfoFor(null);

      // Wyłącz popular mode przy normalnym wyszukiwaniu
      setIsPopularMode(false);

      // ✅ UPROSZCZONE - zawsze normalne wyszukiwanie
      await newSearch(
        searchTags,
        { username: e621User, apiKey: e621ApiKey },
        { order: newOrder || order, clearTags },
      );
    },
    [newSearch, e621User, e621ApiKey, order],
  );

  // 🌟 Handle Popular Search
  const handlePopularSearch = useCallback(
    async (date: string, scale: PopularScale) => {
      console.log('⭐ [App.handlePopularSearch] START', { date, scale });

      // Close popups when searching
      setShowTagsFor(null);
      setShowInfoFor(null);

      setLoading(true);
      setIsPopularMode(true);

      try {
        const auth =
          e621User && e621ApiKey ? { username: e621User, apiKey: e621ApiKey } : undefined;
        console.log('⭐ [handlePopularSearch] Auth:', auth ? 'YES' : 'NO');

        const posts = await fetchPopularPosts(date, scale, auth);

        console.log('⭐ [handlePopularSearch] Received posts:', posts.length);
        console.log('⭐ [handlePopularSearch] First post:', posts[0]);

        setAllPosts(posts);
        setUiPage(1);
        setApiPage(1);
        setHasNextApiPage(false); // Popular nie ma paginacji
        setTags(`popular:${scale}:${date}`);
        setIsViewingRealFavorites(false);

        console.log('⭐ [handlePopularSearch] State updated, posts should display');
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === 'CanceledError' || err.message?.includes('cancel'))
        ) {
          console.log('⚠️ [handlePopularSearch] Request was cancelled');
          return; // Nie pokazuj błędu dla cancelled requests
        }
        console.error('❌ [handlePopularSearch] Error:', err);
      } finally {
        setLoading(false);
      }
    },
    [
      e621User,
      e621ApiKey,
      setLoading,
      setAllPosts,
      setUiPage,
      setApiPage,
      setHasNextApiPage,
      setTags,
      setIsViewingRealFavorites,
    ],
  );

  // 🌟 Change Popular Date (dla swipe i button navigation)
  const changePopularDate = useCallback(
    (direction: 'prev' | 'next') => {
      const currentDate = new Date(popularDate);

      if (popularScale === 'day') {
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
      } else if (popularScale === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
      } else if (popularScale === 'month') {
        currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
      }

      const newDateStr = currentDate.toISOString().split('T')[0];
      setPopularDate(newDateStr);
      handlePopularSearch(newDateStr, popularScale);
    },
    [popularDate, popularScale, handlePopularSearch],
  );

  // 🔥 Automatycznie załaduj popular mode po odświeżeniu
  useEffect(() => {
    if (shouldRestorePopular && isPopularMode) {
      console.log(
        '🔄 Restoring popular mode - calling handlePopularSearch:',
        popularScale,
        popularDate,
      );
      handlePopularSearch(popularDate, popularScale);
      setShouldRestorePopular(false);
    }
  }, [shouldRestorePopular, isPopularMode, popularDate, popularScale, handlePopularSearch]);

  // 🔥 Helper functions for info modal
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getRatingText = (rating: 's' | 'q' | 'e'): string => {
    switch (rating) {
      case 's':
        return 'Safe';
      case 'q':
        return 'Questionable';
      case 'e':
        return 'Explicit';
      default:
        return 'Unknown';
    }
  };

  // 🔥 Funkcje do modyfikacji SearchBar
  const searchTag = useCallback(
    async (tag: string) => {
      // Użyj zapisanego order jeśli istnieje, inaczej domyślny
      const orderToUse = savedOrderRef.current || 'id_desc';
      await handleSearch(tag, orderToUse);

      // Wyczyść zapisany order (już go użyliśmy)
      savedOrderRef.current = null;
    },
    [handleSearch],
  );

  const addTag = useCallback(
    (tag: string) => {
      const currentTags = tags.split(' ').filter(Boolean);
      if (!currentTags.includes(tag)) {
        const newValue = [...currentTags, tag].join(' ');
        // Tylko ustaw tagi, NIE wyszukuj automatycznie
        setTags(newValue);
      }
    },
    [tags, setTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const currentTags = tags.split(' ').filter(Boolean);
      const newValue = currentTags.filter((t: string) => t !== tag).join(' ');
      // Tylko usuń tag, NIE wyszukuj automatycznie
      setTags(newValue);
    },
    [tags, setTags],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      if (maximizedPostId !== null) {
        toggleMaximize(maximizedPostId);
        window.scrollTo({ top: scrollBeforeMaximize.current, behavior: 'smooth' });
      } else if (showNewsPopup) {
        setShowNewsPopup(false);
      } else if (showLoginModal) {
        setShowLoginModal(false);
      } else if (showSettings) {
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedPostId, toggleMaximize, showNewsPopup, showLoginModal, showSettings]);

  const loadRealFavorites = useCallback(async () => {
    if (!e621User || !e621ApiKey) {
      alert('Please log in first');
      return;
    }

    console.log('📥 [loadRealFavorites] Loading favorites from /favorites.json');

    // Wyłącz Popular Mode przy wejściu w Favorites
    setIsPopularMode(false);

    // Wyczyść obecne posty
    setAllPosts([]);
    setUiPage(1);
    setApiPage(1);

    try {
      setLoading(true);

      // ✅ USTAW FLAGĘ ŻE JESTEŚ W TRYBIE FAVORITES
      setIsViewingRealFavorites(true);
      setTags(`fav:${e621User}`);

      const response = await fetch(
        `${BASE_URL}${FAVORITES_ENDPOINT}?username=${encodeURIComponent(e621User)}&apiKey=${encodeURIComponent(e621ApiKey)}&page=1&limit=50`,
        {},
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 [loadRealFavorites] Got', data.posts?.length, 'favorites');

      // Te posty są już posortowane po dacie dodania do favorites!
      const mappedPosts = (data.posts || []).map(mapE621Post);
      setAllPosts(mappedPosts);
      setApiPage(2);
      setHasNextApiPage(data.hasMore || false);

      console.log('✅ [loadRealFavorites] Loaded successfully');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ [loadRealFavorites] Request was cancelled');
        return;
      }
      console.error('❌ [loadRealFavorites] Error:', error);
      alert('Failed to load favorites');
      // ✅ RESET FLAGI przy błędzie
      setIsViewingRealFavorites(false);
    } finally {
      setLoading(false);
    }
  }, [
    e621User,
    e621ApiKey,
    setAllPosts,
    setUiPage,
    setApiPage,
    setLoading,
    setIsViewingRealFavorites,
    setTags,
    setHasNextApiPage,
  ]);

  // ✅ NOWA FUNKCJA - Przycisk Favorites → wpisuje fav:{username}
  const handleFavoritesClick = useCallback(() => {
    if (!e621User) {
      alert('Please log in first to view your favorites');
      setShowLoginModal(true);
      return;
    }

    console.log('⭐ [handleFavoritesClick] Loading favorites for:', e621User);

    loadRealFavorites();

    // ✅ Opcja 2 (lepsze - sortuje po dacie dodania do fav):
    // Musisz dodać endpoint w backend który używa /favorites.json
    // Ten endpoint domyślnie sortuje po "kiedy dodano do favorites"
  }, [e621User, loadRealFavorites]);

  // ✅ Sprawdź czy w searchu jest fav:{username}
  const isViewingFavorites = useMemo(() => {
    return tags.toLowerCase().includes(`fav:${e621User.toLowerCase()}`);
  }, [tags, e621User]);

  const filteredPosts = useMemo(() => {
    let result = allPosts;

    // 🔥 FRONTEND BLACKLIST FILTERING - instant hide/show
    result = filterPostsByBlacklist(result, blacklistLines);

    // 🔥 SEX SEARCH FILTERING - instant filter (działa w Popular Mode też!)
    result = filterPostsBySexSearch(result, sexSearch);

    // Filtruj przez hideFavorites (ale NIE gdy oglądasz favorites)
    if (hideFavorites && !isViewingFavorites) {
      result = result.filter((p) => !p.is_favorited);
    }

    return result;
  }, [allPosts, blacklistLines, sexSearch, hideFavorites, isViewingFavorites]);

  const start = (uiPage - 1) * postsPerPage;
  const end = start + postsPerPage;

  const visiblePosts = useMemo(() => {
    // ✅ UPROSZCZONE - nie ma favoritesMode
    if (infiniteScroll) {
      return filteredPosts;
    }

    return filteredPosts.slice(start, end);
  }, [filteredPosts, start, end, infiniteScroll]);

  // 🔥 Funkcja do nawigacji w zmaksymalizowanym trybie
  const goNextPost = useCallback(() => {
    if (maximizedPostId === null) return;
    const index = visiblePosts.findIndex((p) => p.id === maximizedPostId);
    if (index >= 0 && index < visiblePosts.length - 1) {
      toggleMaximize(visiblePosts[index + 1].id);
    }
  }, [maximizedPostId, visiblePosts, toggleMaximize]);

  const goPrevPost = useCallback(() => {
    if (maximizedPostId === null) return;
    const index = visiblePosts.findIndex((p) => p.id === maximizedPostId);
    if (index > 0) {
      toggleMaximize(visiblePosts[index - 1].id);
    }
  }, [maximizedPostId, visiblePosts, toggleMaximize]);

  // 🔥 Obsługa nawigacji strzałkami w maximized mode
  useEffect(() => {
    if (maximizedPostId === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNextPost();
      if (e.key === 'ArrowLeft') goPrevPost();
      if (e.key === 'Escape') toggleMaximize(maximizedPostId);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximizedPostId, visiblePosts, goNextPost, goPrevPost, toggleMaximize]);

  // 🔥 Obsługa swipe dla mobile w maximized mode - BEST TYPESCRIPT
  useEffect(() => {
    if (!isMobile || maximizedPostId === null) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;

    // ✅ Type guard dla TouchEvent
    const isTouchEvent = (e: Event): e is TouchEvent => {
      return 'changedTouches' in e;
    };

    const handleTouchStart = (e: Event) => {
      if (!isTouchEvent(e) || !e.changedTouches[0]) return;

      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      console.log('👆 Touch start', { x: touchStartX, y: touchStartY });
    };

    const handleTouchEnd = (e: Event) => {
      if (!isTouchEvent(e) || !e.changedTouches[0]) return;

      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;

      const swipeDistanceX = touchEndX - touchStartX;
      const swipeDistanceY = touchEndY - touchStartY;

      console.log('👆 Touch end', {
        x: touchEndX,
        y: touchEndY,
        distanceX: swipeDistanceX,
        distanceY: swipeDistanceY,
      });

      if (Math.abs(swipeDistanceY) > maxVerticalDistance) {
        console.log('⏭️ Too much vertical - ignoring');
        return;
      }

      if (Math.abs(swipeDistanceX) < minSwipeDistance) {
        console.log('⏭️ Too short - ignoring');
        return;
      }

      if (swipeDistanceX > 0) {
        console.log('⬅️ RIGHT swipe → PREV');
        goPrevPost();
      } else {
        console.log('➡️ LEFT swipe → NEXT');
        goNextPost();
      }
    };

    const maximizedElement = document.querySelector('.post-wrapper.maximized') as HTMLElement;

    if (maximizedElement) {
      console.log('✅ Swipe listeners attached');

      maximizedElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      maximizedElement.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        maximizedElement.removeEventListener('touchstart', handleTouchStart);
        maximizedElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, maximizedPostId, goNextPost, goPrevPost]);

  // 🔥 Swipe dla page buttons mode (przełączanie stron)
  useEffect(() => {
    if (!isMobile || infiniteScroll) return; // Tylko mobile + page buttons

    let touchStartX = 0;
    let touchStartY = 0;
    const minSwipeDistance = 100; // większa odległość dla stron
    const maxVerticalDistance = 100;

    const handleTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch) return;
      touchStartX = touch.screenX;
      touchStartY = touch.screenY;
    };

    const handleTouchEnd = (e: Event) => {
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch) return;

      const swipeDistanceX = touch.screenX - touchStartX;
      const swipeDistanceY = touch.screenY - touchStartY;

      // Ignoruj pionowy scroll
      if (Math.abs(swipeDistanceY) > maxVerticalDistance) return;

      // Sprawdź minimalną odległość
      if (Math.abs(swipeDistanceX) < minSwipeDistance) return;

      // Swipe dla page buttons
      if (swipeDistanceX > 0) {
        // Swipe w prawo → poprzednia strona
        if (uiPage > 1) {
          prevUiPage();
        }
      } else {
        // Swipe w lewo → następna strona
        const canGoNext = hasNextApiPage || uiPage * postsPerPage < allPosts.length;
        if (canGoNext) {
          nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey });
        }
      }
    };

    const postsGrid = document.querySelector('.posts-grid') as HTMLElement;

    if (postsGrid) {
      postsGrid.addEventListener('touchstart', handleTouchStart, { passive: true });
      postsGrid.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        postsGrid.removeEventListener('touchstart', handleTouchStart);
        postsGrid.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [
    isMobile,
    infiniteScroll,
    uiPage,
    hasNextApiPage,
    allPosts.length,
    postsPerPage,
    prevUiPage,
    nextUiPage,
    e621User,
    e621ApiKey,
  ]);

  // 🔥 Swipe dla popular mode (przełączanie dat)
  useEffect(() => {
    if (!isMobile || !isPopularMode) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const minSwipeDistance = 100;
    const maxVerticalDistance = 100;

    const handleTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch) return;
      touchStartX = touch.screenX;
      touchStartY = touch.screenY;
    };

    const handleTouchEnd = (e: Event) => {
      const touch = (e as TouchEvent).changedTouches[0];
      if (!touch) return;

      const swipeDistanceX = touch.screenX - touchStartX;
      const swipeDistanceY = touch.screenY - touchStartY;

      // Ignoruj pionowy scroll
      if (Math.abs(swipeDistanceY) > maxVerticalDistance) return;

      // Sprawdź minimalną odległość
      if (Math.abs(swipeDistanceX) < minSwipeDistance) return;

      // Swipe dla popular mode
      if (swipeDistanceX > 0) {
        // Swipe w prawo → poprzednia data
        changePopularDate('prev');
      } else {
        // Swipe w lewo → następna data (jeśli nie jesteśmy w przyszłości)
        const currentDate = new Date(popularDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let canGoNext = false;
        if (popularScale === 'day') {
          canGoNext = currentDate < today;
        } else if (popularScale === 'week') {
          const nextWeek = new Date(currentDate);
          nextWeek.setDate(nextWeek.getDate() + 7);
          canGoNext = nextWeek <= today;
        } else if (popularScale === 'month') {
          const nextMonth = new Date(currentDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          canGoNext = nextMonth <= today;
        }

        if (canGoNext) {
          changePopularDate('next');
        }
      }
    };

    const postsGrid = document.querySelector('.posts-grid') as HTMLElement;

    if (postsGrid) {
      postsGrid.addEventListener('touchstart', handleTouchStart, { passive: true });
      postsGrid.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        postsGrid.removeEventListener('touchstart', handleTouchStart);
        postsGrid.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, isPopularMode, popularDate, popularScale, changePopularDate]);

  useEffect(() => {
    if (!infiniteScroll && hideFavorites) {
      setHideFavorites(false);
    }
  }, [infiniteScroll, hideFavorites, setHideFavorites]);

  // ✅ Wyczyść cache po zalogowaniu
  // DODAJ ref na początku komponentu (około linii 3360)
  const isFirstLoginRef = useRef(true);

  // ZMIEŃ useEffect
  useEffect(() => {
    // Tylko przy PIERWSZYM zalogowaniu, nie przy każdej zmianie
    if (e621User && e621ApiKey && isFirstLoginRef.current) {
      isFirstLoginRef.current = false;
      console.log('🔑 [Login] User logged in, refreshing posts');
      // Odśwież obecne posty z credentials
      if (tags) {
        newSearch(tags, { username: e621User, apiKey: e621ApiKey });
      }
    }

    // Reset gdy user się wyloguje
    if (!e621User || !e621ApiKey) {
      isFirstLoginRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e621User, e621ApiKey]); // ✅ Tylko credentials

  // ✅ DODAJ TEN NOWY useEffect dla infinite scroll
  useEffect(() => {
    if (!infiniteScroll || !infiniteTriggerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && hasNextApiPage) {
          console.log('📜 [Infinite Scroll] Triggered');
          nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey });
        }
      },
      {
        rootMargin: '300px',
        threshold: 0.1,
      },
    );

    observer.observe(infiniteTriggerRef.current);

    return () => observer.disconnect();
  }, [infiniteScroll, loading, hasNextApiPage, nextUiPage, postsPerPage, e621User, e621ApiKey]);

  return (
    <div
      className={`app-container ${fixedHeader ? 'fixed' : ''} ${isPopularMode && fixedHeader ? 'popular-fixed' : ''} ${isMobile && !infiniteScroll ? 'mobile-page-buttons-padding' : ''}`}
    >
      <div className={`app-header ${fixedHeader ? 'fixed' : ''}`}>
        {/* Burger menu - tylko mobile */}
        <button className="burger-menu-btn mobile-only" onClick={() => setShowMobileSidebar(true)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z" />
          </svg>
        </button>

        <button className="settings-btn desktop-only" onClick={() => setShowSettings(true)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M14.2788 2.15224C13.9085 2 13.439 2 12.5 2C11.561 2 11.0915 2 10.7212 2.15224C10.2274 2.35523 9.83509 2.74458 9.63056 3.23463C9.53719 3.45834 9.50065 3.7185 9.48635 4.09799C9.46534 4.65568 9.17716 5.17189 8.69017 5.45093C8.20318 5.72996 7.60864 5.71954 7.11149 5.45876C6.77318 5.2813 6.52789 5.18262 6.28599 5.15102C5.75609 5.08178 5.22018 5.22429 4.79616 5.5472C4.47814 5.78938 4.24339 6.1929 3.7739 6.99993C3.30441 7.80697 3.06967 8.21048 3.01735 8.60491C2.94758 9.1308 3.09118 9.66266 3.41655 10.0835C3.56506 10.2756 3.77377 10.437 4.0977 10.639C4.57391 10.936 4.88032 11.4419 4.88029 12C4.88026 12.5581 4.57386 13.0639 4.0977 13.3608C3.77372 13.5629 3.56497 13.7244 3.41645 13.9165C3.09108 14.3373 2.94749 14.8691 3.01725 15.395C3.06957 15.7894 3.30432 16.193 3.7738 17C4.24329 17.807 4.47804 18.2106 4.79606 18.4527C5.22008 18.7756 5.75599 18.9181 6.28589 18.8489C6.52778 18.8173 6.77305 18.7186 7.11133 18.5412C7.60852 18.2804 8.2031 18.27 8.69012 18.549C9.17714 18.8281 9.46533 19.3443 9.48635 19.9021C9.50065 20.2815 9.53719 20.5417 9.63056 20.7654C9.83509 21.2554 10.2274 21.6448 10.7212 21.8478C11.0915 22 11.561 22 12.5 22C13.439 22 13.9085 22 14.2788 21.8478C14.7726 21.6448 15.1649 21.2554 15.3694 20.7654C15.4628 20.5417 15.4994 20.2815 15.5137 19.902C15.5347 19.3443 15.8228 18.8281 16.3098 18.549C16.7968 18.2699 17.3914 18.2804 17.8886 18.5412C18.2269 18.7186 18.4721 18.8172 18.714 18.8488C19.2439 18.9181 19.7798 18.7756 20.2038 18.4527C20.5219 18.2105 20.7566 17.807 21.2261 16.9999C21.6956 16.1929 21.9303 15.7894 21.9827 15.395C22.0524 14.8691 21.9088 14.3372 21.5835 13.9164C21.4349 13.7243 21.2262 13.5628 20.9022 13.3608C20.4261 13.0639 20.1197 12.558 20.1197 11.9999C20.1197 11.4418 20.4261 10.9361 20.9022 10.6392C21.2263 10.4371 21.435 10.2757 21.5836 10.0835C21.9089 9.66273 22.0525 9.13087 21.9828 8.60497C21.9304 8.21055 21.6957 7.80703 21.2262 7C20.7567 6.19297 20.522 5.78945 20.2039 5.54727C19.7799 5.22436 19.244 5.08185 18.7141 5.15109C18.4722 5.18269 18.2269 5.28136 17.8887 5.4588C17.3915 5.71959 16.7969 5.73002 16.3099 5.45096C15.8229 5.17191 15.5347 4.65566 15.5136 4.09794C15.4993 3.71848 15.4628 3.45833 15.3694 3.23463C15.1649 2.74458 14.7726 2.35523 14.2788 2.15224ZM12.5 15C14.1695 15 15.5228 13.6569 15.5228 12C15.5228 10.3431 14.1695 9 12.5 9C10.8305 9 9.47716 10.3431 9.47716 12C9.47716 13.6569 10.8305 15 12.5 15Z"
            />
          </svg>
        </button>
        <div className="top-bar">
          <SearchBar
            onSearch={handleSearch}
            onPopularSearch={handlePopularSearch}
            initialTags={isPopularMode ? '' : tags}
            order={order}
            setOrder={setOrder}
            savedOrderRef={savedOrderRef}
            isPopularMode={isPopularMode}
            setIsPopularMode={setIsPopularMode}
            popularDate={popularDate}
            setPopularDate={setPopularDate}
            popularScale={popularScale}
            setPopularScale={setPopularScale}
            loading={loading}
          />

          {!infiniteScroll && (
            <PageButtonsTop
              page={uiPage}
              loading={loading}
              onPrev={prevUiPage}
              onNext={() => nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey })}
              disableNext={!hasNextApiPage && uiPage * postsPerPage >= allPosts.length}
            />
          )}
        </div>
        <div className="top-bar-right desktop-only">
          <button
            className="blacklist-btn"
            onClick={() => setShowBlacklistModal(true)}
            disabled={!isLoggedIn}
            title={!isLoggedIn ? 'Login required' : 'Blacklist'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="45"
              height="45"
              viewBox="0 0 120 120"
              fill="currentColor"
            >
              <path d="M60.005 23.299c9.799 0 19.014 3.817 25.946 10.75C92.884 40.98 96.701 50.197 96.701 60s-3.817 19.02-10.75 25.952C79.02 92.884 69.803 96.701 60 96.701s-19.02-3.817-25.952-10.75C27.116 79.02 23.299 69.804 23.299 60s3.817-19.02 10.75-25.952c6.931-6.931 16.148-10.749 25.955-10.75zm-.005-20C45.491 3.3 30.977 8.836 19.906 19.906c-22.144 22.144-22.143 58.045 0 80.188C30.978 111.166 45.489 116.701 60 116.701s29.021-5.535 40.094-16.607c22.144-22.144 22.144-58.044 0-80.188C89.021 8.833 74.513 3.297 60 3.299" />
              <path d="m18.184 33.033 14.848-14.848 68.397 68.397-14.848 14.848z" />
            </svg>
          </button>

          <button
            className="fav-btn"
            onClick={handleFavoritesClick}
            disabled={!isLoggedIn || loading}
            title={!isLoggedIn ? 'Login required' : loading ? 'Loading...' : 'Favorites'}
          >
            <svg height="40" width="40" viewBox="0 0 512 512" fill="currentColor">
              <path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z" />
            </svg>
          </button>
          <button
            className="news-btn"
            onClick={async () => {
              if (observedTags.length === 0) return alert('No tags observed yet!');

              const key = observedTags.sort().join(',');
              const lastReload = Number(localStorage.getItem('newsLastReload')) || 0;
              const timeSinceReload = Date.now() - lastReload;
              const ONE_HOUR = 3600 * 1000;

              // 🔥 SPRAWDŹ CZY CACHE JEST AKTUALNY (młodszy niż 1h) I czy user się nie zmienił
              const cachedForUser = localStorage.getItem('newsCacheUser') || '';
              const userChanged = cachedForUser !== e621User;

              if (newsCache.current[key] && timeSinceReload < ONE_HOUR && !userChanged) {
                console.log('📦 [News] Using cached posts');
                setNewsPosts(newsCache.current[key]);
                setShowNewsPopup(true);
                return;
              }

              // 🔥 Jeśli user się zmienił, wyczyść cache
              if (userChanged) {
                console.log('🔄 [News] User changed, clearing cache');
                newsCache.current = {};
                localStorage.setItem('newsCacheUser', e621User);
              }

              setShowNewsPopup(true);

              try {
                // 🔥 DODANE - przekaż auth do fetchPostsForMultipleTags
                const auth =
                  e621User && e621ApiKey ? { username: e621User, apiKey: e621ApiKey } : undefined;
                const allPosts = await fetchPostsForMultipleTags(observedTags, 'date:week', auth);

                // ⚡ Limit cache size - max 5 entries
                const cacheKeys = Object.keys(newsCache.current);
                if (cacheKeys.length >= 5) {
                  // Usuń najstarszy entry
                  delete newsCache.current[cacheKeys[0]];
                }

                newsCache.current[key] = allPosts;
                setNewsPosts(allPosts);
                localStorage.setItem('newsLastReload', Date.now().toString());

                if (allPosts.length === 0) {
                  console.log('DEBUG: No posts returned for these queries');
                }
              } catch (err) {
                console.error('Failed to fetch news posts', err);
              }
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
            >
              <g transform="scale(0.046875)">
                <path d="M455.973 357.336C443.559 350.167 436 336.835 436 322.5V230c0-82.238-55.152-151.593-130.485-173.101A50.5 50.5 0 0 0 306 50c0-27.614-22.386-50-50-50s-50 22.386-50 50c0 2.342.174 4.643.485 6.899C131.151 78.407 76 147.762 76 230v92.5c0 14.335-7.559 27.667-19.973 34.836-11.76 6.791-19.742 19.394-20.019 33.884C35.577 413.738 54.268 432 76.79 432H176c0 44.183 35.817 80 80 80s80-35.817 80-80h99.21c22.523 0 41.214-18.262 40.783-40.781-.278-14.489-8.26-27.093-20.02-33.883" />
              </g>
            </svg>
          </button>

          <button className="login-btn" onClick={() => setShowLoginModal(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19.6515 19.4054C20.2043 19.2902 20.5336 18.7117 20.2589 18.2183C19.6533 17.1307 18.6993 16.1749 17.4788 15.4465C15.907 14.5085 13.9812 14 12 14C10.0188 14 8.09292 14.5085 6.52112 15.4465C5.30069 16.1749 4.34666 17.1307 3.74108 18.2183C3.46638 18.7117 3.79562 19.2902 4.34843 19.4054C9.39524 20.4572 14.6047 20.4572 19.6515 19.4054Z" />
              <circle cx="12" cy="8" r="5" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`posts-grid ${layout}`}
        style={{ '--columns': postColumns } as React.CSSProperties}
      >
        {visiblePosts.map((post: Post, index: number) => {
          const isLCP = index === 0 && uiPage === 1;
          const url = post.file.url || post.file.sample_url;
          if (!url) return null;

          const isVideo = post.file.ext === 'webm' || post.file.ext === 'mp4';
          const isGif = post.file.ext === 'gif';
          const isMaximized = maximizedPostId === post.id;
          const videoUrl = videoResolution === 'best' ? post.file.url : post.sample.url;
          const shouldUseFull = isMaximized || (gifsAutoplay && isGif);

          return (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={`post-wrapper ${isMaximized ? 'maximized' : ''} ${isMaximized ? `buttons-${maximizedButtonsPosition}` : `buttons-${postButtonsPosition}`}   ${isMobile && !isMaximized ? 'mobile-no-buttons' : ''}`.trim()}
            >
              <button
                className={`maximize-btn ${isMaximized ? 'maximized-btn' : ''}`}
                onClick={() => toggleMaximize(post.id)}
              >
                {isMaximized ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.71 15.29L3 21M8.71 8.71L3 3M21 21l-5.71-5.71M21 3L15.29 8.71" />
                    <path d="M4 15H8a1 1 0 0 1 1 1v4" />
                    <path d="M9 4V8a1 1 0 0 1-1 1H4" />
                    <path d="M15 20V16a1 1 0 0 1 1-1h4" />
                    <path d="M20 9H16a1 1 0 0 1-1-1V4" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 9L3.29 3.29M15 9l5.71-5.71M9 15L3.29 20.71m17.42 0L15 15" />
                    <path d="M3 8V4a1 1 0 0 1 1-1h4" />
                    <path d="M16 3h4a1 1 0 0 1 1 1v4" />
                    <path d="M8 21H4a1 1 0 0 1-1-1v-4" />
                    <path d="M21 16v4a1 1 0 0 1-1 1h-4" />
                  </svg>
                )}
              </button>
              <button
                className={`tags-btn ${isMaximized ? 'tags-btn-max' : ''} ${
                  showTagsFor === post.id ? 'active' : ''
                }`}
                onClick={() => setShowTagsFor((prev) => (prev === post.id ? null : post.id))}
              >
                {isMaximized ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="8" y1="2" x2="8" y2="22" />
                    <line x1="16" y1="2" x2="16" y2="22" />

                    <line x1="2" y1="8" x2="22" y2="8" />
                    <line x1="2" y1="16" x2="22" y2="16" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="8" y1="2" x2="8" y2="22" />
                    <line x1="16" y1="2" x2="16" y2="22" />

                    <line x1="2" y1="8" x2="22" y2="8" />
                    <line x1="2" y1="16" x2="22" y2="16" />
                  </svg>
                )}
              </button>
              <button
                className={`info-btn ${isMaximized ? 'info-btn-max' : ''} ${
                  showInfoFor === post.id ? 'active' : ''
                }`}
                onClick={() => setShowInfoFor(showInfoFor === post.id ? null : post.id)}
              >
                {isMaximized ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </button>
              <button
                className={`fav-post-btn ${post.is_favorited ? 'is-favorite' : ''} ${
                  isMaximized ? 'fav-post-btn-max' : ''
                }`}
                onClick={async () => {
                  const wasNotFavorite = !post.is_favorited;
                  await toggleFavoritePost(post.id, post.is_favorited || false);

                  // Jeśli dodaliśmy do fav i hide favorites jest włączony i jesteśmy w maximized
                  if (wasNotFavorite && hideFavorites && isMaximized) {
                    goNextPost();
                  }
                }}
                title={!isLoggedIn ? 'Login required' : 'Add/Remove Favorite'}
                disabled={!isLoggedIn || pendingFavorites.has(post.id)}
              >
                {isMaximized ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
             4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 
             14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 
             6.86-8.55 11.54L12 21.35z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
             4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 
             14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 
             6.86-8.55 11.54L12 21.35z"
                    />
                  </svg>
                )}
              </button>

              {showTagsFor === post.id && (
                <div
                  className={`tags-popup ${isMaximized ? 'tags-popup-max' : ''}`}
                  ref={tagsPopupRef}
                  onWheel={(e) => {
                    const target = e.currentTarget;
                    const atTop = target.scrollTop === 0;
                    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;

                    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                      e.stopPropagation();
                    }
                  }}
                >
                  {post.tags.length > 0 ? (
                    post.tags.map((tag: PostTag) => {
                      let color = '#fff';
                      switch (tag.type) {
                        case 'artist':
                          color = 'orange';
                          break;
                        case 'copyright':
                          color = '#db58e0';
                          break;
                        case 'general':
                          color = '#ebdd65';
                          break;
                        case 'character':
                          color = '#7fc97f';
                          break;
                        case 'species':
                          color = '#eb6d6d';
                          break;
                        case 'meta':
                          color = '#fff';
                          break;
                      }

                      return (
                        <div key={tag.name} className="tag-item">
                          <button
                            className={`tag-observe ${
                              observedTags.includes(tag.name) ? 'active' : ''
                            }`}
                            onClick={() => {
                              toggleTag(tag.name);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M12 6.00019C10.2006 3.90317 7.19377 3.2551 4.93923 5.17534C2.68468 7.09558 2.36727 10.3061 4.13778 12.5772C5.60984 14.4654 10.0648 18.4479 11.5249 19.7369C11.6882 19.8811 11.7699 19.9532 11.8652 19.9815C11.9483 20.0062 12.0393 20.0062 12.1225 19.9815C12.2178 19.9532 12.2994 19.8811 12.4628 19.7369C13.9229 18.4479 18.3778 14.4654 19.8499 12.5772C21.6204 10.3061 21.3417 7.07538 19.0484 5.17534C16.7551 3.2753 13.7994 3.90317 12 6.00019Z"
                              />
                            </svg>
                          </button>

                          <button className="tag-add" onClick={() => addTag(tag.name)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>

                          <button className="tag-remove" onClick={() => removeTag(tag.name)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>

                          <span
                            className="tag-name"
                            style={{ color }}
                            onClick={() => searchTag(tag.name)}
                          >
                            {tag.name}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="tag-item">No tags</div>
                  )}
                </div>
              )}

              {showInfoFor === post.id && (
                <div
                  className={`info-popup ${isMaximized ? 'info-popup-max' : ''}`}
                  ref={infoPopupRef}
                  onWheel={(e) => {
                    const target = e.currentTarget;
                    const atTop = target.scrollTop === 0;
                    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;

                    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                      e.stopPropagation();
                    }
                  }}
                >
                  <div className="info-row">
                    <span className="info-label">Source:</span>
                    <span className="info-value">
                      {post.sources && post.sources.length > 0 ? (
                        <a
                          href={post.sources[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="info-link"
                        >
                          {post.sources[0].length > 50
                            ? post.sources[0].substring(0, 50) + '...'
                            : post.sources[0]}
                        </a>
                      ) : (
                        'None'
                      )}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">ID:</span>
                    <span className="info-value">
                      <a
                        href={`https://e621.net/posts/${post.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="info-link"
                      >
                        {post.id}
                      </a>
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Size:</span>
                    <span className="info-value">
                      {post.file.width}x{post.file.height} ({formatFileSize(post.file.size)})
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Type:</span>
                    <span className="info-value">{post.file.ext?.toUpperCase() || 'Unknown'}</span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Rating:</span>
                    <span className="info-value">{getRatingText(post.rating)}</span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Score:</span>
                    <span className="info-value">{post.score.total}</span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Faves:</span>
                    <span className="info-value">{post.fav_count}</span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Posted:</span>
                    <span className="info-value">{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>
              )}

              {isVideo ? (
                isMaximized ? (
                  <video
                    className="post-item post-item-max"
                    controls
                    playsInline
                    preload="auto"
                    src={videoUrl}
                    ref={(el) => {
                      if (el) {
                        el.volume = defaultVolume;
                        observeLazy(el);
                        videoRefs.current[post.id] = el;
                      }
                    }}
                    loop={loopVideos}
                  />
                ) : isMobile ? (
                  // Mobile - pokaż thumbnail z overlayem (jak w NewsModal)
                  <div className="video-thumb" onClick={() => toggleMaximize(post.id)}>
                    <img
                      src={post.preview.url || post.sample.url}
                      alt=""
                      className="post-item"
                      loading="lazy"
                    />
                    <div className="video-overlay">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="72"
                        height="72"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <g transform="scale(0.046875)">
                          <path d="M207.063,167.141c-1.031-0.609-2.344-0.641-3.406-0.031c-1.031,0.594-1.688,1.719-1.688,2.938v85.938v85.953 c0,1.234,0.656,2.344,1.688,2.938c1.063,0.625,2.375,0.594,3.406-0.031l144-85.953c1.031-0.594,1.641-1.703,1.641-2.906 c0-1.172-0.609-2.297-1.641-2.891L207.063,167.141z" />
                          <path d="M256,0C114.625,0,0,114.625,0,256s114.625,256,256,256s256-114.625,256-256S397.375,0,256,0z M256,448 c-105.875,0-192-86.125-192-192S150.125,64,256,64s192,86.125,192,192S361.875,448,256,448z" />
                        </g>
                      </svg>
                    </div>
                  </div>
                ) : (
                  // Desktop - pokazuj video z kontrolkami
                  <video
                    className="post-item"
                    controls
                    playsInline
                    preload="metadata"
                    src={post.sample.url}
                    ref={(el) => {
                      if (el) {
                        el.volume = defaultVolume;
                        observeLazy(el);
                        videoRefs.current[post.id] = el;
                      }
                    }}
                    loop={loopVideos}
                  />
                )
              ) : isGif ? (
                isMaximized ? (
                  // Maximized - pokaż pełny GIF
                  <img
                    className="post-item post-item-max"
                    src={post.file.url || post.sample?.url}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : isMobile || !gifsAutoplay ? (
                  // Mobile LUB gdy autoplay wyłączony - pokaż thumbnail z overlayem
                  <div className="video-thumb" onClick={() => toggleMaximize(post.id)}>
                    <img
                      src={post.preview?.url || post.sample?.url}
                      alt=""
                      className="post-item"
                      loading="lazy"
                    />
                    <div className="video-overlay gif">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="100"
                        height="100"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.75 3.5A3.25 3.25 0 0 1 22 6.75v10.503a3.25 3.25 0 0 1-3.25 3.25H5.25A3.25 3.25 0 0 1 2 17.253V6.751A3.25 3.25 0 0 1 5.25 3.5zm0 1.5H5.25A1.75 1.75 0 0 0 3.5 6.75v10.503c0 .967.784 1.75 1.75 1.75h13.5a1.75 1.75 0 0 0 1.75-1.75V6.751A1.75 1.75 0 0 0 18.75 5M8.015 8.873c.596 0 1.019.081 1.502.313a.625.625 0 0 1-.541 1.127c-.3-.144-.54-.19-.961-.19-.867 0-1.504.796-1.504 1.872s.638 1.876 1.504 1.876c.428 0 .791-.18.98-.5L9 13.355v-.734h-.376a.625.625 0 0 1-.618-.532L8 11.996c0-.314.231-.573.533-.618l.092-.007h1.002c.314 0 .573.231.618.533l.007.092-.002 1.548-.006.055-.021.09-.02.055c-.377.89-1.241 1.376-2.188 1.376-1.626 0-2.754-1.412-2.754-3.126 0-1.712 1.127-3.122 2.754-3.122m4.614.122c.314 0 .574.231.618.533l.007.092v4.762a.625.625 0 0 1-1.243.092l-.007-.092V9.62c0-.345.28-.625.625-.625m2.996 0L17.622 9a.625.625 0 0 1 .088 1.243l-.092.007-1.371-.005V12h1.123c.314 0 .574.232.618.533l.007.092a.625.625 0 0 1-.533.619l-.092.006h-1.123v1.115a.625.625 0 0 1-.532.618l-.092.007a.625.625 0 0 1-.619-.533l-.006-.092V9.617A.625.625 0 0 1 15.532 9z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  // Desktop z autoplay - pokaż animowany GIF
                  <img
                    className="post-item"
                    src={post.file.url || post.sample?.url}
                    loading="lazy"
                    onClick={() => toggleMaximize(post.id)}
                    onDoubleClick={() => toggleMaximize(post.id)}
                  />
                )
              ) : (
                <img
                  className={`post-item ${isMaximized ? 'post-item-max' : ''}`}
                  loading={isLCP ? 'eager' : 'lazy'}
                  fetchPriority={isLCP ? 'high' : 'auto'}
                  decoding="async"
                  src={
                    shouldUseFull
                      ? post.file.url || post.sample?.url
                      : post.preview?.url || post.sample?.url || post.file.url
                  }
                  onClick={isMobile ? () => toggleMaximize(post.id) : undefined}
                  onDoubleClick={!isMobile ? () => toggleMaximize(post.id) : undefined}
                />
              )}
              {isMaximized && (
                <>
                  {!hideNavArrows && (
                    <>
                      <button className="nav left" onClick={goPrevPost}>
                        <svg
                          height="30"
                          width="30"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 492 492"
                          fill="currentColor"
                        >
                          <path d="m464.344 207.418.768.168H135.888l103.496-103.724c5.068-5.064 7.848-11.924 7.848-19.124s-2.78-14.012-7.848-19.088L223.28 49.538c-5.064-5.064-11.812-7.864-19.008-7.864-7.2 0-13.952 2.78-19.016 7.844L7.844 226.914C2.76 231.998-.02 238.77 0 245.974c-.02 7.244 2.76 14.02 7.844 19.096l177.412 177.412c5.064 5.06 11.812 7.844 19.016 7.844 7.196 0 13.944-2.788 19.008-7.844l16.104-16.112c5.068-5.056 7.848-11.808 7.848-19.008 0-7.196-2.78-13.592-7.848-18.652L134.72 284.406h329.992c14.828 0 27.288-12.78 27.288-27.6v-22.788c0-14.82-12.828-26.6-27.656-26.6" />
                        </svg>
                      </button>
                      <button className="nav right" onClick={goNextPost}>
                        <svg
                          height="30"
                          width="30"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 492 492"
                          fill="currentColor"
                        >
                          <path d="M484.14 226.886 306.46 49.202c-5.072-5.072-11.832-7.856-19.04-7.856-7.216 0-13.972 2.788-19.044 7.856l-16.132 16.136c-5.068 5.064-7.86 11.828-7.86 19.04 0 7.208 2.792 14.2 7.86 19.264L355.9 207.526H26.58C11.732 207.526 0 219.15 0 234.002v22.812c0 14.852 11.732 27.648 26.58 27.648h330.496L252.248 388.926c-5.068 5.072-7.86 11.652-7.86 18.864 0 7.204 2.792 13.88 7.86 18.948l16.132 16.084c5.072 5.072 11.828 7.836 19.044 7.836 7.208 0 13.968-2.8 19.04-7.872l177.68-177.68c5.084-5.088 7.88-11.88 7.86-19.1.016-7.244-2.776-14.04-7.864-19.12" />
                        </svg>
                      </button>
                    </>
                  )}
                  {/* ✅ KLIKALNE OBSZARY - zawsze obecne, nawet gdy strzałki ukryte */}
                  <div
                    className="nav-area left"
                    onClick={goPrevPost}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '30%',
                      bottom: '30%',
                      width: '20%',
                      cursor: hideNavArrows ? 'pointer' : 'default',
                      zIndex: hideNavArrows ? 10 : -1,
                    }}
                  />
                  <div
                    className="nav-area right"
                    onClick={goNextPost}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '30%',
                      bottom: '30%',
                      width: '20%',
                      cursor: hideNavArrows ? 'pointer' : 'default',
                      zIndex: hideNavArrows ? 10 : -1,
                    }}
                  />
                </>
              )}
              {maximizedPostId !== null && (
                <div
                  className="maximized-overlay"
                  onClick={() => toggleMaximize(maximizedPostId)}
                />
              )}
            </div>
          );
        })}

        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            defaultVolume={defaultVolume}
            setDefaultVolume={setDefaultVolume}
            autoPlayOnMaximize={autoPlayOnMaximize}
            setAutoPlayOnMaximize={setAutoPlayOnMaximize}
            autoPauseOnMinimize={autoPauseOnMinimize}
            setAutoPauseOnMinimize={setAutoPauseOnMinimize}
            pauseVideoOutOfFocus={pauseVideoOutOfFocus}
            setPauseVideoOutOfFocus={setPauseVideoOutOfFocus}
            layout={layout}
            setLayout={setLayout}
            postColumns={postColumns}
            setPostColumns={setPostColumns}
            newsLayout={newsLayout}
            setNewsLayout={setNewsLayout}
            newsPostColumns={newsPostColumns}
            setNewsPostColumns={setNewsPostColumns}
            fixedHeader={fixedHeader}
            setFixedHeader={setFixedHeader}
            postsPerPage={postsPerPage}
            setPostsPerPage={setPostsPerPage}
            hideFavorites={hideFavorites}
            setHideFavorites={setHideFavorites}
            loopVideos={loopVideos}
            setLoopVideos={setLoopVideos}
            videoResolution={videoResolution}
            setVideoResolution={setVideoResolution}
            infiniteScroll={infiniteScroll}
            setInfiniteScroll={setInfiniteScroll}
            gifsAutoplay={gifsAutoplay}
            setGifsAutoplay={setGifsAutoplay}
            hideNavArrows={hideNavArrows} // ✅ DODAJ TO
            setHideNavArrows={setHideNavArrows}
            postButtonsPosition={postButtonsPosition} // ✅ DODAJ
            setPostButtonsPosition={setPostButtonsPosition} // ✅ DODAJ
            maximizedButtonsPosition={maximizedButtonsPosition} // ✅ DODAJ
            setMaximizedButtonsPosition={setMaximizedButtonsPosition}
            isMobile={isMobile}
            sexSearch={sexSearch}
            setSexSearch={setSexSearch}
          />
        )}

        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onLoginSuccess={() => {}}
            e621User={e621User}
            e621ApiKey={e621ApiKey}
            setE621User={setE621User}
            setE621ApiKey={setE621ApiKey}
          />
        )}

        {showNewsPopup && (
          <NewsModal
            posts={newsPosts}
            setNewsPosts={setNewsPosts}
            observedTags={observedTags}
            postColumns={newsPostColumns}
            layout={newsLayout}
            onClose={() => setShowNewsPopup(false)}
            loading={loading}
            onToggleTag={toggleTag}
            onSearchTag={handleSearch}
            defaultVolume={defaultVolume}
            toggleFavoritePost={toggleFavoritePost}
            pendingFavorites={pendingFavorites}
            isLoggedIn={isLoggedIn}
            addTag={addTag}
            removeTag={removeTag}
            searchTag={searchTag}
            username={e621User}
            apiKey={e621ApiKey}
          />
        )}

        {showBlacklistModal && (
          <BlacklistModal
            onClose={() => setShowBlacklistModal(false)}
            blacklistLines={blacklistLines}
            onToggle={toggleLine}
            onAdd={addLine}
            onRemove={removeLine}
            onEdit={editLine}
            onSave={updateBlacklist}
            loading={blacklistLoading}
          />
        )}
      </div>

      {!infiniteScroll && !isMobile && (
        <PageButtonsBottom
          page={uiPage}
          loading={loading}
          onPrev={prevUiPage}
          onNext={() => nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey })}
          disableNext={!hasNextApiPage && uiPage * postsPerPage >= allPosts.length}
        />
      )}

      {loading && <p style={{ marginTop: 10 }}>Loading posts...</p>}
      {infiniteScroll && <div ref={infiniteTriggerRef} style={{ height: 1 }} />}

      <MobileBottomNav
        onSearch={handleSearch}
        onPopularSearch={handlePopularSearch}
        initialTags={isPopularMode ? '' : tags}
        order={order}
        setOrder={setOrder}
        savedOrderRef={savedOrderRef}
        isPopularMode={isPopularMode}
        setIsPopularMode={setIsPopularMode}
        popularDate={popularDate}
        setPopularDate={setPopularDate}
        popularScale={popularScale}
        setPopularScale={setPopularScale}
        loading={loading}
        onFavoritesClick={handleFavoritesClick}
        isFavoritesActive={isViewingRealFavorites}
        isFavoritesDisabled={!isLoggedIn || loading}
      />

      {/* Mobile Sidebar */}
      {showMobileSidebar && (
        <>
          {/* Overlay */}
          <div className="mobile-sidebar-overlay" onClick={() => setShowMobileSidebar(false)} />

          {/* Sidebar */}
          <div className="mobile-sidebar">
            <div className="mobile-sidebar-header">
              <h2>Menu</h2>
              <button className="close-btn" onClick={() => setShowMobileSidebar(false)}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mobile-sidebar-items">
              <button
                className="sidebar-item"
                onClick={() => {
                  setShowMobileSidebar(false);
                  setShowLoginModal(true);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.6515 19.4054C20.2043 19.2902 20.5336 18.7117 20.2589 18.2183C19.6533 17.1307 18.6993 16.1749 17.4788 15.4465C15.907 14.5085 13.9812 14 12 14C10.0188 14 8.09292 14.5085 6.52112 15.4465C5.30069 16.1749 4.34666 17.1307 3.74108 18.2183C3.46638 18.7117 3.79562 19.2902 4.34843 19.4054C9.39524 20.4572 14.6047 20.4572 19.6515 19.4054Z" />
                  <circle cx="12" cy="8" r="5" />
                </svg>
                <span>Konto</span>
              </button>

              <button
                className="sidebar-item"
                onClick={async () => {
                  setShowMobileSidebar(false);

                  if (observedTags.length === 0) return alert('No tags observed yet!');

                  const key = observedTags.sort().join(',');
                  const lastReload = Number(localStorage.getItem('newsLastReload')) || 0;
                  const timeSinceReload = Date.now() - lastReload;
                  const ONE_HOUR = 3600 * 1000;

                  const cachedForUser = localStorage.getItem('newsCacheUser') || '';
                  const userChanged = cachedForUser !== e621User;

                  if (newsCache.current[key] && timeSinceReload < ONE_HOUR && !userChanged) {
                    console.log('📦 [News] Using cached posts');
                    setNewsPosts(newsCache.current[key]);
                    setShowNewsPopup(true);
                    return;
                  }

                  if (userChanged) {
                    console.log('🔄 [News] User changed, clearing cache');
                    newsCache.current = {};
                    localStorage.setItem('newsCacheUser', e621User);
                  }

                  setShowNewsPopup(true);

                  try {
                    const auth =
                      e621User && e621ApiKey
                        ? { username: e621User, apiKey: e621ApiKey }
                        : undefined;
                    const allPosts = await fetchPostsForMultipleTags(
                      observedTags,
                      'date:week',
                      auth,
                    );

                    const cacheKeys = Object.keys(newsCache.current);
                    if (cacheKeys.length >= 5) {
                      delete newsCache.current[cacheKeys[0]];
                    }

                    newsCache.current[key] = allPosts;
                    setNewsPosts(allPosts);
                    localStorage.setItem('newsLastReload', Date.now().toString());

                    if (allPosts.length === 0) {
                      console.log('DEBUG: No posts returned for these queries');
                    }
                  } catch (err) {
                    console.error('Failed to fetch news posts', err);
                  }
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <g transform="scale(0.046875)">
                    <path d="M455.973 357.336C443.559 350.167 436 336.835 436 322.5V230c0-82.238-55.152-151.593-130.485-173.101A50.5 50.5 0 0 0 306 50c0-27.614-22.386-50-50-50s-50 22.386-50 50c0 2.342.174 4.643.485 6.899C131.151 78.407 76 147.762 76 230v92.5c0 14.335-7.559 27.667-19.973 34.836-11.76 6.791-19.742 19.394-20.019 33.884C35.577 413.738 54.268 432 76.79 432H176c0 44.183 35.817 80 80 80s80-35.817 80-80h99.21c22.523 0 41.214-18.262 40.783-40.781-.278-14.489-8.26-27.093-20.02-33.883" />
                  </g>
                </svg>
                <span>Notyfikacje</span>
              </button>

              <button
                className="sidebar-item"
                onClick={() => {
                  setShowMobileSidebar(false);
                  setShowBlacklistModal(true);
                }}
                disabled={!isLoggedIn}
              >
                <svg width="24" height="24" viewBox="0 0 120 120" fill="currentColor">
                  <path d="M60.005 23.299c9.799 0 19.014 3.817 25.946 10.75C92.884 40.98 96.701 50.197 96.701 60s-3.817 19.02-10.75 25.952C79.02 92.884 69.803 96.701 60 96.701s-19.02-3.817-25.952-10.75C27.116 79.02 23.299 69.804 23.299 60s3.817-19.02 10.75-25.952c6.931-6.931 16.148-10.749 25.955-10.75zm-.005-20C45.491 3.3 30.977 8.836 19.906 19.906c-22.144 22.144-22.143 58.045 0 80.188C30.978 111.166 45.489 116.701 60 116.701s29.021-5.535 40.094-16.607c22.144-22.144 22.144-58.044 0-80.188C89.021 8.833 74.513 3.297 60 3.299" />
                  <path d="m18.184 33.033 14.848-14.848 68.397 68.397-14.848 14.848z" />
                </svg>
                <span>Blacklista</span>
              </button>

              <button
                className="sidebar-item"
                onClick={() => {
                  setShowMobileSidebar(false);
                  setShowSettings(true);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.013 2.25c.734.008 1.465.093 2.182.253a.75.75 0 0 1 .582.649l.17 1.527a1.384 1.384 0 0 0 1.928 1.116l1.4-.615a.75.75 0 0 1 .85.174 9.8 9.8 0 0 1 2.204 3.792.75.75 0 0 1-.271.825l-1.242.916a1.38 1.38 0 0 0 0 2.226l1.243.915a.75.75 0 0 1 .272.826 9.8 9.8 0 0 1-2.203 3.792.75.75 0 0 1-.849.175l-1.406-.617a1.38 1.38 0 0 0-1.927 1.114l-.169 1.526a.75.75 0 0 1-.572.647 9.5 9.5 0 0 1-4.406 0 .75.75 0 0 1-.572-.647l-.168-1.524a1.382 1.382 0 0 0-1.926-1.11l-1.406.616a.75.75 0 0 1-.849-.175 9.8 9.8 0 0 1-2.204-3.796.75.75 0 0 1 .272-.826l1.243-.916a1.38 1.38 0 0 0 0-2.226l-1.243-.914a.75.75 0 0 1-.271-.826 9.8 9.8 0 0 1 2.204-3.792.75.75 0 0 1 .85-.174l1.4.615a1.387 1.387 0 0 0 1.93-1.118l.17-1.526a.75.75 0 0 1 .583-.65c.717-.159 1.45-.243 2.201-.252M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6" />
                </svg>
                <span>Ustawienia</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
