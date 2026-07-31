"use client";

/**
 * ВРЕМЕННО: чёрный список артистов мокается в памяти клиента.
 * Нужна отдельная миграция (например, artists.blacklisted boolean или
 * отдельная таблица label_blacklist) и RLS-политики, прежде чем это
 * будет реально влиять на доступ артиста к кабинету.
 */

const blocked = new Set<string>();
const listeners = new Set<() => void>();

// Как и в mockStreams: useSyncExternalStore нужен кэшированный снимок,
// который меняет ссылку только при реальной мутации.
let snapshot: Set<string> = new Set(blocked);

function commit() {
  snapshot = new Set(blocked);
  listeners.forEach((fn) => fn());
}

export function subscribeBlacklist(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBlacklist(): Set<string> {
  return snapshot;
}

export function isBlacklisted(artistId: string): boolean {
  return blocked.has(artistId);
}

export function toggleBlacklisted(artistId: string): void {
  if (blocked.has(artistId)) blocked.delete(artistId);
  else blocked.add(artistId);
  commit();
}
