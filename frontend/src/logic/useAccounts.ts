// useAccounts.ts - Multi-account management
import { useState, useCallback } from 'react';

const ACCOUNTS_KEY = 'e621_accounts';
const ACTIVE_ACCOUNT_KEY = 'e621_active_account';

export interface Account {
  id: string; // unique, timestamp-based
  username: string;
  apiKey: string;
  label?: string; // optional display name
}

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Account[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

function saveActiveId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

export function useAccounts(
  setE621User: (u: string) => void,
  setE621ApiKey: (k: string) => void,
) {
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());

  const addOrUpdateAccount = useCallback(
    (username: string, apiKey: string, label?: string) => {
      const trimUser = username.trim();
      const trimKey = apiKey.trim();
      if (!trimUser || !trimKey) return;

      setAccounts((prev) => {
        // Check if account with same username already exists
        const existing = prev.find(
          (a) => a.username.toLowerCase() === trimUser.toLowerCase(),
        );
        let updated: Account[];
        let id: string;

        if (existing) {
          // Update existing
          id = existing.id;
          updated = prev.map((a) =>
            a.id === id ? { ...a, username: trimUser, apiKey: trimKey, label } : a,
          );
        } else {
          // Add new
          id = `acc_${Date.now()}`;
          const newAcc: Account = { id, username: trimUser, apiKey: trimKey, label };
          updated = [...prev, newAcc];
        }

        saveAccounts(updated);
        saveActiveId(id);
        setActiveId(id);

        // Apply immediately
        setE621User(trimUser);
        setE621ApiKey(trimKey);
        localStorage.setItem('e621User', trimUser);
        localStorage.setItem('e621ApiKey', trimKey);

        return updated;
      });
    },
    [setE621User, setE621ApiKey],
  );

  const switchAccount = useCallback(
    (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;

      saveActiveId(id);
      setActiveId(id);

      setE621User(acc.username);
      setE621ApiKey(acc.apiKey);
      localStorage.setItem('e621User', acc.username);
      localStorage.setItem('e621ApiKey', acc.apiKey);
    },
    [accounts, setE621User, setE621ApiKey],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        saveAccounts(updated);

        // If deleted active account, clear credentials
        if (id === activeId) {
          const next = updated[0] ?? null;
          saveActiveId(next?.id ?? null);
          setActiveId(next?.id ?? null);

          if (next) {
            setE621User(next.username);
            setE621ApiKey(next.apiKey);
            localStorage.setItem('e621User', next.username);
            localStorage.setItem('e621ApiKey', next.apiKey);
          } else {
            setE621User('');
            setE621ApiKey('');
            localStorage.removeItem('e621User');
            localStorage.removeItem('e621ApiKey');
          }
        }

        return updated;
      });
    },
    [activeId, setE621User, setE621ApiKey],
  );

  const logout = useCallback(() => {
    saveActiveId(null);
    setActiveId(null);
    setE621User('');
    setE621ApiKey('');
    localStorage.removeItem('e621User');
    localStorage.removeItem('e621ApiKey');
  }, [setE621User, setE621ApiKey]);

  return {
    accounts,
    activeId,
    addOrUpdateAccount,
    switchAccount,
    deleteAccount,
    logout,
  };
}
