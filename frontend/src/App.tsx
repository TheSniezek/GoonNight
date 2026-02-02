import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/App.scss';
import SearchBar from './components/SearchBar';
import PageButtonsTop from './components/PageButtons/PageButtonsTop';
import PageButtonsBottom from './components/PageButtons/PageButtonsBottom';
import type { Order, Post, PostTag } from './api/types';
import { fetchPostsForMultipleTags } from './api/posts';
import { useSettings } from './logic/useSettings';
import { useObservedTags } from './logic/useObservedTags';
import { usePosts } from './logic/usePosts';
import SettingsModal from './components/SettingsModal';
import NewsModal from './components/NewsModal';
import LoginModal from './components/LoginModal';
import { useFavorites } from './logic/useFavorites';
import { useBlacklist } from './logic/useBlacklist';
import BlacklistModal from './components/BlacklistModal';

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
    searchOnlyObserved,
    setSearchOnlyObserved,
    loopVideos,
    setLoopVideos,
    videoResolution,
    setVideoResolution,
    infiniteScroll,
    setInfiniteScroll,
    gifsAutoplay,
    setGifsAutoplay,
    showHiddenFavCount,
    setShowHiddenFavCount,
  } = useSettings();

  const { observedTags, toggleTag } = useObservedTags();

  const {
    favoritesMode,
    favoritePosts,
    favoritesPage,
    favoritesLoading,
    isLoggedIn,
    toggleFavorites,
    loadFavorites,
    toggleFavoritePost,
    favoriteIds,
    syncFavoriteIdsFromApi,
    searchFavorites,
    favoritesTags,
    favoritesOrder,
    pendingFavorites,
    setFavoritesMode,
  } = useFavorites({
    username: e621User,
    apiKey: e621ApiKey,
  });

  const {
    allPosts,
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
  } = usePosts('', {
    hideFavorites,
    username: e621User,
    postsPerPage,
    pauseLoading: pendingFavorites.size > 0,
  });

  const {
    blacklist,
    loading: blacklistLoading,
    updateBlacklist,
  } = useBlacklist({
    username: e621User,
    apiKey: e621ApiKey,
  });

  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  const [showTagsFor, setShowTagsFor] = useState<number | null>(null);
  const tagsPopupRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const prevMaximizedPostId = useRef<number | null>(null);
  const [showNewsPopup, setShowNewsPopup] = useState(false);
  const [newsPosts, setNewsPosts] = useState<Post[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const scrollBeforeMaximize = useRef<number>(0);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const newsCache = useRef<Record<string, Post[]>>({});
  const infiniteTriggerRef = useRef<HTMLDivElement | null>(null);

  // 🔥 Ref do SearchBar żeby móc modyfikować jego wartość
  const [searchBarValue, setSearchBarValue] = useState('');

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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagsFor, maximizedPostId]);

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

  // 🔥 Synchronizuj searchBarValue z aktualnym stanem
  const currentTags = favoritesMode ? favoritesTags : tags;

  useEffect(() => {
    setSearchBarValue(currentTags);
  }, [currentTags]);

  // 🔥 Funkcje do modyfikacji SearchBar
  const searchTag = async (tag: string) => {
    setSearchBarValue(tag);

    // 🔥 Wyjdź z favorites mode
    if (favoritesMode) {
      setFavoritesMode(false);
    }

    // 🔥 Wyszukaj w normalnym trybie
    await newSearch(tag, { username: e621User, apiKey: e621ApiKey }, { order: order });
  };

  const addTag = (tag: string) => {
    const currentTags = searchBarValue.split(' ').filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newValue = [...currentTags, tag].join(' ');
      setSearchBarValue(newValue);
      // 🔥 NIE wyszukuje automatycznie - tylko dodaje do inputa
    }
  };

  const removeTag = (tag: string) => {
    const currentTags = searchBarValue.split(' ').filter(Boolean);
    const newValue = currentTags.filter((t) => t !== tag).join(' ');
    setSearchBarValue(newValue);
    // 🔥 NIE wyszukuje automatycznie - tylko usuwa z inputa
  };

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
  }, [maximizedPostId, toggleMaximize, showNewsPopup]);

  const handleSearch = async (searchTags: string, newOrder?: Order, clearTags?: boolean) => {
    console.log(
      '🔍 [App.handleSearch] START - tags:',
      searchTags,
      'order:',
      newOrder,
      'clearTags:',
      clearTags,
      'favoritesMode:',
      favoritesMode,
    );

    // 🔥 Jeśli clearTags=true (Hot/Default), wyjdź z favorites mode
    if (clearTags && favoritesMode) {
      console.log('🔄 [App.handleSearch] Exiting favorites mode (clearTags)');
      setFavoritesMode(false);
      // Po wyjściu wykonaj normalne wyszukiwanie
      await newSearch(
        searchTags,
        { username: e621User, apiKey: e621ApiKey },
        { order: newOrder || order, clearTags },
      );
    } else if (favoritesMode) {
      console.log('❤️ [App.handleSearch] Searching in favorites mode');
      // Normalne wyszukiwanie w favorites mode
      await searchFavorites(
        searchTags,
        { username: e621User, apiKey: e621ApiKey },
        { order: newOrder, clearTags },
      );
    } else {
      console.log('📝 [App.handleSearch] Normal search');
      // Normalne wyszukiwanie w zwykłym mode
      await newSearch(
        searchTags,
        { username: e621User, apiKey: e621ApiKey },
        { order: newOrder || order, clearTags },
      );
    }

    console.log('✅ [App.handleSearch] END');
  };

  // Dodaj funkcję filtrującą posty przez blacklist
  const filterByBlacklist = useCallback(
    (posts: Post[]): Post[] => {
      if (!blacklist.trim()) return posts;

      const blacklistLines = blacklist.split('\n').filter((line) => line.trim());

      return posts.filter((post) => {
        // Sprawdź każdą linię blacklisty
        return !blacklistLines.some((line) => {
          const tags = line.trim().toLowerCase().split(/\s+/);

          // Wszystkie tagi z linii muszą być w poście (AND logic)
          return tags.every((blackTag) => {
            return post.tags.some((postTag) => postTag.name.toLowerCase() === blackTag);
          });
        });
      });
    },
    [blacklist],
  );

  const hiddenFavoritesCount = useMemo(() => {
    if (!hideFavorites) return 0;
    return allPosts.filter((p) => favoriteIds.has(p.id)).length;
  }, [allPosts, favoriteIds, hideFavorites]);

  const filteredPosts = useMemo(() => {
    let result = allPosts;

    // 1. Filtruj przez blacklist
    result = filterByBlacklist(result);

    // 2. Filtruj przez hideFavorites
    if (hideFavorites) {
      result = result.filter((p) => !favoriteIds.has(p.id));
    }

    return result;
  }, [allPosts, hideFavorites, favoriteIds, filterByBlacklist]);

  const start = (uiPage - 1) * postsPerPage;
  const end = start + postsPerPage;

  const visiblePosts = useMemo(() => {
    if (favoritesMode) {
      // Filtruj również favorites przez blacklist
      return filterByBlacklist(favoritePosts);
    }

    if (infiniteScroll) {
      return filteredPosts;
    }

    return filteredPosts.slice(start, end);
  }, [favoritesMode, favoritePosts, filteredPosts, start, end, infiniteScroll, filterByBlacklist]);

  // 🔥 Funkcja do nawigacji w zmaksymalizowanym trybie
  const goNextPost = useCallback(() => {
    if (maximizedPostId === null) return;
    const posts = favoritesMode ? favoritePosts : visiblePosts;
    const index = posts.findIndex((p) => p.id === maximizedPostId);
    if (index >= 0 && index < posts.length - 1) {
      toggleMaximize(posts[index + 1].id);
    }
  }, [maximizedPostId, favoritesMode, favoritePosts, visiblePosts, toggleMaximize]);

  const goPrevPost = useCallback(() => {
    if (maximizedPostId === null) return;
    const posts = favoritesMode ? favoritePosts : visiblePosts;
    const index = posts.findIndex((p) => p.id === maximizedPostId);
    if (index > 0) {
      toggleMaximize(posts[index - 1].id);
    }
  }, [maximizedPostId, favoritesMode, favoritePosts, visiblePosts, toggleMaximize]);

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
  }, [
    maximizedPostId,
    favoritesMode,
    favoritePosts,
    visiblePosts,
    goNextPost,
    goPrevPost,
    toggleMaximize,
  ]);

  useEffect(() => {
    if (!infiniteScroll) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && hasNextApiPage) {
          nextUiPage(postsPerPage);
        }
      },
      {
        rootMargin: '300px',
      },
    );

    if (infiniteTriggerRef.current) {
      observer.observe(infiniteTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [infiniteScroll, loading, nextUiPage, postsPerPage]);

  useEffect(() => {
    if (!favoritesMode) return;

    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadFavorites();
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [favoritesMode, loadFavorites]);

  useEffect(() => {
    if (isLoggedIn) {
      syncFavoriteIdsFromApi();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!infiniteScroll && hideFavorites) {
      setHideFavorites(false);
    }
  }, [infiniteScroll]);

  return (
    <div className={`app-container ${fixedHeader ? 'fixed' : ''}`}>
      <div className={`app-header ${fixedHeader ? 'fixed' : ''}`}>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
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
          {showHiddenFavCount && hideFavorites && hiddenFavoritesCount > 0 && (
            <div className="hidden-fav-count-container">
              <div className="hidden-fav-count-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 96 96"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M82.24 22.244a5.999 5.999 0 1 0-8.484-8.484l-4.301 4.301A41.15 41.15 0 0 0 48 12.002c-22.159 0-35.681 15.702-46.99 32.67a5.98 5.98 0 0 0 0 6.656 110.7 110.7 0 0 0 15.811 19.367l-3.061 3.061a5.999 5.999 0 1 0 8.484 8.484ZM13.268 48C25.326 30.792 35.274 24.002 48 24.002a29.35 29.35 0 0 1 12.672 2.843l-9.593 9.592A11.2 11.2 0 0 0 48 36.001 12.01 12.01 0 0 0 36 48a11.2 11.2 0 0 0 .437 3.079L25.301 62.215A88 88 0 0 1 13.268 48m81.722-3.328a154 154 0 0 0-7.672-10.553l-8.546 8.546A128 128 0 0 1 82.732 48C71.176 64.492 61.531 71.342 49.548 71.89L38.57 82.866A42.6 42.6 0 0 0 48 83.998c22.159 0 35.681-15.702 46.99-32.67a5.98 5.98 0 0 0 0-6.656" />
                </svg>
              </div>
              <div className="hidden-fav-count-textbox">
                <span className="hidden-fav-count-label">Hidden posts</span>
                <span className="hidden-fav-count">{hiddenFavoritesCount}</span>
              </div>
            </div>
          )}
          <SearchBar
            onSearch={handleSearch}
            initialTags={searchBarValue}
            order={favoritesMode ? favoritesOrder : order}
            setOrder={(newOrder) => {
              if (favoritesMode) {
                searchFavorites(
                  favoritesTags,
                  { username: e621User, apiKey: e621ApiKey },
                  { order: newOrder },
                );
              } else {
                setOrder(newOrder);
              }
            }}
            favoritesMode={favoritesMode} // 🔥 NOWY
            onExitFavorites={() => {
              // 🔥 NOWY
              setFavoritesMode(false);
              setSearchBarValue(tags);
            }}
          />

          {!infiniteScroll && (
            <PageButtonsTop
              page={favoritesMode ? favoritesPage : uiPage}
              loading={favoritesMode ? favoritesLoading : loading}
              onPrev={() => (favoritesMode ? loadFavorites(favoritesPage - 1) : prevUiPage())}
              onNext={() =>
                favoritesMode
                  ? loadFavorites(favoritesPage + 1)
                  : nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey })
              }
              disableNext={
                favoritesMode ? false : !hasNextApiPage && uiPage * postsPerPage >= allPosts.length
              }
            />
          )}
        </div>
        <div className="top-bar-right">
          <button
            className="blacklist-btn"
            onClick={() => setShowBlacklistModal(true)}
            disabled={!isLoggedIn}
            title={!isLoggedIn ? 'Login required' : 'Blacklist'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2M4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.9 7.9 0 0 1 4 12m8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.9 7.9 0 0 1 20 12c0 4.42-3.58 8-8 8" />
            </svg>
          </button>

          <button
            className={`fav-btn ${favoritesMode ? 'active' : ''}`}
            onClick={async () => {
              console.log('🔘 [FavButton] Clicked - current favoritesMode:', favoritesMode);
              if (!isLoggedIn) {
                console.log('⛔ [FavButton] Not logged in');
                return;
              }

              const wasInFavoritesMode = favoritesMode;

              if (!wasInFavoritesMode) {
                console.log('📥 [FavButton] Entering favorites - clearing searchBar');
                setSearchBarValue('');
              } else {
                console.log('📤 [FavButton] Exiting favorites - restoring tags:', tags);
                setSearchBarValue(tags);
              }

              await toggleFavorites();
              console.log(
                '✅ [FavButton] Toggle complete - new favoritesMode should be:',
                !wasInFavoritesMode,
              );
            }}
            disabled={!isLoggedIn}
            title={!isLoggedIn ? 'Login required' : 'Favorites'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
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
          <button
            className="news-btn"
            onClick={async () => {
              if (observedTags.length === 0) return alert('No tags observed yet!');

              const key = observedTags.sort().join(',');
              if (newsCache.current[key]) {
                setNewsPosts(newsCache.current[key]);
                setShowNewsPopup(true);
                return;
              }

              setShowNewsPopup(true);

              try {
                const allPosts = await fetchPostsForMultipleTags(observedTags, 'date:week');

                newsCache.current[key] = allPosts;
                setNewsPosts(allPosts);

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
          const isLCP = index === 0 && uiPage === 1 && !favoritesMode;
          const url = post.file.url || post.file.sample_url;
          if (!url) return null;

          const isVideo = post.file.ext === 'webm' || post.file.ext === 'mp4';
          const isGif = post.file.ext === 'gif';
          const isMaximized = maximizedPostId === post.id;
          const videoUrl = videoResolution === 'best' ? post.file.url : post.sample.url;
          const shouldUseFull = isMaximized || (gifsAutoplay && isGif);

          const postContent = (
            <div
              key={`${post.id}-fav`}
              id={`post-${post.id}`}
              className={`post-wrapper ${isMaximized ? 'maximized' : ''}`}
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
                className={`tags-btn ${isMaximized ? 'tags-btn-max' : ''}`}
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
                className={`fav-post-btn ${favoriteIds.has(post.id) ? 'is-favorite' : ''} ${
                  isMaximized ? 'fav-post-btn-max' : ''
                }`}
                onClick={async () => {
                  const wasNotFavorite = !favoriteIds.has(post.id);
                  await toggleFavoritePost(post.id);

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
                ) : (
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
                  onDoubleClick={() => toggleMaximize(post.id)}
                />
              )}
              {isMaximized && (
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
              {maximizedPostId !== null && (
                <div
                  className="maximized-overlay"
                  onClick={() => toggleMaximize(maximizedPostId)}
                />
              )}
            </div>
          );

          return postContent;
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
            searchOnlyObserved={searchOnlyObserved}
            setSearchOnlyObserved={setSearchOnlyObserved}
            loopVideos={loopVideos}
            setLoopVideos={setLoopVideos}
            videoResolution={videoResolution}
            setVideoResolution={setVideoResolution}
            infiniteScroll={infiniteScroll}
            setInfiniteScroll={setInfiniteScroll}
            gifsAutoplay={gifsAutoplay}
            setGifsAutoplay={setGifsAutoplay}
            showHiddenFavCount={showHiddenFavCount}
            setShowHiddenFavCount={setShowHiddenFavCount}
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
          />
        )}

        {showBlacklistModal && (
          <BlacklistModal
            onClose={() => setShowBlacklistModal(false)}
            blacklist={blacklist}
            onSave={updateBlacklist}
            loading={blacklistLoading}
          />
        )}
      </div>

      {!infiniteScroll && (
        <PageButtonsBottom
          page={favoritesMode ? favoritesPage : uiPage}
          loading={favoritesMode ? favoritesLoading : loading}
          onPrev={() => (favoritesMode ? loadFavorites(favoritesPage - 1) : prevUiPage())}
          onNext={() =>
            favoritesMode
              ? loadFavorites(favoritesPage + 1)
              : nextUiPage(postsPerPage, { username: e621User, apiKey: e621ApiKey })
          }
          disableNext={
            favoritesMode ? false : !hasNextApiPage && uiPage * postsPerPage >= allPosts.length
          }
        />
      )}

      {(loading || favoritesLoading) && (
        <p style={{ marginTop: 10 }}>
          {favoritesMode ? 'Loading favorites...' : 'Loading posts...'}
        </p>
      )}
      {infiniteScroll && <div ref={infiniteTriggerRef} style={{ height: 1 }} />}
    </div>
  );
}

export default App;
