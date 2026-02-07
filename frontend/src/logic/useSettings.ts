// useSettings z poprzedniego pliku - już jest OK
import { useState, useRef, useCallback } from 'react';

const SETTINGS_KEY = 'e621_viewer_settings';
const SETTINGS_VERSION = 2;
const DEBOUNCE_MS = 500;

export type Layout = 'masonry' | 'grid' | 'accurate-grid';
export type VideoResolution = 'best' | 'worse';

export interface StoredSettings {
  version: number;
  defaultVolume: number;
  autoPlayOnMaximize: boolean;
  autoPauseOnMinimize: boolean;
  loopVideos: boolean;
  videoResolution: VideoResolution;
  gifsAutoplay: boolean;
  layout: Layout;
  postColumns: number;
  newsLayout: Layout;
  newsPostColumns: number;
  fixedHeader: boolean;
  postsPerPage: number;
  hideFavorites: boolean;
  showHiddenFavCount: boolean;
  infiniteScroll: boolean;
}

const getDefaults = (): StoredSettings => ({
  version: SETTINGS_VERSION,
  defaultVolume: 1,
  autoPlayOnMaximize: true,
  autoPauseOnMinimize: true,
  loopVideos: false,
  videoResolution: 'best',
  gifsAutoplay: false,
  layout: 'grid',
  postColumns: 3,
  newsLayout: 'masonry',
  newsPostColumns: 3,
  fixedHeader: true,
  postsPerPage: 50,
  hideFavorites: false,
  showHiddenFavCount: false,
  infiniteScroll: false,
});

type SettingValidator = (value: unknown) => boolean;

const validators: Partial<Record<keyof StoredSettings, SettingValidator>> = {
  defaultVolume: (v): v is number => typeof v === 'number' && v >= 0 && v <= 1,
  postColumns: (v): v is number => typeof v === 'number' && v >= 1 && v <= 10,
  newsPostColumns: (v): v is number => typeof v === 'number' && v >= 1 && v <= 10,
  postsPerPage: (v): v is number => typeof v === 'number' && v >= 10 && v <= 320,
  layout: (v): v is Layout => ['masonry', 'grid', 'accurate-grid'].includes(v as string),
  newsLayout: (v): v is Layout => ['masonry', 'grid', 'accurate-grid'].includes(v as string),
  videoResolution: (v): v is VideoResolution => ['best', 'worse'].includes(v as string),
};

function validateSetting<K extends keyof StoredSettings>(
  key: K,
  value: unknown,
  defaults: StoredSettings,
): StoredSettings[K] {
  const validator = validators[key];
  if (validator && !validator(value)) {
    console.warn(`⚠️ Invalid ${key}: ${value}, using default`);
    return defaults[key];
  }
  return value as StoredSettings[K];
}

function migrateSettings(stored: Partial<StoredSettings>): StoredSettings {
  const defaults = getDefaults();
  if (!stored.version) {
    return { ...defaults, ...stored, version: SETTINGS_VERSION };
  }
  if (stored.version === SETTINGS_VERSION) {
    return { ...defaults, ...stored };
  }
  return { ...defaults, ...stored, version: SETTINGS_VERSION };
}

export const loadSettings = (): StoredSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaults();
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    const migrated = migrateSettings(parsed);
    const defaults = getDefaults();
    const validated = { ...defaults };
    const validatedMutable = validated as Record<string, unknown>;
    for (const key in migrated) {
      const k = key as keyof StoredSettings;
      validatedMutable[k] = validateSetting(k, migrated[k], defaults);
    }
    return validated;
  } catch (err) {
    console.error('❌ Failed to load settings:', err);
    return getDefaults();
  }
};

const saveToStorage = (settings: StoredSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('❌ Failed to save settings:', err);
  }
};

export function useSettings() {
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback((newSettings: StoredSettings) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(newSettings);
      saveTimeoutRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) => {
      setSettings((prev) => {
        const validatedVal = validateSetting(key, value, getDefaults());
        const updated = { ...prev, [key]: validatedVal };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave],
  );

  const updateSettings = useCallback(
    (partial: Partial<StoredSettings>) => {
      setSettings((prev) => {
        const defaults = getDefaults();
        const validatedChanges: Record<string, unknown> = {};
        for (const key in partial) {
          const k = key as keyof StoredSettings;
          if (partial[k] !== undefined) {
            validatedChanges[k] = validateSetting(k, partial[k], defaults);
          }
        }
        const updated = { ...prev, ...validatedChanges } as StoredSettings;
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave],
  );

  const reset = useCallback(() => {
    const defaults = getDefaults();
    setSettings(defaults);
    saveToStorage(defaults);
  }, []);

  return {
    settings,
    defaultVolume: settings.defaultVolume,
    setDefaultVolume: (v: number) => updateSetting('defaultVolume', v),
    autoPlayOnMaximize: settings.autoPlayOnMaximize,
    setAutoPlayOnMaximize: (v: boolean) => updateSetting('autoPlayOnMaximize', v),
    autoPauseOnMinimize: settings.autoPauseOnMinimize,
    setAutoPauseOnMinimize: (v: boolean) => updateSetting('autoPauseOnMinimize', v),
    loopVideos: settings.loopVideos,
    setLoopVideos: (v: boolean) => updateSetting('loopVideos', v),
    videoResolution: settings.videoResolution,
    setVideoResolution: (v: VideoResolution) => updateSetting('videoResolution', v),
    gifsAutoplay: settings.gifsAutoplay,
    setGifsAutoplay: (v: boolean) => updateSetting('gifsAutoplay', v),
    layout: settings.layout,
    setLayout: (v: Layout) => updateSetting('layout', v),
    postColumns: settings.postColumns,
    setPostColumns: (v: number) => updateSetting('postColumns', v),
    newsLayout: settings.newsLayout,
    setNewsLayout: (v: Layout) => updateSetting('newsLayout', v),
    newsPostColumns: settings.newsPostColumns,
    setNewsPostColumns: (v: number) => updateSetting('newsPostColumns', v),
    fixedHeader: settings.fixedHeader,
    setFixedHeader: (v: boolean) => updateSetting('fixedHeader', v),
    postsPerPage: settings.postsPerPage,
    setPostsPerPage: (v: number) => updateSetting('postsPerPage', v),
    hideFavorites: settings.hideFavorites,
    setHideFavorites: (v: boolean) => updateSetting('hideFavorites', v),
    showHiddenFavCount: settings.showHiddenFavCount,
    setShowHiddenFavCount: (v: boolean) => updateSetting('showHiddenFavCount', v),
    infiniteScroll: settings.infiniteScroll,
    setInfiniteScroll: (v: boolean) => updateSetting('infiniteScroll', v),
    updateSetting,
    updateSettings,
    reset,
  };
}
