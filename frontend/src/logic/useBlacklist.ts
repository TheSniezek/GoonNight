import { useCallback, useEffect, useState } from 'react';

interface UseBlacklistArgs {
  username: string;
  apiKey: string;
}

export function useBlacklist({ username, apiKey }: UseBlacklistArgs) {
  const [blacklist, setBlacklist] = useState('');
  const [loading, setLoading] = useState(false);
  const isLoggedIn = Boolean(username && apiKey);

  const fetchBlacklist = useCallback(async () => {
    if (!isLoggedIn) return;

    console.log('🚫 [useBlacklist] Fetching blacklist');
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/e621/blacklist?username=${encodeURIComponent(
          username
        )}&apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await res.json();

      setBlacklist(data.blacklist || '');
      console.log('✅ [useBlacklist] Fetched successfully');
    } catch (err) {
      console.error('❌ [useBlacklist] Fetch ERROR:', err);
    } finally {
      setLoading(false);
    }
  }, [username, apiKey, isLoggedIn]);

  const updateBlacklist = useCallback(
    async (newBlacklist: string) => {
      if (!isLoggedIn) return;

      console.log('🚫 [useBlacklist] Updating blacklist');
      setLoading(true);
      try {
        const res = await fetch('http://localhost:3001/api/e621/blacklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, apiKey, blacklist: newBlacklist }),
        });

        if (res.ok) {
          setBlacklist(newBlacklist);
          console.log('✅ [useBlacklist] Updated successfully');
        }
      } catch (err) {
        console.error('❌ [useBlacklist] Update ERROR:', err);
      } finally {
        setLoading(false);
      }
    },
    [username, apiKey, isLoggedIn]
  );

  useEffect(() => {
    if (isLoggedIn) {
      fetchBlacklist();
    }
  }, [isLoggedIn, fetchBlacklist]);

  return {
    blacklist,
    loading,
    isLoggedIn,
    fetchBlacklist,
    updateBlacklist,
    setBlacklist,
  };
}
