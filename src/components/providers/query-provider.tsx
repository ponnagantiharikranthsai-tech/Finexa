"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

// Fast, non-blocking asynchronous storage driver powered by browser IndexedDB
const indexedDbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    try {
      const readPromise = get(key);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));
      const val = await Promise.race([readPromise, timeoutPromise]);
      return val ?? null;
    } catch (e) {
      console.warn("[INDEXEDDB READ WARNING]", e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      await set(key, value);
    } catch (e) {
      console.warn("[INDEXEDDB WRITE WARNING]", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      await del(key);
    } catch {}
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes fresh data window
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days IndexedDB offline persistence
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  const [persister] = useState(() => {
    if (typeof window === "undefined") return undefined;
    return createAsyncStoragePersister({
      storage: indexedDbStorage,
      key: "FINEXA_APP_OFFLINE_CACHE",
      throttleTime: 1000,
    });
  });

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
