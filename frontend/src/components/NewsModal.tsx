import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Post, PostTag } from '../api/types';
import { fetchPostsForMultipleTags } from '../api/posts'; // 🔹 import fetch
import '../styles/NewsModal.scss';

interface NewsModalProps {
  posts: Post[];
  setNewsPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  observedTags: string[];
  postColumns: number;
  layout: 'masonry' | 'grid' | 'accurate-grid';
  onClose: () => void;
  loading: boolean;
  onToggleTag: (tag: string) => void;
  onSearchTag: (tag: string) => void;
  defaultVolume: number;
  // Nowe propsy dla favorites
  toggleFavoritePost: (postId: number, currentIsFavorited: boolean) => Promise<void>;
  pendingFavorites: Set<number>;
  isLoggedIn: boolean;
  // Nowe propsy dla tagów
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  searchTag: (tag: string) => void;
  // 🔥 DODANE - auth do fetchowania z is_favorited
  username: string;
  apiKey: string;
}

const NEWS_WIDTH_KEY = 'newsSidebarWidth';

const NewsModal = ({
  posts,
  setNewsPosts,
  observedTags,
  postColumns,
  layout,
  onClose,
  loading,
  onToggleTag,
  onSearchTag,
  defaultVolume,
  toggleFavoritePost,
  pendingFavorites,
  isLoggedIn,
  addTag,
  removeTag,
  searchTag,
  username,
  apiKey,
}: NewsModalProps) => {
  // -------------------- STATE --------------------
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(NEWS_WIDTH_KEY);
    return saved ? Number(saved) : 400;
  });
  const [reloadCountdown, setReloadCountdown] = useState(() => {
    const lastReload = Number(localStorage.getItem('newsLastReload')) || Date.now();
    const diff = Math.max(0, 3600 - Math.floor((Date.now() - lastReload) / 1000));
    return diff;
  });
  const [showObservedTags, setShowObservedTags] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [maximizedPost, setMaximizedPost] = useState<Post | null>(null);
  const [showTagsFor, setShowTagsFor] = useState<number | null>(null);

  // -------------------- REFS --------------------
  const isResizing = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(width);
  const rafRef = useRef<number | null>(null);
  const maximizedVideoRef = useRef<HTMLVideoElement | null>(null);
  const tagsPopupRef = useRef<HTMLDivElement | null>(null);

  // -------------------- FUNCTIONS --------------------
  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true;
    sidebarRef.current?.classList.add('resizing');
    e.preventDefault();
  };

  const handleReload = async () => {
    if (!observedTags.length || isReloading) return;
    try {
      setIsReloading(true);
      // 🔥 DODANE - przekaż auth do fetchPostsForMultipleTags
      const auth = username && apiKey ? { username, apiKey } : undefined;
      const allPosts = await fetchPostsForMultipleTags(observedTags, 'date:week', auth);
      setNewsPosts(allPosts);
      localStorage.setItem('newsLastReload', Date.now().toString());
      setReloadCountdown(3600);
    } catch (err) {
      console.error('Failed to reload news posts', err);
    } finally {
      setIsReloading(false);
    }
  };

  const groupPostsByDay = (posts: Post[]) => {
    const groups: Record<string, Post[]> = {};
    posts.forEach((post) => {
      const date = (post.created_at as string).split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(post);
    });
    return groups;
  };

  // -------------------- USE EFFECTS --------------------
  // Resizing sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !sidebarRef.current) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth < 200 || newWidth > window.innerWidth - 100) return;

      widthRef.current = newWidth;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (sidebarRef.current) {
            sidebarRef.current.style.width = `${widthRef.current}px`;
          }
          rafRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      sidebarRef.current?.classList.remove('resizing');
      setWidth(widthRef.current); // ✅ tylko raz
      localStorage.setItem(NEWS_WIDTH_KEY, String(widthRef.current));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      e.stopImmediatePropagation();

      if (maximizedPost) {
        setMaximizedPost(null);
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [maximizedPost, onClose]);

  // Click outside handler for tags popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showTagsFor !== null) {
        const popup = tagsPopupRef.current;
        const button = document
          .getElementById(`news-post-${showTagsFor}`)
          ?.querySelector('.news-tags-btn');

        if (popup && !popup.contains(target) && button && !button.contains(target)) {
          setShowTagsFor(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagsFor]);

  // Countdown timer for auto reload
  useEffect(() => {
    // 🔥 ZMIANA - countdown działa tylko gdy modal jest otwarty
    countdownRef.current = window.setInterval(() => {
      setReloadCountdown((prev) => {
        if (prev <= 1) {
          // Auto reload tylko gdy countdown dojdzie do 0
          handleReload();
          return 3600; // reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [observedTags]); // 🔥 zależność od observedTags - gdy się zmienią, restart timera

  // Live update volume
  useEffect(() => {
    if (maximizedVideoRef.current) {
      maximizedVideoRef.current.volume = defaultVolume;
    }
  }, [defaultVolume]);

  // Blocking scrolling for normal window
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // -------------------- RENDER --------------------
  const postsToRender = posts;
  const postsByDay = groupPostsByDay(postsToRender);
  const sortedDates = Object.keys(postsByDay).sort((a, b) => (a < b ? 1 : -1));

  return createPortal(
    <div
      className="news-overlay"
      onClick={() => {
        if (maximizedPost) return;
        onClose();
      }}
    >
      <div
        className="news-sidebar"
        ref={sidebarRef}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="resize-handle" onMouseDown={startResize} />

        <div className="news-top-bar">
          <button className="news-close-btn" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            onClick={handleReload}
            className={`news-reload-btn ${isReloading ? 'spinning' : ''}`}
            data-countdown={`${Math.floor(reloadCountdown / 60)}:${String(
              reloadCountdown % 60,
            ).padStart(2, '0')}`}
            aria-label="Reload"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="reload-btn-icon"
            >
              <path d="M0 12q0-2.088 0.816-3.984t2.184-3.288 3.288-2.184 4.008-0.816q2.088 0 3.984 0.816t3.288 2.184 2.184 3.288 0.816 3.984h1.728q0.552 0 0.96 0.312t0.6 0.768 0.12 0.96-0.48 0.888l-3.432 3.432q-0.504 0.504-1.2 0.504t-1.224-0.504l-3.432-3.432q-0.384-0.384-0.456-0.888t0.096-0.96 0.6-0.768 0.984-0.312h1.704q0-1.848-0.912-3.432t-2.496-2.496-3.432-0.912-3.456 0.912-2.496 2.496-0.912 3.432 0.912 3.456 2.496 2.496 3.456 0.912q1.296 0 2.52-0.48l2.568 2.544q-2.352 1.368-5.088 1.368-2.112 0-4.008-0.816t-3.288-2.184-2.184-3.288-0.816-4.008z" />
            </svg>
          </button>

          <button
            className={`observed-tags-btn ${showObservedTags ? 'active' : ''}`}
            onClick={() => setShowObservedTags((prev) => !prev)}
            aria-label="Observed tags"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
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
          <h2>Notifications from last week</h2>
        </div>

        {showObservedTags && (
          <div className="observed-tags-panel">
            {observedTags.length === 0 ? (
              <span>None</span>
            ) : (
              observedTags.map((tag) => (
                <span key={tag} className="observed-tag-pill">
                  <button
                    className="observed-tag-remove"
                    onClick={() => onToggleTag(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <span
                    className="observed-tag-name"
                    onClick={() => {
                      onSearchTag(tag);
                      onClose();
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {tag}
                  </span>
                </span>
              ))
            )}
          </div>
        )}

        <div className="news-content">
          {loading ? (
            <p>Loading posts...</p>
          ) : postsToRender.length === 0 ? (
            <p>No posts found.</p>
          ) : (
            sortedDates.map((date) => (
              <div key={date} className="news-day-group">
                <div className="date-display-line">
                  <span className="date-display">{date}</span>
                </div>
                <div
                  className={`news-posts-grid ${layout}`}
                  style={{ '--columns': postColumns } as React.CSSProperties}
                >
                  {postsByDay[date].map((post) => {
                    const url = post.file.url || post.file.sample_url;
                    if (!url) return null;
                    const isVideo = post.file.ext === 'webm' || post.file.ext === 'mp4';
                    const isGif = post.file.ext === 'gif';
                    const isMaximized = maximizedPost?.id === post.id;

                    return (
                      <div
                        key={post.id}
                        id={`news-post-${post.id}`}
                        className={`news-post-wrapper ${isMaximized ? 'maximized' : ''}`}
                      >
                        {/* Przyciski - tags i favorites */}
                        <button
                          className="news-tags-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTagsFor((prev) => (prev === post.id ? null : post.id));
                          }}
                        >
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
                        </button>

                        <button
                          className={`news-fav-btn ${post.is_favorited ? 'is-favorite' : ''}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await toggleFavoritePost(post.id, post.is_favorited || false);
                          }}
                          title={!isLoggedIn ? 'Login required' : 'Add/Remove Favorite'}
                          disabled={!isLoggedIn || pendingFavorites.has(post.id)}
                        >
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
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>

                        {/* Tags popup */}
                        {showTagsFor === post.id && (
                          <div className="news-tags-popup" ref={tagsPopupRef}>
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
                                  <div key={tag.name} className="news-tag-item">
                                    <button
                                      className={`news-tag-observe ${
                                        observedTags.includes(tag.name) ? 'active' : ''
                                      }`}
                                      onClick={() => {
                                        onToggleTag(tag.name);
                                      }}
                                      title="Toggle observe"
                                    >
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
                                        <path
                                          fillRule="evenodd"
                                          clipRule="evenodd"
                                          d="M12 6.00019C10.2006 3.90317 7.19377 3.2551 4.93923 5.17534C2.68468 7.09558 2.36727 10.3061 4.13778 12.5772C5.60984 14.4654 10.0648 18.4479 11.5249 19.7369C11.6882 19.8811 11.7699 19.9532 11.8652 19.9815C11.9483 20.0062 12.0393 20.0062 12.1225 19.9815C12.2178 19.9532 12.2994 19.8811 12.4628 19.7369C13.9229 18.4479 18.3778 14.4654 19.8499 12.5772C21.6204 10.3061 21.3417 7.07538 19.0484 5.17534C16.7551 3.2753 13.7994 3.90317 12 6.00019Z"
                                        />
                                      </svg>
                                    </button>

                                    <button
                                      className="news-tag-add"
                                      onClick={() => addTag(tag.name)}
                                    >
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

                                    <button
                                      className="news-tag-remove"
                                      onClick={() => removeTag(tag.name)}
                                    >
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
                                      className="news-tag-name"
                                      style={{ color }}
                                      onClick={() => {
                                        searchTag(tag.name);
                                        onClose();
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="news-tag-item">No tags</div>
                            )}
                          </div>
                        )}

                        {/* Media content */}
                        {isGif ? (
                          <div className="news-video-thumb" onClick={() => setMaximizedPost(post)}>
                            <img
                              src={post.preview.url || post.sample.url}
                              alt=""
                              className="news-post-item"
                              loading="lazy"
                            />
                            <div className="news-video-overlay gif">
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
                        ) : isVideo ? (
                          <div className="news-video-thumb" onClick={() => setMaximizedPost(post)}>
                            <img
                              src={post.preview.url || post.sample.url}
                              alt=""
                              className="news-post-item"
                              loading="lazy"
                            />
                            <div className="news-video-overlay">
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
                          <img
                            className="news-post-item"
                            src={post.preview.url || post.sample.url || post.file.url}
                            alt=""
                            onClick={() => setMaximizedPost(post)}
                            loading="lazy"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {maximizedPost &&
        createPortal(
          <div className="news-maximized-overlay" onClick={() => setMaximizedPost(null)}>
            {maximizedPost.file.ext === 'gif' ? (
              <img
                className="news-maximized-item"
                src={maximizedPost.file.url || maximizedPost.file.sample_url}
              />
            ) : ['webm', 'mp4'].includes(maximizedPost.file.ext as string) ? (
              <video
                src={maximizedPost.file.url || maximizedPost.file.sample_url}
                controls
                autoPlay
                className="news-maximized-item"
                ref={(el) => {
                  if (el) {
                    maximizedVideoRef.current = el;
                    el.volume = defaultVolume;
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={maximizedPost.file.url || maximizedPost.file.sample_url}
                className="news-maximized-item"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>,
          document.body,
        )}
    </div>,
    document.body,
  );
};

export default NewsModal;
