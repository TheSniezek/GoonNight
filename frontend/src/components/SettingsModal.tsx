import { createPortal } from 'react-dom';
import { useObservedTags } from '../logic/useObservedTags';
import type { StoredSettings } from '../logic/useSettings';
import '../styles/SettingsModal.scss';
import { useEffect, useState } from 'react';

interface SettingsModalProps {
  onClose: () => void;
  defaultVolume: number;
  setDefaultVolume: (v: number) => void;
  autoPlayOnMaximize: boolean;
  setAutoPlayOnMaximize: (v: boolean) => void;
  autoPauseOnMinimize: boolean;
  setAutoPauseOnMinimize: (v: boolean) => void;
  pauseVideoOutOfFocus: boolean;
  setPauseVideoOutOfFocus: (v: boolean) => void;
  layout: 'masonry' | 'grid' | 'accurate-grid';
  setLayout: (l: 'masonry' | 'grid' | 'accurate-grid') => void;
  postColumns: number;
  setPostColumns: (n: number) => void;
  newsLayout: 'masonry' | 'grid' | 'accurate-grid';
  setNewsLayout: (l: 'masonry' | 'grid' | 'accurate-grid') => void;
  newsPostColumns: number;
  setNewsPostColumns: (n: number) => void;
  fixedHeader: boolean;
  setFixedHeader: (v: boolean) => void;
  postsPerPage: number;
  setPostsPerPage: (n: number) => void;
  hideFavorites: boolean;
  setHideFavorites: (v: boolean) => void;
  loopVideos: boolean;
  setLoopVideos: (v: boolean) => void;
  videoResolution: 'best' | 'worse';
  setVideoResolution: (l: 'best' | 'worse') => void;
  infiniteScroll: boolean;
  setInfiniteScroll: (v: boolean) => void;
  gifsAutoplay: boolean;
  setGifsAutoplay: (v: boolean) => void;
  showHiddenFavCount: boolean;
  setShowHiddenFavCount: (v: boolean) => void;
  sexSearch: {
    female: boolean;
    male: boolean;
    intersex: boolean;
    ambiguous: boolean;
  };
  setSexSearch: (v: SettingsModalProps['sexSearch']) => void;
}

export default function SettingsModal({
  onClose,
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
  showHiddenFavCount,
  setShowHiddenFavCount,
  sexSearch,
  setSexSearch,
}: SettingsModalProps) {
  const {
    observedTags,
    setObservedTags: originalSetObservedTags,
    saveObservedTags,
  } = useObservedTags();

  const [exportFilename, setExportFilename] = useState('goonnight_data');

  const setObservedTags = (tags: string[]) => {
    originalSetObservedTags(tags);
    saveObservedTags(tags);
  };

  const exportSettings = (settings: Partial<StoredSettings>, observedTags: string[]) => {
    const data = {
      settings,
      observedTags: [...observedTags].sort((a, b) => a.localeCompare(b)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    // Użyj custom filename lub fallback na domyślny
    let filename = exportFilename.trim() || 'goonnight_data';

    // Dodaj .json jeśli nie ma
    if (!filename.endsWith('.json')) {
      filename += '.json';
    }

    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (
    file: File,
    applySettings: (newSettings: Partial<StoredSettings>) => void,
    applyObservedTags: (tags: string[]) => void,
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as {
          settings?: Partial<StoredSettings>;
          observedTags?: string[];
        };
        if (data.settings) applySettings(data.settings);
        if (data.observedTags) applyObservedTags(data.observedTags);
        alert('Settings imported successfully!');
      } catch {
        alert('Failed to import settings. Invalid file.');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-top-bar">
          <button className="settings-close" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
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
          <span className="settings-tittle">Settings</span>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <span className="settings-section-tittle">General</span>
            <div className="settings-section-content">
              <label className="settings-row">
                <span className="settings-names">Layout</span>
                <div className="layout-toggle">
                  <button
                    className={`right-settings-btn button ${layout === 'masonry' ? 'active' : ''}`}
                    onClick={() => setLayout('masonry')}
                  >
                    Masonry
                  </button>
                  <button
                    className={`middle-settings-btn button ${layout === 'grid' ? 'active' : ''}`}
                    onClick={() => setLayout('grid')}
                  >
                    Grid
                  </button>
                  <button
                    className={`left-settings-btn button ${
                      layout === 'accurate-grid' ? 'active' : ''
                    }`}
                    onClick={() => setLayout('accurate-grid')}
                  >
                    Accurate Grid
                  </button>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Number of columns</span>
                <div className="input-slider">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={postColumns}
                    style={
                      { '--value': `${((postColumns - 1) / 9) * 100}%` } as React.CSSProperties
                    }
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(10, Number(e.target.value)));
                      setPostColumns(val);
                    }}
                  />
                  <span className="input-slider-number">{postColumns}</span>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Posts per page</span>
                <div className="input-slider">
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={10}
                    value={postsPerPage}
                    style={
                      {
                        '--value': `${((postsPerPage - 10) / 50) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) => {
                      const val = Math.max(10, Math.min(320, Number(e.target.value)));
                      setPostsPerPage(val);
                    }}
                  />
                  <span className="input-slider-number">{postsPerPage}</span>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Infinite scroll</span>
                <input
                  type="checkbox"
                  checked={infiniteScroll}
                  onChange={(e) => setInfiniteScroll(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Fixed header</span>
                <input
                  type="checkbox"
                  checked={fixedHeader}
                  onChange={(e) => setFixedHeader(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Hide favorites</span>
                <input
                  type="checkbox"
                  checked={hideFavorites}
                  onChange={(e) => setHideFavorites(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Show hidden favorites count</span>
                <input
                  type="checkbox"
                  checked={showHiddenFavCount}
                  onChange={(e) => setShowHiddenFavCount(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <span className="settings-section-tittle">Search</span>
            <div className="settings-section-content">
              <label className="settings-row">
                <span className="settings-names">Gender</span>
                <div className="sex-search-grid">
                  <button
                    className={`sex-search-btn ${sexSearch.female ? 'active' : ''} top-left`}
                    onClick={() =>
                      setSexSearch({
                        ...sexSearch,
                        female: !sexSearch.female,
                      })
                    }
                  >
                    <span>Female</span>
                  </button>

                  <button
                    className={`sex-search-btn ${sexSearch.male ? 'active' : ''} top-right`}
                    onClick={() =>
                      setSexSearch({
                        ...sexSearch,
                        male: !sexSearch.male,
                      })
                    }
                  >
                    <span>Male</span>
                  </button>

                  <button
                    className={`sex-search-btn ${sexSearch.intersex ? 'active' : ''} bottom-left`}
                    onClick={() =>
                      setSexSearch({
                        ...sexSearch,
                        intersex: !sexSearch.intersex,
                      })
                    }
                  >
                    <span>Intersex</span>
                  </button>

                  <button
                    className={`sex-search-btn ${sexSearch.ambiguous ? 'active' : ''} bottom-right`}
                    onClick={() =>
                      setSexSearch({
                        ...sexSearch,
                        ambiguous: !sexSearch.ambiguous,
                      })
                    }
                  >
                    <span>Ambiguous</span>
                  </button>
                </div>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <span className="settings-section-tittle">Video & Media</span>
            <div className="settings-section-content">
              <label className="settings-row">
                <span className="settings-names">Default volume</span>
                <div className="input-slider">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={defaultVolume}
                    style={{ '--value': `${defaultVolume * 100}%` } as React.CSSProperties}
                    onChange={(e) => setDefaultVolume(Number(e.target.value))}
                  />
                  <span className="input-slider-number">{Math.round(defaultVolume * 100)}%</span>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Video resolution</span>
                <div className="layout-toggle">
                  <button
                    className={`right-settings-btn button ${
                      videoResolution === 'best' ? 'active' : ''
                    }`}
                    onClick={() => setVideoResolution('best')}
                  >
                    Best
                  </button>
                  <button
                    className={`left-settings-btn button ${
                      videoResolution === 'worse' ? 'active' : ''
                    }`}
                    onClick={() => setVideoResolution('worse')}
                  >
                    Worse then the best
                  </button>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Loop videos</span>
                <input
                  type="checkbox"
                  checked={loopVideos}
                  onChange={(e) => setLoopVideos(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Auto-play on maximize</span>
                <input
                  type="checkbox"
                  checked={autoPlayOnMaximize}
                  onChange={(e) => setAutoPlayOnMaximize(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Auto-pause on minimize</span>
                <input
                  type="checkbox"
                  checked={autoPauseOnMinimize}
                  onChange={(e) => setAutoPauseOnMinimize(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">Pause video out of focus</span>
                <input
                  type="checkbox"
                  checked={pauseVideoOutOfFocus}
                  onChange={(e) => setPauseVideoOutOfFocus(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>

              <label className="settings-row">
                <span className="settings-names">GIFs autoplay</span>
                <input
                  type="checkbox"
                  checked={gifsAutoplay}
                  onChange={(e) => setGifsAutoplay(e.target.checked)}
                />
                <span className="checkmark"></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <span className="settings-section-tittle">Notification Popup</span>
            <div className="settings-section-content">
              <label className="settings-row">
                <span className="settings-names">Layout</span>
                <div className="layout-toggle">
                  <button
                    className={`right-settings-btn button ${
                      newsLayout === 'masonry' ? 'active' : ''
                    }`}
                    onClick={() => setNewsLayout('masonry')}
                  >
                    Masonry
                  </button>
                  <button
                    className={`middle-settings-btn button ${
                      newsLayout === 'grid' ? 'active' : ''
                    }`}
                    onClick={() => setNewsLayout('grid')}
                  >
                    Grid
                  </button>
                  <button
                    className={`left-settings-btn button ${
                      newsLayout === 'accurate-grid' ? 'active' : ''
                    }`}
                    onClick={() => setNewsLayout('accurate-grid')}
                  >
                    Accurate Grid
                  </button>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-names">Number of columns</span>
                <div className="input-slider">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={newsPostColumns}
                    style={
                      {
                        '--value': `${((newsPostColumns - 1) / 9) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(10, Number(e.target.value)));
                      setNewsPostColumns(val);
                    }}
                  />
                  <span className="input-slider-number">{newsPostColumns}</span>
                </div>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <span className="settings-section-tittle">Data</span>
            <div className="settings-section-content">
              <label className="settings-row">
                <span className="settings-names">Export filename</span>
                <input
                  type="text"
                  className="filename-input"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  placeholder="goonnight_data"
                />
              </label>

              <div className="settings-row importexport">
                <label className="settings-btn settings-names">
                  <span>Import Data</span>
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M14 9a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a1 1 0 0 1 2 0v3h10v-3a1 1 0 0 1 1-1M8 1a1 1 0 0 1 1 1v4.586l1.293-1.293a1 1 0 1 1 1.414 1.414L8 10.414 4.293 6.707a1 1 0 0 1 1.414-1.414L7 6.586V2a1 1 0 0 1 1-1" />
                  </svg>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        importSettings(
                          e.target.files[0],
                          (newSettings) => {
                            if (newSettings.defaultVolume !== undefined)
                              setDefaultVolume(newSettings.defaultVolume);
                            if (newSettings.autoPlayOnMaximize !== undefined)
                              setAutoPlayOnMaximize(newSettings.autoPlayOnMaximize);
                            if (newSettings.autoPauseOnMinimize !== undefined)
                              setAutoPauseOnMinimize(newSettings.autoPauseOnMinimize);
                            if (newSettings.pauseVideoOutOfFocus !== undefined)
                              setPauseVideoOutOfFocus(newSettings.pauseVideoOutOfFocus);
                            if (newSettings.layout) setLayout(newSettings.layout);
                            if (newSettings.postColumns) setPostColumns(newSettings.postColumns);
                            if (newSettings.newsLayout) setNewsLayout(newSettings.newsLayout);
                            if (newSettings.newsPostColumns)
                              setNewsPostColumns(newSettings.newsPostColumns);
                            if (newSettings.fixedHeader !== undefined)
                              setFixedHeader(newSettings.fixedHeader);
                            if (newSettings.postsPerPage) setPostsPerPage(newSettings.postsPerPage);
                            if (newSettings.hideFavorites !== undefined)
                              setHideFavorites(newSettings.hideFavorites);
                            if (newSettings.loopVideos !== undefined)
                              setLoopVideos(newSettings.loopVideos);
                            if (newSettings.videoResolution)
                              setVideoResolution(newSettings.videoResolution);
                            if (newSettings.sexSearch) setSexSearch(newSettings.sexSearch);
                          },
                          (tags) => {
                            setObservedTags(tags);
                          },
                        );
                        window.location.reload();
                      }
                    }}
                  />
                </label>

                <button
                  className="settings-btn settings-names"
                  onClick={() =>
                    exportSettings(
                      {
                        defaultVolume,
                        autoPlayOnMaximize,
                        autoPauseOnMinimize,
                        pauseVideoOutOfFocus,
                        layout,
                        postColumns,
                        newsLayout,
                        newsPostColumns,
                        fixedHeader,
                        postsPerPage,
                        hideFavorites,
                        loopVideos,
                        videoResolution,
                        sexSearch,
                      },
                      observedTags,
                    )
                  }
                >
                  <span>Export Data</span>
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 16 16"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                  >
                    <path d="M14 9.004a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a1 1 0 0 1 2 0v3h10v-3a1 1 0 0 1 1-1M8 1.59l3.707 3.707a1 1 0 0 1-1.414 1.414L9 5.418v4.586a1 1 0 1 1-2 0V5.418L5.707 6.711a1 1 0 0 1-1.414-1.414z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
