import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import '../styles/MobileBottomNav.scss';
import type { AutocompleteItem, Order, PopularScale } from '../api/types';
import { fetchTagSuggestions } from '../api/posts';

type Props = {
  onSearch: (tags: string, order: Order, clearTags?: boolean) => void;
  onPopularSearch: (date: string, scale: PopularScale) => void;
  initialTags?: string;
  order: Order;
  setOrder: (order: Order) => void;
  savedOrderRef?: React.MutableRefObject<Order | null>;
  isPopularMode: boolean;
  setIsPopularMode: (value: boolean) => void;
  popularDate: string;
  setPopularDate: (date: string) => void;
  popularScale: PopularScale;
  setPopularScale: (scale: PopularScale) => void;
  loading?: boolean;
  onFavoritesClick: () => void;
  isFavoritesActive: boolean;
  isFavoritesDisabled: boolean;
};

export default function MobileBottomNav({
  onSearch,
  onPopularSearch,
  initialTags = '',
  order,
  setOrder,
  savedOrderRef,
  isPopularMode,
  setIsPopularMode,
  popularDate,
  setPopularDate,
  popularScale,
  setPopularScale,
  loading = false,
  onFavoritesClick,
  isFavoritesActive,
  isFavoritesDisabled,
}: Props) {
  const [input, setInput] = useState(initialTags);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);
  const [showNavDropdown, setShowNavDropdown] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const navDropdownRef = useRef<HTMLDivElement | null>(null);
  const navBtnRef = useRef<HTMLButtonElement | null>(null);
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date picker state
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [showYearSelector, setShowYearSelector] = useState(false);

  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Helper functions
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  };

  const isDateInPast = (year: number, month: number, day: number = 1): boolean => {
    const targetDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate <= today;
  };

  const isMonthInPast = (year: number, month: number): boolean => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (year < currentYear) return true;
    if (year === currentYear && month <= currentMonth) return true;
    return false;
  };

  const isWeekInPast = (mondayDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    mondayDate.setHours(0, 0, 0, 0);
    return mondayDate <= today;
  };

  const getDaysInMonth = (year: number, month: number): number => {
    if (month === 1) {
      return isLeapYear(year) ? 29 : 28;
    }
    if ([3, 5, 8, 10].includes(month)) {
      return 30;
    }
    return 31;
  };

  useEffect(() => {
    setInput(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (popularDate) {
      const date = new Date(popularDate);
      setPickerYear(date.getFullYear());
      setPickerMonth(date.getMonth());
    }
  }, [popularDate, showDatePicker]);

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

    if (input.trim()) {
      const history: string[] = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const filtered = history.filter((item) => item !== input.trim());
      const newHistory = [input.trim(), ...filtered].slice(0, 5);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    }

    if (isPopularMode) {
      setIsPopularMode(false);
    }

    const hasOrderHot = input.toLowerCase().includes('order:hot');

    if (savedOrder !== null && !hasOrderHot) {
      setOrder(savedOrder);
      onSearch(input, savedOrder);
      setSavedOrder(null);
    } else {
      onSearch(input, order);
    }

    setShowSuggestions(false);
  };

  const handleDefaultSearch = () => {
    setIsPopularMode(false);

    if (savedOrder !== null) {
      setOrder(savedOrder);
      setSavedOrder(null);
    }

    setInput('');
    onSearch('', savedOrder || 'id_desc', true);
    setShowNavDropdown(false);
  };

  const handlePopularSearch = () => {
    if (isPopularMode) {
      setIsPopularMode(false);

      if (savedOrder !== null) {
        setOrder(savedOrder);
        setSavedOrder(null);
      }

      setInput('');
      onSearch('', savedOrder || 'id_desc', true);
    } else {
      if (!isPopularMode && order !== 'hot') {
        setSavedOrder(order);
      }

      setIsPopularMode(true);
      onPopularSearch(popularDate, popularScale);
    }
    setShowNavDropdown(false);
  };

  const handleHotSearch = () => {
    if (order === 'hot') {
      if (savedOrder !== null) {
        setOrder(savedOrder);
        onSearch(input, savedOrder);
        setSavedOrder(null);
      }
    } else {
      setSavedOrder(order);
      setOrder('hot');
      onSearch(input, 'hot');
    }
    setShowNavDropdown(false);
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 2) {
      debounceRef.current = window.setTimeout(async () => {
        const data = await fetchTagSuggestions(value);
        setSuggestions(data);
        setShowSuggestions(true);
        setActiveIndex(0);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (tag: string) => {
    const tags = input.split(/\s+/).filter(Boolean).slice(0, -1);
    tags.push(tag);
    const newInput = tags.join(' ') + ' ';
    setInput(newInput);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = (prev + 1) % suggestions.length;
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = (prev - 1 + suggestions.length) % suggestions.length;
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const selectedTag = suggestions[activeIndex]?.name;
      if (selectedTag) {
        handleSuggestionClick(selectedTag);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        filterRef.current &&
        !filterRef.current.contains(target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(target)
      ) {
        setShowFilters(false);
      }

      if (
        navDropdownRef.current &&
        !navDropdownRef.current.contains(target) &&
        navBtnRef.current &&
        !navBtnRef.current.contains(target)
      ) {
        setShowNavDropdown(false);
      }

      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        const backdrop = document.querySelector('.mobile-date-picker-backdrop');
        if (backdrop && backdrop.contains(target)) {
          setShowDatePicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeDate = (direction: 'prev' | 'next') => {
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
    onPopularSearch(newDateStr, popularScale);
  };

  const canGoNext = (): boolean => {
    const currentDate = new Date(popularDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (popularScale === 'day') {
      return currentDate < today;
    } else if (popularScale === 'week') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek <= today;
    } else if (popularScale === 'month') {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth <= today;
    }
    return false;
  };

  const formatDisplayDate = (): string => {
    const date = new Date(popularDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    if (popularScale === 'day') {
      return `${MONTH_NAMES[month]} ${day}, ${year}`;
    } else if (popularScale === 'week') {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startMonth = MONTH_NAMES[weekStart.getMonth()];
      const startDay = weekStart.getDate();

      return `Week of ${startMonth} ${startDay} , ${year}`;
    } else {
      return `${MONTH_NAMES[month]} ${year}`;
    }
  };

  const changeScale = (newScale: PopularScale) => {
    setPopularScale(newScale);

    const currentDate = new Date(popularDate);
    let adjustedDate = currentDate;

    if (newScale === 'week') {
      adjustedDate = getWeekStart(currentDate);
    } else if (newScale === 'month') {
      adjustedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    }

    const newDateStr = adjustedDate.toISOString().split('T')[0];
    setPopularDate(newDateStr);
    onPopularSearch(newDateStr, newScale);
  };

  const changePickerYear = (direction: 'prev' | 'next') => {
    const newYear = direction === 'next' ? pickerYear + 1 : pickerYear - 1;
    if (newYear >= 2007 && newYear <= new Date().getFullYear()) {
      setPickerYear(newYear);
    }
  };

  const changePickerMonth = (direction: 'prev' | 'next') => {
    let newMonth = pickerMonth;
    let newYear = pickerYear;

    if (direction === 'next') {
      newMonth++;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
    } else {
      newMonth--;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
    }

    if (newYear < 2007) return;
    if (newYear > new Date().getFullYear()) return;

    setPickerMonth(newMonth);
    setPickerYear(newYear);
  };

  const generateYearOptions = (): number[] => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear; year >= 2007; year--) {
      years.push(year);
    }
    return years;
  };

  const generateDaysForPicker = (): Array<{ day: number; disabled: boolean }> => {
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const days: Array<{ day: number; disabled: boolean }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = !isDateInPast(pickerYear, pickerMonth, day);
      days.push({ day, disabled });
    }

    return days;
  };

  const generateWeeksForPicker = (): Array<{
    weekNumber: number;
    displayLabel: string;
    disabled: boolean;
  }> => {
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0);

    const weeks: Array<{ weekNumber: number; displayLabel: string; disabled: boolean }> = [];
    let weekNumber = 1;
    let currentMonday = getWeekStart(firstDay);

    if (currentMonday < firstDay) {
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    while (currentMonday.getMonth() === pickerMonth && currentMonday <= lastDay) {
      const weekEnd = new Date(currentMonday);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startDay = currentMonday.getDate();
      const endDay = weekEnd.getDate();

      const displayLabel =
        weekEnd.getMonth() === currentMonday.getMonth()
          ? `Week ${weekNumber}: ${startDay}-${endDay}`
          : `Week ${weekNumber}: ${startDay}-${endDay}`;

      const disabled = !isWeekInPast(currentMonday);

      weeks.push({ weekNumber, displayLabel, disabled });

      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
      weekNumber++;
    }

    return weeks;
  };

  const selectDay = (day: number) => {
    const newDate = new Date(pickerYear, pickerMonth, day);
    const dateStr = newDate.toISOString().split('T')[0];
    setPopularDate(dateStr);
    onPopularSearch(dateStr, 'day');
    setShowDatePicker(false);
  };

  const selectWeek = (weekNumber: number) => {
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    let currentMonday = getWeekStart(firstDay);

    if (currentMonday < firstDay) {
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    for (let i = 1; i < weekNumber; i++) {
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    const dateStr = currentMonday.toISOString().split('T')[0];
    setPopularDate(dateStr);
    onPopularSearch(dateStr, 'week');
    setShowDatePicker(false);
  };

  const selectMonth = () => {
    const newDate = new Date(pickerYear, pickerMonth, 1);
    const dateStr = newDate.toISOString().split('T')[0];
    setPopularDate(dateStr);
    onPopularSearch(dateStr, 'month');
    setShowDatePicker(false);
  };

  return (
    <div className="mobile-bottom-nav">
      {/* Left Section - Navigation Dropdown */}
      <div className="nav-section">
        <button
          ref={navBtnRef}
          type="button"
          className="nav-dropdown-btn"
          onClick={() => setShowNavDropdown(!showNavDropdown)}
          disabled={loading}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12h18M3 6h18M3 18h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {showNavDropdown && (
          <div ref={navDropdownRef} className="nav-dropdown">
            <button type="button" onClick={handleDefaultSearch} disabled={loading}>
              <svg height="24" width="24" viewBox="0 0 576 512" fill="currentColor">
                <path d="M575.8 255.5c0 18-15 32.1-32 32.1l-32 0 .7 160.2c0 2.7-.2 5.4-.5 8.1l0 16.2c0 22.1-17.9 40-40 40l-16 0c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1L416 512l-24 0c-22.1 0-40-17.9-40-40l0-24 0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32l0 64 0 24c0 22.1-17.9 40-40 40l-24 0-31.9 0c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2l-16 0c-22.1 0-40-17.9-40-40l0-112c0-.9 0-1.9 .1-2.8l0-69.7-32 0c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z" />
              </svg>
              <span>Home</span>
            </button>

            <button
              type="button"
              className={order === 'hot' ? 'active' : ''}
              onClick={handleHotSearch}
              disabled={loading}
            >
              <svg height="24" width="24" viewBox="0 0 448 512" fill="currentColor">
                <path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z" />
              </svg>
              <span>Hot</span>
            </button>

            <button
              type="button"
              className={isPopularMode ? 'active' : ''}
              onClick={handlePopularSearch}
              disabled={loading}
            >
              <svg height="24" width="24" viewBox="0 0 576 512" fill="currentColor">
                <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" />
              </svg>
              <span>Popular</span>
            </button>
          </div>
        )}
      </div>

      {/* Center Section - Filters */}
      <div className="filter-section">
        <button
          ref={filterBtnRef}
          type="button"
          className="filter-dropdown-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <svg height="24" width="24" viewBox="0 0 512 512" fill="currentColor">
            <path d="M3.9 54.9C10.5 40.9 24.5 32 40 32l432 0c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9 320 448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6l0-79.1L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z" />
          </svg>
        </button>

        {showFilters && (
          <div ref={filterRef} className="mobile-filter-dropdown">
            {ORDER_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={order === filter.value ? 'active' : ''}
                onClick={() => {
                  setOrder(filter.value);
                  setShowFilters(false);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Section - Favorites */}
      <div className="fav-section">
        <button
          type="button"
          className={`fav-btn ${isFavoritesActive ? 'active' : ''}`}
          onClick={onFavoritesClick}
          disabled={isFavoritesDisabled}
        >
          <svg height="24" width="24" viewBox="0 0 512 512" fill="currentColor">
            <path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z" />
          </svg>
        </button>
      </div>

      {/* Search Modal */}
      {showFilters && (
        <div className="mobile-search-modal">
          <div className="mobile-search-modal-backdrop" onClick={() => setShowFilters(false)} />
          <div className="mobile-search-modal-content">
            <div className="mobile-search-header">
              <h3>Search</h3>
              <button type="button" onClick={() => setShowFilters(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <form className="mobile-search-form" onSubmit={handleSubmit}>
              <div className="mobile-input-wrapper">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search tags..."
                  autoComplete="off"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <ul ref={listRef} className="mobile-autocomplete">
                    {suggestions.map((item, idx) => (
                      <li key={item.id} onClick={() => handleSuggestionClick(item.name)}>
                        <div className={`li-guts ${idx === activeIndex ? 'active' : ''}`}>
                          {item.antecedent_name ? (
                            <div className="alias-container">
                              <div className="alias-row">
                                <span className="alias">{item.antecedent_name}</span>
                                <span className="arrow">
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9.4 18L8 16.6l4.6-4.6L8 7.4 9.4 6l6 6z" />
                                  </svg>
                                </span>
                              </div>
                              <span className={`tag cat-${item.category}`}>{item.name}</span>
                            </div>
                          ) : (
                            <span className={`tag cat-${item.category}`}>{item.name}</span>
                          )}
                          <small>{item.post_count.toLocaleString()}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button type="submit" className="mobile-search-btn">
                <svg height="20" width="20" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popular Controls (when active) */}
      {isPopularMode && (
        <div className="mobile-popular-overlay">
          <div className="mobile-popular-controls">
            <div className="mobile-scale-selector">
              <button
                type="button"
                className={popularScale === 'day' ? 'active' : ''}
                onClick={() => changeScale('day')}
              >
                Day
              </button>
              <button
                type="button"
                className={popularScale === 'week' ? 'active' : ''}
                onClick={() => changeScale('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={popularScale === 'month' ? 'active' : ''}
                onClick={() => changeScale('month')}
              >
                Month
              </button>
            </div>
            <div className="mobile-date-navigation">
              <button type="button" className="nav-arrow" onClick={() => changeDate('prev')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                className="date-display"
                onClick={() => setShowDatePicker(true)}
              >
                {formatDisplayDate()}
              </button>

              <button
                type="button"
                className="nav-arrow"
                onClick={() => changeDate('next')}
                disabled={!canGoNext()}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 18L15 12L9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <>
          <div className="mobile-date-picker-backdrop" onClick={() => setShowDatePicker(false)} />
          <div className="mobile-date-picker-modal" ref={datePickerRef}>
            <div className="mobile-date-picker-header">
              <h3>Select Date</h3>
              <button
                type="button"
                className="close-picker"
                onClick={() => setShowDatePicker(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mobile-date-picker-content">
              <div className="mobile-date-picker-row">
                <button
                  type="button"
                  className="picker-nav-btn"
                  onClick={() => changePickerYear('prev')}
                  disabled={pickerYear <= 2007}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="picker-value-btn"
                  onClick={() => setShowYearSelector(!showYearSelector)}
                >
                  {pickerYear}
                </button>

                <button
                  type="button"
                  className="picker-nav-btn"
                  onClick={() => changePickerYear('next')}
                  disabled={pickerYear >= new Date().getFullYear()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {showYearSelector && (
                <div className="year-selector-dropdown">
                  {generateYearOptions().map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={`year-option ${year === pickerYear ? 'active' : ''}`}
                      onClick={() => {
                        setPickerYear(year);
                        setShowYearSelector(false);
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}

              <div className="mobile-date-picker-row">
                <button
                  type="button"
                  className="picker-nav-btn"
                  onClick={() => changePickerMonth('prev')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>

                <div className="picker-value-btn">{MONTH_NAMES[pickerMonth]}</div>

                <button
                  type="button"
                  className="picker-nav-btn"
                  onClick={() => changePickerMonth('next')}
                  disabled={(() => {
                    let nextMonth = pickerMonth + 1;
                    let nextYear = pickerYear;
                    if (nextMonth > 11) {
                      nextMonth = 0;
                      nextYear++;
                    }
                    return !isMonthInPast(nextYear, nextMonth);
                  })()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {popularScale === 'day' && (
                <div className="mobile-day-grid">
                  {generateDaysForPicker().map((dayObj) => (
                    <button
                      key={dayObj.day}
                      type="button"
                      className="day-option"
                      onClick={() => selectDay(dayObj.day)}
                      disabled={dayObj.disabled}
                    >
                      {dayObj.day}
                    </button>
                  ))}
                </div>
              )}

              {popularScale === 'week' && (
                <div className="mobile-week-grid">
                  {generateWeeksForPicker().map((week) => (
                    <button
                      key={week.weekNumber}
                      type="button"
                      className="week-option"
                      onClick={() => selectWeek(week.weekNumber)}
                      disabled={week.disabled}
                    >
                      {week.displayLabel}
                    </button>
                  ))}
                </div>
              )}

              {popularScale === 'month' && (
                <div className="mobile-month-confirm">
                  <button type="button" className="confirm-month-btn" onClick={selectMonth}>
                    Select {MONTH_NAMES[pickerMonth]} {pickerYear}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
