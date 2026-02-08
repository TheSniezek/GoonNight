import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import '../styles/SearchBar.scss';
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
};

export default function SearchBar({
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
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🔥 State dla nowego date pickera
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth()); // 0-11
  const [showYearSelector, setShowYearSelector] = useState(false);

  // 🔥 Helper: Oblicz początek tygodnia (poniedziałek)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Niedziela = 0, więc -6; Poniedziałek = 1, więc 0
    d.setDate(d.getDate() + diff);
    return d;
  };

  // 🔥 Helper: Sprawdź czy rok jest przestępny
  const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  };

  // 🔥 Helper: Sprawdź czy data już wystąpiła (czy możemy ją wybrać)
  const isDateInPast = (year: number, month: number, day: number = 1): boolean => {
    const targetDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate <= today;
  };

  // 🔥 Helper: Sprawdź czy cały miesiąc już wystąpił
  const isMonthInPast = (year: number, month: number): boolean => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    if (year < currentYear) return true;
    if (year === currentYear && month <= currentMonth) return true;
    return false;
  };

  // 🔥 Helper: Sprawdź czy tydzień już wystąpił
  const isWeekInPast = (mondayDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    mondayDate.setHours(0, 0, 0, 0);
    return mondayDate <= today;
  };

  // 🔥 Helper: Ile dni ma miesiąc
  const getDaysInMonth = (year: number, month: number): number => {
    // Luty - sprawdź czy rok przestępny
    if (month === 1) {
      return isLeapYear(year) ? 29 : 28;
    }
    // Miesiące z 30 dniami: kwiecień, czerwiec, wrzesień, listopad
    if ([3, 5, 8, 10].includes(month)) {
      return 30;
    }
    // Pozostałe miesiące mają 31 dni
    return 31;
  };

  // 🔥 Helper: Ile tygodni w miesiącu (tylko te które zaczynają się w tym miesiącu)
  const getWeeksInMonth = (year: number, month: number): number => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let count = 0;
    let currentMonday = getWeekStart(firstDay);

    // Jeśli pierwszy poniedziałek jest przed pierwszym dniem miesiąca, przejdź do następnego
    if (currentMonday < firstDay) {
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    // Zlicz tygodnie które zaczynają się w tym miesiącu
    while (currentMonday.getMonth() === month && currentMonday <= lastDay) {
      count++;
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    return count;
  };

  // 🔥 Synchronizuj input z initialTags z zewnątrz
  useEffect(() => {
    setInput(initialTags);
  }, [initialTags]);

  // 🔥 Synchronizuj picker state z popularDate
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

    // Jeśli jesteśmy w popular mode, wyłącz go
    if (isPopularMode) {
      setIsPopularMode(false);
    }

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
    // Wyłącz popular mode
    setIsPopularMode(false);

    // Przywróć poprzedni order jeśli był zapisany
    if (savedOrder !== null) {
      setOrder(savedOrder);
      setSavedOrder(null);
    }

    setInput('');
    onSearch('', savedOrder || 'id_desc', true);
  };

  const handlePopularSearch = () => {
    if (isPopularMode) {
      // Jeśli Popular jest już aktywny, wyłącz i wróć do home
      setIsPopularMode(false);

      // Przywróć poprzedni order jeśli był zapisany
      if (savedOrder !== null) {
        setOrder(savedOrder);
        setSavedOrder(null);
      }

      setInput('');
      onSearch('', savedOrder || 'id_desc', true);
    } else {
      // Zapisz obecny order jeśli nie jest już zapisany
      if (savedOrder === null) {
        setSavedOrder(order);
      }

      // Włącz popular mode
      setIsPopularMode(true);
      setInput('');

      // Wywołaj wyszukiwanie popular
      onPopularSearch(popularDate, popularScale);
    }
  };

  const handleHotSearch = () => {
    // Wyłącz popular mode
    setIsPopularMode(false);

    // Zapisz obecny order jeśli nie jest już hot
    if (order !== 'hot' && savedOrder === null) {
      setSavedOrder(order);
    }

    // Ustaw order na hot i wpisz do search bara
    setOrder('hot');
    setInput('');
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

  useEffect(() => {
    if (!showDatePicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!datePickerRef.current?.contains(target)) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  // Nawigacja po datach
  const changeDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(popularDate);
    let newDate: Date;

    if (popularScale === 'day') {
      newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (popularScale === 'week') {
      newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      // month
      newDate = new Date(currentDate);
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    const newDateString = newDate.toISOString().split('T')[0];
    setPopularDate(newDateString);
    onPopularSearch(newDateString, popularScale);
  };

  const changeScale = (newScale: PopularScale) => {
    setPopularScale(newScale);

    const today = new Date();
    let targetDate: Date;

    if (newScale === 'week') {
      // Dla week - znajdź poniedziałek bieżącego tygodnia
      targetDate = getWeekStart(today);
    } else {
      // Dla day i month - dzisiejsza data
      targetDate = today;
    }

    const currentDate = targetDate.toISOString().split('T')[0];
    setPopularDate(currentDate);
    onPopularSearch(currentDate, newScale);
  };

  const selectDate = (newDate: string) => {
    setPopularDate(newDate);
    setShowDatePicker(false);
    onPopularSearch(newDate, popularScale);
  };

  // 🔥 Nowe funkcje dla date pickera

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

  const changePickerYear = (direction: 'prev' | 'next') => {
    const newYear = direction === 'next' ? pickerYear + 1 : pickerYear - 1;
    const currentYear = new Date().getFullYear();

    // Nie pozwól na lata przyszłe lub starsze niż 2007
    if (newYear > currentYear || newYear < 2007) return;

    setPickerYear(newYear);
  };

  const changePickerMonth = (direction: 'prev' | 'next') => {
    let newMonth = direction === 'next' ? pickerMonth + 1 : pickerMonth - 1;
    let newYear = pickerYear;

    // Obsługa przeskoku roku
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    // Sprawdź czy nowy miesiąc już wystąpił
    if (!isMonthInPast(newYear, newMonth)) {
      return; // Nie pozwól na przyszłe miesiące
    }

    // Sprawdź czy nie wychodzimy poza zakres lat
    if (newYear > new Date().getFullYear() || newYear < 2007) {
      return;
    }

    setPickerYear(newYear);
    setPickerMonth(newMonth);
  };

  const selectDay = (day: number) => {
    const date = new Date(pickerYear, pickerMonth, day);
    // Użyj lokalnego formatowania zamiast UTC (toISOString może zmienić dzień przez timezone)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;
    selectDate(dateString);
  };

  const selectWeek = (weekNumber: number) => {
    // Znajdź poniedziałek danego tygodnia w miesiącu
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    let firstMonday = getWeekStart(firstDay);

    // Jeśli pierwszy poniedziałek jest przed pierwszym dniem miesiąca, przejdź do następnego
    if (firstMonday < firstDay) {
      firstMonday = new Date(firstMonday);
      firstMonday.setDate(firstMonday.getDate() + 7);
    }

    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

    // Użyj lokalnego formatowania
    const year = targetMonday.getFullYear();
    const month = String(targetMonday.getMonth() + 1).padStart(2, '0');
    const day = String(targetMonday.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    selectDate(dateString);
  };

  const selectMonth = () => {
    const date = new Date(pickerYear, pickerMonth, 1);
    // Użyj lokalnego formatowania
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    selectDate(dateString);
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let y = currentYear; y >= 2007; y--) {
      years.push(y);
    }

    return years;
  };

  // Generuj dni dla wybranego miesiąca
  const generateDaysForPicker = () => {
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const days: { day: number; disabled: boolean }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const disabled = !isDateInPast(pickerYear, pickerMonth, d);
      days.push({ day: d, disabled });
    }

    return days;
  };

  // Generuj tygodnie dla wybranego miesiąca
  const generateWeeksForPicker = () => {
    const weeksCount = getWeeksInMonth(pickerYear, pickerMonth);
    const weeks: { weekNumber: number; label: string; displayLabel: string; disabled: boolean }[] =
      [];

    const firstDay = new Date(pickerYear, pickerMonth, 1);
    let currentMonday = getWeekStart(firstDay);

    // Jeśli pierwszy poniedziałek jest przed pierwszym dniem miesiąca, przejdź do następnego
    if (currentMonday < firstDay) {
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    for (let i = 0; i < weeksCount; i++) {
      const weekEnd = new Date(currentMonday);
      weekEnd.setDate(currentMonday.getDate() + 6);

      const label = `${currentMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      // Format displayLabel: "Week of Feb 02"
      const monthShort = currentMonday.toLocaleDateString('en-US', { month: 'short' });
      const day = currentMonday.getDate().toString().padStart(2, '0');
      const displayLabel = `Week of ${monthShort} ${day}`;

      // Sprawdź czy tydzień już wystąpił
      const disabled = !isWeekInPast(new Date(currentMonday));

      weeks.push({ weekNumber: i + 1, label, displayLabel, disabled });

      // Przejdź do następnego poniedziałku
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    return weeks;
  };

  // Format daty do wyświetlenia
  const formatDisplayDate = () => {
    // Gdy picker jest otwarty, użyj pickerYear i pickerMonth dla podglądu
    let date: Date;

    if (showDatePicker) {
      if (popularScale === 'week') {
        // Dla week - znajdź pierwszy poniedziałek miesiąca
        const firstDay = new Date(pickerYear, pickerMonth, 1);
        let firstMonday = getWeekStart(firstDay);
        if (firstMonday < firstDay) {
          firstMonday = new Date(firstMonday);
          firstMonday.setDate(firstMonday.getDate() + 7);
        }
        date = firstMonday;
      } else {
        date = new Date(pickerYear, pickerMonth, 1);
      }
    } else {
      date = new Date(popularDate);
    }

    if (popularScale === 'day') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (popularScale === 'week') {
      // Zawsze pokaż początek tygodnia (poniedziałek)
      const weekStart = getWeekStart(date);
      // Format: "Week of Feb 02"
      const monthShort = weekStart.toLocaleDateString('en-US', { month: 'short' });
      const day = weekStart.getDate().toString().padStart(2, '0');
      return `Week of ${monthShort} ${day}`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });
    }
  };

  return (
    <div className="search-bar-container">
      <form className="search-bar" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`popular-search-btn ${isPopularMode ? 'active' : ''}`}
          onClick={handlePopularSearch}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="45"
            height="45"
            viewBox="0 0 512 512"
            fill="currentColor"
          >
            <path d="M370.214 502.906c-11.484 0-22.938-2.844-33.125-8.188l-77.797-40.891c-2.016-1.078-4.547-1.078-6.578 0l-77.797 40.891c-10.172 5.344-21.625 8.188-33.109 8.188-15.141 0-29.609-4.719-41.844-13.594-22.047-16.047-32.906-42.703-28.328-69.578l14.891-86.672c.391-2.281-.375-4.594-2.047-6.234l-62.938-61.344c-19.531-19.047-26.438-47-18.016-72.953C11.979 166.562 34.01 148 60.995 144.093l86.984-12.641a7.03 7.03 0 0 0 5.313-3.859l38.906-78.828c12.047-24.453 36.5-39.672 63.813-39.672 27.297 0 51.75 15.219 63.813 39.688l38.906 78.813a7.02 7.02 0 0 0 5.313 3.859l86.969 12.641c27 3.906 49.016 22.469 57.453 48.406 8.438 25.984 1.531 53.938-18 72.984l-62.953 61.359a7.07 7.07 0 0 0-2.016 6.25l14.859 86.609c4.594 26.922-6.266 53.578-28.328 69.609-12.219 8.877-26.673 13.595-41.813 13.595M256.011 388.875c11.484 0 22.938 2.844 33.109 8.188l77.813 40.906c1.953 1.031 4.203 1.813 7.391-.531a6.99 6.99 0 0 0 2.813-6.906l-14.844-86.625a71.18 71.18 0 0 1 20.453-62.969l62.953-61.375c1.938-1.875 2.609-4.656 1.781-7.25-.813-2.5-3.047-4.375-5.672-4.75l-87-12.656a71.17 71.17 0 0 1-53.594-38.938l-38.906-78.813c-2.391-4.859-10.219-4.844-12.609-.031l-38.906 78.859a71.19 71.19 0 0 1-53.563 38.922l-87.016 12.641c-2.641.391-4.875 2.266-5.703 4.797a7.01 7.01 0 0 0 1.797 7.219l62.953 61.359a71.22 71.22 0 0 1 20.469 62.969l-14.875 86.672c-.453 2.625.625 5.281 2.813 6.875 3.219 2.328 5.453 1.563 7.422.531l77.797-40.906c10.171-5.344 21.624-8.188 33.124-8.188" />
          </svg>
        </button>
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

                  // Wyłącz popular mode
                  setIsPopularMode(false);

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

      {/* Popular Mode Controls */}
      {isPopularMode && (
        <div className="popular-controls">
          <div className="date-navigation">
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

            <button type="button" className="date-display" onClick={() => setShowDatePicker(true)}>
              {formatDisplayDate()}
            </button>

            {/* Date Picker Modal */}
            {showDatePicker && (
              <>
                <div className="date-picker-backdrop" onClick={() => setShowDatePicker(false)} />
                <div className="date-picker-modal" ref={datePickerRef}>
                  <div className="date-picker-header">
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

                  <div className="date-picker-content">
                    {/* Year Selector */}
                    <div className="date-picker-row">
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

                    {/* Year Dropdown */}
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

                    {/* Month Selector */}
                    <div className="date-picker-row">
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

                    {/* Day Selector (dla scale=day) */}
                    {popularScale === 'day' && (
                      <div className="day-grid">
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

                    {/* Week Selector (dla scale=week) */}
                    {popularScale === 'week' && (
                      <div className="week-grid">
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

                    {/* Month Selector (dla scale=month) */}
                    {popularScale === 'month' && (
                      <div className="month-confirm">
                        <button type="button" className="confirm-month-btn" onClick={selectMonth}>
                          Select {MONTH_NAMES[pickerMonth]} {pickerYear}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <button type="button" className="nav-arrow" onClick={() => changeDate('next')}>
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

          <div className="scale-selector">
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
        </div>
      )}
    </div>
  );
}
