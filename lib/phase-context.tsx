"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "nexium-selected-phase";

type PhaseContextValue = {
  /** List of phase names from the organisation (e.g. ["Phase 1", "Phase 2", ...]). */
  phases: string[];
  /** Currently selected phase for global filtering. Null means "All phases". */
  selectedPhase: string | null;
  /** Set the selected phase. Pass null for "All phases". */
  setSelectedPhase: (phase: string | null) => void;
  /** Whether phases are still loading from the API. */
  loading: boolean;
  /** Re-fetch phases from the API (e.g. after Settings save). */
  reloadPhases: () => Promise<void>;
};

const PhaseContext = createContext<PhaseContextValue | null>(null);

export function usePhase() {
  const ctx = useContext(PhaseContext);
  if (!ctx) {
    throw new Error("usePhase must be used within a PhaseProvider");
  }
  return ctx;
}

/** Optional hook: returns phase context or null if outside provider (e.g. login page). */
export function usePhaseOptional(): PhaseContextValue | null {
  return useContext(PhaseContext);
}

type PhaseProviderProps = {
  children: ReactNode;
};

export function PhaseProvider({ children }: PhaseProviderProps) {
  const [phases, setPhases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhaseState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored || null;
    } catch {
      return null;
    }
  });

  const setSelectedPhase = useCallback((phase: string | null) => {
    setSelectedPhaseState(phase);
    try {
      if (phase) localStorage.setItem(STORAGE_KEY, phase);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const reloadPhases = useCallback(async () => {
    try {
      const list = await api<string[]>("/api/quarters");
      setPhases(Array.isArray(list) ? list : []);
    } catch {
      setPhases([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<string[]>("/api/quarters")
      .then((list) => {
        if (cancelled) return;
        const next = Array.isArray(list) ? list : [];
        setPhases(next);
        setSelectedPhaseState((prev) => {
          if (prev && next.length > 0 && !next.includes(prev)) {
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              // ignore
            }
            return null;
          }
          return prev;
        });
      })
      .catch(() => {
        if (!cancelled) setPhases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<PhaseContextValue>(
    () => ({
      phases,
      selectedPhase,
      setSelectedPhase,
      loading,
      reloadPhases,
    }),
    [phases, selectedPhase, setSelectedPhase, loading, reloadPhases]
  );

  return (
    <PhaseContext.Provider value={value}>
      {children}
    </PhaseContext.Provider>
  );
}
