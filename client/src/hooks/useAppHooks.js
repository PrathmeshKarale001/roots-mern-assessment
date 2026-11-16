import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const THEME_STORAGE_KEY = 'roots-ems-theme';

export function useTheme() {
  const [mode, setMode] = useState(() => {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved =
        mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
      document.documentElement.setAttribute('data-theme', resolved);
    };

    apply();
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);

    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);

  return { mode, setMode };
}

export function useDebounce(value, delayMs = 280) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Synchronizes search, filter, sort, and page state directly with the URL query string
 * so refreshing or sharing a URL restores the exact same server-queried view.
 */
export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {};
  Object.entries(defaults).forEach(([key, fallback]) => {
    const raw = searchParams.get(key);
    filters[key] = raw !== null ? raw : fallback;
  });

  const setFilter = useCallback(
    (updates, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, val]) => {
            const defaultVal = defaults[key] ?? '';
            if (
              val === undefined ||
              val === null ||
              String(val) === '' ||
              String(val) === String(defaultVal)
            ) {
              next.delete(key);
            } else {
              next.set(key, String(val));
            }
          });

          if (resetPage && !('page' in updates)) {
            next.delete('page');
          }
          return next;
        },
        { replace }
      );
    },
    [defaults, setSearchParams]
  );

  const resetAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: false });
  }, [setSearchParams]);

  return { filters, setFilter, resetAllFilters };
}
