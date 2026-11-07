"use client";

import { useSyncExternalStore } from "react";

export interface LocalStore<T> {
  read: () => T;
  write: (next: T) => void;
  subscribe: (l: () => void) => () => void;
  fallback: T;
}

/**
 * A tiny localStorage-backed store for per-viewer conveniences (viewed loads, recent
 * searches). Read it with `useLocalStore` so the server render (no storage) and the
 * first client render agree, then the stored value appears.
 */
export function createLocalStore<T>(key: string, fallback: T): LocalStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache === undefined) {
      try {
        const raw = localStorage.getItem(key);
        cache = raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        cache = fallback;
      }
    }
    return cache;
  };

  const write = (next: T) => {
    cache = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in memory */
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };

  return { read, write, subscribe, fallback };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, () => store.fallback);
}
