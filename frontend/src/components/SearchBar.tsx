import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import '../styles/SearchBar.scss';
import type { AutocompleteItem, Order } from '../api/types';
import { fetchTagSuggestions } from '../api/posts';

type Props = {
  onSearch: (tags: string, order: Order, clearTags?: boolean) => void;
  initialTags?: string;
  order: Order;
  setOrder: (order: Order) => void;
  savedOrderRef?: React.MutableRefObject<Order | null>;
};

export default function SearchBar({
  onSearch,
  initialTags = '',
  order,
  setOrder,
  savedOrderRef,
}: Props) {
  const [input, setInput] = useState(initialTags);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);

  const debounceRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);

  // 🔥 Synchronizuj input z initialTags z zewnątrz
  useEffect(() => {
    setInput(initialTags);
  }, [initialTags]);

  const ORDER_FILTERS: { label: string; value: Order }[] = [
    { label: 'Newest', value: 'id_desc' },
    { label: 'Oldest', value: 'id' },
    { label: 'Highest score', value: 'score' },
    { label: 'Most favourites', value: 'favcount' },
    { label: 'Hot', value: 'hot' },
  ];

  useEffect(() => {
    if (savedOrderRef) {
      savedOrderRef.current = savedOrder;
    }
  }, [savedOrder, savedOrderRef]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Sprawdź czy user usunął order:hot z inputu
    const hasOrderHot = input.toLowerCase().includes('order:hot');

    if (savedOrder !== null && !hasOrderHot) {
      // User wyszukuje coś innego niż hot - przywróć poprzedni order
      setOrder(savedOrder);
      onSearch(input, savedOrder);
      setSavedOrder(null);
    } else {
      onSearch(input, order);
    }
  };

  const handleDefaultSearch = () => {
    // Przywróć poprzedni order jeśli był zapisany
    if (savedOrder !== null) {
      setOrder(savedOrder);
      setSavedOrder(null);
    }

    setInput('');
    onSearch('', savedOrder || 'id_desc', true);
  };

  const handleHotSearch = () => {
    // Zapisz obecny order jeśli nie jest już hot
    if (order !== 'hot' && savedOrder === null) {
      setSavedOrder(order);
    }

    // Ustaw order na hot i wpisz do search bara
    setOrder('hot');
    setInput('order:hot');
    onSearch('order:hot', 'hot');
  };

  const handleChange = (value: string) => {
    setInput(value);
    setActiveIndex(0);

    const lastWord = value.split(' ').pop()?.toLowerCase() ?? '';
    if (lastWord.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      const results: AutocompleteItem[] = await fetchTagSuggestions(lastWord);

      // 🔥 Posortuj według post_count (malejąco)
      results.sort((a, b) => b.post_count - a.post_count);

      console.log(`🔍 [SearchBar] Autocomplete for "${lastWord}":`, results.length, 'results');
      setSuggestions(results);
      setShowSuggestions(true);
    }, 200);
  };

  const applySuggestion = (tag: string) => {
    const parts = input.split(' ');
    parts[parts.length - 1] = tag;
    setInput(parts.join(' ') + ' ');
    setShowSuggestions(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      applySuggestion(suggestions[activeIndex].name);
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(0);
    }
  };

  useEffect(() => {
    const list = listRef.current;
    const item = itemRefs.current[activeIndex];

    if (!list || !item) return;

    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    if (itemRect.top < listRect.top) {
      item.scrollIntoView({ block: 'nearest' });
    } else if (itemRect.bottom > listRect.bottom) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !(document.activeElement === e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showFilters) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (!filterRef.current?.contains(target) && !filterBtnRef.current?.contains(target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <button type="button" className="hot-search-btn" onClick={handleHotSearch}>
        <svg
          width="45"
          height="45"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.0284 1.11813C9.69728 1.2952 9.53443 1.61638 9.49957 1.97965C9.48456 2.15538 9.46201 2.32986 9.43136 2.50363C9.3663 2.87248 9.24303 3.3937 9.01205 3.98313C8.5513 5.15891 7.67023 6.58926 5.96985 7.65195C3.57358 9.14956 2.68473 12.5146 3.06456 15.527C3.45234 18.6026 5.20871 21.7903 8.68375 22.9486C9.03 23.0641 9.41163 22.9817 9.67942 22.7337C10.0071 22.4303 10.0238 22.0282 9.94052 21.6223C9.87941 21.3244 9.74999 20.5785 9.74999 19.6875C9.74999 19.3992 9.76332 19.1034 9.79413 18.8068C10.3282 20.031 11.0522 20.9238 11.7758 21.5623C12.8522 22.5121 13.8694 22.8574 14.1722 22.9466C14.402 23.0143 14.6462 23.0185 14.8712 22.9284C17.5283 21.8656 19.2011 20.4232 20.1356 18.7742C21.068 17.1288 21.1993 15.3939 20.9907 13.8648C20.7833 12.3436 20.2354 10.9849 19.7537 10.0215C19.3894 9.29292 19.0534 8.77091 18.8992 8.54242C18.7101 8.26241 18.4637 8.04626 18.1128 8.00636C17.8332 7.97456 17.5531 8.06207 17.3413 8.24739L15.7763 9.61686C15.9107 7.44482 15.1466 5.61996 14.1982 4.24472C13.5095 3.24609 12.7237 2.47913 12.1151 1.96354C11.8094 1.70448 11.5443 1.50549 11.3525 1.36923C11.2564 1.30103 11.1784 1.24831 11.1224 1.21142C10.7908 0.99291 10.3931 0.923125 10.0284 1.11813ZM7.76396 20.256C7.75511 20.0744 7.74999 19.8842 7.74999 19.6875C7.75 18.6347 7.89677 17.3059 8.47802 16.0708C8.67271 15.6572 8.91614 15.254 9.21914 14.8753C9.47408 14.5566 9.89709 14.4248 10.2879 14.5423C10.6787 14.6598 10.959 15.003 10.9959 15.4094C11.2221 17.8977 12.2225 19.2892 13.099 20.0626C13.5469 20.4579 13.979 20.7056 14.292 20.8525C15.5 20.9999 17.8849 18.6892 18.3955 17.7882C19.0569 16.6211 19.1756 15.356 19.0091 14.1351C18.8146 12.7092 18.2304 11.3897 17.7656 10.5337L14.6585 13.2525C14.3033 13.5634 13.779 13.5835 13.401 13.3008C13.023 13.018 12.8942 12.5095 13.092 12.0809C14.4081 9.22933 13.655 6.97987 12.5518 5.38019C12.1138 4.74521 11.6209 4.21649 11.18 3.80695C11.0999 4.088 10.9997 4.39262 10.8742 4.71284C10.696 5.16755 10.4662 5.65531 10.1704 6.15187C9.50801 7.26379 8.51483 8.41987 7.02982 9.34797C5.57752 10.2556 4.71646 12.6406 5.04885 15.2768C5.29944 17.2643 6.20241 19.1244 7.76396 20.256Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button type="button" className="home-search-btn" onClick={handleDefaultSearch}>
        <svg width="45" height="45" viewBox="0 0 32 32" fill="currentColor">
          <path d="M 17.381 1.55 C 18.853 1.51 18.826 2.337 19.193 3.517 L 19.62 4.872 C 19.925 5.846 20.105 6.541 19.911 7.558 C 19.857 7.848 19.782 8.12 19.773 8.42 C 19.725 9.959 21.085 11.157 22.613 10.845 C 23.21 10.723 23.513 10.546 24.172 10.564 C 24.726 10.578 27.624 11.079 28.233 11.302 C 29.166 11.643 29.443 12.797 28.692 13.465 C 28.404 13.723 24.93 15.189 24.179 15.491 C 23.54 15.749 23.083 15.751 22.546 16.25 C 21.279 17.427 21.89 18.539 22.261 19.775 L 23.206 22.82 C 23.351 23.28 23.537 23.785 23.64 24.252 C 23.717 24.697 22.15 26.128 23.472 27.45 C 24.466 28.443 23.973 30.47 22.399 30.389 C 21.064 30.32 20.513 28.65 21.223 27.631 C 21.544 27.17 21.671 27.025 21.704 26.449 C 21.704 25.259 20.582 24.732 19.752 24.041 L 16.829 21.604 C 15.68 20.642 14.892 21.088 13.906 21.854 C 12.729 22.773 11.641 23.784 10.477 24.72 C 9.89 25.192 9.273 25.998 8.414 25.481 C 7.557 24.965 7.868 24.157 8.116 23.394 L 8.528 22.144 C 8.782 21.356 9.038 20.573 9.313 19.794 C 9.763 18.497 10.017 17.578 11.359 16.912 C 12.375 16.411 13.761 16.308 14.395 15.256 C 14.719 14.718 14.816 13.824 14.634 13.221 C 14.149 11.708 12.659 11.052 13.422 8.876 C 13.733 7.988 14.607 7.568 14.986 6.726 C 15.2 6.247 15.302 5.751 15.458 5.254 C 15.688 4.579 15.943 3.906 16.177 3.233 C 16.429 2.516 16.498 1.746 17.381 1.55 Z" />
          <path d="M 5.146 9.883 C 6.24 9.854 9.136 10.037 9.932 10.417 C 11.677 11.252 13.008 14.125 10.659 14.916 C 8.794 15.558 7.2 13.879 5.888 12.904 C 5.457 12.554 4.911 12.335 4.492 11.975 C 3.655 11.255 3.973 9.96 5.146 9.883 Z" />
          <path d="M 25.447 4.335 C 27.252 4.142 27.85 6.754 25.496 7.596 C 25.146 7.721 24.782 7.903 24.431 8.053 C 24.142 8.219 23.591 8.346 23.309 8.117 C 22.772 7.674 23.341 6.869 23.542 6.393 C 23.943 5.456 24.274 4.482 25.447 4.335 Z" />
          <path d="M 8.85 3.479 C 10.215 3.353 10.615 4.694 10.995 5.725 C 11.227 6.279 11.845 7.131 10.928 7.443 C 10.664 7.533 10.461 7.441 10.228 7.325 C 9.268 6.723 7.693 6.513 7.533 5.194 C 7.415 4.214 7.885 3.616 8.85 3.479 Z" />
        </svg>
      </button>
      <button
        ref={filterBtnRef}
        type="button"
        className="filter-btn"
        onClick={() => setShowFilters((v) => !v)}
      >
        <svg
          width="60"
          height="60"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1m3 5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1m3 5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1" />
        </svg>
      </button>
      {showFilters && (
        <div className="filter-dropdown" ref={filterRef}>
          {ORDER_FILTERS.map((opt) => (
            <button
              key={opt.value}
              className={(savedOrder !== null ? savedOrder : order) === opt.value ? 'active' : ''}
              onClick={() => {
                setShowFilters(false);

                // Jeśli był zapisany order (np. z Hot), wyczyść go
                if (savedOrder !== null) {
                  setSavedOrder(null);
                }

                setOrder(opt.value);
                onSearch(input, opt.value);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="input-wrapper">
        <input
          type="text"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter tags (e.g., wolf cum)"
          onFocus={() => suggestions.length && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="autocomplete" ref={listRef}>
            {suggestions.map((item, i) => (
              <li
                key={item.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                onMouseDown={() => applySuggestion(item.name)}
              >
                <div className={`li-guts ${i === activeIndex ? 'active' : ''}`}>
                  {item.antecedent_name ? (
                    <span className="alias-container">
                      <div className="alias-row">
                        <span className="alias">{item.antecedent_name.replace(/_/g, ' ')}</span>
                        <span className="arrow">
                          <svg
                            height="10"
                            width="10"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 31.143 31.143"
                            fill="currentColor"
                          >
                            <path d="M0 15.571a3.09 3.09 0 0 0 3.085 3.083l17.528-.002-4.738 4.739c-1.283 1.284-1.349 3.301-.145 4.507 1.205 1.201 3.222 1.138 4.507-.146l9.896-9.898c1.287-1.283 1.352-3.301.146-4.506-.033-.029-.068-.051-.1-.08-.041-.043-.07-.094-.113-.139l-9.764-9.762c-1.268-1.266-3.27-1.316-4.474-.111s-1.153 3.208.111 4.476l4.755 4.754H3.085A3.083 3.083 0 0 0 0 15.571" />
                            <g />
                          </svg>
                        </span>
                      </div>
                      <span className={`tag cat-${item.category}`}>
                        {item.name.replace(/_/g, ' ')}
                      </span>
                    </span>
                  ) : (
                    <span className={`tag cat-${item.category}`}>
                      {item.name.replace(/_/g, ' ')}
                    </span>
                  )}

                  <div>
                    <small>{item.post_count.toLocaleString()}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="search-btn" type="submit">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
