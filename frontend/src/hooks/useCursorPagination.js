import { useState, useEffect, useRef, useCallback } from "react";

export function useCursorPagination(fetchFn) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const nextCursorRef = useRef(null);
  const fetchingRef = useRef(false);
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => { fetchFnRef.current = fetchFn; }, [fetchFn]);

  const sentinelRef = useRef(null);

  const doFetch = useCallback(async (cursor, isInitial) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setError(null);

    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await fetchFnRef.current(cursor);
      const { data = [], nextCursor = null, hasMore: more = false } = result || {};

      setItems((prev) => {
        if (isInitial) return data;
        const existingIds = new Set(prev.map((i) => String(i._id)));
        const fresh = data.filter((i) => !existingIds.has(String(i._id)));
        return [...prev, ...fresh];
      });

      nextCursorRef.current = nextCursor;
      setHasMore(more);
    } catch (err) {
      console.error("[useCursorPagination] fetch error:", err);
      setError(err.message || "Failed to load. Tap to retry.");
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    nextCursorRef.current = null;
    setItems([]);
    setHasMore(true);
    setError(null);
    doFetch(null, true);
  }, [fetchFn]);

  const loadMore = useCallback(() => {
    if (!hasMore || fetchingRef.current) return;
    doFetch(nextCursorRef.current, false);
  }, [hasMore, doFetch]);

  const reset = useCallback(() => {
    nextCursorRef.current = null;
    setItems([]);
    setHasMore(true);
    setError(null);
    fetchingRef.current = false;
    doFetch(null, true);
  }, [doFetch]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !fetchingRef.current) {
          doFetch(nextCursorRef.current, false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, doFetch]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reset,
    sentinelRef,
  };
}
