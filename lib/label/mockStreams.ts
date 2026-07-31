"use client";

/**
 * ВРЕМЕННО: данные по стримам мокаются в памяти клиента.
 *
 * Для них ещё нет таблицы в Supabase — раздел «Загрузка данных» описывает,
 * как они должны появляться (сейчас вручную, позже — импортом отчётов
 * стриминг-платформ), но сохраняются они только на время сессии вкладки
 * и общие между «Статистикой» и «Загрузкой данных» через этот модуль.
 * Нужна отдельная миграция (например, artist_stream_stats), прежде чем
 * это станет настоящими данными.
 */

export interface StreamEntry {
  streams: number;
  updatedAt: string; // ISO
}

const store = new Map<string, StreamEntry>();
const listeners = new Set<() => void>();

// useSyncExternalStore нужна ссылка, которая: (а) остаётся стабильной
// между рендерами, пока данные не менялись, и (б) меняется при мутации —
// поэтому храним отдельный кэш-снимок и обновляем его только в момент записи.
let snapshot: Map<string, StreamEntry> = new Map(store);

function commit() {
  snapshot = new Map(store);
  listeners.forEach((fn) => fn());
}

export function subscribeStreams(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStreams(artistId: string): StreamEntry | null {
  return store.get(artistId) ?? null;
}

export function getAllStreams(): Map<string, StreamEntry> {
  return snapshot;
}

export function setStreams(artistId: string, streams: number): void {
  store.set(artistId, { streams: Math.max(0, Math.round(streams)), updatedAt: new Date().toISOString() });
  commit();
}

/** Сеем правдоподобные значения один раз, чтобы демо не выглядело пустым. */
export function seedStreamsIfEmpty(artistIds: string[]): void {
  let changed = false;
  artistIds.forEach((id, i) => {
    if (!store.has(id)) {
      // Разные порядки величины, чтобы ранжирование в статистике было наглядным.
      const base = [812_400, 96_300, 214_800, 1_240_000, 58_900][i % 5];
      store.set(id, { streams: base, updatedAt: new Date().toISOString() });
      changed = true;
    }
  });
  if (changed) commit();
}
