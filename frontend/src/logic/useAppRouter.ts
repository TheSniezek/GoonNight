import { useCallback, useEffect, useRef } from 'react';
import type { Order, PopularScale } from '../api/types';

export type AppRoute =
  | { type: 'posts'; tags: string; order: Order }
  | { type: 'popular'; scale: PopularScale; date: string }
  | { type: 'post'; id: number; tags: string; order: Order }
  | { type: 'favorites'; userId: string };

const SESSION_ROUTE_KEY = 'appRoute';

export function saveRouteToSession(route: AppRoute) {
  if (route.type === 'post') return;
  sessionStorage.setItem(SESSION_ROUTE_KEY, JSON.stringify(route));
}

export function loadRouteFromSession(): AppRoute | null {
  try {
    const raw = sessionStorage.getItem(SESSION_ROUTE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppRoute;
  } catch {
    return null;
  }
}

function parseRoute(): AppRoute {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);

  const postMatch = path.match(/^\/posts\/(\d+)$/);
  if (postMatch) {
    return {
      type: 'post',
      id: parseInt(postMatch[1], 10),
      tags: search.get('tags') ?? '',
      order: (search.get('order') as Order) ?? 'id_desc',
    };
  }

  if (path === '/popular') {
    return {
      type: 'popular',
      scale: (search.get('scale') as PopularScale) ?? 'day',
      date: search.get('date') ?? new Date().toISOString().split('T')[0],
    };
  }

  if (path === '/favorites') {
    return {
      type: 'favorites',
      userId: search.get('user_id') ?? '',
    };
  }

  const tags = search.get('tags') ?? '';
  const order = (search.get('order') as Order) ?? 'id_desc';
  return { type: 'posts', tags, order };
}

function buildPostsUrl(tags: string, order: Order): string {
  const p = new URLSearchParams();
  if (tags) p.set('tags', tags);
  if (order && order !== 'id_desc') p.set('order', order);
  const qs = p.toString();
  return '/posts' + (qs ? '?' + qs : '');
}

function buildPopularUrl(scale: PopularScale, date: string): string {
  const p = new URLSearchParams({ scale, date });
  return '/popular?' + p.toString();
}

function buildPostUrl(id: number, tags: string, order: Order): string {
  const p = new URLSearchParams();
  if (tags) p.set('tags', tags);
  if (order && order !== 'id_desc') p.set('order', order);
  const qs = p.toString();
  return `/posts/${id}` + (qs ? '?' + qs : '');
}

interface UseAppRouterOptions {
  onNavigate: (route: AppRoute) => void;
}

export function useAppRouter({ onNavigate }: UseAppRouterOptions) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    const handlePop = () => {
      const route = parseRoute();
      saveRouteToSession(route);
      onNavigateRef.current(route);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigateToPosts = useCallback((tags: string, order: Order) => {
    const route: AppRoute = { type: 'posts', tags, order };
    window.history.pushState(route, '', buildPostsUrl(tags, order));
    saveRouteToSession(route);
  }, []);

  const navigateToPopular = useCallback((scale: PopularScale, date: string) => {
    const route: AppRoute = { type: 'popular', scale, date };
    window.history.pushState(route, '', buildPopularUrl(scale, date));
    saveRouteToSession(route);
  }, []);

  const navigateToPost = useCallback((id: number, tags: string, order: Order) => {
    const route: AppRoute = { type: 'post', id, tags, order };
    window.history.pushState(route, '', buildPostUrl(id, tags, order));
  }, []);

  const replaceRoute = useCallback((tags: string, order: Order) => {
    const route: AppRoute = { type: 'posts', tags, order };
    window.history.replaceState(route, '', buildPostsUrl(tags, order));
    saveRouteToSession(route);
  }, []);

  const replacePopular = useCallback((scale: PopularScale, date: string) => {
    const route: AppRoute = { type: 'popular', scale, date };
    window.history.replaceState(route, '', buildPopularUrl(scale, date));
    saveRouteToSession(route);
  }, []);

  const navigateToFavorites = useCallback((userId: string) => {
    const route: AppRoute = { type: 'favorites', userId };
    window.history.pushState(route, '', '/favorites?user_id=' + encodeURIComponent(userId));
    saveRouteToSession(route);
  }, []);

  return {
    parseRoute,
    navigateToPosts,
    navigateToPopular,
    navigateToPost,
    navigateToFavorites,
    replaceRoute,
    replacePopular,
  };
}
