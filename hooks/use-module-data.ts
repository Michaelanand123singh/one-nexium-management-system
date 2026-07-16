"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Fetch one or more API endpoints with shared loading/error/cancel behaviour.
 * Use for module pages that load multiple lists (e.g. roadmap + epics + milestones).
 */
export function useModuleData<T>(
  url: string,
  options?: { params?: Record<string, string>; toastError?: string }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const paramsKey = options?.params ? JSON.stringify(options.params) : "";
  const toastError = options?.toastError;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = paramsKey
        ? (JSON.parse(paramsKey) as Record<string, string>)
        : undefined;
      const result = await api<T>(url, { params });
      setData(result);
      return result;
    } catch {
      setError(true);
      if (toastError) toast.error(toastError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, paramsKey, toastError]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = paramsKey
      ? (JSON.parse(paramsKey) as Record<string, string>)
      : undefined;
    api<T>(url, { params })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          if (toastError) toast.error(toastError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, paramsKey, toastError]);

  return { data, loading, error, refetch };
}

/**
 * Fetch multiple URLs in parallel with a single loading state.
 * Use for module pages that need e.g. [items, epics, milestones].
 */
export function useModuleDataMany<T extends unknown[]>(
  urls: string[],
  options?: { toastError?: string }
): {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<T | null>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const urlsKey = urls.join(",");
  const toastError = options?.toastError;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const results = (await Promise.all(
        urlsKey.split(",").filter(Boolean).map((u) => api(u))
      )) as T;
      setData(results);
      return results;
    } catch {
      setError(true);
      if (toastError) toast.error(toastError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [urlsKey, toastError]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all(urlsKey.split(",").filter(Boolean).map((u) => api(u)))
      .then((results) => {
        if (!cancelled) setData(results as T);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          if (toastError) toast.error(toastError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlsKey, toastError]);

  return { data, loading, error, refetch };
}
