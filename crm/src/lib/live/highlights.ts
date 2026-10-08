'use client';

import { useSyncExternalStore } from 'react';

// Tiny external store: ids of rows/cards a teammate changed in the last few seconds.
const TTL = 3600;
const expiry = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function markChanged(ids: (string | null | undefined)[]) {
  const until = Date.now() + TTL;
  let any = false;
  for (const id of ids) {
    if (!id) continue;
    expiry.set(id, until);
    any = true;
    setTimeout(() => {
      if ((expiry.get(id) ?? 0) <= Date.now()) {
        expiry.delete(id);
        emit();
      }
    }, TTL + 50);
  }
  if (any) emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** True for ~3.5 seconds after another user changed the entity. */
export function useIsHighlighted(id: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (id ? (expiry.get(id) ?? 0) > Date.now() : false),
    () => false,
  );
}

export function _versionForTests() { return version; }
