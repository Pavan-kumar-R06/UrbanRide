import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/* Stale-while-revalidate: show the last result instantly, refresh it quietly in the background.
   The cache is cleared on every login/logout so one user's data is never shown to another. */
const store = new Map();
export const getCached = path => store.get(path)?.data;
export const setCached = (path, data) => store.set(path, { data, at: Date.now() });
export const clearCache = () => store.clear();
export const prefetch = path => api(path).then(d => { setCached(path, d); return d; }).catch(() => null);

export function useCachedApi(path, onError) {
  const [data, setData] = useState(() => getCached(path));
  const [loading, setLoading] = useState(() => !getCached(path));
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await api(path);
      setCached(path, d);
      if (alive.current) setData(d);
    } catch (e) { if (onError) onError(e); }
    finally { if (alive.current) { setLoading(false); setRefreshing(false); } }
  }, [path]); // eslint-disable-line
  useEffect(() => {
    const c = getCached(path);
    if (c) { setData(c); setLoading(false); }   // otherwise keep showing the previous result while the new one loads
    reload();
  }, [path]); // eslint-disable-line
  const replace = d => { setCached(path, d); setData(d); };
  return { data, loading, refreshing, reload, replace };
}
