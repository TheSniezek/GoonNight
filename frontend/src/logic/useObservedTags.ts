import { useState } from 'react';

const OBSERVED_TAGS_KEY = 'observed_tags';

export const loadObservedTags = (): string[] => {
  try {
    const raw = localStorage.getItem(OBSERVED_TAGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveObservedTags = (tags: string[]) => {
  localStorage.setItem(OBSERVED_TAGS_KEY, JSON.stringify(tags));
};

export function useObservedTags() {
  const [observedTags, setObservedTags] = useState(loadObservedTags());

  const toggleTag = (tag: string) => {
    const updated = observedTags.includes(tag)
      ? observedTags.filter((t) => t !== tag)
      : [...observedTags, tag];
    setObservedTags(updated);
    saveObservedTags(updated);
  };

  return { observedTags, toggleTag, setObservedTags, saveObservedTags };
}
