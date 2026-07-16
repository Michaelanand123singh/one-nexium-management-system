"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

const DEFAULT_QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];

let cachedQuarters: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

/**
 * Hook to fetch the organisation's quarters list.
 * Uses module-level cache so every component shares the same data
 * without duplicate requests.
 */
export function useQuarters(): { quarters: string[]; loading: boolean; refetch: () => void } {
    const [quarters, setQuarters] = useState<string[]>(cachedQuarters ?? DEFAULT_QUARTERS);
    const [loading, setLoading] = useState(!cachedQuarters);
    const mounted = useRef(true);

    const fetchQuarters = useCallback(async () => {
        if (cachedQuarters && !fetchPromise) {
            setQuarters(cachedQuarters);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (!fetchPromise) {
                fetchPromise = api<string[]>("/api/quarters");
            }
            const data = await fetchPromise;
            const list = Array.isArray(data) ? data : DEFAULT_QUARTERS;
            cachedQuarters = list;
            if (mounted.current) {
                setQuarters(list);
                setLoading(false);
            }
        } catch {
            if (mounted.current) {
                setQuarters(DEFAULT_QUARTERS);
                setLoading(false);
            }
        } finally {
            fetchPromise = null;
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        fetchQuarters();
        return () => {
            mounted.current = false;
        };
    }, [fetchQuarters]);

    const refetch = useCallback(() => {
        cachedQuarters = null;
        fetchPromise = null;
        fetchQuarters();
    }, [fetchQuarters]);

    return { quarters, loading, refetch };
}

/**
 * Invalidate the quarters cache.
 * Call this after updating quarters from settings.
 */
export function invalidateQuartersCache() {
    cachedQuarters = null;
    fetchPromise = null;
}
