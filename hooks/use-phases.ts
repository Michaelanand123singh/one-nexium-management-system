"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { PHASES } from "@/lib/constants";

let cachedPhases: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

/**
 * Hook to fetch the organisation's phases list (roadmap/OKR stages).
 * Uses module-level cache so every component shares the same data.
 */
export function usePhases(): { phases: string[]; loading: boolean; refetch: () => void } {
    const [phases, setPhases] = useState<string[]>(cachedPhases ?? PHASES);
    const [loading, setLoading] = useState(!cachedPhases);
    const mounted = useRef(true);

    const fetchPhases = useCallback(async () => {
        if (cachedPhases && !fetchPromise) {
            setPhases(cachedPhases);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (!fetchPromise) {
                fetchPromise = api<string[]>("/api/quarters");
            }
            const data = await fetchPromise;
            const list = Array.isArray(data) ? data : PHASES;
            cachedPhases = list;
            if (mounted.current) {
                setPhases(list);
                setLoading(false);
            }
        } catch {
            if (mounted.current) {
                setPhases(PHASES);
                setLoading(false);
            }
        } finally {
            fetchPromise = null;
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        fetchPhases();
        return () => {
            mounted.current = false;
        };
    }, [fetchPhases]);

    const refetch = useCallback(() => {
        cachedPhases = null;
        fetchPromise = null;
        fetchPhases();
    }, [fetchPhases]);

    return { phases, loading, refetch };
}

/** Invalidate the phases cache (e.g. after updating phases in settings). */
export function invalidatePhasesCache() {
    cachedPhases = null;
    fetchPromise = null;
}
