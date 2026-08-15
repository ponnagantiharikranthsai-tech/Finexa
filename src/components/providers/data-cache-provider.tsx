"use client";

import React, { createContext, useContext, useRef, useCallback } from "react";

type CacheEntry<T = any> = {
  data: T;
  timestamp: number;
};

type DataCacheContextType = {
  getCache: <T>(key: string) => T | null;
  setCache: <T>(key: string, data: T) => void;
  invalidateCache: (key?: string) => void;
};

const DataCacheContext = createContext<DataCacheContextType | null>(null);

const DEFAULT_TTL = 1000 * 60 * 5; // 5 minutes cache TTL

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const getCache = useCallback(<T,>(key: string): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > DEFAULT_TTL;
    if (isExpired) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data as T;
  }, []);

  const setCache = useCallback(<T,>(key: string, data: T) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const invalidateCache = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  return (
    <DataCacheContext.Provider value={{ getCache, setCache, invalidateCache }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error("useDataCache must be used within a DataCacheProvider");
  }
  return context;
}
