import { useCallback, useEffect, useState } from 'react';

const IS_PROD = import.meta.env.PROD;
const BASE_URL = IS_PROD ? '' : 'http://localhost:3001';
const BLACKLIST_ENDPOINT = IS_PROD ? '/api/blacklist' : '/api/e621/blacklist';

interface UseBlacklistArgs {
  username: string;
  apiKey: string;
  provider?: string;
}

export type BlacklistLine = {
  id: string;
  tags: string;
  enabled: boolean;
};

export function useBlacklist({ username, apiKey, provider = 'e621' }: UseBlacklistArgs) {
  const [blacklistLines, setBlacklistLines] = useState<BlacklistLine[]>([]);
  const [loading, setLoading] = useState(false);
  const isLoggedIn = Boolean(username && apiKey);

  // Convert array of lines to string format for e621 API
  const linesToString = (lines: BlacklistLine[]): string => {
    return lines.map((line) => line.tags).join('\n');
  };

  // Convert string from e621 API to array of lines
  const stringToLines = (blacklistString: string): BlacklistLine[] => {
    return blacklistString
      .split('\n')
      .map((tags, index) => ({
        id: `bl-${Date.now()}-${index}`,
        tags: tags.trim(),
        enabled: true, // Default wszystkie włączone
      }))
      .filter((line) => line.tags.length > 0 && !line.tags.startsWith('#')); // Ignoruj puste i komentarze
  };

  const fetchBlacklist = useCallback(async () => {
    if (!isLoggedIn) return;

    console.log('🚫 [useBlacklist] Fetching blacklist');
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}${BLACKLIST_ENDPOINT}?username=${encodeURIComponent(username)}&apiKey=${encodeURIComponent(apiKey)}&provider=${provider}`,
      );
      const data = await res.json();

      const lines = stringToLines(data.blacklist || '');
      setBlacklistLines(lines);
      console.log('✅ [useBlacklist] Fetched successfully:', lines.length, 'lines');
    } catch (err) {
      console.error('❌ [useBlacklist] Fetch ERROR:', err);
    } finally {
      setLoading(false);
    }
  }, [username, apiKey, isLoggedIn, provider]);

  const updateBlacklist = useCallback(
    async (newLines: BlacklistLine[]) => {
      if (!isLoggedIn) return;

      const blacklistString = linesToString(newLines);

      console.log('🚫 [useBlacklist] Updating blacklist');
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}${BLACKLIST_ENDPOINT}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, apiKey, blacklist: blacklistString, provider }),
        });

        if (res.ok) {
          setBlacklistLines(newLines);
          console.log('✅ [useBlacklist] Updated successfully');
        }
      } catch (err) {
        console.error('❌ [useBlacklist] Update ERROR:', err);
      } finally {
        setLoading(false);
      }
    },
    [username, apiKey, isLoggedIn],
  );

  const toggleLine = useCallback((lineId: string) => {
    setBlacklistLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, enabled: !line.enabled } : line)),
    );
  }, []);

  const addLine = useCallback((tags: string) => {
    const newLine: BlacklistLine = {
      id: `bl-${Date.now()}`,
      tags: tags.trim(),
      enabled: true,
    };
    setBlacklistLines((prev) => [...prev, newLine]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setBlacklistLines((prev) => prev.filter((line) => line.id !== lineId));
  }, []);

  const editLine = useCallback((lineId: string, newTags: string) => {
    setBlacklistLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, tags: newTags.trim() } : line)),
    );
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchBlacklist();
    }
  }, [isLoggedIn, fetchBlacklist]);

  return {
    blacklistLines,
    loading,
    isLoggedIn,
    fetchBlacklist,
    updateBlacklist,
    toggleLine,
    addLine,
    removeLine,
    editLine,
    setBlacklistLines,
  };
}
